#!/bin/bash
# Complete NetKnife Deployment Script
# Handles infrastructure deployment, frontend updates, and verification
# Use this to deploy or redeploy the entire project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../../.."
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Load environment variables (Cloudflare token)
if [ -f "$SCRIPT_DIR/load-env.sh" ]; then
    source "$SCRIPT_DIR/load-env.sh" 2>/dev/null || true
fi

echo "=========================================="
echo "NetKnife Complete Deployment"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo "Step 1: Checking prerequisites..."

# Check Terraform
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform not found${NC}"
    exit 1
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found${NC}"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi

# Check terraform.tfvars
if [ ! -f "$SCRIPT_DIR/terraform.tfvars" ]; then
    echo -e "${YELLOW}⚠️  terraform.tfvars not found${NC}"
    echo "   Copying from example..."
    cp "$SCRIPT_DIR/terraform.tfvars.example" "$SCRIPT_DIR/terraform.tfvars"
    echo -e "${YELLOW}   Please edit terraform.tfvars with your values, then run this script again${NC}"
    exit 1
fi

# Check Cloudflare token if using custom domain
if grep -q "custom_domain" "$SCRIPT_DIR/terraform.tfvars" && [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  CLOUDFLARE_API_TOKEN not set${NC}"
    echo "   If using custom domain, export CLOUDFLARE_API_TOKEN before running"
    read -p "   Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Step 2: Initialize Terraform
echo "Step 2: Initializing Terraform..."
cd "$SCRIPT_DIR"

if [ ! -d ".terraform" ]; then
    echo "   Running init script..."
    ./init.sh || {
        echo -e "${YELLOW}   Init script failed, trying manual init...${NC}"
        export GODEBUG=x509ignoreCN=0
        terraform init -upgrade -reconfigure
    }
else
    echo "   Terraform already initialized"
fi

echo -e "${GREEN}✅ Terraform initialized${NC}"
echo ""

# Step 3: Deploy Infrastructure
echo "Step 3: Deploying infrastructure..."
echo "   This will take 5-10 minutes..."
echo ""

terraform apply -auto-approve

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Terraform apply failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Infrastructure deployed${NC}"
echo ""

# Step 4: Get outputs and verify
echo "Step 4: Getting deployment outputs..."
cd "$SCRIPT_DIR"

# Get all outputs
USER_POOL_ID=$(terraform output -raw user_pool_id 2>/dev/null || echo "")
BUCKET_NAME=$(terraform output -raw bucket_name 2>/dev/null || echo "")
CLOUDFRONT_ID=$(terraform output -raw cloudfront_id 2>/dev/null || echo "")
SITE_URL=$(terraform output -raw site_url 2>/dev/null || echo "")
COGNITO_DOMAIN=$(terraform output -raw cognito_domain_url 2>/dev/null || echo "")
CLIENT_ID=$(terraform output -raw client_id 2>/dev/null || echo "")
ISSUER=$(terraform output -raw cognito_issuer 2>/dev/null || echo "")
API_URL=$(terraform output -raw api_url 2>/dev/null || echo "")

if [ -z "$BUCKET_NAME" ] || [ -z "$CLOUDFRONT_ID" ]; then
    echo -e "${RED}❌ Failed to get Terraform outputs${NC}"
    echo "   Run: terraform output"
    exit 1
fi

echo "   Bucket: $BUCKET_NAME"
echo "   CloudFront ID: $CLOUDFRONT_ID"
echo "   Site URL: $SITE_URL"
echo "   Cognito Domain: $COGNITO_DOMAIN"
echo -e "${GREEN}✅ Outputs retrieved${NC}"
echo ""

# Step 5: Check if user exists, create if not
echo "Step 5: Checking Cognito user..."
if [ -n "$USER_POOL_ID" ]; then
    # Try to get user
    if aws cognito-idp admin-get-user \
        --user-pool-id "$USER_POOL_ID" \
        --username alex.lux \
        --region us-west-2 > /dev/null 2>&1; then
        echo "   User 'alex.lux' already exists"
    else
        echo "   Creating admin user..."
        read -p "   Enter email for user: " EMAIL
        read -sp "   Enter password: " PASSWORD
        echo ""
        
        aws cognito-idp admin-create-user \
          --user-pool-id "$USER_POOL_ID" \
          --username alex.lux \
          --user-attributes Name=email,Value="$EMAIL" \
          --temporary-password "TempPass123!" \
          --region us-west-2 > /dev/null 2>&1 || true

        aws cognito-idp admin-set-user-password \
          --user-pool-id "$USER_POOL_ID" \
          --username alex.lux \
          --password "$PASSWORD" \
          --permanent \
          --region us-west-2 > /dev/null 2>&1

        echo -e "${GREEN}✅ User created${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Could not get User Pool ID, skipping user creation${NC}"
fi
echo ""

# Step 6: Update frontend environment
echo "Step 6: Updating frontend environment variables..."
cd "$FRONTEND_DIR"

if [ ! -f "update-env.sh" ]; then
    echo -e "${YELLOW}⚠️  update-env.sh not found, creating manually...${NC}"
    
    if [ -z "$COGNITO_DOMAIN" ] || [ -z "$CLIENT_ID" ] || [ -z "$ISSUER" ] || [ -z "$API_URL" ] || [ -z "$SITE_URL" ]; then
        echo -e "${RED}❌ Missing required values for frontend config${NC}"
        echo "   Run: cd infra/envs/dev && terraform output"
        exit 1
    fi
    
    cat > .env.production << EOF
VITE_API_URL=$API_URL
VITE_COGNITO_DOMAIN=$COGNITO_DOMAIN
VITE_COGNITO_CLIENT_ID=$CLIENT_ID
VITE_COGNITO_ISSUER=$ISSUER
VITE_OIDC_REDIRECT_URI=$SITE_URL/callback
VITE_OIDC_POST_LOGOUT_REDIRECT_URI=$SITE_URL/login
VITE_REGION=us-west-2
VITE_DEV_BYPASS_AUTH=false
EOF
    echo "   Created .env.production manually"
else
    ./update-env.sh
fi

echo -e "${GREEN}✅ Frontend environment updated${NC}"
echo ""

# Step 7: Build frontend
echo "Step 7: Building frontend..."
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install
fi

npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed - dist/ directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built${NC}"
echo ""

# Step 8: Deploy frontend
echo "Step 8: Deploying frontend to S3..."
if [ -f "deploy.sh" ]; then
    ./deploy.sh
else
    echo "   Uploading to S3..."
    aws s3 sync dist/ "s3://$BUCKET_NAME/" --delete
    
    echo "   Invalidating CloudFront cache..."
    aws cloudfront create-invalidation \
      --distribution-id "$CLOUDFRONT_ID" \
      --paths "/*" > /dev/null 2>&1
fi

echo -e "${GREEN}✅ Frontend deployed${NC}"
echo ""

# Step 9: Verify deployment
echo "Step 9: Verifying deployment..."
cd "$SCRIPT_DIR"

if [ -f "verify-deployment.sh" ]; then
    ./verify-deployment.sh
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "Site URL: $SITE_URL"
echo "Cognito Domain: $COGNITO_DOMAIN"
echo ""
echo "Next steps:"
echo "  1. Wait 2-5 minutes for CloudFront to fully deploy"
echo "  2. If using custom domain, wait 5-60 minutes for DNS propagation"
echo "  3. Navigate to: $SITE_URL"
echo "  4. Sign in with your Cognito credentials"
echo ""
echo "To check DNS propagation:"
echo "  dig tools.alexflux.com CNAME"
echo ""
echo "To check CloudFront status:"
echo "  aws cloudfront get-distribution --id $CLOUDFRONT_ID --query 'Distribution.Status'"
echo ""
