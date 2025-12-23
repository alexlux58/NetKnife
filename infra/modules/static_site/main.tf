# ==============================================================================
# NETKNIFE - STATIC SITE TERRAFORM MODULE
# ==============================================================================
# This module creates a secure, globally-distributed static website hosting
# infrastructure using AWS S3 and CloudFront.
#
# Architecture:
# - S3 bucket (PRIVATE) stores the static website files
# - CloudFront CDN serves content globally with HTTPS
# - Origin Access Control (OAC) ensures S3 is only accessible via CloudFront
# - Security headers are automatically added to all responses
# - Optional custom domain with ACM certificate and Cloudflare DNS
#
# Security Features:
# - S3 bucket is completely private (no public access)
# - All traffic is forced to HTTPS
# - Security headers: HSTS, X-Frame-Options, X-Content-Type-Options, etc.
# - CloudFront uses latest TLS protocols
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
}

# ------------------------------------------------------------------------------
# VARIABLES
# ------------------------------------------------------------------------------

variable "bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name for hosting static site files"
}

variable "project" {
  type        = string
  description = "Project name used for resource naming and tagging"
}

variable "env" {
  type        = string
  description = "Environment name (dev, staging, prod)"
}

# Custom domain configuration (optional)
variable "custom_domain" {
  type        = string
  description = "Custom domain for the site (e.g., tools.alexflux.com). Leave empty to use CloudFront domain."
  default     = ""
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM certificate ARN for custom domain (must be in us-east-1). Required if custom_domain is set."
  default     = ""
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone ID for DNS record creation. Required if custom_domain is set."
  default     = ""
}

variable "enable_cloudflare_proxy" {
  type        = bool
  description = "Enable Cloudflare proxy (orange cloud) for DNS record. Recommended: false for CloudFront."
  default     = false
}

# ------------------------------------------------------------------------------
# S3 BUCKET - Private storage for static site files
# ------------------------------------------------------------------------------
# The bucket is completely private - no public access is allowed.
# All access goes through CloudFront using Origin Access Control (OAC).

resource "aws_s3_bucket" "site" {
  bucket = var.bucket_name

  tags = {
    Project     = var.project
    Environment = var.env
    Purpose     = "Static website hosting"
  }
}

# Block ALL public access to the S3 bucket
# This ensures the bucket cannot be accidentally made public
resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  # Block public ACLs from being set on objects
  block_public_acls = true

  # Block public bucket policies from being applied
  block_public_policy = true

  # Ignore any existing public ACLs on objects
  ignore_public_acls = true

  # Restrict access to only authenticated AWS principals
  restrict_public_buckets = true
}

# ------------------------------------------------------------------------------
# CLOUDFRONT ORIGIN ACCESS CONTROL (OAC)
# ------------------------------------------------------------------------------
# OAC is the modern, secure way to give CloudFront access to private S3 buckets.
# It replaces the older Origin Access Identity (OAI) approach.
# 
# How it works:
# 1. CloudFront signs requests to S3 using AWS SigV4
# 2. S3 bucket policy allows only CloudFront (via service principal + ARN condition)
# 3. Direct S3 access is blocked - users can only access via CloudFront

resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "${var.project}-${var.env}-oac"
  description                       = "OAC for ${var.project} ${var.env} static site"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"  # Always sign requests to S3
  signing_protocol                  = "sigv4"   # Use AWS Signature Version 4
}

# ------------------------------------------------------------------------------
# CLOUDFRONT SECURITY HEADERS POLICY
# ------------------------------------------------------------------------------
# Automatically adds security headers to all responses.
# These headers protect against common web vulnerabilities.

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "${var.project}-${var.env}-security-headers"
  comment = "Security headers for ${var.project} ${var.env}"

  security_headers_config {
    # X-Content-Type-Options: nosniff
    # Prevents MIME type sniffing attacks
    content_type_options {
      override = true
    }

    # X-Frame-Options: DENY
    # Prevents clickjacking by blocking iframe embedding
    frame_options {
      frame_option = "DENY"
      override     = true
    }

    # Referrer-Policy: same-origin
    # Controls how much referrer information is sent
    referrer_policy {
      referrer_policy = "same-origin"
      override        = true
    }

    # Strict-Transport-Security (HSTS)
    # Forces browsers to use HTTPS for this domain
    # max-age=31536000 (1 year), includeSubdomains, preload
    strict_transport_security {
      access_control_max_age_sec = 31536000  # 1 year
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    # X-XSS-Protection: 1; mode=block
    # Enables browser's XSS filter (legacy but still useful)
    xss_protection {
      protection = true
      mode_block = true
      override   = true
    }
  }
}

# ------------------------------------------------------------------------------
# CLOUDFRONT DISTRIBUTION
# ------------------------------------------------------------------------------
# Global CDN that serves the static site with low latency worldwide.
# Configured for single-page application (SPA) routing.

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"  # Serve index.html at /
  comment             = "${var.project} ${var.env} static site"

  # Custom domain alias (if configured)
  aliases = var.custom_domain != "" ? [var.custom_domain] : []

  # Origin: Private S3 bucket
  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  # Default cache behavior for all requests
  default_cache_behavior {
    target_origin_id       = "s3-origin"
    viewer_protocol_policy = "redirect-to-https"  # Force HTTPS

    # Allowed HTTP methods (static site only needs GET/HEAD)
    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD", "OPTIONS"]

    # Enable compression for faster downloads
    compress = true

    # Attach security headers policy
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    # Forwarding configuration
    forwarded_values {
      query_string = true  # Forward query strings (useful for cache busting)
      cookies {
        forward = "none"  # Don't forward cookies (static site doesn't need them)
      }
    }

    # Cache settings
    min_ttl     = 0
    default_ttl = 86400   # 1 day default cache
    max_ttl     = 31536000  # 1 year max cache
  }

  # No geographic restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # TLS certificate configuration
  # Uses ACM certificate for custom domain, or CloudFront default certificate
  viewer_certificate {
    # Use ACM certificate if custom domain is set, otherwise use CloudFront default
    acm_certificate_arn            = var.acm_certificate_arn != "" ? var.acm_certificate_arn : null
    cloudfront_default_certificate = var.acm_certificate_arn == "" ? true : false
    ssl_support_method             = var.acm_certificate_arn != "" ? "sni-only" : null
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  # Custom error responses for SPA routing
  # Return index.html for 403/404 so client-side routing works
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  tags = {
    Project     = var.project
    Environment = var.env
  }
}

# ------------------------------------------------------------------------------
# S3 BUCKET POLICY
# ------------------------------------------------------------------------------
# Grants CloudFront permission to read objects from the bucket.
# Uses condition to ensure only this specific CloudFront distribution can access.

data "aws_iam_policy_document" "bucket_policy" {
  statement {
    sid     = "AllowCloudFrontServicePrincipal"
    effect  = "Allow"
    actions = ["s3:GetObject"]

    # CloudFront can read any object in the bucket
    resources = ["${aws_s3_bucket.site.arn}/*"]

    # Only allow CloudFront service principal
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    # Only allow this specific CloudFront distribution
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.bucket_policy.json
}

# ------------------------------------------------------------------------------
# CLOUDFLARE DNS RECORD (Optional)
# ------------------------------------------------------------------------------
# Creates a CNAME record pointing the custom domain to CloudFront.
# Only created if cloudflare_zone_id and custom_domain are set.

resource "cloudflare_dns_record" "site" {
  count = var.cloudflare_zone_id != "" && var.custom_domain != "" ? 1 : 0

  zone_id = var.cloudflare_zone_id
  name    = var.custom_domain
  content = aws_cloudfront_distribution.cdn.domain_name
  type    = "CNAME"
  proxied = var.enable_cloudflare_proxy
  ttl     = var.enable_cloudflare_proxy ? 1 : 300  # Auto if proxied

  comment = "NetKnife static site - managed by Terraform"
}

# ------------------------------------------------------------------------------
# OUTPUTS
# ------------------------------------------------------------------------------

output "bucket_name" {
  value       = aws_s3_bucket.site.bucket
  description = "S3 bucket name for uploading static files"
}

output "bucket_arn" {
  value       = aws_s3_bucket.site.arn
  description = "S3 bucket ARN"
}

output "cloudfront_domain" {
  value       = aws_cloudfront_distribution.cdn.domain_name
  description = "CloudFront distribution domain name"
}

output "cloudfront_id" {
  value       = aws_cloudfront_distribution.cdn.id
  description = "CloudFront distribution ID (for cache invalidation)"
}

output "cloudfront_arn" {
  value       = aws_cloudfront_distribution.cdn.arn
  description = "CloudFront distribution ARN"
}

output "site_url" {
  value       = var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${aws_cloudfront_distribution.cdn.domain_name}"
  description = "Full URL to access the site"
}
