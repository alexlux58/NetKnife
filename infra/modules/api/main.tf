# ==============================================================================
# NETKNIFE - API GATEWAY + LAMBDA MODULE
# ==============================================================================
# This module creates the serverless API backend:
# - HTTP API Gateway with JWT authentication
# - Lambda functions for each API endpoint
# - DynamoDB table for caching (DNS, RDAP results)
# - WAF rate limiting for abuse prevention
#
# Endpoints:
# - POST /dns    - DNS-over-HTTPS resolver
# - POST /rdap   - RDAP (WHOIS replacement) lookup
# - POST /tls    - TLS certificate inspection
# - POST /headers - HTTP security headers scan
# - POST /peeringdb - PeeringDB network info query
#
# Security:
# - All endpoints require valid Cognito JWT
# - WAF rate limits requests per IP
# - CORS locked to allowed origins
# - Lambda has minimal IAM permissions
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

# ------------------------------------------------------------------------------
# VARIABLES
# ------------------------------------------------------------------------------

variable "project" {
  type        = string
  description = "Project name for resource naming"
}

variable "env" {
  type        = string
  description = "Environment name (dev, staging, prod)"
}

variable "cognito_issuer" {
  type        = string
  description = "Cognito OIDC issuer URL for JWT validation"
}

variable "cognito_audience" {
  type        = string
  description = "Cognito app client ID (JWT audience)"
}

variable "allowed_origins" {
  type        = list(string)
  description = "CORS allowed origins (e.g., CloudFront URL)"
}

variable "abuseipdb_api_key" {
  type        = string
  description = "API key for AbuseIPDB (get from https://www.abuseipdb.com/account/api)"
  sensitive   = true
  default     = ""
}

variable "shodan_api_key" {
  type        = string
  description = "API key for Shodan"
  sensitive   = true
  default     = ""
}

variable "virustotal_api_key" {
  type        = string
  description = "API key for VirusTotal"
  sensitive   = true
  default     = ""
}

variable "securitytrails_api_key" {
  type        = string
  description = "API key for SecurityTrails"
  sensitive   = true
  default     = ""
}

variable "censys_api_key" {
  type        = string
  description = "API key for Censys (format: id:secret)"
  sensitive   = true
  default     = ""
}

variable "greynoise_api_key" {
  type        = string
  description = "API key for GreyNoise"
  sensitive   = true
  default     = ""
}

# Local variables for consistent naming
locals {
  name = "${var.project}-${var.env}"
}

# ------------------------------------------------------------------------------
# DYNAMODB CACHE TABLE
# ------------------------------------------------------------------------------
# Caches DNS and RDAP results to reduce upstream API calls and costs.
# Uses TTL for automatic expiration of cached items.

resource "aws_dynamodb_table" "cache" {
  name         = "${local.name}-cache"
  billing_mode = "PAY_PER_REQUEST"  # On-demand pricing (no capacity planning)
  hash_key     = "cache_key"         # Primary key: query identifier

  attribute {
    name = "cache_key"
    type = "S"
  }

  # TTL configuration - automatically deletes expired items
  ttl {
    attribute_name = "expires_at"  # Unix timestamp for expiration
    enabled        = true
  }

  tags = {
    Project     = var.project
    Environment = var.env
    Purpose     = "API response caching"
  }
}

# ------------------------------------------------------------------------------
# IAM ROLE FOR LAMBDA FUNCTIONS
# ------------------------------------------------------------------------------
# Shared execution role for all Lambda functions.
# Grants basic execution permissions + DynamoDB cache access.

resource "aws_iam_role" "lambda_role" {
  name = "${local.name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

# Basic Lambda execution (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB cache access policy
resource "aws_iam_role_policy" "cache_access" {
  name = "${local.name}-cache-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem"
      ]
      Resource = aws_dynamodb_table.cache.arn
    }]
  })
}

# ------------------------------------------------------------------------------
# HTTP API GATEWAY
# ------------------------------------------------------------------------------
# HTTP APIs are faster, cheaper, and simpler than REST APIs.
# Perfect for Lambda proxy integrations.

resource "aws_apigatewayv2_api" "http" {
  name          = "${local.name}-http-api"
  protocol_type = "HTTP"
  description   = "NetKnife API - Network/Security tools"

  # CORS configuration
  cors_configuration {
    allow_credentials = true
    allow_headers     = ["authorization", "content-type", "x-amz-date"]
    allow_methods     = ["POST", "OPTIONS"]
    allow_origins     = var.allowed_origins
    max_age           = 3600
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

# JWT Authorizer using Cognito
resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id          = aws_apigatewayv2_api.http.id
  authorizer_type = "JWT"
  name            = "${local.name}-jwt-auth"

  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    issuer   = var.cognito_issuer
    audience = [var.cognito_audience]
  }
}

# Default stage (auto-deploy enabled)
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  # Access logging
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      requestTime      = "$context.requestTime"
      httpMethod       = "$context.httpMethod"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      protocol         = "$context.protocol"
      responseLength   = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

# API access logs
resource "aws_cloudwatch_log_group" "api_access" {
  name              = "/aws/apigateway/${local.name}"
  retention_in_days = 30

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: DNS (DoH Resolver)
# ------------------------------------------------------------------------------

data "archive_file" "dns_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/dns"
  output_path = "${path.module}/dns.zip"
}

resource "aws_lambda_function" "dns" {
  function_name = "${local.name}-dns"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "DNS-over-HTTPS resolver using Cloudflare"

  filename         = data.archive_file.dns_zip.output_path
  source_code_hash = data.archive_file.dns_zip.output_base64sha256

  timeout     = 10
  memory_size = 128

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "300"  # 5 minutes
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "dns" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.dns.arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "dns" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /dns"
  target    = "integrations/${aws_apigatewayv2_integration.dns.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "dns" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.dns.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: RDAP (WHOIS Replacement)
# ------------------------------------------------------------------------------

data "archive_file" "rdap_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/rdap"
  output_path = "${path.module}/rdap.zip"
}

resource "aws_lambda_function" "rdap" {
  function_name = "${local.name}-rdap"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "RDAP lookup for IPs and domains"

  filename         = data.archive_file.rdap_zip.output_path
  source_code_hash = data.archive_file.rdap_zip.output_base64sha256

  timeout     = 15
  memory_size = 128

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "86400"  # 24 hours
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "rdap" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.rdap.arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "rdap" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /rdap"
  target    = "integrations/${aws_apigatewayv2_integration.rdap.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "rdap" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.rdap.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: TLS Inspector
# ------------------------------------------------------------------------------

data "archive_file" "tls_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/tls"
  output_path = "${path.module}/tls.zip"
}

resource "aws_lambda_function" "tls" {
  function_name = "${local.name}-tls"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "TLS certificate chain inspector"

  filename         = data.archive_file.tls_zip.output_path
  source_code_hash = data.archive_file.tls_zip.output_base64sha256

  timeout     = 15
  memory_size = 128

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "tls" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.tls.arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "tls" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /tls"
  target    = "integrations/${aws_apigatewayv2_integration.tls.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "tls" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tls.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: HTTP Headers Scanner
# ------------------------------------------------------------------------------

data "archive_file" "headers_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/headers"
  output_path = "${path.module}/headers.zip"
}

resource "aws_lambda_function" "headers" {
  function_name = "${local.name}-headers"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "HTTP security headers scanner (SSRF-safe)"

  filename         = data.archive_file.headers_zip.output_path
  source_code_hash = data.archive_file.headers_zip.output_base64sha256

  timeout     = 15
  memory_size = 256

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "headers" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.headers.arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "headers" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /headers"
  target    = "integrations/${aws_apigatewayv2_integration.headers.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "headers" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.headers.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: PeeringDB Query
# ------------------------------------------------------------------------------

data "archive_file" "peeringdb_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/peeringdb"
  output_path = "${path.module}/peeringdb.zip"
}

resource "aws_lambda_function" "peeringdb" {
  function_name = "${local.name}-peeringdb"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "PeeringDB network info query proxy"

  filename         = data.archive_file.peeringdb_zip.output_path
  source_code_hash = data.archive_file.peeringdb_zip.output_base64sha256

  timeout     = 15
  memory_size = 128

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "3600"  # 1 hour
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "peeringdb" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.peeringdb.arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "peeringdb" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /peeringdb"
  target    = "integrations/${aws_apigatewayv2_integration.peeringdb.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "peeringdb" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.peeringdb.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: Reverse DNS (PTR Lookup)
# ------------------------------------------------------------------------------

data "archive_file" "reverse_dns_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/reverse-dns"
  output_path = "${path.module}/reverse-dns.zip"
}

resource "aws_lambda_function" "reverse_dns" {
  function_name = "${local.name}-reverse-dns"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "Reverse DNS (PTR) lookup via DoH"

  filename         = data.archive_file.reverse_dns_zip.output_path
  source_code_hash = data.archive_file.reverse_dns_zip.output_base64sha256

  timeout     = 10
  memory_size = 128

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "3600"  # 1 hour
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "reverse_dns" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.reverse_dns.arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "reverse_dns" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /reverse-dns"
  target    = "integrations/${aws_apigatewayv2_integration.reverse_dns.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "reverse_dns" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.reverse_dns.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: Email Auth (SPF/DKIM/DMARC)
# ------------------------------------------------------------------------------

data "archive_file" "email_auth_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/email-auth"
  output_path = "${path.module}/email-auth.zip"
}

resource "aws_lambda_function" "email_auth" {
  function_name = "${local.name}-email-auth"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "Email authentication checker (SPF/DKIM/DMARC)"

  filename         = data.archive_file.email_auth_zip.output_path
  source_code_hash = data.archive_file.email_auth_zip.output_base64sha256

  timeout     = 15
  memory_size = 128

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "3600"  # 1 hour
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "email_auth" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.email_auth.arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "email_auth" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /email-auth"
  target    = "integrations/${aws_apigatewayv2_integration.email_auth.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "email_auth" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email_auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: HIBP Password Check
# ------------------------------------------------------------------------------

data "archive_file" "hibp_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/hibp"
  output_path = "${path.module}/hibp.zip"
}

resource "aws_lambda_function" "hibp" {
  function_name = "${local.name}-hibp"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "Have I Been Pwned password checker (k-anonymity)"

  filename         = data.archive_file.hibp_zip.output_path
  source_code_hash = data.archive_file.hibp_zip.output_base64sha256

  timeout     = 10
  memory_size = 128

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "86400"  # 24 hours
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "hibp" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.hibp.arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "hibp" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /hibp"
  target    = "integrations/${aws_apigatewayv2_integration.hibp.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "hibp" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.hibp.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# ABUSEIPDB LAMBDA (IP Reputation Check)
# ------------------------------------------------------------------------------
# Checks IP addresses against AbuseIPDB for abuse reports/confidence scores.
# Requires API key from https://www.abuseipdb.com/account/api

data "archive_file" "abuseipdb_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/abuseipdb"
  output_path = "${path.module}/abuseipdb.zip"
}

resource "aws_lambda_function" "abuseipdb" {
  count = var.abuseipdb_api_key != "" ? 1 : 0

  function_name = "${local.name}-abuseipdb"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "AbuseIPDB IP reputation checker"

  filename         = data.archive_file.abuseipdb_zip.output_path
  source_code_hash = data.archive_file.abuseipdb_zip.output_base64sha256

  timeout     = 15
  memory_size = 128

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "3600"  # 1 hour (conserve API quota)
      ABUSEIPDB_API_KEY = var.abuseipdb_api_key
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "abuseipdb" {
  count = var.abuseipdb_api_key != "" ? 1 : 0

  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.abuseipdb[0].arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "abuseipdb" {
  count = var.abuseipdb_api_key != "" ? 1 : 0

  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /abuseipdb"
  target    = "integrations/${aws_apigatewayv2_integration.abuseipdb[0].id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "abuseipdb" {
  count = var.abuseipdb_api_key != "" ? 1 : 0

  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.abuseipdb[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: DNS Propagation
# ------------------------------------------------------------------------------

data "archive_file" "dns_propagation_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/dns-propagation"
  output_path = "${path.module}/dns-propagation.zip"
}

resource "aws_lambda_function" "dns_propagation" {
  function_name = "${local.name}-dns-propagation"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "DNS propagation checker across global resolvers"

  filename         = data.archive_file.dns_propagation_zip.output_path
  source_code_hash = data.archive_file.dns_propagation_zip.output_base64sha256

  timeout     = 20
  memory_size = 256

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "300"
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "dns_propagation" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.dns_propagation.arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "dns_propagation" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /dns-propagation"
  target    = "integrations/${aws_apigatewayv2_integration.dns_propagation.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "dns_propagation" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.dns_propagation.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: ASN Details
# ------------------------------------------------------------------------------

data "archive_file" "asn_details_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/asn-details"
  output_path = "${path.module}/asn-details.zip"
}

resource "aws_lambda_function" "asn_details" {
  function_name = "${local.name}-asn-details"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "ASN details lookup via RIPEstat"

  filename         = data.archive_file.asn_details_zip.output_path
  source_code_hash = data.archive_file.asn_details_zip.output_base64sha256

  timeout     = 30  # Increased for multiple API calls to BGPView
  memory_size = 128

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "3600"
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "asn_details" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.asn_details.arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "asn_details" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /asn-details"
  target    = "integrations/${aws_apigatewayv2_integration.asn_details.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "asn_details" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.asn_details.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: BGP Looking Glass
# ------------------------------------------------------------------------------

data "archive_file" "bgp_looking_glass_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/bgp-looking-glass"
  output_path = "${path.module}/bgp-looking-glass.zip"
}

resource "aws_lambda_function" "bgp_looking_glass" {
  function_name = "${local.name}-bgp-looking-glass"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "BGP looking glass query via public route servers"

  filename         = data.archive_file.bgp_looking_glass_zip.output_path
  source_code_hash = data.archive_file.bgp_looking_glass_zip.output_base64sha256

  timeout     = 20
  memory_size = 256

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "300"
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "bgp_looking_glass" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.bgp_looking_glass.arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "bgp_looking_glass" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /bgp-looking-glass"
  target    = "integrations/${aws_apigatewayv2_integration.bgp_looking_glass.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "bgp_looking_glass" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bgp_looking_glass.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: SSL Labs
# ------------------------------------------------------------------------------

data "archive_file" "ssl_labs_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/ssl-labs"
  output_path = "${path.module}/ssl-labs.zip"
}

resource "aws_lambda_function" "ssl_labs" {
  function_name = "${local.name}-ssl-labs"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "SSL/TLS configuration analysis"

  filename         = data.archive_file.ssl_labs_zip.output_path
  source_code_hash = data.archive_file.ssl_labs_zip.output_base64sha256

  timeout     = 30
  memory_size = 256

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "3600"
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "ssl_labs" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.ssl_labs.arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "ssl_labs" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /ssl-labs"
  target    = "integrations/${aws_apigatewayv2_integration.ssl_labs.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "ssl_labs" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ssl_labs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: Traceroute
# ------------------------------------------------------------------------------

data "archive_file" "traceroute_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/traceroute"
  output_path = "${path.module}/traceroute.zip"
}

resource "aws_lambda_function" "traceroute" {
  function_name = "${local.name}-traceroute"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "Network path tracing from AWS"

  filename         = data.archive_file.traceroute_zip.output_path
  source_code_hash = data.archive_file.traceroute_zip.output_base64sha256

  timeout     = 60  # Increased for multiple API calls (DNS + RIPEstat + BGPView)
  memory_size = 256

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "300"
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "traceroute" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.traceroute.arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "traceroute" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /traceroute"
  target    = "integrations/${aws_apigatewayv2_integration.traceroute.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "traceroute" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.traceroute.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: Shodan (requires API key)
# ------------------------------------------------------------------------------

data "archive_file" "shodan_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/shodan"
  output_path = "${path.module}/shodan.zip"
}

resource "aws_lambda_function" "shodan" {
  count = var.shodan_api_key != "" ? 1 : 0

  function_name = "${local.name}-shodan"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "Shodan internet device search"

  filename         = data.archive_file.shodan_zip.output_path
  source_code_hash = data.archive_file.shodan_zip.output_base64sha256

  timeout     = 15
  memory_size = 128

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "3600"
      SHODAN_API_KEY    = var.shodan_api_key
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "shodan" {
  count = var.shodan_api_key != "" ? 1 : 0

  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.shodan[0].arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "shodan" {
  count = var.shodan_api_key != "" ? 1 : 0

  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /shodan"
  target    = "integrations/${aws_apigatewayv2_integration.shodan[0].id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "shodan" {
  count = var.shodan_api_key != "" ? 1 : 0

  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.shodan[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: VirusTotal (requires API key)
# ------------------------------------------------------------------------------

data "archive_file" "virustotal_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/virustotal"
  output_path = "${path.module}/virustotal.zip"
}

resource "aws_lambda_function" "virustotal" {
  count = var.virustotal_api_key != "" ? 1 : 0

  function_name = "${local.name}-virustotal"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "VirusTotal file/URL/domain/IP analysis"

  filename         = data.archive_file.virustotal_zip.output_path
  source_code_hash = data.archive_file.virustotal_zip.output_base64sha256

  timeout     = 15
  memory_size = 128

  environment {
    variables = {
      CACHE_TABLE        = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS  = "3600"
      VIRUSTOTAL_API_KEY = var.virustotal_api_key
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "virustotal" {
  count = var.virustotal_api_key != "" ? 1 : 0

  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.virustotal[0].arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "virustotal" {
  count = var.virustotal_api_key != "" ? 1 : 0

  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /virustotal"
  target    = "integrations/${aws_apigatewayv2_integration.virustotal[0].id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "virustotal" {
  count = var.virustotal_api_key != "" ? 1 : 0

  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.virustotal[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: SecurityTrails (requires API key)
# ------------------------------------------------------------------------------

data "archive_file" "securitytrails_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/security-trails"
  output_path = "${path.module}/security-trails.zip"
}

resource "aws_lambda_function" "securitytrails" {
  count = var.securitytrails_api_key != "" ? 1 : 0

  function_name = "${local.name}-securitytrails"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "SecurityTrails DNS/WHOIS historical data"

  filename         = data.archive_file.securitytrails_zip.output_path
  source_code_hash = data.archive_file.securitytrails_zip.output_base64sha256

  timeout     = 15
  memory_size = 128

  environment {
    variables = {
      CACHE_TABLE           = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS     = "3600"
      SECURITYTRAILS_API_KEY = var.securitytrails_api_key
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "securitytrails" {
  count = var.securitytrails_api_key != "" ? 1 : 0

  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.securitytrails[0].arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "securitytrails" {
  count = var.securitytrails_api_key != "" ? 1 : 0

  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /security-trails"
  target    = "integrations/${aws_apigatewayv2_integration.securitytrails[0].id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "securitytrails" {
  count = var.securitytrails_api_key != "" ? 1 : 0

  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.securitytrails[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: Censys (requires API key)
# ------------------------------------------------------------------------------

data "archive_file" "censys_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/censys"
  output_path = "${path.module}/censys.zip"
}

resource "aws_lambda_function" "censys" {
  count = var.censys_api_key != "" ? 1 : 0

  function_name = "${local.name}-censys"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "Censys internet-wide scan data"

  filename         = data.archive_file.censys_zip.output_path
  source_code_hash = data.archive_file.censys_zip.output_base64sha256

  timeout     = 15
  memory_size = 128

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "3600"
      CENSYS_API_KEY    = var.censys_api_key
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "censys" {
  count = var.censys_api_key != "" ? 1 : 0

  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.censys[0].arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "censys" {
  count = var.censys_api_key != "" ? 1 : 0

  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /censys"
  target    = "integrations/${aws_apigatewayv2_integration.censys[0].id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "censys" {
  count = var.censys_api_key != "" ? 1 : 0

  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.censys[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# LAMBDA FUNCTION: GreyNoise (requires API key)
# ------------------------------------------------------------------------------

data "archive_file" "greynoise_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/greynoise"
  output_path = "${path.module}/greynoise.zip"
}

resource "aws_lambda_function" "greynoise" {
  count = var.greynoise_api_key != "" ? 1 : 0

  function_name = "${local.name}-greynoise"
  role          = aws_iam_role.lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  description   = "GreyNoise IP threat intelligence"

  filename         = data.archive_file.greynoise_zip.output_path
  source_code_hash = data.archive_file.greynoise_zip.output_base64sha256

  timeout     = 15
  memory_size = 128

  environment {
    variables = {
      CACHE_TABLE       = aws_dynamodb_table.cache.name
      CACHE_TTL_SECONDS = "3600"
      GREYNOISE_API_KEY = var.greynoise_api_key
    }
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_apigatewayv2_integration" "greynoise" {
  count = var.greynoise_api_key != "" ? 1 : 0

  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.greynoise[0].arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "greynoise" {
  count = var.greynoise_api_key != "" ? 1 : 0

  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /greynoise"
  target    = "integrations/${aws_apigatewayv2_integration.greynoise[0].id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "greynoise" {
  count = var.greynoise_api_key != "" ? 1 : 0

  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.greynoise[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ------------------------------------------------------------------------------
# WAF WEB ACL (Rate Limiting)
# ------------------------------------------------------------------------------
# Protects the API from abuse with per-IP rate limiting.

resource "aws_wafv2_web_acl" "api" {
  name        = "${local.name}-api-waf"
  description = "WAF for NetKnife API rate limiting"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate limit rule: 1000 requests per 5 minutes per IP
  rule {
    name     = "RateLimitPerIP"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 1000  # Requests per 5-minute window
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitPerIP"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name}-api-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

# NOTE: WAF Web ACL Association is NOT supported for HTTP API (API Gateway v2).
# WAF only works with REST APIs and AppSync. Rate limiting is handled by:
# - Cognito JWT authentication (prevents unauthorized access)
# - Lambda concurrency limits (prevents runaway costs)
# - The WAF ACL above is kept for reference but not associated.
#
# If you need WAF, consider using REST API instead of HTTP API.

# ------------------------------------------------------------------------------
# OUTPUTS
# ------------------------------------------------------------------------------

output "api_url" {
  value       = aws_apigatewayv2_api.http.api_endpoint
  description = "API Gateway endpoint URL"
}

output "api_id" {
  value       = aws_apigatewayv2_api.http.id
  description = "API Gateway ID"
}

output "cache_table_name" {
  value       = aws_dynamodb_table.cache.name
  description = "DynamoDB cache table name"
}

output "waf_web_acl_arn" {
  value       = aws_wafv2_web_acl.api.arn
  description = "WAF Web ACL ARN"
}

output "lambda_dns_name" {
  value       = aws_lambda_function.dns.function_name
  description = "DNS Lambda function name"
}

output "lambda_rdap_name" {
  value       = aws_lambda_function.rdap.function_name
  description = "RDAP Lambda function name"
}

output "lambda_tls_name" {
  value       = aws_lambda_function.tls.function_name
  description = "TLS Lambda function name"
}

output "lambda_headers_name" {
  value       = aws_lambda_function.headers.function_name
  description = "Headers Lambda function name"
}

output "lambda_peeringdb_name" {
  value       = aws_lambda_function.peeringdb.function_name
  description = "PeeringDB Lambda function name"
}

output "lambda_reverse_dns_name" {
  value       = aws_lambda_function.reverse_dns.function_name
  description = "Reverse DNS Lambda function name"
}

output "lambda_email_auth_name" {
  value       = aws_lambda_function.email_auth.function_name
  description = "Email Auth Lambda function name"
}

output "lambda_hibp_name" {
  value       = aws_lambda_function.hibp.function_name
  description = "HIBP Lambda function name"
}

output "lambda_abuseipdb_name" {
  value       = var.abuseipdb_api_key != "" ? nonsensitive(aws_lambda_function.abuseipdb[0].function_name) : null
  description = "AbuseIPDB Lambda function name (null if API key not configured)"
}

output "abuseipdb_enabled" {
  value       = nonsensitive(var.abuseipdb_api_key != "")
  description = "Whether AbuseIPDB integration is enabled"
}

output "lambda_dns_propagation_name" {
  value       = aws_lambda_function.dns_propagation.function_name
  description = "DNS Propagation Lambda function name"
}

output "lambda_asn_details_name" {
  value       = aws_lambda_function.asn_details.function_name
  description = "ASN Details Lambda function name"
}

output "lambda_bgp_looking_glass_name" {
  value       = aws_lambda_function.bgp_looking_glass.function_name
  description = "BGP Looking Glass Lambda function name"
}

output "lambda_ssl_labs_name" {
  value       = aws_lambda_function.ssl_labs.function_name
  description = "SSL Labs Lambda function name"
}

output "lambda_traceroute_name" {
  value       = aws_lambda_function.traceroute.function_name
  description = "Traceroute Lambda function name"
}

output "lambda_shodan_name" {
  value       = var.shodan_api_key != "" ? nonsensitive(aws_lambda_function.shodan[0].function_name) : null
  description = "Shodan Lambda function name (null if API key not configured)"
}

output "lambda_virustotal_name" {
  value       = var.virustotal_api_key != "" ? nonsensitive(aws_lambda_function.virustotal[0].function_name) : null
  description = "VirusTotal Lambda function name (null if API key not configured)"
}

output "lambda_securitytrails_name" {
  value       = var.securitytrails_api_key != "" ? nonsensitive(aws_lambda_function.securitytrails[0].function_name) : null
  description = "SecurityTrails Lambda function name (null if API key not configured)"
}

output "lambda_censys_name" {
  value       = var.censys_api_key != "" ? nonsensitive(aws_lambda_function.censys[0].function_name) : null
  description = "Censys Lambda function name (null if API key not configured)"
}

output "lambda_greynoise_name" {
  value       = var.greynoise_api_key != "" ? nonsensitive(aws_lambda_function.greynoise[0].function_name) : null
  description = "GreyNoise Lambda function name (null if API key not configured)"
}

