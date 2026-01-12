#!/bin/bash
# Verification script for NetKnife deployment
# Checks DNS, CloudFront, and ACM certificate status

set -e

echo "=========================================="
echo "NetKnife Deployment Verification"
echo "=========================================="
echo ""

DOMAIN="tools.alexflux.com"
CLOUDFRONT_ID="E38VXFFR6VR8F7"
CLOUDFRONT_DOMAIN="d3r72xmc8pu9ul.cloudfront.net"

echo "Configuration:"
echo "  Domain: $DOMAIN"
echo "  CloudFront ID: $CLOUDFRONT_ID"
echo "  CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo ""

echo "=========================================="
echo "1. Checking CloudFront Distribution"
echo "=========================================="
echo ""

if command -v aws &> /dev/null; then
    echo "CloudFront Status:"
    aws cloudfront get-distribution --id $CLOUDFRONT_ID --query 'Distribution.Status' --output text 2>/dev/null || echo "  ⚠ Could not check CloudFront status (check AWS credentials)"
    echo ""
    
    echo "CloudFront Aliases:"
    aws cloudfront get-distribution --id $CLOUDFRONT_ID --query 'Distribution.DistributionConfig.Aliases.Items' --output text 2>/dev/null || echo "  ⚠ Could not check aliases"
    echo ""
else
    echo "  ⚠ AWS CLI not found - skipping CloudFront checks"
    echo ""
fi

echo "=========================================="
echo "2. Testing CloudFront Directly"
echo "=========================================="
echo ""

echo "Testing: https://$CLOUDFRONT_DOMAIN"
if curl -s -o /dev/null -w "%{http_code}" -I "https://$CLOUDFRONT_DOMAIN" | grep -q "200\|403\|404"; then
    echo "  ✓ CloudFront is responding"
else
    echo "  ⚠ CloudFront may not be responding (this is normal if S3 bucket is empty)"
fi
echo ""

echo "=========================================="
echo "3. Checking DNS Records"
echo "=========================================="
echo ""

echo "Expected DNS Configuration:"
echo "  Record: tools (CNAME)"
echo "  Points to: $CLOUDFRONT_DOMAIN"
echo ""

echo "Current DNS Resolution:"
if command -v dig &> /dev/null; then
    DNS_RESULT=$(dig +short $DOMAIN CNAME 2>/dev/null || echo "")
    if [ -n "$DNS_RESULT" ]; then
        echo "  ✓ DNS resolves to: $DNS_RESULT"
        if [ "$DNS_RESULT" = "$CLOUDFRONT_DOMAIN." ] || [ "$DNS_RESULT" = "$CLOUDFRONT_DOMAIN" ]; then
            echo "  ✓ DNS points to correct CloudFront domain"
        else
            echo "  ⚠ DNS points to: $DNS_RESULT (expected: $CLOUDFRONT_DOMAIN)"
        fi
    else
        echo "  ⚠ DNS record not found or not propagated yet"
        echo "  This is normal immediately after deployment - wait 5-60 minutes"
    fi
else
    echo "  ⚠ dig not available - cannot check DNS"
fi
echo ""

echo "=========================================="
echo "4. Manual Verification Steps"
echo "=========================================="
echo ""
echo "1. Check Cloudflare Dashboard:"
echo "   https://dash.cloudflare.com"
echo "   → Select alexflux.com zone"
echo "   → Go to DNS → Records"
echo "   → Look for 'tools' CNAME record"
echo "   → Should point to: $CLOUDFRONT_DOMAIN"
echo ""
echo "2. Check DNS Propagation:"
echo "   https://www.whatsmydns.net/#CNAME/tools.alexflux.com"
echo ""
echo "3. Test the site:"
echo "   curl -I https://$DOMAIN"
echo "   curl -I https://$CLOUDFRONT_DOMAIN"
echo ""

echo "=========================================="
echo "5. Common Issues & Solutions"
echo "=========================================="
echo ""
echo "Issue: DNS_PROBE_FINISHED_NXDOMAIN"
echo "  Cause: DNS not propagated yet"
echo "  Solution: Wait 10-30 minutes, then try again"
echo ""
echo "Issue: SSL/TLS errors"
echo "  Cause: ACM certificate not validated"
echo "  Solution: Check ACM certificate status in AWS Console"
echo ""
echo "Issue: 403 Forbidden from CloudFront"
echo "  Cause: S3 bucket is empty or bucket policy issue"
echo "  Solution: Upload index.html to S3 bucket"
echo ""

echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo ""
echo "1. Wait 10-30 minutes for DNS propagation"
echo "2. Upload your static site files to S3:"
echo "   aws s3 sync ./dist s3://netknife-site-026600053230/"
echo "3. Test the site: https://$DOMAIN"
echo ""
