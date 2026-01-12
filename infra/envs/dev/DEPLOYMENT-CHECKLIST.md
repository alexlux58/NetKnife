# NetKnife Deployment Checklist

Use this checklist to ensure a successful deployment.

## Pre-Deployment Checklist

- [ ] **AWS CLI configured** - Run `aws sts get-caller-identity` to verify
- [ ] **Terraform installed** - Run `terraform version` (needs >= 1.6)
- [ ] **Node.js installed** - Run `node --version` and `npm --version`
- [ ] **terraform.tfvars configured** - Copy from `terraform.tfvars.example` and fill in values
- [ ] **Cloudflare API token** - Either:
  - Added to `terraform.tfvars` as `cloudflare_api_token = "..."`, OR
  - Run `./sync-cloudflare-token.sh` to auto-sync from openarena project

## Deployment Steps

### Option 1: Complete Automated Deployment (Recommended)

```bash
cd /Users/alex.lux/Desktop/AWS/netknife/infra/envs/dev
./redeploy.sh
```

This script will:
1. ✅ Initialize Terraform
2. ✅ Sync Cloudflare token (if needed)
3. ✅ Deploy infrastructure (5-10 minutes)
4. ✅ Get Terraform outputs
5. ✅ Create Cognito admin user
6. ✅ Update frontend environment variables
7. ✅ Build frontend
8. ✅ Deploy frontend to S3
9. ✅ Invalidate CloudFront cache

### Option 2: Step-by-Step Manual Deployment

```bash
cd /Users/alex.lux/Desktop/AWS/netknife/infra/envs/dev

# 1. Initialize Terraform
./init.sh

# 2. Sync Cloudflare token (if using custom domain)
./sync-cloudflare-token.sh

# 3. Deploy infrastructure
terraform apply -auto-approve

# 4. Update frontend environment
cd ../../frontend
./update-env.sh

# 5. Build frontend
npm run build

# 6. Deploy frontend
./deploy.sh
```

## Post-Deployment Verification

After deployment completes:

- [ ] **Check Terraform outputs** - Run `terraform output` (all should have values)
- [ ] **Check DNS record** - Verify `tools` CNAME exists in Cloudflare dashboard
- [ ] **Check CloudFront status** - Should be "Deployed" (takes 2-5 minutes)
- [ ] **Test site access** - Navigate to `https://tools.alexflux.com`
- [ ] **Test Cognito login** - Sign in with your credentials
- [ ] **Check S3 bucket** - Verify files are uploaded: `aws s3 ls s3://netknife-site-026600053230/`

## Common Issues and Solutions

### Issue: Script stops after Cognito user creation
**Solution**: The script has been fixed to handle errors gracefully. If it still stops, check:
- AWS credentials are valid
- User Pool ID is correct
- Password meets Cognito requirements (14+ chars, uppercase, lowercase, number, symbol)

### Issue: Frontend build fails
**Solution**: 
- Check Node.js version: `node --version` (should be 18+)
- Clear cache: `rm -rf node_modules package-lock.json && npm install`
- Check for errors: `npm run build` (without redirect)

### Issue: S3 sync fails
**Solution**:
- Verify AWS credentials: `aws sts get-caller-identity`
- Check bucket name: `terraform output bucket_name`
- Verify bucket exists: `aws s3 ls s3://<bucket-name>`

### Issue: DNS not resolving
**Solution**:
- Wait 5-60 minutes for DNS propagation
- Check Cloudflare dashboard for DNS record
- Verify DNS record points to CloudFront domain: `terraform output cloudfront_domain`

## Verification Commands

```bash
# Check infrastructure
cd infra/envs/dev
terraform output

# Check DNS
dig tools.alexflux.com CNAME

# Check CloudFront
CLOUDFRONT_ID=$(terraform output -raw cloudfront_id)
aws cloudfront get-distribution --id "$CLOUDFRONT_ID" --query 'Distribution.Status'

# Check S3
BUCKET=$(terraform output -raw bucket_name)
aws s3 ls "s3://$BUCKET/"

# Check Cognito
USER_POOL_ID=$(terraform output -raw user_pool_id)
aws cognito-idp list-users --user-pool-id "$USER_POOL_ID" --region us-west-2
```

## Expected Deployment Time

- Terraform apply: **5-10 minutes**
- Certificate validation: **2-5 minutes** (if using custom domain)
- DNS propagation: **5-60 minutes** (if using custom domain)
- Frontend build: **1-2 minutes**
- Frontend deployment: **1-2 minutes**
- CloudFront deployment: **2-5 minutes**

**Total: ~15-20 minutes** (plus DNS propagation if using custom domain)
