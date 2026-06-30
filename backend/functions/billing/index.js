/**
 * ==============================================================================
 * NETKNIFE - BILLING & STRIPE LAMBDA
 * ==============================================================================
 *
 * Handles: usage, create-checkout, portal, Stripe webhook.
 * Monetization is DISABLED for user "alex.lux" (grandfathered, no limits, no paywall).
 *
 * POST /billing { action: "usage" } -> { plan, usage, limits, isGrandfathered }
 * POST /billing { action: "create-checkout", email } -> { url }
 * POST /billing { action: "portal" } -> { url }
 * POST /billing/webhook (no JWT, Stripe signature) -> 200
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const Stripe = require('stripe');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const BILLING_TABLE = process.env.BILLING_TABLE;
const USAGE_TABLE = process.env.USAGE_TABLE;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
const SITE_URL = process.env.SITE_URL || 'https://localhost';

// Comma-separated usernames exempt from billing (superuser: full access, no limits, no paywall)
const BILLING_EXEMPT_USERNAMES = (process.env.BILLING_EXEMPT_USERNAMES || 'alex.lux')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' }) : null;

// ------------------------------------------------------------------------------
// JWT HELPERS
// ------------------------------------------------------------------------------

function getClaims(event) {
  let claims = {};
  if (event.requestContext?.authorizer?.jwt?.claims) {
    claims = event.requestContext.authorizer.jwt.claims;
  } else if (event.requestContext?.authorizer?.claims) {
    claims = event.requestContext.authorizer.claims;
  } else if (event.requestContext?.authorizer && (event.requestContext.authorizer.sub || event.requestContext.authorizer['cognito:username'])) {
    claims = event.requestContext.authorizer;
  }
  if (Object.keys(claims).length === 0) {
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const parts = token.split('.');
        if (parts.length === 3) {
          claims = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        }
      } catch (e) {
        console.warn('Failed to decode JWT:', e);
      }
    }
  }
  return claims;
}

function getUserId(event) {
  const claims = getClaims(event);
  return claims.sub || claims['cognito:username'] || 'unknown';
}

function getUsername(event) {
  const claims = getClaims(event);
  return claims['cognito:username'] || claims['preferred_username'] || '';
}

function isBillingExempt(event) {
  const u = getUsername(event);
  return BILLING_EXEMPT_USERNAMES.includes(u);
}

// ------------------------------------------------------------------------------
// RESPONSE
// ------------------------------------------------------------------------------

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

// ------------------------------------------------------------------------------
// PLANS & LIMITS
// ------------------------------------------------------------------------------

// Free: browser-only (0 API/advisor); 3 report saves so notes-only reports work. Pro ($5/mo): API access.
const PLAN_LIMITS = {
  free:    { remote: 0,   advisor: 0,   report_save: 3 },
  pro:     { remote: 500, advisor: 100, report_save: 50 },
  team:    { remote: 2000, advisor: 500, report_save: 200 },
  grandfathered: { remote: 999999, advisor: 999999, report_save: 999999 },
};

function getLimit(planId, meter) {
  const plan = planId === 'grandfathered' ? 'grandfathered' : (planId || 'free');
  const lim = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  return lim[meter] ?? 0;
}

// ------------------------------------------------------------------------------
// DB: get billing row
// ------------------------------------------------------------------------------

async function getBilling(userId) {
  if (!BILLING_TABLE) return null;
  const r = await ddb.send(new GetCommand({
    TableName: BILLING_TABLE,
    Key: { pk: userId },
  }));
  return r.Item || null;
}

function stripeErrorMessage(err) {
  return (err && (err.message || (err.raw && err.raw.message))) || '';
}

function isStripeMissingCustomer(err) {
  if (!err || err.code !== 'resource_missing') return false;
  // customers.retrieve uses param "id"; portal/checkout use param "customer"
  if (err.param === 'customer' || err.param === 'id') return true;
  return /no such customer/i.test(stripeErrorMessage(err));
}

function isStripeMissingPrice(err) {
  if (!err || err.code !== 'resource_missing') return false;
  if (err.param === 'price' || err.param === 'plan') return true;
  return /no such price/i.test(stripeErrorMessage(err));
}

async function clearStaleStripeCustomer(userId) {
  if (!BILLING_TABLE) return;
  await ddb.send(new UpdateCommand({
    TableName: BILLING_TABLE,
    Key: { pk: userId },
    UpdateExpression: 'SET planId = :free, stripeCustomerId = :null, stripeSubscriptionId = :null, periodEnd = :null, updatedAt = :u',
    ExpressionAttributeValues: {
      ':free': 'free',
      ':null': null,
      ':u': new Date().toISOString(),
    },
  }));
}

async function ensureStripeCustomer(userId, email) {
  let billing = await getBilling(userId);
  let customerId = billing?.stripeCustomerId;

  if (customerId) {
    try {
      await stripe.customers.retrieve(customerId);
      return customerId;
    } catch (e) {
      if (!isStripeMissingCustomer(e)) throw e;
      await clearStaleStripeCustomer(userId);
      billing = await getBilling(userId);
      customerId = null;
    }
  }

  const cust = await stripe.customers.create({
    email: email.trim(),
    metadata: { netknife_user_id: userId },
  });
  customerId = cust.id;
  const now = new Date().toISOString();
  await ddb.send(new PutCommand({
    TableName: BILLING_TABLE,
    Item: {
      pk: userId,
      planId: 'free',
      stripeCustomerId: customerId,
      stripeSubscriptionId: null,
      periodEnd: null,
      createdAt: billing?.createdAt || now,
      updatedAt: now,
    },
  }));
  return customerId;
}

// ------------------------------------------------------------------------------
// DB: get or create usage row for current month
// ------------------------------------------------------------------------------

function currentMonthKey() {
  const n = new Date();
  return `MONTH#${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function getUsage(userId) {
  if (!USAGE_TABLE) return { remoteCalls: 0, advisorMessages: 0, reportSaves: 0 };
  const sk = currentMonthKey();
  const r = await ddb.send(new GetCommand({
    TableName: USAGE_TABLE,
    Key: { pk: userId, sk },
  }));
  const i = r.Item || {};
  return {
    remoteCalls:     i.remoteCalls || 0,
    advisorMessages: i.advisorMessages || 0,
    reportSaves:     i.reportSaves || 0,
  };
}

// ------------------------------------------------------------------------------
// ACTION: usage
// ------------------------------------------------------------------------------

async function handleUsage(userId, exempt) {
  if (exempt) {
    return {
      plan: 'grandfathered',
      usage: { remoteCalls: 0, advisorMessages: 0, reportSaves: 0 },
      limits: PLAN_LIMITS.grandfathered,
      isGrandfathered: true,
      hasSubscription: false,
    };
  }
  const billing = await getBilling(userId);
  let planId = billing?.planId || 'free';
  let hasSubscription = Boolean(billing?.stripeSubscriptionId);

  // Invalid or stale Stripe refs (e.g. after rotating API keys to another account)
  if (stripe && billing?.stripeCustomerId) {
    try {
      await stripe.customers.retrieve(billing.stripeCustomerId);
    } catch (e) {
      if (isStripeMissingCustomer(e)) {
        await clearStaleStripeCustomer(userId);
        billing = await getBilling(userId);
        planId = 'free';
        hasSubscription = false;
      } else {
        throw e;
      }
    }
  }

  if (planId === 'pro' && hasSubscription && stripe) {
    try {
      const sub = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
      if (sub.status !== 'active' && sub.status !== 'trialing') {
        planId = 'free';
        hasSubscription = false;
      }
    } catch (e) {
      if (e.code === 'resource_missing') {
        await clearStaleStripeCustomer(userId);
        planId = 'free';
        hasSubscription = false;
      } else {
        throw e;
      }
    }
  }

  // Invalid state from legacy webhook bug: pro without a Stripe subscription
  if (planId === 'pro' && !hasSubscription) {
    planId = 'free';
    if (billing && BILLING_TABLE) {
      await ddb.send(new UpdateCommand({
        TableName: BILLING_TABLE,
        Key: { pk: userId },
        UpdateExpression: 'SET planId = :free, updatedAt = :u',
        ExpressionAttributeValues: {
          ':free': 'free',
          ':u': new Date().toISOString(),
        },
      })).catch((e) => console.warn('Failed to repair billing row:', e.message));
    }
  }

  const usage = await getUsage(userId);
  const limits = {
    remote:     getLimit(planId, 'remote'),
    advisor:    getLimit(planId, 'advisor'),
    report_save: getLimit(planId, 'report_save'),
  };
  return {
    plan: planId,
    usage,
    limits,
    isGrandfathered: false,
    hasSubscription,
  };
}

// ------------------------------------------------------------------------------
// ACTION: create-checkout
// ------------------------------------------------------------------------------

async function handleCreateCheckout(userId, email, exempt) {
  if (exempt) {
    return json(400, { error: 'Billing is not enabled for your account. You have full access.' });
  }
  if (!stripe || !STRIPE_PRO_PRICE_ID) {
    return json(503, { error: 'Billing is not configured.' });
  }
  if (!email || typeof email !== 'string') {
    return json(400, { error: 'Email is required for checkout.' });
  }

  const customerId = await ensureStripeCustomer(userId, email);

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }],
      success_url: `${SITE_URL}/pricing?success=1`,
      cancel_url: `${SITE_URL}/pricing?cancel=1`,
      metadata: { netknife_user_id: userId },
      subscription_data: { metadata: { netknife_user_id: userId } },
    });
    return json(200, { url: session.url });
  } catch (e) {
    if (isStripeMissingPrice(e)) {
      return json(503, {
        error: 'Subscription price not found in Stripe. Update stripe_pro_price_id in terraform.tfvars for your current account.',
      });
    }
    throw e;
  }
}

// ------------------------------------------------------------------------------
// ACTION: portal
// ------------------------------------------------------------------------------

async function handlePortal(userId, exempt) {
  if (exempt) {
    return json(400, { error: 'Billing is not enabled for your account.' });
  }
  if (!stripe) return json(503, { error: 'Billing is not configured.' });

  const billing = await getBilling(userId);
  const customerId = billing?.stripeCustomerId;
  if (!customerId) {
    return json(400, { error: 'No billing account found. Subscribe first.' });
  }

  try {
    await stripe.customers.retrieve(customerId);
  } catch (e) {
    if (isStripeMissingCustomer(e)) {
      await clearStaleStripeCustomer(userId);
      return json(400, { error: 'No billing account found. Subscribe first.' });
    }
    throw e;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${SITE_URL}/pricing`,
    });
    return json(200, { url: session.url });
  } catch (e) {
    if (isStripeMissingCustomer(e)) {
      await clearStaleStripeCustomer(userId);
      return json(400, { error: 'No billing account found. Subscribe first.' });
    }
    throw e;
  }
}

// ------------------------------------------------------------------------------
// ACTION: create-donation (one-time, no subscription)
// ------------------------------------------------------------------------------

async function handleCreateDonation(userId, amountCents, email, exempt) {
  if (!stripe) return json(503, { error: 'Donations are not configured.' });
  const amount = Math.round(Number(amountCents) || 0);
  if (amount < 100) return json(400, { error: 'Minimum donation is $1 (100 cents).' });
  if (amount > 100000) return json(400, { error: 'Maximum donation is $1000.' });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: (email && typeof email === 'string') ? email.trim() || undefined : undefined,
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: amount,
        product_data: {
          name: 'Donation to NetKnife',
          description: 'One-time donation to support NetKnife',
          images: [],
        },
      },
      quantity: 1,
    }],
    success_url: `${SITE_URL}/pricing?donated=1`,
    cancel_url: `${SITE_URL}/pricing`,
    metadata: { netknife_user_id: userId, type: 'donation' },
  });

  return json(200, { url: session.url });
}

// ------------------------------------------------------------------------------
// WEBHOOK (Stripe)
// ------------------------------------------------------------------------------

async function handleWebhook(rawBody, sig) {
  if (!STRIPE_WEBHOOK_SECRET || !stripe) {
    return json(503, { error: 'Webhook not configured.' });
  }
  let ev;
  try {
    ev = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.warn('Stripe webhook signature verification failed:', e.message);
    return json(400, { error: 'Invalid signature' });
  }

  const sub = ev.data?.object;
  const userId = sub?.metadata?.netknife_user_id || ev.data?.object?.metadata?.netknife_user_id;

  switch (ev.type) {
    case 'checkout.session.completed': {
      const sess = ev.data.object;
      // One-time donations must not grant API Access / pro plan
      if (sess.mode === 'payment' || sess.metadata?.type === 'donation') {
        break;
      }
      const cid = sess.customer;
      const subId = sess.subscription;
      const uid = sess.metadata?.netknife_user_id || userId;
      if (!uid || !subId) break;
      const subObj = subId ? await stripe.subscriptions.retrieve(subId) : null;
      const periodEnd = subObj?.current_period_end
        ? new Date(subObj.current_period_end * 1000).toISOString().slice(0, 10)
        : null;
      await ddb.send(new PutCommand({
        TableName: BILLING_TABLE,
        Item: {
          pk: uid,
          planId: 'pro',
          stripeCustomerId: cid,
          stripeSubscriptionId: subId || null,
          periodEnd: periodEnd || null,
          updatedAt: new Date().toISOString(),
        },
      }));
      break;
    }
    case 'customer.subscription.updated': {
      const uid = sub.metadata?.netknife_user_id;
      if (!uid) break;
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString().slice(0, 10)
        : null;
      const status = sub.status;
      const planId = (status === 'active' || status === 'trialing') ? 'pro' : 'free';
      await ddb.send(new UpdateCommand({
        TableName: BILLING_TABLE,
        Key: { pk: uid },
        UpdateExpression: 'SET planId = :p, periodEnd = :e, stripeSubscriptionId = :s, updatedAt = :u',
        ExpressionAttributeValues: {
          ':p': planId,
          ':e': periodEnd,
          ':s': sub.id,
          ':u': new Date().toISOString(),
        },
      }));
      break;
    }
    case 'customer.subscription.deleted': {
      const uid = sub.metadata?.netknife_user_id;
      if (!uid) break;
      await ddb.send(new UpdateCommand({
        TableName: BILLING_TABLE,
        Key: { pk: uid },
        UpdateExpression: 'SET planId = :p, stripeSubscriptionId = :s, periodEnd = :e, updatedAt = :u',
        ExpressionAttributeValues: {
          ':p': 'free',
          ':s': null,
          ':e': null,
          ':u': new Date().toISOString(),
        },
      }));
      break;
    }
    default:
      // acknowledge other events
      break;
  }

  return json(200, { received: true });
}

// ------------------------------------------------------------------------------
// ROUTING
// ------------------------------------------------------------------------------

function getPath(event) {
  return event.rawPath || event.requestContext?.http?.path || event.path || '';
}

exports.handler = async (event) => {
  const path = getPath(event);

  // Webhook: no JWT, raw body for signature
  if (path === '/billing/webhook' || path.endsWith('/billing/webhook')) {
    let rawBody = typeof event.body === 'string' ? event.body : (event.body ? JSON.stringify(event.body) : '');
    if (event.isBase64Encoded && rawBody) {
      rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
    }
    const sig = event.headers?.['stripe-signature'] || event.headers?.['Stripe-Signature'] || '';
    return handleWebhook(rawBody, sig);
  }

  // Authenticated actions
  const userId = getUserId(event);
  if (userId === 'unknown') {
    return json(401, { error: 'Authentication required' });
  }

  const exempt = isBillingExempt(event);
  const body = (event.body && typeof event.body === 'string') ? JSON.parse(event.body) : (event.body || {});
  const action = body.action;

  if (!action) {
    return json(400, { error: 'Missing action' });
  }

  try {
    switch (action) {
      case 'usage':
        return json(200, await handleUsage(userId, exempt));
      case 'create-checkout':
        return await handleCreateCheckout(userId, body.email, exempt);
      case 'create-donation':
        return await handleCreateDonation(userId, body.amount, body.email, exempt);
      case 'portal':
        return await handlePortal(userId, exempt);
      default:
        return json(400, { error: `Unknown action: ${action}` });
    }
  } catch (e) {
    console.error('Billing handler error:', e);
    const msg = e && e.message ? e.message : 'Billing request failed';
    return json(500, { error: msg });
  }
};
