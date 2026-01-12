# NetKnife - Development Environment

Terraform configuration for deploying NetKnife infrastructure to AWS with CloudFront, S3, API Gateway, Lambda, and Cloudflare DNS.

## Table of Contents

- [Quick Start](#quick-start)
- [Setup Instructions](#setup-instructions)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [DNS Configuration](#dns-configuration)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [Important Notes](#important-notes)

## Quick Start

### 1. Initialize Terraform

```bash
cd /Users/alex.lux/Desktop/AWS/netknife/infra/envs/dev
./init.sh
```

**If the script hangs** (due to TLS certificate issues), try:
```bash
export GODEBUG=x509ignoreCN=0
terraform init -upgrade -reconfigure
```

### 2. Configure Variables

Copy the example file and fill in your values:
```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

### 3. Deploy

```bash
# Review changes
terraform plan

# Apply (use -auto-approve to skip confirmation)
terraform apply -auto-approve
```

## Setup Instructions

### Prerequisites

1. **AWS CLI** configured with credentials
2. **Terraform** >= 1.6 installed
3. **Cloudflare API Token** (if using custom domain):
   ```bash
   export CLOUDFLARE_API_TOKEN="your-token"
   ```

### Initial Setup

#### Step 1: Clean and Initialize

Run the initialization script:
```bash
./init.sh
```

Or manually:
```bash
# Clean up
rm -rf .terraform .terraform.lock.hcl

# Initialize
terraform init -upgrade -reconfigure
```

#### Step 2: If Terraform Init Hangs

This is usually due to TLS certificate issues on macOS. Try:

**Option A: Use the init script (recommended)**
```bash
./init.sh
```

**Option B: TLS workaround**
```bash
export GODEBUG=x509ignoreCN=0
terraform init -upgrade -reconfigure
```

**Option C: Fix certificates**
```bash
# Update Homebrew certificates
brew install ca-certificates

# Or update system date/time
sudo sntp -sS time.apple.com
```

#### Step 3: Verify Initialization

After successful init, verify:
```bash
# Check providers are installed
ls -la .terraform/providers/registry.terraform.io/

# Should see:
# - hashicorp/aws/
# - cloudflare/cloudflare/
# - hashicorp/archive/
# - hashicorp/random/

# Verify Terraform works
terraform version
terraform providers
```

#### Step 4: Configure Variables

1. Copy the example file:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. Edit `terraform.tfvars` with your values:
   - `site_bucket_name` - Must be globally unique
   - `alert_email` - For monitoring alerts
   - `custom_domain` - Optional custom domain
   - `cloudflare_zone_id` - Required if using custom domain
   - `cloudflare_zone_name` - Required if using custom domain
   - `cloudflare_subdomain` - Required if using custom domain (e.g., "tools")
   - API keys for third-party services (optional)

## Configuration

### Required Variables

- `site_bucket_name` - S3 bucket name (must be globally unique)
- `alert_email` - Email for monitoring alerts

### Optional Variables

- `custom_domain` - Custom domain (e.g., "tools.alexflux.com")
- `cloudflare_zone_id` - Cloudflare zone ID
- `cloudflare_zone_name` - Cloudflare zone name (e.g., "alexflux.com")
- `cloudflare_subdomain` - Subdomain (e.g., "tools")
- `monthly_budget_usd` - Monthly cost budget (default: 25)

### Cloudflare Configuration

If using a custom domain, you need:
1. Cloudflare zone ID (from Cloudflare dashboard)
2. Cloudflare zone name (e.g., "alexflux.com")
3. Subdomain name (e.g., "tools")
4. Cloudflare API token (set as environment variable)

```bash
export CLOUDFLARE_API_TOKEN="your-token"
```

## Deployment

### Plan Changes

```bash
terraform plan
```

### Apply Changes

**Option 1: Auto-approve (recommended)**
```bash
terraform apply -auto-approve
```

**Option 2: Use apply script**
```bash
./apply.sh
```

**Option 3: Save plan and apply**
```bash
terraform plan -out=tfplan
terraform apply tfplan
```

### Verify Deployment

Run the verification script:
```bash
./verify-deployment.sh
```

## DNS Configuration

### DNS Configuration Fix - Matching OpenArena Pattern

The DNS configuration has been updated to match the **exact same pattern** that works in the openarena project for `games.alexflux.com`.

#### Key Configuration

**OpenArena (working):**
- `cloudflare_zone_name = "alexflux.com"`
- `cloudflare_subdomain = "games"`
- DNS record name: `"games"` → Creates `games.alexflux.com`

**NetKnife (matching):**
- `cloudflare_zone_name = "alexflux.com"`
- `cloudflare_subdomain = "tools"`
- DNS record name: `"tools"` → Creates `tools.alexflux.com`

#### Required Variables

Add to your `terraform.tfvars`:
```hcl
custom_domain = "tools.alexflux.com"
cloudflare_zone_id = "YOUR_ZONE_ID"      # Same as openarena
cloudflare_zone_name = "alexflux.com"     # Same as openarena
cloudflare_subdomain = "tools"            # Just like openarena uses "games"
```

#### Why This Works

Cloudflare's DNS API expects the record name to be **relative to the zone**. Since your zone is `alexflux.com`:
- ✅ Correct: `name = "tools"` → Creates `tools.alexflux.com`
- ❌ Wrong: `name = "tools.alexflux.com"` → Tries to create `tools.alexflux.com.alexflux.com`

### DNS Troubleshooting

#### Issue: Site Not Reachable (DNS_PROBE_FINISHED_NXDOMAIN)

If you see `DNS_PROBE_FINISHED_NXDOMAIN` when accessing `https://tools.alexflux.com`, this means DNS is not resolving.

**Common Causes:**

1. **DNS Propagation Delay** (Most Common)
   - DNS records can take 5-60 minutes to propagate globally
   - Solution: Wait 10-30 minutes and try again

2. **Incorrect DNS Record Name**
   - Cloudflare requires subdomain names (e.g., "tools") not full domains ("tools.alexflux.com")
   - Solution: Verify and fix the DNS record configuration

3. **DNS Record Not Created**
   - Terraform might have failed to create the DNS record
   - Solution: Check Terraform state and Cloudflare dashboard

**Quick Checks:**

1. **Check Cloudflare Dashboard**
   - Go to: https://dash.cloudflare.com
   - Navigate to: DNS → Records
   - Look for: `tools` CNAME record
   - Should point to: `d3r72xmc8pu9ul.cloudfront.net`

2. **Check DNS Propagation**
   ```bash
   dig @8.8.8.8 tools.alexflux.com CNAME
   dig @1.1.1.1 tools.alexflux.com CNAME
   ```

3. **Check Terraform State**
   ```bash
   terraform state list | grep cloudflare_dns_record
   ```

**Fixes:**

1. **Wait for DNS Propagation**
   - DNS records typically propagate within 5-60 minutes
   - Clear your DNS cache: `sudo dscacheutil -flushcache` (macOS)

2. **Verify DNS Record in Cloudflare**
   - Name: `tools` (not `tools.alexflux.com`)
   - Type: `CNAME`
   - Content: `d3r72xmc8pu9ul.cloudfront.net`
   - Proxy status: DNS only (gray cloud)
   - TTL: 300 (or Auto)

3. **Recreate DNS Record**
   ```bash
   terraform taint 'module.static_site.cloudflare_dns_record.site[0]'
   terraform apply
   ```

## Troubleshooting

### Issue: Terraform Commands Hang

**Cause**: Missing or corrupted providers

**Solution**:
```bash
rm -rf .terraform .terraform.lock.hcl
terraform init -upgrade -reconfigure
```

### Issue: TLS Certificate Errors

**Cause**: macOS certificate store issues

**Solution**:
```bash
export GODEBUG=x509ignoreCN=0
terraform init -upgrade -reconfigure
```

Or:
```bash
brew install ca-certificates
```

### Issue: "Apply cancelled" After Typing "yes"

**Cause**: Terminal input buffering issues

**Solutions**:

1. **Use `-auto-approve` flag (recommended)**
   ```bash
   terraform apply -auto-approve
   ```

2. **Use the apply script**
   ```bash
   ./apply.sh
   ```

3. **Save plan and apply separately**
   ```bash
   terraform plan -out=tfplan
   terraform apply tfplan
   ```

4. **Fix terminal state**
   ```bash
   reset
   # Or
   stty sane
   ```

### Issue: Provider Configuration Warnings

**Status**: ✅ Fixed - ACM module now properly declares provider aliases

### Issue: DNS Not Resolving

See [DNS Troubleshooting](#dns-troubleshooting) section above.

### Issue: Cognito Sign-In Broken (DNS_PROBE_FINISHED_NXDOMAIN)

**Cause**: Frontend `.env.production` has outdated Cognito domain values. The Cognito domain uses a random suffix that changes when recreated.

**Root Cause**:

The Cognito domain in Terraform uses a random suffix:
```hcl
domain = "${var.project}-${var.env}-${random_id.domain_suffix.hex}"
```

When the domain is recreated (e.g., after `terraform destroy` and `terraform apply`), the suffix changes, breaking the frontend configuration.

**Solution**:

1. **Update frontend environment file** (automated - recommended):
   ```bash
   cd /Users/alex.lux/Desktop/AWS/netknife/frontend
   ./update-env.sh
   ```

2. **Or update manually**:
   ```bash
   cd /Users/alex.lux/Desktop/AWS/netknife/infra/envs/dev
   terraform output -json | jq -r '{
     cognito_domain: .cognito_domain_url.value,
     client_id: .client_id.value,
     issuer: .cognito_issuer.value,
     api_url: .api_url.value
   }'
   ```
   Then update `frontend/.env.production` with these values:
   ```env
   VITE_API_URL=<api_url_from_terraform>
   VITE_COGNITO_DOMAIN=<cognito_domain_from_terraform>
   VITE_COGNITO_CLIENT_ID=<client_id_from_terraform>
   VITE_COGNITO_ISSUER=<issuer_from_terraform>
   VITE_OIDC_REDIRECT_URI=https://tools.alexflux.com/callback
   VITE_OIDC_POST_LOGOUT_REDIRECT_URI=https://tools.alexflux.com/login
   VITE_REGION=us-west-2
   VITE_DEV_BYPASS_AUTH=false
   ```

3. **Rebuild and redeploy frontend**:
   ```bash
   cd /Users/alex.lux/Desktop/AWS/netknife/frontend
   npm run build
   # Upload to S3 bucket
   aws s3 sync dist/ s3://<your-bucket-name>/
   ```

**Verification**:

After updating and rebuilding:
1. Clear browser cache
2. Navigate to `https://tools.alexflux.com/login`
3. Click "Sign in" - should redirect to Cognito Hosted UI
4. After authentication, should redirect back to the app

**Prevention**:

To prevent this issue in the future:
1. **Automate environment variable updates** - Use the `update-env.sh` script after each Terraform apply
2. **Use a fixed Cognito domain** - Consider using a custom domain for Cognito instead of the random suffix
3. **Document the process** - Always update frontend env after infrastructure changes

### Verification Steps

After successful initialization, verify:
```bash
# Check providers are downloaded
ls -la .terraform/providers/registry.terraform.io/

# Test Terraform works
terraform version
terraform providers
```

## Project Structure

```
netknife/infra/envs/dev/
├── main.tf                    # Main Terraform configuration
├── terraform.tfvars           # Variable values (sensitive - not in git)
├── terraform.tfvars.example   # Example variables template
├── .env                       # Environment variables (sensitive - not in git)
├── .env.example               # Example environment variables
├── terraform.tfstate          # Infrastructure state (backup regularly!)
├── init.sh                    # Initialization script with error handling
├── apply.sh                   # Apply script with proper input handling
├── deploy-complete.sh         # Complete automated deployment
├── deploy.sh                  # Simplified deployment script
├── redeploy.sh                # Complete redeployment script
├── load-env.sh                # Loads Cloudflare token automatically
├── verify-deployment.sh       # Deployment verification script
├── check-dns.sh               # DNS diagnostic script
└── README.md                  # This file
```

## Important Notes

### State Management

- **Never delete `.terraform` manually** unless doing a clean reinit
- **Keep `terraform.tfstate` backed up** - it contains your infrastructure state
- **Don't commit `terraform.tfstate`** to git (contains sensitive data)
- **Use remote state** (S3 backend) for production environments

### Security

- **Never commit `terraform.tfvars`** - it contains sensitive values
- **Use environment variables** for API tokens when possible
- **Rotate credentials regularly**

### Best Practices

1. **Always run `terraform plan` first** to review changes
2. **Use `-auto-approve`** when you're confident about the plan
3. **Use plan files** (`-out=tfplan`) for safer, non-interactive applies
4. **Keep terminal sessions clean** (restart terminal if issues persist)
5. **Back up state files** before major changes

### Scripts

- `init.sh` - Handles initialization with TLS workarounds
- `apply.sh` - Handles apply with proper input handling
- `deploy-complete.sh` - Complete automated deployment (infrastructure + frontend)
- `deploy.sh` - Simplified deployment script
- `redeploy.sh` - Complete redeployment after destroy
- `load-env.sh` - Loads Cloudflare token from .env or openarena project
- `verify-deployment.sh` - Comprehensive deployment verification
- `check-dns.sh` - DNS diagnostic and troubleshooting

## Frontend Configuration

### Updating Frontend Environment Variables

After deploying or updating infrastructure, you need to update the frontend environment variables to match the new Cognito configuration.

**Automated Update (Recommended)**:
```bash
cd /Users/alex.lux/Desktop/AWS/netknife/frontend
./update-env.sh
```

This script:
1. Fetches current values from Terraform outputs
2. Updates `.env.production` with correct Cognito domain, client ID, issuer, and API URL
3. Shows what was updated

**Manual Update**:
```bash
cd /Users/alex.lux/Desktop/AWS/netknife/infra/envs/dev
terraform output -json | jq -r '{
  cognito_domain: .cognito_domain_url.value,
  client_id: .client_id.value,
  issuer: .cognito_issuer.value,
  api_url: .api_url.value
}'
```

Then manually update `frontend/.env.production` with these values.

## Environment Variables

### Cloudflare API Token

The deployment scripts automatically load the Cloudflare API token from multiple sources (in order):

1. **Local `.env` file** (if exists in this directory)
2. **OpenArena project `.env` file** (automatically sources from `../../../../openarena-aws/.env`)
3. **Environment variable** (if already set)

**To set up for future deployments:**

**Option 1: Create local .env file (recommended)**
```bash
cd /Users/alex.lux/Desktop/AWS/netknife/infra/envs/dev
cp .env.example .env
# Edit .env and add: CLOUDFLARE_API_TOKEN="your-token"
```

**Option 2: Use OpenArena token automatically**
The `load-env.sh` script automatically sources the token from the openarena project if available. No setup needed!

**Option 3: Set environment variable**
```bash
export CLOUDFLARE_API_TOKEN="your-token"
```

The deployment scripts (`deploy-complete.sh`, `deploy.sh`) automatically call `load-env.sh` to load the token.

## Status

- ✅ Project cleaned up
- ✅ Provider configuration fixed
- ✅ DNS configuration matches openarena pattern
- ✅ Troubleshooting documentation consolidated
- ✅ Frontend environment update script created
- ✅ Cloudflare token auto-loading from openarena project
- ✅ All markdown files consolidated into README
- ⏳ Ready for deployment

## Complete Deployment Guide

### Quick Deployment (Automated - Recommended)

**Use the complete deployment script**:
```bash
./deploy-complete.sh
```

This script handles everything:
1. ✅ Checks prerequisites
2. ✅ Initializes Terraform
3. ✅ Deploys infrastructure
4. ✅ Creates/verifies Cognito user
5. ✅ Updates frontend environment variables (CRITICAL - fixes Cognito domain issues)
6. ✅ Builds frontend
7. ✅ Deploys frontend to S3
8. ✅ Invalidates CloudFront cache
9. ✅ Verifies deployment

**Why use this?** The Cognito domain uses a random suffix that changes when infrastructure is recreated. This script automatically updates the frontend configuration, preventing the "Cognito login broken" issue.


### Alternative: Step-by-Step Manual Deployment

**Step 1: Initialize and Deploy Infrastructure**
```bash
cd /Users/alex.lux/Desktop/AWS/netknife/infra/envs/dev

# Load environment (Cloudflare token)
source load-env.sh 2>/dev/null || true

# Initialize if needed
./init.sh

# Deploy
terraform apply -auto-approve
```

**Step 2: Create Admin User (if needed)**
```bash
USER_POOL_ID=$(terraform output -raw user_pool_id)
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username alex.lux \
  --user-attributes Name=email,Value=alex.lux@example.com \
  --temporary-password "ChangeMe123!" \
  --region us-west-2

aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username alex.lux \
  --password "YourSecurePassword123!" \
  --permanent \
  --region us-west-2
```

**Step 3: Update and Deploy Frontend**
```bash
cd ../../frontend
./update-env.sh    # Updates .env.production with new Cognito domain
npm run build
./deploy.sh
```

### Troubleshooting: Site Works Then Stops

If your site works initially but then stops working (DNS_PROBE_FINISHED_NXDOMAIN), this is usually caused by:

**Common causes:**
1. **DNS records deleted or changed** - Check Cloudflare dashboard
2. **Cognito domain changed** - Frontend environment variables not updated
3. **CloudFront distribution recreated** - DNS record points to old domain
4. **Certificate validation issues** - ACM certificate not validated

**Quick Fix:**
```bash
# 1. Deploy infrastructure
cd infra/envs/dev
source load-env.sh 2>/dev/null || true
terraform apply -auto-approve

# 2. Update and redeploy frontend
cd ../../frontend
./update-env.sh
npm run build
./deploy.sh
```

**Detailed Troubleshooting:**

**Issue 1: DNS Record Missing**
```bash
# Check if DNS record exists in Terraform state
terraform state list | grep cloudflare_dns_record

# Recreate DNS record
terraform apply -target=module.static_site.cloudflare_dns_record.site
```

**Issue 2: Cognito Domain Changed**
```bash
cd frontend
./update-env.sh  # Updates .env.production with new Cognito domain
npm run build
./deploy.sh
```

**Issue 3: CloudFront Distribution Recreated**
```bash
# Get new CloudFront domain
terraform output cloudfront_domain

# Update DNS record (Terraform should do this automatically)
terraform apply -target=module.static_site.cloudflare_dns_record.site
```

**Issue 4: Certificate Not Validated**
```bash
# Check certificate status
aws acm list-certificates --region us-east-1 \
  --query 'CertificateSummaryList[?DomainName==`tools.alexflux.com`]'

# Wait 2-5 minutes for validation
# Check DNS validation records in Cloudflare
```

## Need Help?

1. Check the [Troubleshooting](#troubleshooting) section
2. See [REDEPLOY.md](./REDEPLOY.md) for complete redeployment steps
3. Review Terraform logs: `terraform.log` or `TF_LOG=DEBUG terraform plan`
4. Verify DNS in Cloudflare dashboard
5. Check AWS CloudFront distribution status
6. Run verification scripts: `./verify-deployment.sh` or `./check-dns.sh`
