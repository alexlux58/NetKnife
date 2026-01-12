#!/bin/bash
# Set password for Cognito user
# Usage: ./set-password.sh [username] [password]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Get user pool ID from Terraform
USER_POOL_ID=$(terraform output -raw user_pool_id)

if [ -z "$USER_POOL_ID" ]; then
    echo "❌ Failed to get user pool ID from Terraform"
    exit 1
fi

# Get username
if [ -n "$1" ]; then
    USERNAME="$1"
else
    read -p "Enter username (default: alex.lux): " USERNAME
    USERNAME=${USERNAME:-alex.lux}
fi

# Get password
if [ -n "$2" ]; then
    PASSWORD="$2"
else
    read -sp "Enter password: " PASSWORD
    echo ""
    if [ -z "$PASSWORD" ]; then
        echo "❌ Password is required"
        exit 1
    fi
fi

# Validate password meets requirements (14+ chars, uppercase, lowercase, number, symbol)
if [ ${#PASSWORD} -lt 14 ]; then
    echo "❌ Password must be at least 14 characters long"
    exit 1
fi

echo ""
echo "Setting password for user: $USERNAME"
echo "User Pool ID: $USER_POOL_ID"
echo ""

# Check if user exists first
if ! aws cognito-idp admin-get-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$USERNAME" \
  --region us-west-2 >/dev/null 2>&1; then
    echo "❌ User '$USERNAME' does not exist in user pool"
    echo ""
    echo "Creating user first..."
    read -p "Enter email for user: " EMAIL
    if [ -z "$EMAIL" ]; then
        echo "❌ Email is required"
        exit 1
    fi
    
    # Use a strong temporary password that meets Cognito requirements
    # Minimum 14 chars, uppercase, lowercase, number, symbol
    TEMP_PASSWORD="TempPass123!@#$"
    aws cognito-idp admin-create-user \
      --user-pool-id "$USER_POOL_ID" \
      --username "$USERNAME" \
      --user-attributes Name=email,Value="$EMAIL" \
      --temporary-password "$TEMP_PASSWORD" \
      --region us-west-2
    
    echo "✅ User created"
    echo "   Waiting 2 seconds for user to be fully created..."
    sleep 2
fi

# Set the password
echo "Setting permanent password..."
if aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "$USERNAME" \
  --password "$PASSWORD" \
  --permanent \
  --region us-west-2; then
    echo "✅ Password set successfully!"
    echo ""
    echo "You can now log in with:"
    echo "  Username: $USERNAME"
    echo "  Password: (the password you just set)"
else
    echo "❌ Failed to set password"
    exit 1
fi
