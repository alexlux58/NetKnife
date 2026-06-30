#!/usr/bin/env bash
# Create NetKnife API Access product + $5/mo price in the Stripe account from terraform.tfvars.
# Prints the price_... ID to add as stripe_pro_price_id.
#
# Usage:
#   bash infra/scripts/create-stripe-price.sh
#   bash infra/scripts/create-stripe-price.sh --update-tfvars   # also patches terraform.tfvars

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TFVARS="${PROJECT_ROOT}/infra/envs/dev/terraform.tfvars"
UPDATE_TFVARS=false

if [[ "${1:-}" == "--update-tfvars" ]]; then
  UPDATE_TFVARS=true
fi

read_tfvar() {
  grep -E "^${1}[[:space:]]*=" "$TFVARS" | sed 's/^[^=]*=[[:space:]]*"\([^"]*\)".*/\1/' | head -1
}

STRIPE_KEY="${STRIPE_SECRET_KEY:-$(read_tfvar stripe_secret_key)}"
if [[ -z "$STRIPE_KEY" ]]; then
  echo "Error: stripe_secret_key not set in terraform.tfvars" >&2
  exit 1
fi

echo "==> Listing existing monthly recurring prices..."
EXISTING="$(curl -s -u "${STRIPE_KEY}:" \
  "https://api.stripe.com/v1/prices?limit=20&active=true" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data.get('error'):
    print('ERROR:' + data['error']['message'], file=sys.stderr)
    sys.exit(1)
for p in data.get('data', []):
    rec = p.get('recurring') or {}
    if rec.get('interval') != 'month':
        continue
    amt = (p.get('unit_amount') or 0) / 100
    print(f\"{p['id']}\t\${amt:.2f}/mo\t{p.get('nickname') or p.get('product')}\")
")"

if [[ -n "$EXISTING" ]]; then
  echo "$EXISTING"
  BEST="$(echo "$EXISTING" | awk -F'\t' '$2 == "\$5.00/mo" {print $1; exit}')"
  if [[ -z "$BEST" ]]; then
    BEST="$(echo "$EXISTING" | head -1 | awk -F'\t' '{print $1}')"
  fi
  echo ""
  echo "Using existing price: $BEST"
  PRICE_ID="$BEST"
else
  echo "No monthly prices found — creating product and \$5/mo price..."
  PRODUCT_JSON="$(curl -s -u "${STRIPE_KEY}:" \
    -d "name=NetKnife API Access" \
    -d "description=500 API calls, 100 Security Advisor messages, 50 saved reports per month" \
    "https://api.stripe.com/v1/products")"
  PRODUCT_ID="$(echo "$PRODUCT_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if d.get('error'):
    print('ERROR:' + d['error']['message'], file=sys.stderr)
    sys.exit(1)
print(d['id'])
")"

  PRICE_JSON="$(curl -s -u "${STRIPE_KEY}:" \
    -d "product=${PRODUCT_ID}" \
    -d "unit_amount=500" \
    -d "currency=usd" \
    -d "recurring[interval]=month" \
    -d "nickname=NetKnife API Access \$5/mo" \
    "https://api.stripe.com/v1/prices")"
  PRICE_ID="$(echo "$PRICE_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if d.get('error'):
    print('ERROR:' + d['error']['message'], file=sys.stderr)
    sys.exit(1)
print(d['id'])
")"
  echo "Created product ${PRODUCT_ID}"
  echo "Created price ${PRICE_ID} (\$5.00/month)"
fi

echo ""
echo "=========================================="
echo "stripe_pro_price_id = \"${PRICE_ID}\""
echo "=========================================="

if $UPDATE_TFVARS; then
  if grep -q '^stripe_pro_price_id' "$TFVARS"; then
    sed -i.bak "s|^stripe_pro_price_id = .*|stripe_pro_price_id = \"${PRICE_ID}\"|" "$TFVARS"
    rm -f "${TFVARS}.bak"
    echo "Updated ${TFVARS}"
  else
    echo "stripe_pro_price_id = \"${PRICE_ID}\"" >> "$TFVARS"
    echo "Appended to ${TFVARS}"
  fi
  echo ""
  echo "Deploy billing Lambda:"
  echo "  nk deploy-lambda billing"
  echo "  # or: cd infra/envs/dev && terraform apply -target=module.api.aws_lambda_function.billing -auto-approve"
fi
