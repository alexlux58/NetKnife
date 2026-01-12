#!/bin/bash
# Terraform Initialization Script for NetKnife
# Handles TLS certificate issues and provides clear feedback

set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "NetKnife Terraform Initialization"
echo "=========================================="
echo ""

# Step 1: Clean up
echo "Step 1: Cleaning up old Terraform state..."
rm -rf .terraform .terraform.lock.hcl
echo "✓ Cleaned .terraform directory"
echo ""

# Step 2: Check prerequisites
echo "Step 2: Checking prerequisites..."
if ! command -v terraform &> /dev/null; then
    echo "✗ ERROR: Terraform is not installed"
    exit 1
fi

TERRAFORM_VERSION=$(terraform version -json | grep -o '"terraform_version":"[^"]*' | cut -d'"' -f4)
echo "✓ Terraform version: $TERRAFORM_VERSION"
echo ""

# Step 3: Try initialization with different methods
echo "Step 3: Initializing Terraform providers..."
echo ""

# Method 1: Normal initialization
echo "Attempting standard initialization..."
if terraform init -upgrade -reconfigure 2>&1 | tee init.log; then
    echo ""
    echo "✓ SUCCESS: Terraform initialized successfully!"
    terraform providers
    exit 0
fi

echo ""
echo "⚠ Standard initialization failed, checking error..."
if grep -q "x509\|certificate\|TLS" init.log; then
    echo "TLS certificate issue detected. Trying workaround..."
    echo ""
    
    # Method 2: Try with TLS workaround
    echo "Attempting with TLS workaround..."
    export GODEBUG=x509ignoreCN=0
    
    if terraform init -upgrade -reconfigure 2>&1 | tee init2.log; then
        echo ""
        echo "✓ SUCCESS: Terraform initialized with TLS workaround!"
        terraform providers
        exit 0
    fi
    
    echo ""
    echo "⚠ TLS workaround also failed"
fi

echo ""
echo "✗ ERROR: Failed to initialize Terraform"
echo ""
echo "Troubleshooting steps:"
echo "1. Check your internet connection"
echo "2. Update system certificates: brew install ca-certificates"
echo "3. Check firewall/proxy settings"
echo "4. Review init.log for detailed errors"
echo ""
echo "See TROUBLESHOOTING.md for more help"
exit 1
