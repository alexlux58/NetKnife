# ==============================================================================
# NETKNIFE - LABS MODULE (Kali VM infrastructure)
# ==============================================================================

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.0"
    }
  }
}

variable "project" {
  type = string
}

variable "env" {
  type = string
}

variable "api_id" {
  type        = string
  description = "Existing API Gateway HTTP API ID"
}

variable "authorizer_id" {
  type        = string
  description = "JWT authorizer ID from api module"
}

variable "execution_arn" {
  type        = string
  description = "API Gateway execution ARN for Lambda permissions"
}

variable "kali_ami_id" {
  type        = string
  default     = ""
  description = "Packer-built Kali AMI ID. Leave empty to disable lab launches."
}

variable "site_url" {
  type = string
}

variable "stripe_secret_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "stripe_lab_starter_price_id" {
  type    = string
  default = ""
}

variable "stripe_lab_standard_price_id" {
  type    = string
  default = ""
}

variable "stripe_lab_power_price_id" {
  type    = string
  default = ""
}

variable "billing_exempt_usernames" {
  type    = string
  default = "alex.lux"
}

variable "billing_table_name" {
  type        = string
  description = "Existing billing DynamoDB table name"
}

variable "lambda_deps_trigger" {
  type = any
}

locals {
  name     = "${var.project}-${var.env}"
  enabled  = var.kali_ami_id != ""
  vpc_cidr = "10.42.0.0/16"
}

# ------------------------------------------------------------------------------
# VPC (minimal, private subnet + NAT for outbound tool updates)
# ------------------------------------------------------------------------------

resource "aws_vpc" "labs" {
  count                = local.enabled ? 1 : 0
  cidr_block           = local.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = { Name = "${local.name}-labs-vpc" }
}

resource "aws_internet_gateway" "labs" {
  count  = local.enabled ? 1 : 0
  vpc_id = aws_vpc.labs[0].id
  tags   = { Name = "${local.name}-labs-igw" }
}

resource "aws_subnet" "labs_private" {
  count                   = local.enabled ? 1 : 0
  vpc_id                  = aws_vpc.labs[0].id
  cidr_block              = cidrsubnet(local.vpc_cidr, 8, 1)
  availability_zone       = data.aws_availability_zones.available[0].names[0]
  map_public_ip_on_launch = false
  tags                    = { Name = "${local.name}-labs-private" }
}

resource "aws_subnet" "labs_public" {
  count                   = local.enabled ? 1 : 0
  vpc_id                  = aws_vpc.labs[0].id
  cidr_block              = cidrsubnet(local.vpc_cidr, 8, 0)
  availability_zone       = data.aws_availability_zones.available[0].names[0]
  map_public_ip_on_launch = true
  tags                    = { Name = "${local.name}-labs-public" }
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_eip" "labs_nat" {
  count  = local.enabled ? 1 : 0
  domain = "vpc"
  tags   = { Name = "${local.name}-labs-nat-eip" }
}

resource "aws_nat_gateway" "labs" {
  count         = local.enabled ? 1 : 0
  allocation_id = aws_eip.labs_nat[0].id
  subnet_id     = aws_subnet.labs_public[0].id
  tags          = { Name = "${local.name}-labs-nat" }
}

resource "aws_route_table" "labs_public" {
  count  = local.enabled ? 1 : 0
  vpc_id = aws_vpc.labs[0].id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.labs[0].id
  }
  tags = { Name = "${local.name}-labs-public-rt" }
}

resource "aws_route_table" "labs_private" {
  count  = local.enabled ? 1 : 0
  vpc_id = aws_vpc.labs[0].id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.labs[0].id
  }
  tags = { Name = "${local.name}-labs-private-rt" }
}

resource "aws_route_table_association" "labs_public" {
  count          = local.enabled ? 1 : 0
  subnet_id      = aws_subnet.labs_public[0].id
  route_table_id = aws_route_table.labs_public[0].id
}

resource "aws_route_table_association" "labs_private" {
  count          = local.enabled ? 1 : 0
  subnet_id      = aws_subnet.labs_private[0].id
  route_table_id = aws_route_table.labs_private[0].id
}

# SSM VPC endpoints (avoid NAT for Session Manager)
resource "aws_vpc_endpoint" "ssm" {
  count             = local.enabled ? 1 : 0
  vpc_id            = aws_vpc.labs[0].id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.ssm"
  vpc_endpoint_type = "Interface"
  subnet_ids        = [aws_subnet.labs_private[0].id]
  security_group_ids = [aws_security_group.labs_endpoint[0].id]
  private_dns_enabled = true
}

resource "aws_vpc_endpoint" "ssmmessages" {
  count             = local.enabled ? 1 : 0
  vpc_id            = aws_vpc.labs[0].id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.ssmmessages"
  vpc_endpoint_type = "Interface"
  subnet_ids        = [aws_subnet.labs_private[0].id]
  security_group_ids = [aws_security_group.labs_endpoint[0].id]
  private_dns_enabled = true
}

resource "aws_vpc_endpoint" "ec2messages" {
  count             = local.enabled ? 1 : 0
  vpc_id            = aws_vpc.labs[0].id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.ec2messages"
  vpc_endpoint_type = "Interface"
  subnet_ids        = [aws_subnet.labs_private[0].id]
  security_group_ids = [aws_security_group.labs_endpoint[0].id]
  private_dns_enabled = true
}

data "aws_region" "current" {}

resource "aws_security_group" "labs_endpoint" {
  count       = local.enabled ? 1 : 0
  name        = "${local.name}-labs-endpoint-sg"
  description = "SSM VPC endpoint"
  vpc_id      = aws_vpc.labs[0].id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [local.vpc_cidr]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "labs_instance" {
  count       = local.enabled ? 1 : 0
  name        = "${local.name}-labs-instance-sg"
  description = "Kali lab instances - egress only"
  vpc_id      = aws_vpc.labs[0].id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-labs-instance-sg" }
}

# ------------------------------------------------------------------------------
# IAM for EC2 instances (SSM only)
# ------------------------------------------------------------------------------

resource "aws_iam_role" "lab_instance" {
  count = local.enabled ? 1 : 0
  name  = "${local.name}-lab-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lab_ssm" {
  count      = local.enabled ? 1 : 0
  role       = aws_iam_role.lab_instance[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "lab_instance" {
  count = local.enabled ? 1 : 0
  name  = "${local.name}-lab-instance"
  role  = aws_iam_role.lab_instance[0].name
}

# ------------------------------------------------------------------------------
# DynamoDB: labs sessions
# ------------------------------------------------------------------------------

resource "aws_dynamodb_table" "labs" {
  count        = local.enabled ? 1 : 0
  name         = "${local.name}-labs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled      = true
  }

  tags = { Name = "${local.name}-labs" }
}

# ------------------------------------------------------------------------------
# Lambda: labs API
# ------------------------------------------------------------------------------

resource "aws_iam_role" "labs_lambda" {
  count = local.enabled ? 1 : 0
  name  = "${local.name}-labs-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "labs_lambda_basic" {
  count      = local.enabled ? 1 : 0
  role       = aws_iam_role.labs_lambda[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "labs_lambda" {
  count = local.enabled ? 1 : 0
  name  = "${local.name}-labs-lambda"
  role  = aws_iam_role.labs_lambda[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"]
        Resource = [aws_dynamodb_table.labs[0].arn]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
        Resource = "arn:aws:dynamodb:*:*:table/${var.billing_table_name}"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:RunInstances",
          "ec2:TerminateInstances",
          "ec2:DescribeInstances",
          "ec2:CreateTags",
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = [aws_iam_role.lab_instance[0].arn]
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:DescribeInstanceInformation"]
        Resource = "*"
      },
    ]
  })
}

data "archive_file" "labs_zip" {
  count       = local.enabled ? 1 : 0
  depends_on  = [var.lambda_deps_trigger]
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/labs"
  output_path = "${path.module}/labs.zip"
}

resource "aws_lambda_function" "labs" {
  count         = local.enabled ? 1 : 0
  function_name = "${local.name}-labs"
  role          = aws_iam_role.labs_lambda[0].arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "Kali Lab VM lifecycle and billing"

  filename         = data.archive_file.labs_zip[0].output_path
  source_code_hash = data.archive_file.labs_zip[0].output_base64sha256
  timeout          = 60
  memory_size      = 256

  environment {
    variables = {
      LABS_TABLE                   = aws_dynamodb_table.labs[0].name
      BILLING_TABLE                = var.billing_table_name
      KALI_AMI_ID                  = var.kali_ami_id
      LAB_SUBNET_ID                = aws_subnet.labs_private[0].id
      LAB_SG_ID                    = aws_security_group.labs_instance[0].id
      LAB_INSTANCE_PROFILE         = aws_iam_instance_profile.lab_instance[0].name
      SITE_URL                     = var.site_url
      STRIPE_SECRET_KEY            = var.stripe_secret_key
      STRIPE_LAB_STARTER_PRICE_ID    = var.stripe_lab_starter_price_id
      STRIPE_LAB_STANDARD_PRICE_ID   = var.stripe_lab_standard_price_id
      STRIPE_LAB_POWER_PRICE_ID      = var.stripe_lab_power_price_id
      BILLING_EXEMPT_USERNAMES     = var.billing_exempt_usernames
    }
  }
}

resource "aws_apigatewayv2_integration" "labs" {
  count              = local.enabled ? 1 : 0
  api_id             = var.api_id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.labs[0].arn
  integration_method = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "labs" {
  count              = local.enabled ? 1 : 0
  api_id             = var.api_id
  route_key          = "POST /labs"
  target             = "integrations/${aws_apigatewayv2_integration.labs[0].id}"
  authorization_type = "JWT"
  authorizer_id      = var.authorizer_id
}

resource "aws_lambda_permission" "labs" {
  count         = local.enabled ? 1 : 0
  statement_id  = "AllowAPIGatewayLabs"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.labs[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# EventBridge: sweeper for expired labs (every 5 min)
# ------------------------------------------------------------------------------

resource "aws_cloudwatch_event_rule" "labs_sweeper" {
  count               = local.enabled ? 1 : 0
  name                = "${local.name}-labs-sweeper"
  description         = "Terminate expired Kali labs"
  schedule_expression = "rate(5 minutes)"
}

resource "aws_lambda_permission" "labs_sweeper" {
  count         = local.enabled ? 1 : 0
  statement_id  = "AllowEventBridgeSweeper"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.labs[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.labs_sweeper[0].arn
}

# ------------------------------------------------------------------------------
# OUTPUTS
# ------------------------------------------------------------------------------

output "labs_lambda_name" {
  value       = local.enabled ? aws_lambda_function.labs[0].function_name : null
  description = "Labs Lambda function name"
}

output "labs_table_name" {
  value       = local.enabled ? aws_dynamodb_table.labs[0].name : null
  description = "Labs DynamoDB table"
}

output "enabled" {
  value       = local.enabled
  description = "Whether labs module is active (kali_ami_id set)"
}
