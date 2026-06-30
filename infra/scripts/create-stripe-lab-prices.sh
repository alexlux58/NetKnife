#!/usr/bin/env bash
# Create Stripe one-time Prices for Kali Lab credit packs.
# Usage: STRIPE_SECRET_KEY=sk_test_... ./create-stripe-lab-prices.sh
set -euo pipefail

if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  echo "Set STRIPE_SECRET_KEY (sk_test_... or sk_live_...)"
  exit 1
fi

create_pack() {
  local name="$1"
  local amount="$2"
  local minutes="$3"
  local pack_id="$4"

  echo "Creating product: NetKnife Lab Credits - $name"
  PRODUCT=$(curl -s https://api.stripe.com/v1/products \
    -u "${STRIPE_SECRET_KEY}:" \
    -d "name=NetKnife Lab Credits - ${name}" \
    -d "metadata[pack]=${pack_id}" \
    -d "metadata[minutes]=${minutes}")

  PROD_ID=$(echo "$PRODUCT" | jq -r .id)

  PRICE=$(curl -s https://api.stripe.com/v1/prices \
    -u "${STRIPE_SECRET_KEY}:" \
    -d "product=${PROD_ID}" \
    -d "unit_amount=${amount}" \
    -d "currency=usd" \
    -d "metadata[pack]=${pack_id}" \
    -d "metadata[minutes]=${minutes}")

  PRICE_ID=$(echo "$PRICE" | jq -r .id)
  echo "  ${pack_id}: ${PRICE_ID} (\$$(echo "scale=2; $amount/100" | bc) / ${minutes} min)"
}

echo "=== NetKnife Lab Credit Packs ==="
create_pack "Starter (2 hr)"  200  120 starter
create_pack "Standard (6 hr)" 500  360 standard
create_pack "Power (16 hr)"  1200 960 power
echo ""
echo "Add to terraform.tfvars:"
echo "  stripe_lab_starter_price_id  = \"price_...\""
echo "  stripe_lab_standard_price_id = \"price_...\""
echo "  stripe_lab_power_price_id    = \"price_...\""
