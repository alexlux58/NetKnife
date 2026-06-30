#!/usr/bin/env bash
# Configure Stripe webhook for NetKnife and print tfvars values.
#
# Usage (test mode):
#   export API_URL="$(cd infra/envs/dev && terraform output -raw api_url)"
#   bash infra/scripts/setup-stripe.sh test
#
# Usage (live mode — real charges):
#   STRIPE_SECRET_KEY=sk_live_... bash infra/scripts/setup-stripe.sh live
#
# Optional: WEBHOOK_URL overrides auto-built URL from API_URL

set -euo pipefail

MODE="${1:-test}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TFVARS="$PROJECT_ROOT/infra/envs/dev/terraform.tfvars"

if [[ "$MODE" != "test" && "$MODE" != "live" ]]; then
  echo "Usage: $0 [test|live]" >&2
  exit 1
fi

read_tfvar() {
  local key="$1"
  grep -E "^${key}[[:space:]]*=" "$TFVARS" | sed 's/^[^=]*=[[:space:]]*"\([^"]*\)".*/\1/' | head -1
}

if [[ -n "${STRIPE_SECRET_KEY:-}" ]]; then
  STRIPE_KEY="$STRIPE_SECRET_KEY"
else
  STRIPE_KEY="$(read_tfvar stripe_secret_key)"
fi

if [[ -z "$STRIPE_KEY" ]]; then
  echo "Error: set stripe_secret_key in terraform.tfvars or export STRIPE_SECRET_KEY" >&2
  exit 1
fi

if [[ "$MODE" == "test" && "$STRIPE_KEY" != sk_test_* ]]; then
  echo "Warning: running in test mode but key is not sk_test_..." >&2
fi
if [[ "$MODE" == "live" && "$STRIPE_KEY" != sk_live_* ]]; then
  echo "Warning: running in live mode but key is not sk_live_..." >&2
fi

API_URL="${API_URL:-}"
if [[ -z "$API_URL" ]]; then
  if [[ -d "$PROJECT_ROOT/infra/envs/dev/.terraform" ]]; then
    API_URL="$(cd "$PROJECT_ROOT/infra/envs/dev" && terraform output -raw api_url 2>/dev/null || true)"
  fi
fi

if [[ -z "${WEBHOOK_URL:-}" ]]; then
  if [[ -z "$API_URL" ]]; then
    echo "Error: set API_URL or run terraform apply and ensure 'terraform output api_url' works." >&2
    echo "  export API_URL=https://YOUR_API_ID.execute-api.us-west-2.amazonaws.com" >&2
    exit 1
  fi
  WEBHOOK_URL="${API_URL%/}/billing/webhook"
fi

echo "==> Stripe mode: $MODE"
echo "==> Webhook URL: $WEBHOOK_URL"
echo ""

echo "==> Recurring prices in Stripe account:"
curl -s -u "${STRIPE_KEY}:" \
  "https://api.stripe.com/v1/prices?limit=20&active=true" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data.get('error'):
    print('ERROR:', data['error']['message']); sys.exit(1)
for p in data.get('data', []):
    rec = p.get('recurring') or {}
    if rec.get('interval') != 'month':
        continue
    amt = (p.get('unit_amount') or 0) / 100
    print(f\"  {p['id']}  \${amt:.2f}/{rec.get('interval')}  product={p.get('product')}\")
"

PRICE_ID="${STRIPE_PRO_PRICE_ID:-$(read_tfvar stripe_pro_price_id)}"
if [[ -z "$PRICE_ID" || "$PRICE_ID" != price_* ]]; then
  echo ""
  echo "Error: stripe_pro_price_id must be set to a price_... ID in terraform.tfvars" >&2
  exit 1
fi

echo ""
echo "==> Using price: $PRICE_ID"
echo "==> Creating webhook endpoint (if not already present)..."

WEBHOOK_JSON="$(curl -s -u "${STRIPE_KEY}:" \
  -d "url=${WEBHOOK_URL}" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  "https://api.stripe.com/v1/webhook_endpoints")"

WH_SECRET="$(echo "$WEBHOOK_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if d.get('error'):
    msg = d['error'].get('message', '')
    if 'already exists' in msg.lower():
        print('DUPLICATE')
    else:
        print('ERROR:' + msg)
        sys.exit(1)
else:
    print(d.get('secret', ''))
")"

if [[ "$WH_SECRET" == "DUPLICATE" ]]; then
  echo "A webhook for this URL may already exist. List in Stripe Dashboard → Developers → Webhooks"
  echo "Copy the signing secret (whsec_...) manually into terraform.tfvars"
  WH_SECRET=""
elif [[ "$WH_SECRET" == ERROR:* ]]; then
  echo "$WH_SECRET" >&2
  exit 1
fi

echo ""
echo "=========================================="
echo "Add/update in infra/envs/dev/terraform.tfvars:"
echo "=========================================="
echo ""
echo "stripe_pro_price_id   = \"$PRICE_ID\""
if [[ -n "$WH_SECRET" ]]; then
  echo "stripe_webhook_secret = \"$WH_SECRET\""
fi
echo ""
echo "Then deploy:"
echo "  bash infra/scripts/install-lambda-deps.sh"
echo "  cd infra/envs/dev && terraform apply"
echo ""
echo "Test checkout (non-exempt user only — alex.lux is grandfathered):"
echo "  1. Open /pricing → Subscribe"
echo "  2. Card: 4242 4242 4242 4242, any future expiry/CVC"
echo "  3. Confirm plan updates after webhook fires"
echo ""
if [[ "$MODE" == "live" ]]; then
  echo "LIVE MODE: real charges will occur."
fi
