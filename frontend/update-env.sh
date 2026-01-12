#!/bin/bash
# Script to update frontend .env.production with current Terraform outputs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra/envs/dev"

echo "=========================================="
echo "Updating Frontend Environment Variables"
echo "=========================================="
echo ""

# Check if Terraform is initialized
if [ ! -d "$INFRA_DIR/.terraform" ]; then
    echo "❌ Error: Terraform not initialized in $INFRA_DIR"
    echo "   Run: cd $INFRA_DIR && terraform init"
    exit 1
fi

# Get values from Terraform
cd "$INFRA_DIR"

echo "Fetching values from Terraform..."
COGNITO_DOMAIN=$(terraform output -raw cognito_domain_url)
CLIENT_ID=$(terraform output -raw client_id)
ISSUER=$(terraform output -raw cognito_issuer)
API_URL=$(terraform output -raw api_url)
SITE_URL=$(terraform output -raw site_url)

echo "  Cognito Domain: $COGNITO_DOMAIN"
echo "  Client ID: $CLIENT_ID"
echo "  Issuer: $ISSUER"
echo "  API URL: $API_URL"
echo "  Site URL: $SITE_URL"
echo ""

# Update .env.production
ENV_FILE="$SCRIPT_DIR/.env.production"

echo "Updating $ENV_FILE..."

cat > "$ENV_FILE" << EOF
VITE_API_URL=$API_URL
VITE_COGNITO_DOMAIN=$COGNITO_DOMAIN
VITE_COGNITO_CLIENT_ID=$CLIENT_ID
VITE_COGNITO_ISSUER=$ISSUER
VITE_OIDC_REDIRECT_URI=$SITE_URL/callback
VITE_OIDC_POST_LOGOUT_REDIRECT_URI=$SITE_URL/login
VITE_REGION=us-west-2
VITE_DEV_BYPASS_AUTH=false
EOF

echo "✅ Updated $ENV_FILE"
echo ""
echo "Next steps:"
echo "  1. Review the updated file: cat $ENV_FILE"
echo "  2. Rebuild the frontend: npm run build"
echo "  3. Upload to S3: aws s3 sync dist/ s3://<bucket-name>/"
echo ""
