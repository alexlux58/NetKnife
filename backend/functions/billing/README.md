# Billing Lambda

Stripe Checkout, Customer Portal, webhook, and usage API. User `alex.lux` is exempt (grandfathered).

## Deploy

Before `terraform apply`, install the Stripe SDK so it's included in the zip:

```bash
cd backend/functions/billing && npm install --omit=dev
```

Then run Terraform from `infra/envs/dev`.

## Endpoints

- `POST /billing` with `{ action: "usage" }` — plan, usage, limits
- `POST /billing` with `{ action: "create-checkout", email }` — Stripe Checkout URL
- `POST /billing` with `{ action: "portal" }` — Stripe Customer Portal URL
- `POST /billing/webhook` — Stripe webhooks (no JWT)

## Stripe setup

1. **API Access ($5/mo):** Create Product "NetKnife API Access" and a $5/month recurring Price. Set `stripe_pro_price_id` in tfvars.
2. **Webhook:** `https://<api-id>.execute-api.<region>.amazonaws.com/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
3. Set `stripe_webhook_secret` from the webhook's signing secret.
4. **Donations:** One-time payments use `price_data`; no extra Price needed. Min $1, max $1000.
