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

  # Schema - standard attributes only
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

  # Read/write attributes
  read_attributes  = ["email", "email_verified", "name", "preferred_username"]
  write_attributes = ["email", "name", "preferred_username"]

  # Prevent user existence errors (security best practice)
  prevent_user_existence_errors = "ENABLED"
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

