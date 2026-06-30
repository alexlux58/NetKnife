#!/usr/bin/env bash
# Write terraform.tfvars in CI from the NETKNIFE_TFVARS GitHub Actions secret.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${ROOT}/infra/envs/dev/terraform.tfvars"

if [ -z "${NETKNIFE_TFVARS:-}" ]; then
  echo "Error: NETKNIFE_TFVARS secret is not set." >&2
  echo "Copy your local infra/envs/dev/terraform.tfvars into a GitHub Actions secret." >&2
  echo "See docs/CICD.md" >&2
  exit 1
fi

printf '%s\n' "$NETKNIFE_TFVARS" > "$OUT"
echo "Wrote ${OUT} ($(wc -l < "$OUT" | tr -d ' ') lines)"
