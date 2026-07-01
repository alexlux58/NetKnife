#!/usr/bin/env bash
# Copy netknife-common into the Lambda layer tree and PoC function node_modules.
# Run before Terraform zips / local backend tests.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SHARED_SRC="$PROJECT_ROOT/backend/shared/netknife-common"
LAYER_DEST="$PROJECT_ROOT/backend/layer/nodejs/node_modules/netknife-common"
POC_FUNCTIONS=(dns headers reverse-dns tls rdap traceroute)

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

for fn in "${POC_FUNCTIONS[@]}"; do
  fn_dir="$PROJECT_ROOT/backend/functions/$fn"
  if [ ! -d "$fn_dir" ]; then
    echo "Warning: function directory missing: $fn_dir" >&2
    continue
  fi
  echo "==> Linking netknife-common for local/tests: $fn"
  copy_shared "$fn_dir/node_modules/netknife-common"
done

echo "Prepared netknife-common for layer and ${#POC_FUNCTIONS[@]} function(s)."
