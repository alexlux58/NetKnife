# Stripe setup for NetKnife

Step-by-step guide to configure Stripe billing in `terraform.tfvars` and test payments **without being charged**.

---

## 1. Test mode vs live mode

| Mode   | Secret key     | Charges      | Use case                          |
|--------|----------------|-------------|-----------------------------------|
| **Test** | `sk_test_...` | **No real charges** | Development, QA, demos           |
| **Live** | `sk_live_...` | Real charges | Production                        |

- Use **test mode** for all setup and testing. Stripe **test cards** (e.g. `4242 4242 4242 4242`) never charge real money.
- In the [Stripe Dashboard](https://dashboard.stripe.com), keep the **Test mode** toggle **ON** (top right) while you configure Products, Prices, and Webhooks.

---

## 2. Get your Stripe secret key

1. Go to [Stripe Dashboard → API keys](https://dashboard.stripe.com/apikeys).
2. Ensure **Test mode** is **ON**.
3. Under **Standard keys**, reveal **Secret key** and copy it (`sk_test_...`).

In `terraform.tfvars`:

```hcl
stripe_secret_key = ""
```

---

## 3. Create a Product and Price (for the $5/mo API Access plan)

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/test/products).
2. Ensure **Test mode** is **ON**.
3. Click **+ Add product**.
4. **Name:** e.g. `NetKnife API Access`.
5. **Pricing:**
   - **Standard pricing**
   - **Price:** `5.00` **USD**
   - **Billing period:** **Monthly** (recurring)
6. Click **Save product**.
7. Open the new **Price** (or the default price created with the product).
8. Copy the **Price ID** — it must start with `price_` (e.g. `price_1ABC123def456xyz`).

In `terraform.tfvars`:

```hcl
stripe_pro_price_id = "price_1ABC123def456xyz"
```

> **Important:** Use a **Price** ID (`price_...`), **not** a Product ID (`prod_...`) or Subscription/Subscription Item ID (`sub_...`, `si_...`). Using `si_...` or `prod_...` will cause checkout to fail (often as a 500 from the billing Lambda).

---

## 4. Create a Webhook (for subscriptions)

The webhook tells NetKnife when a payment or subscription change happens so it can update the user’s plan. Without it, checkout can succeed in Stripe but the user stays on the free plan.

### 4.1 Webhook URL

Use your API Gateway base URL plus `/billing/webhook`:

```
https://<api-id>.execute-api.<region>.amazonaws.com/billing/webhook
```

- **`<api-id>`:** e.g. `b17ta36i5j` from your API URL, or run:
  ```bash
  cd infra/envs/dev && terraform output -raw api_url
  ```
  then take the hostname (e.g. `b17ta36i5j.execute-api.us-west-2.amazonaws.com`) and form:
  `https://b17ta36i5j.execute-api.us-west-2.amazonaws.com/billing/webhook`
- **`<region>`:** e.g. `us-west-2`.

### 4.2 Add the endpoint in Stripe

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/test/webhooks).
2. Ensure **Test mode** is **ON**.
3. Click **Add endpoint**.
4. **Endpoint URL:**  
   `https://<your-api-id>.execute-api.us-west-2.amazonaws.com/billing/webhook`
5. **Events to send:** choose:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Click **Add endpoint**.
7. Open the new endpoint and click **Reveal** under **Signing secret**.
8. Copy the value (`whsec_...`).

In `terraform.tfvars`:

```hcl
stripe_webhook_secret = ""
```

---

## 5. Example `terraform.tfvars` (test mode)

```hcl
# ============================================================================
# STRIPE BILLING (TEST MODE — no real charges)
# ============================================================================

stripe_secret_key     = ""
stripe_webhook_secret = ""
stripe_pro_price_id   = ""
```

---

## 6. Deploy

1. From the billing Lambda dir (Terraform expects the bundle):
   ```bash
   cd backend/functions/billing && npm install --omit=dev
   ```
2. Apply Terraform:
   ```bash
   cd infra/envs/dev && terraform apply
   ```

---

## 7. Test a subscription (no real charge)

1. Open NetKnife → **Pricing**.
2. Click subscribe for **API Access** and complete the email/checkout.
3. On the Stripe Checkout page, use a **test card**:
   - **Number:** `4242 4242 4242 4242`
   - **Expiry:** any future date (e.g. `12/34`)
   - **CVC:** any 3 digits (e.g. `123`)
   - **ZIP:** any 5 digits
4. Complete payment. In test mode, **no real charge** is made.
5. You should be redirected back and your plan should update (when the webhook is configured and the billing Lambda receives the events).

Other test cards: [Stripe – Testing](https://docs.stripe.com/testing#cards).

---

## 8. Stripe.js console warnings (link, amazon_pay, klarna)

You may see:

> The following payment method types are not activated: link, amazon_pay, klarna. They will be displayed in test mode, but hidden in live mode.

- **Test mode:** these can still appear; you can ignore the warning or turn off the methods you don’t need.
- To disable them: [Stripe Dashboard → Settings → Payment methods](https://dashboard.stripe.com/settings/payment_methods) and turn **off** Link, Amazon Pay, Klarna, etc. **Card** is enough for testing.

---

## 9. Switching to live mode

When you are ready for real charges:

1. In Stripe Dashboard, switch to **Live mode**.
2. Create a **live** Product and **recurring Price** (e.g. $5/month) and copy the **live** `price_...` ID.
3. Create a **live** Webhook with the same events and the **same** `/billing/webhook` URL, and copy the **live** `whsec_...`.
4. In [Stripe Dashboard → API keys](https://dashboard.stripe.com/apikeys) (Live mode), copy the **Secret key** (`sk_live_...`).
5. In `terraform.tfvars`:
   ```hcl
   stripe_secret_key     = ""
   stripe_webhook_secret = ""
   stripe_pro_price_id   = ""
   ```
6. Run `terraform apply` and deploy.

---

## 10. Troubleshooting

### Checkout fails with 500

- **`stripe_pro_price_id` must be a Price ID (`price_...`).** If you use a Product or Subscription/Item ID (`prod_...`, `si_...`, `sub_...`), Stripe will reject the request and the billing Lambda can return 500. Fix: create a **Price** on the product and set `stripe_pro_price_id = "price_..."`.
- **Missing or wrong `stripe_webhook_secret`:** the webhook handler can fail or behave oddly. Set `stripe_webhook_secret` to the **Signing secret** of the endpoint that receives `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`.

### “Only allowed users can view the alarms dashboard” (403 on /alarms)

- The Alarms page uses `ALARMS_DASHBOARD_USERNAMES` (from `admin_usernames` in the API module). The default includes `alex.lux` and `god of lux` (case-insensitive).
- If you **override** `admin_usernames` when calling the API module, include **both** your Cognito username and display name, e.g.  
  `admin_usernames = "alex.lux, god of lux"`.
- Redeploy: `terraform apply` so the alarms Lambda gets the updated env.

### Board or Activity 500

- **Board / Activity** need the `board_*` DynamoDB tables (and `board_activity` for Activity). If a past `terraform apply` failed (e.g. on `board_activity`), the table or IAM may be missing. Fix any Terraform errors (e.g. invalid tags), run `terraform apply` again, and redeploy the board Lambda.
- Check CloudWatch logs for the **board** and **billing** Lambdas to see the exact error (Dynamo, Stripe, or missing config).

---

## 11. Summary

| Step | What to do |
|------|------------|
| 1 | Use **Test mode** in Stripe and `sk_test_...` so no real charges happen. |
| 2 | Copy **Secret key** → `stripe_secret_key`. |
| 3 | Create a **Product** and **recurring Price** ($5/mo), copy **Price ID** (`price_...`) → `stripe_pro_price_id`. |
| 4 | Add **Webhook** to `https://<api-id>.execute-api.<region>.amazonaws.com/billing/webhook`, events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, copy **Signing secret** → `stripe_webhook_secret`. |
| 5 | Run `terraform apply` and test with card `4242 4242 4242 4242`. |
