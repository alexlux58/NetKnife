#!/bin/bash
# Terraform Apply Script for NetKnife
# Handles apply with proper input handling

set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "NetKnife Terraform Apply"
echo "=========================================="
echo ""

# Check if terraform is initialized
if [ ! -d ".terraform" ] || [ ! -f ".terraform.lock.hcl" ]; then
    echo "⚠ Terraform not initialized. Running init first..."
    terraform init -upgrade -reconfigure
    echo ""
fi

# Run plan first to show what will be created
echo "Running terraform plan..."
terraform plan -out=tfplan

echo ""
echo "=========================================="
read -p "Apply the plan above? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Apply cancelled by user"
    exit 0
fi

echo ""
echo "Applying Terraform plan..."
terraform apply tfplan

echo ""
echo "✓ Apply complete!"
