# ==============================================================================
# NETKNIFE - DEVELOPMENT ENVIRONMENT
# ==============================================================================
# This file wires together all modules for the dev environment.
# It creates:
# - Static website hosting (S3 + CloudFront) with optional custom domain
# - ACM certificate for HTTPS (in us-east-1 for CloudFront)
# - Cloudflare DNS records
# - Cognito authentication (single user, no self-signup)
# - API Gateway + Lambda functions
# - Monitoring and alerting
# - Cost management
#
# Deployment:
#   cd infra/envs/dev
#   terraform init
#   terraform plan
#   terraform apply
# ==============================================================================

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 5.0"
    }
  }

  # Uncomment and configure for remote state storage
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "netknife/dev/terraform.tfstate"
  #   region         = "us-west-2"
  #   dynamodb_table = "your-terraform-lock-table"
  #   encrypt        = true
  # }
}

# ------------------------------------------------------------------------------
# PROVIDERS
# ------------------------------------------------------------------------------

# Main AWS provider (your primary region)
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.env
      ManagedBy   = "Terraform"
    }
  }
}

# AWS provider for ACM certificates (CloudFront requires us-east-1)
provider "aws" {
  alias  = "acm"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.env
      ManagedBy   = "Terraform"
    }
  }
}

# AWS provider for cost management (us-east-1)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.env
      ManagedBy   = "Terraform"
    }
  }
}

# Cloudflare provider for DNS management
# Uses CLOUDFLARE_API_TOKEN environment variable
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ------------------------------------------------------------------------------
# VARIABLES
# ------------------------------------------------------------------------------

variable "project" {
  type        = string
  default     = "netknife"
  description = "Project name"
}

variable "env" {
  type        = string
  default     = "dev"
  description = "Environment name"
}

variable "aws_region" {
  type        = string
  default     = "us-west-2"
  description = "AWS region for deployment"
}

variable "site_bucket_name" {
  type        = string
  description = "S3 bucket name for static site (must be globally unique)"
}

variable "alert_email" {
  type        = string
  description = "Email address for monitoring alerts"
}

variable "monthly_budget_usd" {
  type        = number
  default     = 25
  description = "Monthly cost budget in USD"
}

# Custom domain configuration
variable "custom_domain" {
  type        = string
  default     = ""
  description = "Custom domain for the site (e.g., tools.alexflux.com). Leave empty to use CloudFront domain."
}

variable "cloudflare_zone_id" {
  type        = string
  default     = ""
  description = "Cloudflare zone ID for DNS management. Required if custom_domain is set."
}

variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "Cloudflare API token for DNS management. Required if custom_domain is set."
}

variable "abuseipdb_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "API key for AbuseIPDB IP reputation checks. Get from https://www.abuseipdb.com/account/api"
}

variable "shodan_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "API key for Shodan. Get from https://account.shodan.io"
}

variable "virustotal_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "API key for VirusTotal. Get from https://www.virustotal.com/gui/my-apikey"
}

variable "securitytrails_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "API key for SecurityTrails. Get from https://securitytrails.com/app/account/credentials"
}

variable "censys_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "API key for Censys (format: id:secret). Get from https://censys.io/account/api"
}

variable "greynoise_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "API key for GreyNoise. Get from https://viz.greynoise.io/account/api-key"
}

# ------------------------------------------------------------------------------
# ACM CERTIFICATE MODULE (for custom domain)
# ------------------------------------------------------------------------------
# Creates an SSL certificate in us-east-1 (required for CloudFront)
# Only created if custom_domain is set

module "acm" {
  source = "../../modules/acm"
  count  = var.custom_domain != "" ? 1 : 0

  providers = {
    aws.acm    = aws.acm
    cloudflare = cloudflare
  }

  domain             = var.custom_domain
  cloudflare_zone_id = var.cloudflare_zone_id
  project            = var.project
  env                = var.env
}

# ------------------------------------------------------------------------------
# STATIC SITE MODULE
# ------------------------------------------------------------------------------

module "static_site" {
  source = "../../modules/static_site"

  providers = {
    aws        = aws
    cloudflare = cloudflare
  }

  project     = var.project
  env         = var.env
  bucket_name = var.site_bucket_name

  # Custom domain configuration (optional)
  custom_domain       = var.custom_domain
  acm_certificate_arn = var.custom_domain != "" ? module.acm[0].certificate_arn : ""
  cloudflare_zone_id  = var.cloudflare_zone_id
}

# Site URL for other modules (uses custom domain if set)
locals {
  site_url = var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${module.static_site.cloudfront_domain}"
}

# ------------------------------------------------------------------------------
# AUTH MODULE (Cognito)
# ------------------------------------------------------------------------------

module "auth" {
  source = "../../modules/auth"

  project = var.project
  env     = var.env

  # OAuth callback/redirect URLs
  callback_urls = ["${local.site_url}/callback"]
  logout_urls   = ["${local.site_url}/", "${local.site_url}/login"]
}

# ------------------------------------------------------------------------------
# API MODULE (API Gateway + Lambda)
# ------------------------------------------------------------------------------

module "api" {
  source = "../../modules/api"

  project = var.project
  env     = var.env

  # Cognito JWT validation
  cognito_issuer   = module.auth.issuer
  cognito_audience = module.auth.client_id

  # CORS: only allow requests from our site
  allowed_origins = [local.site_url]

  # Optional API key integrations (leave empty to disable)
  abuseipdb_api_key      = var.abuseipdb_api_key
  shodan_api_key         = var.shodan_api_key
  virustotal_api_key     = var.virustotal_api_key
  securitytrails_api_key = var.securitytrails_api_key
  censys_api_key         = var.censys_api_key
  greynoise_api_key      = var.greynoise_api_key
}

# ------------------------------------------------------------------------------
# OPS MODULE (Monitoring & Alerting)
# ------------------------------------------------------------------------------

module "ops" {
  source = "../../modules/ops"

  name_prefix = "${var.project}-${var.env}"
  alert_email = var.alert_email

  # API Gateway monitoring
  api_id    = module.api.api_id
  api_stage = "$default"

  # Lambda functions to monitor
  # Use nonsensitive() because function names are not secrets, even though
  # some are conditionally created based on sensitive API keys
  # compact() removes nulls (for disabled integrations)
  lambda_function_names = nonsensitive(compact([
    # Core functions (always enabled)
    module.api.lambda_dns_name,
    module.api.lambda_rdap_name,
    module.api.lambda_tls_name,
    module.api.lambda_headers_name,
    module.api.lambda_peeringdb_name,
    module.api.lambda_reverse_dns_name,
    module.api.lambda_email_auth_name,
    module.api.lambda_hibp_name,
    module.api.lambda_dns_propagation_name,
    module.api.lambda_asn_details_name,
    module.api.lambda_bgp_looking_glass_name,
    module.api.lambda_ssl_labs_name,
    module.api.lambda_traceroute_name,
    # Optional functions (null if API key not configured)
    module.api.lambda_abuseipdb_name,
    module.api.lambda_shodan_name,
    module.api.lambda_virustotal_name,
    module.api.lambda_securitytrails_name,
    module.api.lambda_censys_name,
    module.api.lambda_greynoise_name,
  ]))

  # WAF logging
  enable_waf_logging = true
  waf_web_acl_arn    = module.api.waf_web_acl_arn
  waf_log_group_name = "aws-waf-logs-${var.project}-${var.env}"
}

# ------------------------------------------------------------------------------
# COST MODULE (Budgets & Anomaly Detection)
# ------------------------------------------------------------------------------

module "cost" {
  source = "../../modules/cost"

  providers = {
    aws = aws.us_east_1
  }

  name_prefix              = "${var.project}-${var.env}"
  alerts_topic_arn         = module.ops.alerts_topic_arn
  monthly_budget_usd       = var.monthly_budget_usd
  enable_anomaly_detection = false  # Disabled: AWS account limit exceeded
}

# ------------------------------------------------------------------------------
# OUTPUTS
# ------------------------------------------------------------------------------

output "site_url" {
  value       = local.site_url
  description = "Website URL (custom domain or CloudFront)"
}

output "cloudfront_domain" {
  value       = module.static_site.cloudfront_domain
  description = "CloudFront distribution domain"
}

output "api_url" {
  value       = module.api.api_url
  description = "API Gateway endpoint URL"
}

output "bucket_name" {
  value       = module.static_site.bucket_name
  description = "S3 bucket for static site files"
}

output "cloudfront_id" {
  value       = module.static_site.cloudfront_id
  description = "CloudFront distribution ID (for cache invalidation)"
}

output "user_pool_id" {
  value       = module.auth.user_pool_id
  description = "Cognito User Pool ID"
}

output "client_id" {
  value       = module.auth.client_id
  description = "Cognito App Client ID"
}

output "cognito_domain" {
  value       = module.auth.domain
  description = "Cognito Hosted UI domain prefix"
}

output "cognito_domain_url" {
  value       = module.auth.domain_url
  description = "Full Cognito Hosted UI URL"
}

output "cognito_issuer" {
  value       = module.auth.issuer
  description = "Cognito OIDC issuer URL"
}

output "cache_table_name" {
  value       = module.api.cache_table_name
  description = "DynamoDB cache table"
}

output "alerts_topic_arn" {
  value       = module.ops.alerts_topic_arn
  description = "SNS topic for alerts"
}
