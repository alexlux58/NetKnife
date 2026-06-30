# ==============================================================================
# GitHub Actions OIDC deploy role (apply once with your terraform IAM user)
# ==============================================================================
# Creates an IAM role GitHub Actions can assume to run terraform apply + S3 deploy.
#
# Usage:
#   cd infra/ci/github-oidc
#   cp terraform.tfvars.example terraform.tfvars   # set github_org + github_repo
#   terraform init && terraform apply
#
# Then set GitHub repository variable:
#   Settings → Secrets and variables → Actions → Variables → AWS_ROLE_TO_ASSUME
#   = output role_arn
# ==============================================================================

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-west-2"
}

variable "github_org" {
  type        = string
  description = "GitHub org or username (owner of the repo)"
}

variable "github_repo" {
  type        = string
  description = "Repository name (e.g. NetKnife)"
}

variable "role_name" {
  type    = string
  default = "netknife-github-deploy"
}

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "github_oidc_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# Same broad access as typical terraform deploy user. Tighten with a custom policy later.
resource "aws_iam_role" "deploy" {
  name               = var.role_name
  assume_role_policy = data.aws_iam_policy_document.github_oidc_assume.json
}

resource "aws_iam_role_policy_attachment" "deploy_admin" {
  role       = aws_iam_role.deploy.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

output "role_arn" {
  value       = aws_iam_role.deploy.arn
  description = "Set as GitHub Actions variable AWS_ROLE_TO_ASSUME"
}

output "account_id" {
  value = data.aws_caller_identity.current.account_id
}
