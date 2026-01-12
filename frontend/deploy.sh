#!/bin/bash
# Deploy frontend to S3 and invalidate CloudFront cache

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra/envs/dev"

echo "=========================================="
echo "NetKnife Frontend Deployment"
echo "=========================================="
echo ""

# Check if dist folder exists
if [ ! -d "$SCRIPT_DIR/dist" ]; then
    echo "❌ Error: dist/ folder not found"
    echo "   Run: npm run build"
    exit 1
fi

# Get bucket name from Terraform
cd "$INFRA_DIR"
BUCKET_NAME=$(terraform output -raw bucket_name)
CLOUDFRONT_ID=$(terraform output -raw cloudfront_id)

echo "Configuration:"
echo "  Bucket: $BUCKET_NAME"
echo "  CloudFront ID: $CLOUDFRONT_ID"
echo ""

# Upload to S3
echo "Uploading files to S3..."
cd "$SCRIPT_DIR"
aws s3 sync dist/ "s3://$BUCKET_NAME/" --delete

echo ""
echo "✅ Files uploaded successfully"
echo ""

# Invalidate CloudFront cache
echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_ID" \
    --paths "/*"

echo ""
echo "✅ CloudFront cache invalidation initiated"
echo ""
echo "Deployment complete! Your site should be live in a few minutes."
echo "URL: https://tools.alexflux.com"
echo ""
