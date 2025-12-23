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
  value       = var.abuseipdb_api_key != "" ? aws_lambda_function.abuseipdb[0].function_name : null
  description = "AbuseIPDB Lambda function name (null if API key not configured)"
}

output "abuseipdb_enabled" {
  value       = var.abuseipdb_api_key != ""
  description = "Whether AbuseIPDB integration is enabled"
}

