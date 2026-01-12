# ==============================================================================
# NETKNIFE - ACM CERTIFICATE MODULE
# ==============================================================================
# This module creates an ACM certificate for the custom domain.
#
# IMPORTANT: CloudFront requires certificates in us-east-1, so this module
# uses a separate provider alias for that region.
#
# Validation:
# - Uses DNS validation via Cloudflare
# - Automatically creates validation CNAME records
# - Waits for certificate to be issued
# ==============================================================================

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = ">= 5.0"
      configuration_aliases = [aws.acm]
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 5.0"
    }
  }
}

# ------------------------------------------------------------------------------
# VARIABLES
# ------------------------------------------------------------------------------

variable "domain" {
  type        = string
  description = "Domain name for the certificate (e.g., tools.alexflux.com)"
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone ID for DNS validation records"
}

variable "project" {
  type        = string
  description = "Project name for tagging"
}

variable "env" {
  type        = string
  description = "Environment name for tagging"
}

# ------------------------------------------------------------------------------
# ACM CERTIFICATE (us-east-1)
# ------------------------------------------------------------------------------
# CloudFront requires certificates in us-east-1, regardless of where your
# other resources are located. This uses the "acm" provider alias.

resource "aws_acm_certificate" "cert" {
  # Use the acm provider (us-east-1)
  provider = aws.acm

  domain_name       = var.domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Project     = var.project
    Environment = var.env
    Purpose     = "CloudFront custom domain certificate"
  }
}

# ------------------------------------------------------------------------------
# CAA RECORDS FOR AMAZON
# ------------------------------------------------------------------------------
# CAA records authorize which CAs can issue certificates for the domain.
# Amazon/AWS must be authorized to issue certificates for ACM to work.

resource "cloudflare_dns_record" "caa_amazon" {
  zone_id = var.cloudflare_zone_id
  name    = "@"  # Root domain (alexflux.com)
  type    = "CAA"
  ttl     = 300
  data = {
    flags = "0"
    tag   = "issue"
    value = "amazon.com"
  }
  comment = "Allow AWS ACM to issue certificates"
}

resource "cloudflare_dns_record" "caa_amazontrust" {
  zone_id = var.cloudflare_zone_id
  name    = "@"  # Root domain
  type    = "CAA"
  ttl     = 300
  data = {
    flags = "0"
    tag   = "issue"
    value = "amazontrust.com"
  }
  comment = "Allow AWS ACM to issue certificates"
}

# ------------------------------------------------------------------------------
# CLOUDFLARE DNS VALIDATION RECORDS
# ------------------------------------------------------------------------------
# Creates the CNAME records required for ACM DNS validation.

resource "cloudflare_dns_record" "validation" {
  for_each = {
    for dvo in aws_acm_certificate.cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = var.cloudflare_zone_id
  name    = each.value.name
  content = each.value.record
  type    = each.value.type
  ttl     = 60
  proxied = false  # Validation records cannot be proxied

  comment = "ACM DNS validation for ${var.domain}"
}

# ------------------------------------------------------------------------------
# CERTIFICATE VALIDATION
# ------------------------------------------------------------------------------
# Waits for the certificate to be issued after DNS validation records are created.

resource "aws_acm_certificate_validation" "cert" {
  provider = aws.acm

  certificate_arn         = aws_acm_certificate.cert.arn
  # Use the domain validation options directly - no need to reference Cloudflare
  validation_record_fqdns = [for dvo in aws_acm_certificate.cert.domain_validation_options : dvo.resource_record_name]

  # Ensure DNS records and CAA records are created first
  depends_on = [
    cloudflare_dns_record.validation,
    cloudflare_dns_record.caa_amazon,
    cloudflare_dns_record.caa_amazontrust,
  ]

  timeouts {
    create = "10m"
  }
}

# ------------------------------------------------------------------------------
# OUTPUTS
# ------------------------------------------------------------------------------

output "certificate_arn" {
  value       = aws_acm_certificate.cert.arn
  description = "ACM certificate ARN (for CloudFront viewer_certificate)"
}

output "certificate_status" {
  value       = aws_acm_certificate.cert.status
  description = "Certificate status (should be ISSUED)"
}

output "validation_complete" {
  value       = aws_acm_certificate_validation.cert.id != ""
  description = "Whether certificate validation is complete"
}

