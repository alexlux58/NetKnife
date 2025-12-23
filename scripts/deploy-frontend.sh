#!/bin/bash
# ==============================================================================
# NETKNIFE - FRONTEND DEPLOYMENT SCRIPT
# ==============================================================================
# This script builds and deploys the frontend to S3/CloudFront.
#
# Usage:
#   ./scripts/deploy-frontend.sh
#
# Prerequisites:
#   - AWS CLI configured
#   - Terraform outputs available
#   - Node.js installed
#   - frontend/.env.local configured
# ==============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== NetKnife Frontend Deployment ===${NC}"

# Change to frontend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../frontend"

# Check for .env.local
if [ ! -f ".env.local" ]; then
    echo -e "${RED}Error: frontend/.env.local not found${NC}"
    echo "Create it with your environment variables from Terraform outputs."
    exit 1
fi

# Check for node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Build the frontend
echo -e "${YELLOW}Building frontend...${NC}"
npm run build

# Get bucket name and CloudFront distribution ID
# Try to read from terraform
INFRA_DIR="$SCRIPT_DIR/../infra/envs/dev"

if [ -f "$INFRA_DIR/terraform.tfstate" ]; then
    echo -e "${YELLOW}Reading deployment info from Terraform state...${NC}"
    BUCKET=$(terraform -chdir="$INFRA_DIR" output -raw bucket_name 2>/dev/null || echo "")
    CF_ID=$(terraform -chdir="$INFRA_DIR" output -raw cloudfront_id 2>/dev/null || echo "")
else
    echo -e "${YELLOW}Terraform state not found. Please provide values:${NC}"
    read -p "S3 Bucket name: " BUCKET
    read -p "CloudFront Distribution ID: " CF_ID
fi

if [ -z "$BUCKET" ]; then
    echo -e "${RED}Error: Could not determine S3 bucket name${NC}"
    exit 1
fi

# Upload to S3
echo -e "${YELLOW}Uploading to S3 bucket: $BUCKET${NC}"
aws s3 sync dist/ "s3://$BUCKET/" --delete

# Invalidate CloudFront cache
if [ -n "$CF_ID" ]; then
    echo -e "${YELLOW}Invalidating CloudFront cache...${NC}"
    aws cloudfront create-invalidation \
        --distribution-id "$CF_ID" \
        --paths "/*" \
        --output text
fi

echo -e "${GREEN}=== Deployment Complete! ===${NC}"

# Show URL
if [ -f "$INFRA_DIR/terraform.tfstate" ]; then
    SITE_URL=$(terraform -chdir="$INFRA_DIR" output -raw site_url 2>/dev/null || echo "")
    if [ -n "$SITE_URL" ]; then
        echo -e "Site URL: ${GREEN}$SITE_URL${NC}"
    fi
fi

