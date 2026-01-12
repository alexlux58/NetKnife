#!/bin/bash
# Fix DNS record creation issue
# This script ensures the Cloudflare DNS record is created

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "Fixing DNS Record"
echo "=========================================="
echo ""

cd "$SCRIPT_DIR"

# Check if variables are set
echo "Checking terraform.tfvars..."
if ! grep -q "^cloudflare_zone_name\s*=" terraform.tfvars; then
    echo "❌ cloudflare_zone_name not found in terraform.tfvars"
    exit 1
fi

if ! grep -q "^cloudflare_subdomain\s*=" terraform.tfvars; then
    echo "❌ cloudflare_subdomain not found in terraform.tfvars"
    exit 1
fi

echo "✅ Variables are set"
echo ""

# Get values
CLOUDFRONT_DOMAIN=$(terraform output -raw cloudfront_domain)
CLOUDFLARE_ZONE_ID=$(grep "^cloudflare_zone_id\s*=" terraform.tfvars | sed 's/.*=\s*"\(.*\)".*/\1/')
CLOUDFLARE_SUBDOMAIN=$(grep "^cloudflare_subdomain\s*=" terraform.tfvars | sed 's/.*=\s*"\(.*\)".*/\1/')
CLOUDFLARE_API_TOKEN=$(grep "^cloudflare_api_token\s*=" terraform.tfvars | sed 's/.*=\s*"\(.*\)".*/\1/')

echo "Configuration:"
echo "  CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo "  Cloudflare Zone ID: $CLOUDFLARE_ZONE_ID"
echo "  Cloudflare Subdomain: $CLOUDFLARE_SUBDOMAIN"
echo ""

# Check if DNS record exists in Terraform state
if terraform state list | grep -q "module.static_site.cloudflare_dns_record.site"; then
    echo "✅ DNS record exists in Terraform state"
    echo "   Running terraform apply to ensure it's up to date..."
    terraform apply -target=module.static_site.cloudflare_dns_record.site -auto-approve
else
    echo "⚠️  DNS record NOT in Terraform state"
    echo "   Creating it now..."
    terraform apply -target=module.static_site.cloudflare_dns_record.site -auto-approve
fi

echo ""
echo "✅ DNS record should now be created"
echo ""
echo "Verification:"
echo "  1. Check Cloudflare dashboard: https://dash.cloudflare.com"
echo "  2. Look for DNS record: $CLOUDFLARE_SUBDOMAIN → $CLOUDFLARE_DOMAIN"
echo "  3. Wait 5-60 minutes for DNS propagation"
echo "  4. Test: dig tools.alexflux.com CNAME"
echo ""
