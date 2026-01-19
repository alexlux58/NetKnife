#!/bin/bash
# Toggle the sign-up failsafe for NetKnife Cognito.
# Usage: ./toggle-signups.sh [enable|disable]
# Requires: terraform output auth_config_table_name, aws CLI, and running from this directory.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TABLE=$(terraform output -raw auth_config_table_name 2>/dev/null) || true
if [ -z "$TABLE" ]; then
  echo "Run 'terraform apply' first to create the auth config table."
  exit 1
fi

case "${1:-}" in
  disable)
    aws dynamodb put-item --table-name "$TABLE" --item '{"id":{"S":"CONFIG"},"signups_enabled":{"BOOL":false}}'
    echo "Sign-ups are now DISABLED (failsafe on). New self-signups will be rejected."
    ;;
  enable)
    aws dynamodb put-item --table-name "$TABLE" --item '{"id":{"S":"CONFIG"},"signups_enabled":{"BOOL":true}}'
    echo "Sign-ups are now ENABLED. New users can create accounts."
    ;;
  status)
    OUT=$(aws dynamodb get-item --table-name "$TABLE" --key '{"id":{"S":"CONFIG"}}' --query 'Item.signups_enabled.BOOL' --output text 2>/dev/null || echo "absent")
    if [ "$OUT" = "False" ]; then
      echo "Sign-ups: DISABLED (failsafe on)"
    elif [ "$OUT" = "True" ]; then
      echo "Sign-ups: ENABLED"
    else
      echo "Sign-ups: ENABLED (no CONFIG item; default is allow)"
    fi
    ;;
  *)
    echo "Usage: $0 [enable|disable|status]"
    echo "  enable  - Allow new sign-ups"
    echo "  disable - Failsafe: reject new sign-ups"
    echo "  status  - Show current state"
    exit 1
    ;;
esac
