#!/bin/bash
# Simplified NetKnife Deployment Script
# Handles deployment with or without Cloudflare token

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../../.."
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Load environment variables (Cloudflare token)
if [ -f "$SCRIPT_DIR/load-env.sh" ]; then
    source "$SCRIPT_DIR/load-env.sh" 2>/dev/null || true
fi

echo "=========================================="
echo "NetKnife Deployment"
echo "=========================================="
echo ""

cd "$SCRIPT_DIR"

# Check for Cloudflare token
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "⚠️  CLOUDFLARE_API_TOKEN not set"
    echo ""
    echo "If you're using a custom domain (tools.alexflux.com), you need to:"
    echo "  1. Get token from: https://dash.cloudflare.com/profile/api-tokens"
    echo "  2. Run: export CLOUDFLARE_API_TOKEN=\"your-token\""
    echo "  3. Then run this script again"
    echo ""
    read -p "Continue without Cloudflare token? (DNS records won't be created) [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    echo ""
fi

# Step 1: Initialize Terraform
echo "Step 1: Initializing Terraform..."
if [ ! -d ".terraform" ]; then
    if [ -f "init.sh" ]; then
        ./init.sh
    else
        terraform init
    fi
fi
echo "✅ Terraform initialized"
echo ""

# Step 2: Deploy Infrastructure
echo "Step 2: Deploying infrastructure..."
echo "   This will take 5-10 minutes..."
echo ""

terraform apply -auto-approve

echo "✅ Infrastructure deployed"
echo ""

# Step 3: Get outputs
echo "Step 3: Getting deployment information..."
BUCKET_NAME=$(terraform output -raw bucket_name 2>/dev/null || echo "")
CLOUDFRONT_ID=$(terraform output -raw cloudfront_id 2>/dev/null || echo "")
SITE_URL=$(terraform output -raw site_url 2>/dev/null || echo "")
COGNITO_DOMAIN=$(terraform output -raw cognito_domain_url 2>/dev/null || echo "")

if [ -z "$BUCKET_NAME" ]; then
    echo "❌ Failed to get bucket name from Terraform"
    exit 1
fi

echo "   Bucket: $BUCKET_NAME"
echo "   CloudFront ID: $CLOUDFRONT_ID"
echo "   Site URL: $SITE_URL"
echo "   Cognito Domain: $COGNITO_DOMAIN"
echo ""

# Step 4: Update frontend
echo "Step 4: Updating frontend environment..."
cd "$FRONTEND_DIR"

if [ -f "update-env.sh" ]; then
    ./update-env.sh
else
    echo "⚠️  update-env.sh not found, skipping frontend update"
    echo "   You'll need to manually update .env.production"
fi
echo ""

# Step 5: Build frontend
echo "Step 5: Building frontend..."
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install
fi

npm run build
echo "✅ Frontend built"
echo ""

# Step 6: Deploy frontend
echo "Step 6: Deploying frontend..."
if [ -f "deploy.sh" ]; then
    ./deploy.sh
else
    echo "   Uploading to S3..."
    aws s3 sync dist/ "s3://$BUCKET_NAME/" --delete
    
    if [ -n "$CLOUDFRONT_ID" ]; then
        echo "   Invalidating CloudFront cache..."
        aws cloudfront create-invalidation \
          --distribution-id "$CLOUDFRONT_ID" \
          --paths "/*" > /dev/null 2>&1
    fi
fi

echo "✅ Frontend deployed"
echo ""

echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Site URL: $SITE_URL"
echo ""
echo "Next steps:"
echo "  1. Wait 2-5 minutes for CloudFront to deploy"
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "  2. ⚠️  Create DNS record manually in Cloudflare:"
    echo "     - Name: tools"
    echo "     - Type: CNAME"
    echo "     - Content: $(terraform output -raw cloudfront_domain)"
    echo "  3. Wait 5-60 minutes for DNS propagation"
else
    echo "  2. Wait 5-60 minutes for DNS propagation"
fi
echo "  4. Navigate to: $SITE_URL"
echo "  5. Sign in with Cognito credentials"
echo ""
