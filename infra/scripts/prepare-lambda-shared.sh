#!/usr/bin/env bash
# Copy netknife-common into the Lambda layer tree and PoC function node_modules.
# Run before Terraform zips / local backend tests.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SHARED_SRC="$PROJECT_ROOT/backend/shared/netknife-common"
LAYER_DEST="$PROJECT_ROOT/backend/layer/nodejs/node_modules/netknife-common"
FUNCTIONS_DIR="$PROJECT_ROOT/backend/functions"

if [ ! -f "$SHARED_SRC/package.json" ]; then
  echo "Error: shared module not found at $SHARED_SRC" >&2
  exit 1
fi

copy_shared() {
  local dest="$1"
  rm -rf "$dest"
  mkdir -p "$(dirname "$dest")"
  cp -R "$SHARED_SRC/." "$dest"
}

echo "==> Preparing Lambda layer: netknife-common"
copy_shared "$LAYER_DEST"

# Auto-discover every function that requires the shared module, so newly
# migrated functions get the local/test copy without editing this script.
count=0
while IFS= read -r fn_dir; do
  fn="$(basename "$fn_dir")"
  if grep -rql "require(['\"]netknife-common['\"])" "$fn_dir"/*.js 2>/dev/null; then
    echo "==> Linking netknife-common for local/tests: $fn"
    copy_shared "$fn_dir/node_modules/netknife-common"
    count=$((count + 1))
  fi
done < <(find "$FUNCTIONS_DIR" -mindepth 1 -maxdepth 1 -type d | sort)

echo "Prepared netknife-common for layer and ${count} function(s)."
