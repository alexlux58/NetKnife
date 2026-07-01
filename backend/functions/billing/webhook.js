function parseWebhookRequest(event) {
  let rawBody = typeof event.body === 'string' ? event.body : (event.body ? JSON.stringify(event.body) : '')
  if (event.isBase64Encoded && rawBody) {
    rawBody = Buffer.from(rawBody, 'base64').toString('utf8')
  }
  const sig = event.headers?.['stripe-signature'] || event.headers?.['Stripe-Signature'] || ''
  return { rawBody, sig }
}

function verifyStripeEvent(stripe, rawBody, sig, secret) {
  if (!secret || !stripe) {
    return { ok: false, status: 503, body: { error: 'Webhook not configured.' } }
  }
  try {
    const event = stripe.webhooks.constructEvent(rawBody, sig, secret)
    return { ok: true, event }
  } catch (e) {
    return { ok: false, status: 400, body: { error: 'Invalid signature' } }
  }
}

async function processWebhookEvent(ev, deps) {
  const { ddb, billingTable, stripe } = deps
  const sub = ev.data?.object
  const userId = sub?.metadata?.netknife_user_id || ev.data?.object?.metadata?.netknife_user_id

  switch (ev.type) {
    case 'checkout.session.completed': {
      const sess = ev.data.object
      if (sess.mode === 'payment' && sess.metadata?.type === 'donation') {
        return { received: true, ignored: 'donation' }
      }
      if (sess.mode === 'payment' && sess.metadata?.type === 'lab_credits') {
        const uid = sess.metadata?.netknife_user_id
        const minutes = Number(sess.metadata?.minutes) || 0
        if (uid && minutes > 0 && billingTable) {
          await ddb.send(new deps.UpdateCommand({
            TableName: billingTable,
            Key: { pk: uid },
            UpdateExpression: 'SET labCreditsMinutes = if_not_exists(labCreditsMinutes, :zero) + :m, updatedAt = :u',
            ExpressionAttributeValues: {
              ':zero': 0,
              ':m': minutes,
              ':u': new Date().toISOString(),
            },
          }))
        }
        return { received: true, applied: 'lab_credits' }
      }
      const cid = sess.customer
      const subId = sess.subscription
      const uid = sess.metadata?.netknife_user_id || userId
      if (!uid || !subId) return { received: true, ignored: 'missing-user-or-subscription' }
      const subObj = subId ? await stripe.subscriptions.retrieve(subId) : null
      const periodEnd = subObj?.current_period_end
        ? new Date(subObj.current_period_end * 1000).toISOString().slice(0, 10)
        : null
      await ddb.send(new deps.PutCommand({
        TableName: billingTable,
        Item: {
          pk: uid,
          planId: 'pro',
          stripeCustomerId: cid,
          stripeSubscriptionId: subId || null,
          periodEnd: periodEnd || null,
          updatedAt: new Date().toISOString(),
        },
      }))
      return { received: true, applied: 'subscription' }
    }
    case 'customer.subscription.updated': {
      const uid = sub.metadata?.netknife_user_id
      if (!uid) return { received: true, ignored: 'missing-user' }
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString().slice(0, 10)
        : null
      const status = sub.status
      const planId = (status === 'active' || status === 'trialing') ? 'pro' : 'free'
      await ddb.send(new deps.UpdateCommand({
        TableName: billingTable,
        Key: { pk: uid },
        UpdateExpression: 'SET planId = :p, periodEnd = :e, stripeSubscriptionId = :s, updatedAt = :u',
        ExpressionAttributeValues: {
          ':p': planId,
          ':e': periodEnd,
          ':s': sub.id,
          ':u': new Date().toISOString(),
        },
      }))
      return { received: true, applied: 'subscription_updated' }
    }
    case 'customer.subscription.deleted': {
      const uid = sub.metadata?.netknife_user_id
      if (!uid) return { received: true, ignored: 'missing-user' }
      await ddb.send(new deps.UpdateCommand({
        TableName: billingTable,
        Key: { pk: uid },
        UpdateExpression: 'SET planId = :p, stripeSubscriptionId = :s, periodEnd = :e, updatedAt = :u',
        ExpressionAttributeValues: {
          ':p': 'free',
          ':s': null,
          ':e': null,
          ':u': new Date().toISOString(),
        },
      }))
      return { received: true, applied: 'subscription_deleted' }
    }
    default:
      return { received: true, ignored: ev.type }
  }
}

async function handleWebhook(rawBody, sig, deps) {
  const verified = verifyStripeEvent(deps.stripe, rawBody, sig, deps.webhookSecret)
  if (!verified.ok) {
    return { status: verified.status, body: verified.body }
  }
  const body = await processWebhookEvent(verified.event, deps)
  return { status: 200, body }
}

module.exports = {
  parseWebhookRequest,
  verifyStripeEvent,
  processWebhookEvent,
  handleWebhook,
}
