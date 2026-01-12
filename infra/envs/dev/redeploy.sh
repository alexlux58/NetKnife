#!/bin/bash
# Complete NetKnife Redeployment Script
# Use this after running terraform destroy or starting fresh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../../.."

echo "=========================================="
echo "NetKnife Complete Redeployment"
echo "=========================================="
echo ""

# Step 1: Initialize Terraform
echo "Step 1: Initializing Terraform..."
cd "$SCRIPT_DIR"
./init.sh
echo "✅ Terraform initialized"
echo ""

# Step 2: Check for terraform.tfvars
if [ ! -f "terraform.tfvars" ]; then
    echo "⚠️  Warning: terraform.tfvars not found"
    echo "   Copy terraform.tfvars.example to terraform.tfvars and configure it"
    echo "   Then run this script again"
    exit 1
fi

# Step 3: Deploy Infrastructure
echo "Step 2: Deploying infrastructure..."
echo "   This will take 5-10 minutes..."
terraform apply -auto-approve
echo "✅ Infrastructure deployed"
echo ""

# Step 4: Get outputs
echo "Step 3: Getting Terraform outputs..."
USER_POOL_ID=$(terraform output -raw user_pool_id)
BUCKET_NAME=$(terraform output -raw bucket_name)
CLOUDFRONT_ID=$(terraform output -raw cloudfront_id)
SITE_URL=$(terraform output -raw site_url)

echo "   User Pool ID: $USER_POOL_ID"
echo "   Bucket: $BUCKET_NAME"
echo "   CloudFront ID: $CLOUDFRONT_ID"
echo "   Site URL: $SITE_URL"
echo ""

# Step 5: Create admin user
echo "Step 4: Creating admin user in Cognito..."
read -p "Enter username (default: alex.lux): " USERNAME
USERNAME=${USERNAME:-alex.lux}

read -p "Enter email: " EMAIL
if [ -z "$EMAIL" ]; then
    echo "❌ Email is required"
    exit 1
fi

read -sp "Enter password: " PASSWORD
echo ""
if [ -z "$PASSWORD" ]; then
    echo "❌ Password is required"
    exit 1
fi

echo "   Creating user: $USERNAME..."
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$USERNAME" \
  --user-attributes Name=email,Value="$EMAIL" \
  --temporary-password "TempPass123!" \
  --region us-west-2 > /dev/null 2>&1 || true

echo "   Setting permanent password..."
aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "$USERNAME" \
  --password "$PASSWORD" \
  --permanent \
  --region us-west-2 > /dev/null 2>&1

echo "✅ User created: $USERNAME"
echo ""

# Step 6: Update frontend environment
echo "Step 5: Updating frontend environment variables..."
cd "$PROJECT_ROOT/frontend"
if [ -f "update-env.sh" ]; then
    ./update-env.sh
else
    echo "⚠️  update-env.sh not found, skipping..."
fi
echo "✅ Frontend environment updated"
echo ""

# Step 7: Build frontend
echo "Step 6: Building frontend..."
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install
fi
npm run build
echo "✅ Frontend built"
echo ""

# Step 8: Deploy frontend
echo "Step 7: Deploying frontend..."
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
echo "✅ Frontend deployed"
echo ""

echo "=========================================="
echo "✅ Redeployment Complete!"
echo "=========================================="
echo ""
echo "Site URL: $SITE_URL"
echo "Username: $USERNAME"
echo ""
echo "Next steps:"
echo "  1. Wait 2-5 minutes for CloudFront to deploy"
echo "  2. If using custom domain, wait 5-60 minutes for DNS propagation"
echo "  3. Navigate to $SITE_URL"
echo "  4. Sign in with username: $USERNAME"
echo ""
