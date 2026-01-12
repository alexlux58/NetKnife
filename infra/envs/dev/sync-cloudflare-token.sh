#!/bin/bash
# Sync Cloudflare API token from openarena project to terraform.tfvars
# This ensures the token is available for Terraform without manual setup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENARENA_DIR="$SCRIPT_DIR/../../../../openarena-aws"
TFVARS_FILE="$SCRIPT_DIR/terraform.tfvars"
TFVARS_EXAMPLE="$SCRIPT_DIR/terraform.tfvars.example"

# Try to load token from multiple sources
TOKEN=""

# 1. Try local .env file
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env" 2>/dev/null || true
    if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
        TOKEN="$CLOUDFLARE_API_TOKEN"
        echo "✅ Found token in local .env"
    fi
fi

# 2. Try openarena project .env file
if [ -z "$TOKEN" ] && [ -f "$OPENARENA_DIR/.env" ]; then
    source "$OPENARENA_DIR/.env" 2>/dev/null || true
    if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
        TOKEN="$CLOUDFLARE_API_TOKEN"
        echo "✅ Found token in openarena project"
    fi
fi

# 3. Try environment variable
if [ -z "$TOKEN" ] && [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    TOKEN="$CLOUDFLARE_API_TOKEN"
    echo "✅ Found token in environment"
fi

# 4. Try reading from existing terraform.tfvars
if [ -z "$TOKEN" ] && [ -f "$TFVARS_FILE" ]; then
    EXISTING_TOKEN=$(grep -E "^cloudflare_api_token\s*=" "$TFVARS_FILE" 2>/dev/null | sed 's/.*=\s*"\(.*\)".*/\1/' | head -1)
    if [ -n "$EXISTING_TOKEN" ]; then
        TOKEN="$EXISTING_TOKEN"
        echo "✅ Found token in existing terraform.tfvars"
    fi
fi

if [ -z "$TOKEN" ]; then
    echo "❌ Cloudflare API token not found"
    echo ""
    echo "Please provide the token in one of these ways:"
    echo "  1. Create .env file: echo 'CLOUDFLARE_API_TOKEN=\"your-token\"' > $SCRIPT_DIR/.env"
    echo "  2. Set environment: export CLOUDFLARE_API_TOKEN=\"your-token\""
    echo "  3. Add to terraform.tfvars: cloudflare_api_token = \"your-token\""
    echo "  4. Ensure openarena project has .env with CLOUDFLARE_API_TOKEN"
    exit 1
fi

# Check if terraform.tfvars exists
if [ ! -f "$TFVARS_FILE" ]; then
    echo "⚠️  terraform.tfvars not found, creating from example..."
    if [ -f "$TFVARS_EXAMPLE" ]; then
        cp "$TFVARS_EXAMPLE" "$TFVARS_FILE"
        echo "✅ Created terraform.tfvars from example"
    else
        echo "❌ terraform.tfvars.example not found!"
        exit 1
    fi
fi

# Update or add cloudflare_api_token in terraform.tfvars
if grep -q "^cloudflare_api_token\s*=" "$TFVARS_FILE"; then
    # Update existing token
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^cloudflare_api_token\s*=.*|cloudflare_api_token = \"$TOKEN\"|" "$TFVARS_FILE"
    else
        # Linux
        sed -i "s|^cloudflare_api_token\s*=.*|cloudflare_api_token = \"$TOKEN\"|" "$TFVARS_FILE"
    fi
    echo "✅ Updated cloudflare_api_token in terraform.tfvars"
else
    # Add new token (find a good place to insert it)
    if grep -q "^cloudflare_zone_id\s*=" "$TFVARS_FILE"; then
        # Insert after cloudflare_subdomain
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "/^cloudflare_subdomain\s*=.*/a\\
cloudflare_api_token = \"$TOKEN\"
" "$TFVARS_FILE"
        else
            # Linux
            sed -i "/^cloudflare_subdomain\s*=.*/a cloudflare_api_token = \"$TOKEN\"" "$TFVARS_FILE"
        fi
    else
        # Append to end of file
        echo "" >> "$TFVARS_FILE"
        echo "# Cloudflare API Token (auto-synced)" >> "$TFVARS_FILE"
        echo "cloudflare_api_token = \"$TOKEN\"" >> "$TFVARS_FILE"
    fi
    echo "✅ Added cloudflare_api_token to terraform.tfvars"
fi

echo ""
echo "✅ Cloudflare token synced to terraform.tfvars"
echo "   Token is now available for Terraform"
