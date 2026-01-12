#!/bin/bash
# DNS Diagnostic Script for NetKnife
# Checks DNS propagation and Cloudflare record configuration

set -e

echo "=========================================="
echo "NetKnife DNS Diagnostic"
echo "=========================================="
echo ""

DOMAIN="tools.alexflux.com"
CLOUDFRONT_DOMAIN="d3r72xmc8pu9ul.cloudfront.net"

echo "Expected Configuration:"
echo "  Domain: $DOMAIN"
echo "  Should point to: $CLOUDFRONT_DOMAIN"
echo ""

echo "Checking DNS records..."
echo ""

# Check using different DNS servers
echo "1. Checking with Google DNS (8.8.8.8):"
dig @8.8.8.8 +short $DOMAIN CNAME || echo "  No CNAME record found"
echo ""

echo "2. Checking with Cloudflare DNS (1.1.1.1):"
dig @1.1.1.1 +short $DOMAIN CNAME || echo "  No CNAME record found"
echo ""

echo "3. Checking with your local DNS:"
dig +short $DOMAIN CNAME || echo "  No CNAME record found"
echo ""

echo "4. Full DNS query:"
dig $DOMAIN ANY +noall +answer || echo "  Query failed"
echo ""

echo "=========================================="
echo "Troubleshooting Steps:"
echo "=========================================="
echo ""
echo "If DNS records are not found:"
echo "  1. Check Cloudflare dashboard: https://dash.cloudflare.com"
echo "  2. Verify DNS record exists for: $DOMAIN"
echo "  3. Ensure it points to: $CLOUDFRONT_DOMAIN"
echo "  4. DNS propagation can take 5-60 minutes"
echo ""
echo "If DNS record exists but site doesn't load:"
echo "  1. Verify CloudFront distribution is deployed:"
echo "     aws cloudfront get-distribution --id E38VXFFR6VR8F7"
echo "  2. Check CloudFront status is 'Deployed'"
echo "  3. Verify ACM certificate is validated"
echo "  4. Check CloudFront aliases include: $DOMAIN"
echo ""
echo "To check CloudFront directly:"
echo "  curl -I https://$CLOUDFRONT_DOMAIN"
echo ""
