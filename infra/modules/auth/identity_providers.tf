# ==============================================================================
# SOCIAL / FEDERATED IDENTITY PROVIDERS (optional)
# ==============================================================================
# Each provider is created only when client_id + client_secret are set in tfvars.
# OAuth redirect URI for all IdPs (register in Google/Facebook/GitHub/Microsoft):
#   https://<cognito-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse
# See docs/SOCIAL-LOGIN-SETUP.md

locals {
  social_idps = compact([
    var.google_client_id != "" && var.google_client_secret != "" ? "Google" : "",
    var.facebook_client_id != "" && var.facebook_client_secret != "" ? "Facebook" : "",
    var.github_client_id != "" && var.github_client_secret != "" ? "GitHub" : "",
    var.microsoft_client_id != "" && var.microsoft_client_secret != "" ? "Microsoft" : "",
  ])
  supported_identity_providers = concat(["COGNITO"], local.social_idps)
}

resource "aws_cognito_identity_provider" "google" {
  count = var.google_client_id != "" && var.google_client_secret != "" ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    authorize_scopes = "openid email profile"
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
    name     = "name"
  }
}

resource "aws_cognito_identity_provider" "facebook" {
  count = var.facebook_client_id != "" && var.facebook_client_secret != "" ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Facebook"
  provider_type = "Facebook"

  provider_details = {
    authorize_scopes = "email public_profile"
    client_id        = var.facebook_client_id
    client_secret    = var.facebook_client_secret
  }

  attribute_mapping = {
    email    = "email"
    username = "id"
    name     = "name"
  }
}

resource "aws_cognito_identity_provider" "github" {
  count = var.github_client_id != "" && var.github_client_secret != "" ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "GitHub"
  provider_type = "OIDC"

  provider_details = {
    client_id        = var.github_client_id
    client_secret    = var.github_client_secret
    authorize_scopes = "openid user:email read:user"
    oidc_issuer      = "https://github.com"
    attributes_request_method = "GET"
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
    name     = "name"
  }
}

resource "aws_cognito_identity_provider" "microsoft" {
  count = var.microsoft_client_id != "" && var.microsoft_client_secret != "" ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Microsoft"
  provider_type = "OIDC"

  provider_details = {
    client_id        = var.microsoft_client_id
    client_secret    = var.microsoft_client_secret
    authorize_scopes = "openid email profile"
    oidc_issuer      = "https://login.microsoftonline.com/${var.microsoft_tenant_id}/v2.0"
    attributes_request_method = "GET"
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
    name     = "name"
  }
}

output "oauth_idp_redirect_uri" {
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.id}.amazoncognito.com/oauth2/idpresponse"
  description = "Register this redirect URI in Google, Facebook, GitHub, and Microsoft OAuth apps"
}

output "enabled_social_providers" {
  value       = local.social_idps
  description = "Social IdPs enabled in this deployment (empty = username/password only)"
}
