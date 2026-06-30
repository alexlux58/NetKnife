#!/usr/bin/env bash
# Install production npm dependencies for every backend Lambda that has package.json.
# Used by Terraform (null_resource) and redeploy.sh before apply.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FUNCTIONS_DIR="$PROJECT_ROOT/backend/functions"

if [ ! -d "$FUNCTIONS_DIR" ]; then
  echo "Error: functions directory not found: $FUNCTIONS_DIR" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but not found in PATH" >&2
  exit 1
fi

installed=0
for pkg in "$FUNCTIONS_DIR"/*/package.json; do
  [ -f "$pkg" ] || continue
  dir="$(dirname "$pkg")"
  name="$(basename "$dir")"
  echo "==> npm install --omit=dev ($name)"
  (cd "$dir" && npm install --omit=dev)
  installed=$((installed + 1))
done

if [ "$installed" -eq 0 ]; then
  echo "No Lambda functions with package.json found under $FUNCTIONS_DIR"
else
  echo "Installed dependencies for $installed Lambda function(s)."
fi
