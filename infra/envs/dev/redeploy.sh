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
if [ -f "init.sh" ]; then
    ./init.sh
else
    echo "   Running terraform init..."
    terraform init -upgrade -reconfigure
fi

if [ ! -d ".terraform" ]; then
    echo "❌ Error: Terraform initialization failed"
    exit 1
fi

echo "✅ Terraform initialized"
echo ""

# Step 2: Check for terraform.tfvars
if [ ! -f "terraform.tfvars" ]; then
    echo "⚠️  Warning: terraform.tfvars not found"
    echo "   Copy terraform.tfvars.example to terraform.tfvars and configure it"
    echo "   Then run this script again"
    exit 1
fi

# Step 2.5: Sync Cloudflare token if needed
if [ -f "sync-cloudflare-token.sh" ]; then
    echo "Syncing Cloudflare API token..."
    ./sync-cloudflare-token.sh 2>/dev/null || true
fi

# Step 3: Deploy Infrastructure
echo "Step 2: Deploying infrastructure..."
echo "   This will take 5-10 minutes..."
terraform apply -auto-approve
echo "✅ Infrastructure deployed"
echo ""

# Step 4: Get outputs
echo "Step 3: Getting Terraform outputs..."
USER_POOL_ID=$(terraform output -raw user_pool_id 2>/dev/null || echo "")
BUCKET_NAME=$(terraform output -raw bucket_name 2>/dev/null || echo "")
CLOUDFRONT_ID=$(terraform output -raw cloudfront_id 2>/dev/null || echo "")
SITE_URL=$(terraform output -raw site_url 2>/dev/null || echo "")

if [ -z "$BUCKET_NAME" ] || [ -z "$CLOUDFRONT_ID" ]; then
    echo "❌ Error: Failed to get required Terraform outputs"
    echo "   Run: terraform output"
    exit 1
fi

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
# Use a strong temporary password that meets Cognito requirements
# Minimum 14 chars, uppercase, lowercase, number, symbol
TEMP_PASSWORD="TempPass123!@#$"
CREATE_OUTPUT=$(aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$USERNAME" \
  --user-attributes Name=email,Value="$EMAIL" \
  --temporary-password "$TEMP_PASSWORD" \
  --region us-west-2 2>&1) || true

if echo "$CREATE_OUTPUT" | grep -q "already exists\|UsernameExistsException"; then
    echo "   User already exists, will update password..."
else
    echo "   User created successfully"
    # Wait a moment for user to be fully created before setting password
    echo "   Waiting 2 seconds for user to be fully created..."
    sleep 2
fi

echo "   Setting permanent password..."
if aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "$USERNAME" \
  --password "$PASSWORD" \
  --permanent \
  --region us-west-2 2>&1; then
    echo "✅ Password set successfully"
else
    echo "⚠️  Warning: Failed to set password"
    echo "   You can set it manually by running: ./set-password.sh $USERNAME"
fi

echo "✅ User ready: $USERNAME"
echo ""

# Step 6: Update frontend environment
echo "Step 5: Updating frontend environment variables..."
if [ ! -d "$PROJECT_ROOT/frontend" ]; then
    echo "❌ Error: Frontend directory not found at $PROJECT_ROOT/frontend"
    exit 1
fi

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
    if [ $? -ne 0 ]; then
        echo "❌ Error: npm install failed"
        exit 1
    fi
fi

npm run build
if [ $? -ne 0 ]; then
    echo "❌ Error: npm run build failed"
    exit 1
fi

if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed - dist/ directory not found"
    exit 1
fi

echo "✅ Frontend built"
echo ""

# Step 8: Deploy frontend
echo "Step 7: Deploying frontend..."
if [ -f "deploy.sh" ]; then
    ./deploy.sh
    if [ $? -ne 0 ]; then
        echo "❌ Error: deploy.sh failed"
        exit 1
    fi
else
    echo "   Uploading to S3..."
    aws s3 sync dist/ "s3://$BUCKET_NAME/" --delete
    if [ $? -ne 0 ]; then
        echo "❌ Error: S3 sync failed"
        exit 1
    fi
    
    echo "   Invalidating CloudFront cache..."
    aws cloudfront create-invalidation \
      --distribution-id "$CLOUDFRONT_ID" \
      --paths "/*" > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo "⚠️  Warning: CloudFront invalidation failed (but files are uploaded)"
    fi
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
