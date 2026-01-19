# ==============================================================================
# NETKNIFE - COGNITO AUTHENTICATION MODULE
# ==============================================================================
# This module creates AWS Cognito User Pool for authentication.
# Self-signup enabled: users can create accounts; free = local tools, Pro ($5/mo) = remote/AWS tools.
#
# Security Features:
# - Self-signup enabled (Create account on login page)
# - Email verification for new sign-ups
# - Strong password requirements (14+ chars, mixed case, numbers, symbols)
# - OAuth 2.0 / OIDC authorization code flow
# - Token-based authentication for API access
#
# Integration:
# - Frontend uses OIDC client to authenticate via Cognito Hosted UI
# - API Gateway uses JWT authorizer to validate Cognito tokens
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
    null = {
      source  = "hashicorp/null"
      version = ">= 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
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

variable "callback_urls" {
  type        = list(string)
  description = "Allowed OAuth callback URLs (e.g., https://yoursite.com/callback)"
}

variable "logout_urls" {
  type        = list(string)
  description = "Allowed logout redirect URLs (e.g., https://yoursite.com/)"
}

variable "signup_notification_email" {
  type        = string
  default     = ""
  description = "Email to notify on each new sign-up. Leave empty to disable notifications."
}

# Get current AWS region
data "aws_region" "current" {}

# Random suffix for globally unique Cognito domain
resource "random_id" "domain_suffix" {
  byte_length = 4
}

# ------------------------------------------------------------------------------
# COGNITO USER POOL
# ------------------------------------------------------------------------------
# The user pool stores user accounts and handles authentication.
# Configured for maximum security with admin-only user creation.

resource "aws_cognito_user_pool" "main" {
  name = "${var.project}-${var.env}-users"

  # Self-signup enabled: users can create accounts via Hosted UI "Create account"
  # Admin can still create users; invite template used for admin-created only
  admin_create_user_config {
    allow_admin_create_user_only = false

    invite_message_template {
      email_subject = "Your NetKnife account"
      email_message = "Your NetKnife username is {username}. Temporary password: {####}"
      sms_message   = "Your NetKnife username is {username}. Temporary password: {####}"
    }
  }

  # Strong password policy
  password_policy {
    minimum_length                   = 14      # 14+ characters
    require_lowercase                = true    # At least one lowercase letter
    require_uppercase                = true    # At least one uppercase letter
    require_numbers                  = true    # At least one number
    require_symbols                  = true    # At least one special character
    temporary_password_validity_days = 7       # Temp passwords expire in 7 days
  }

  # Username configuration
  username_configuration {
    case_sensitive = false  # Usernames are case-insensitive
  }

  # Account recovery (disabled - admin manages accounts)
  account_recovery_setting {
    recovery_mechanism {
      name     = "admin_only"
      priority = 1
    }
  }

  # MFA configuration (optional - can enable later)
  mfa_configuration = "OFF"

  # Email verification for self-signup (Cognito sends code to verify email)
  auto_verified_attributes = ["email"]

  # Schema - standard attributes (required/min_length cannot be changed after creation).
  # Cognito Hosted UI often does NOT show optional attributes (email, phone_number) at
  # sign-up. Use the in-app /signup page to collect email and phone; it calls SignUp
  # with UserAttributes so they are stored and included in signup notifications.
  schema {
    name                     = "email"
    attribute_data_type      = "String"
    mutable                  = true
    required                 = false
    string_attribute_constraints {
      min_length = 0
      max_length = 256
    }
  }
  schema {
    name                     = "phone_number"
    attribute_data_type      = "String"
    mutable                  = true
    required                 = false
    string_attribute_constraints {
      min_length = 0
      max_length = 256
    }
  }

  # PreSignUp: auto-confirm, auto-verify email/phone, and failsafe (signups_enabled in DynamoDB)
  # PostConfirmation: SNS notification for each new sign-up
  lambda_config {
    pre_sign_up       = aws_lambda_function.cognito_triggers.arn
    post_confirmation = aws_lambda_function.cognito_triggers.arn
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

# ------------------------------------------------------------------------------
# COGNITO USER POOL DOMAIN
# ------------------------------------------------------------------------------
# Creates a hosted UI domain for login/logout flows.
# Users will be redirected here for authentication.

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project}-${var.env}-${random_id.domain_suffix.hex}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# ------------------------------------------------------------------------------
# COGNITO USER POOL CLIENT (SPA Application)
# ------------------------------------------------------------------------------
# App client configuration for the React frontend.
# Uses OAuth 2.0 authorization code flow with PKCE (implicit for SPA).

resource "aws_cognito_user_pool_client" "spa" {
  name         = "${var.project}-${var.env}-spa-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # SPA clients should NOT have a client secret
  # (secrets can't be kept secret in browser code)
  generate_secret = false

  # OAuth 2.0 configuration
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]  # Authorization code flow
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  # Callback/redirect URLs
  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  # Identity providers (just Cognito for now)
  supported_identity_providers = ["COGNITO"]

  # Allowed authentication flows
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",        # Secure Remote Password (recommended)
    "ALLOW_REFRESH_TOKEN_AUTH",   # Allow token refresh
    "ALLOW_USER_PASSWORD_AUTH"    # Direct username/password (for testing)
  ]

  # Token validity periods
  access_token_validity  = 60   # 60 minutes
  id_token_validity      = 60   # 60 minutes
  refresh_token_validity = 30   # 30 days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Read/write attributes (email, phone so Hosted UI collects and we can store them)
  read_attributes  = ["email", "email_verified", "name", "preferred_username", "phone_number", "phone_number_verified"]
  write_attributes = ["email", "name", "preferred_username", "phone_number"]

  # Prevent user existence errors (security best practice)
  prevent_user_existence_errors = "ENABLED"
}

# ------------------------------------------------------------------------------
# AUTH CONFIG (DynamoDB) — failsafe and feature flags
# ------------------------------------------------------------------------------
# Item id=CONFIG, signups_enabled (bool). If signups_enabled=false, PreSignUp
# rejects new self-signups. Omit or true = allow. Not managed by Terraform so
# you can toggle without apply. Table created here; put-item via CLI or Console.

resource "aws_dynamodb_table" "auth_config" {
  name         = "${var.project}-${var.env}-auth-config"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Project     = var.project
    Environment = var.env
    Purpose     = "Auth config signups failsafe"
  }
}

# ------------------------------------------------------------------------------
# SIGNUPS (DynamoDB) — email, phone, username per user
# ------------------------------------------------------------------------------
# PostConfirmation writes here. pk = Cognito sub. Optional TTL for cleanup.

resource "aws_dynamodb_table" "signups" {
  name         = "${var.project}-${var.env}-signups"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  tags = {
    Project     = var.project
    Environment = var.env
    Purpose     = "Sign-up email and phone storage"
  }
}

# ------------------------------------------------------------------------------
# SNS — sign-up notifications
# ------------------------------------------------------------------------------
# PostConfirmation publishes to this topic. Email subscription must be confirmed.

resource "aws_sns_topic" "signup_notifications" {
  count  = var.signup_notification_email != "" ? 1 : 0
  name   = "${var.project}-${var.env}-signup-notifications"
  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_sns_topic_subscription" "signup_notifications_email" {
  count     = var.signup_notification_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.signup_notifications[0].arn
  protocol  = "email"
  endpoint  = var.signup_notification_email
}

# ------------------------------------------------------------------------------
# COGNITO TRIGGERS LAMBDA (PreSignUp + PostConfirmation)
# ------------------------------------------------------------------------------

resource "null_resource" "cognito_triggers_npm" {
  triggers = {
    pkg = filemd5("${path.module}/../../../backend/functions/cognito-triggers/package.json")
    idx = filemd5("${path.module}/../../../backend/functions/cognito-triggers/index.js")
  }
  provisioner "local-exec" {
    command     = "npm install --omit=dev"
    working_dir = "${path.module}/../../../backend/functions/cognito-triggers"
  }
}

data "archive_file" "cognito_triggers_zip" {
  depends_on  = [null_resource.cognito_triggers_npm]
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/functions/cognito-triggers"
  output_path = "${path.module}/cognito-triggers.zip"
}

resource "aws_iam_role" "cognito_triggers" {
  name = "${var.project}-${var.env}-cognito-triggers-role"

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

resource "aws_iam_role_policy_attachment" "cognito_triggers_logs" {
  role       = aws_iam_role.cognito_triggers.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "cognito_triggers_ddb_sns" {
  name   = "${var.project}-${var.env}-cognito-triggers-ddb-sns"
  role   = aws_iam_role.cognito_triggers.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Effect   = "Allow"
          Action   = ["dynamodb:GetItem"]
          Resource = aws_dynamodb_table.auth_config.arn
        },
        {
          Effect   = "Allow"
          Action   = ["dynamodb:PutItem"]
          Resource = aws_dynamodb_table.signups.arn
        }
      ],
      var.signup_notification_email != "" ? [{
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = aws_sns_topic.signup_notifications[0].arn
      }] : []
    )
  })
}

resource "aws_lambda_function" "cognito_triggers" {
  function_name = "${var.project}-${var.env}-cognito-triggers"
  role          = aws_iam_role.cognito_triggers.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = data.archive_file.cognito_triggers_zip.output_path
  source_code_hash = data.archive_file.cognito_triggers_zip.output_base64sha256

  timeout     = 10
  memory_size = 128

  environment {
    variables = {
      CONFIG_TABLE_NAME   = aws_dynamodb_table.auth_config.name
      SIGNUPS_TABLE_NAME  = aws_dynamodb_table.signups.name
      SNS_TOPIC_ARN       = var.signup_notification_email != "" ? aws_sns_topic.signup_notifications[0].arn : ""
    }
  }
  tags = {
    Project     = var.project
    Environment = var.env
  }
}

resource "aws_lambda_permission" "cognito_triggers" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_triggers.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

# ------------------------------------------------------------------------------
# OUTPUTS
# ------------------------------------------------------------------------------

output "user_pool_id" {
  value       = aws_cognito_user_pool.main.id
  description = "Cognito User Pool ID"
}

output "user_pool_arn" {
  value       = aws_cognito_user_pool.main.arn
  description = "Cognito User Pool ARN"
}

output "client_id" {
  value       = aws_cognito_user_pool_client.spa.id
  description = "Cognito App Client ID for the SPA"
}

output "domain" {
  value       = aws_cognito_user_pool_domain.main.domain
  description = "Cognito Hosted UI domain prefix"
}

output "domain_url" {
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.id}.amazoncognito.com"
  description = "Full Cognito Hosted UI domain URL"
}

output "issuer" {
  value       = "https://cognito-idp.${data.aws_region.current.id}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  description = "OIDC issuer URL for JWT validation"
}

output "auth_config_table_name" {
  value       = aws_dynamodb_table.auth_config.name
  description = "DynamoDB table for auth config (failsafe: put id=CONFIG, signups_enabled=false to disable sign-ups)"
}

output "cognito_triggers_lambda_name" {
  value       = aws_lambda_function.cognito_triggers.function_name
  description = "Lambda used for PreSignUp and PostConfirmation triggers"
}

output "signups_table_name" {
  value       = aws_dynamodb_table.signups.name
  description = "DynamoDB table storing sign-up email and phone (pk = Cognito sub)"
}

