/**
 * ==============================================================================
 * NETKNIFE - LABS LAMBDA (Kali VM lifecycle + billing)
 * ==============================================================================
 *
 * Actions:
 * - list          → user's labs
 * - launch        → provision EC2 from Kali AMI
 * - status        → lab state + SSM connect URL
 * - stop          → terminate instance, refund unused credits
 * - credits       → lab credit balance
 * - buy-credits   → Stripe checkout for credit pack
 *
 * Billing: per-minute lab credits stored on billing row (labCreditsMinutes).
 * Pro subscription required unless billing-exempt.
 * ==============================================================================
 */

const crypto = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const {
  EC2Client,
  RunInstancesCommand,
  TerminateInstancesCommand,
  DescribeInstancesCommand,
} = require('@aws-sdk/client-ec2');
const { SSMClient, DescribeInstanceInformationCommand } = require('@aws-sdk/client-ssm');
const Stripe = require('stripe');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const ec2 = new EC2Client({});
const ssm = new SSMClient({});

const LABS_TABLE = process.env.LABS_TABLE;
const BILLING_TABLE = process.env.BILLING_TABLE;
const KALI_AMI_ID = process.env.KALI_AMI_ID || '';
const LAB_SUBNET_ID = process.env.LAB_SUBNET_ID || '';
const LAB_SG_ID = process.env.LAB_SG_ID || '';
const LAB_INSTANCE_PROFILE = process.env.LAB_INSTANCE_PROFILE || '';
const AWS_REGION = process.env.AWS_REGION || 'us-west-2';
const SITE_URL = process.env.SITE_URL || 'https://localhost';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_LAB_STARTER_PRICE_ID = process.env.STRIPE_LAB_STARTER_PRICE_ID || '';
const STRIPE_LAB_STANDARD_PRICE_ID = process.env.STRIPE_LAB_STANDARD_PRICE_ID || '';
const STRIPE_LAB_POWER_PRICE_ID = process.env.STRIPE_LAB_POWER_PRICE_ID || '';
const BILLING_EXEMPT_USERNAMES = (process.env.BILLING_EXEMPT_USERNAMES || 'alex.lux')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' }) : null;

const DEFAULT_SESSION_MINUTES = 60;
const MAX_SESSION_MINUTES = 240;
const MIN_CREDITS_TO_LAUNCH = 15;
const RATE_CENTS_PER_MINUTE = 2; // $0.12/hr display rate

const CREDIT_PACKS = {
  starter: { minutes: 120, priceId: STRIPE_LAB_STARTER_PRICE_ID },
  standard: { minutes: 360, priceId: STRIPE_LAB_STANDARD_PRICE_ID },
  power: { minutes: 960, priceId: STRIPE_LAB_POWER_PRICE_ID },
};

const INSTANCE_TYPES = {
  small: 't3.small',
  standard: 't3.medium',
  large: 't3.large',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function getClaims(event) {
  let claims = {};
  if (event.requestContext?.authorizer?.jwt?.claims) {
    claims = event.requestContext.authorizer.jwt.claims;
  } else if (event.requestContext?.authorizer?.claims) {
    claims = event.requestContext.authorizer.claims;
  } else if (event.requestContext?.authorizer?.sub) {
    claims = event.requestContext.authorizer;
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
  return BILLING_EXEMPT_USERNAMES.includes(getUsername(event));
}

function userPk(userId) {
  return `USER#${userId}`;
}

function labSk(labId) {
  return `LAB#${labId}`;
}

async function getBilling(userId) {
  if (!BILLING_TABLE) return null;
  const r = await ddb.send(new GetCommand({
    TableName: BILLING_TABLE,
    Key: { pk: userId },
  }));
  return r.Item || null;
}

async function getLabCredits(userId) {
  const billing = await getBilling(userId);
  return billing?.labCreditsMinutes ?? 0;
}

async function addLabCredits(userId, minutes) {
  const now = new Date().toISOString();
  await ddb.send(new UpdateCommand({
    TableName: BILLING_TABLE,
    Key: { pk: userId },
    UpdateExpression: 'SET labCreditsMinutes = if_not_exists(labCreditsMinutes, :zero) + :m, updatedAt = :u',
    ExpressionAttributeValues: {
      ':zero': 0,
      ':m': minutes,
      ':u': now,
    },
  }));
}

async function reserveCredits(userId, minutes) {
  const billing = await getBilling(userId);
  const current = billing?.labCreditsMinutes ?? 0;
  if (current < minutes) {
    throw new Error(`Insufficient lab credits. Need ${minutes} min, have ${current} min.`);
  }
  await ddb.send(new UpdateCommand({
    TableName: BILLING_TABLE,
    Key: { pk: userId },
    UpdateExpression: 'SET labCreditsMinutes = labCreditsMinutes - :m, updatedAt = :u',
    ConditionExpression: 'labCreditsMinutes >= :m',
    ExpressionAttributeValues: {
      ':m': minutes,
      ':u': new Date().toISOString(),
    },
  }));
}

async function refundCredits(userId, minutes) {
  if (minutes <= 0) return;
  await addLabCredits(userId, minutes);
}

function requirePro(billing, exempt) {
  if (exempt) return;
  const plan = billing?.planId || 'free';
  const hasSub = Boolean(billing?.stripeSubscriptionId);
  if (plan !== 'pro' || !hasSub) {
    throw new Error('Pro subscription required to launch Kali Labs. Subscribe at /pricing.');
  }
}

async function listLabs(userId) {
  const r = await ddb.send(new QueryCommand({
    TableName: LABS_TABLE,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': userPk(userId),
      ':prefix': 'LAB#',
    },
    ScanIndexForward: false,
    Limit: 20,
  }));
  return (r.Items || []).map(formatLab);
}

function formatLab(item) {
  return {
    labId: item.labId,
    status: item.status,
    instanceId: item.instanceId || null,
    instanceType: item.instanceType,
    sessionMinutes: item.sessionMinutes,
    minutesUsed: item.minutesUsed || 0,
    creditsReserved: item.creditsReserved || 0,
    ssmUrl: item.instanceId ? buildSsmUrl(item.instanceId) : null,
    createdAt: item.createdAt,
    startedAt: item.startedAt || null,
    stoppedAt: item.stoppedAt || null,
    expiresAt: item.expiresAt || null,
  };
}

function buildSsmUrl(instanceId) {
  const region = AWS_REGION;
  return `https://${region}.console.aws.amazon.com/systems-manager/session-manager/${instanceId}?region=${region}`;
}

async function getActiveLab(userId) {
  const labs = await listLabs(userId);
  return labs.find((l) => ['provisioning', 'running', 'stopping'].includes(l.status)) || null;
}

async function handleLaunch(userId, body, exempt) {
  if (!KALI_AMI_ID || !LAB_SUBNET_ID || !LAB_SG_ID || !LAB_INSTANCE_PROFILE) {
    return json(503, { error: 'Kali Labs infrastructure is not configured.' });
  }

  const billing = await getBilling(userId);
  requirePro(billing, exempt);

  const active = await getActiveLab(userId);
  if (active) {
    return json(409, { error: 'You already have an active lab.', lab: active });
  }

  const sizeKey = body.instanceType || 'standard';
  const instanceType = INSTANCE_TYPES[sizeKey] || INSTANCE_TYPES.standard;
  const sessionMinutes = Math.min(
    MAX_SESSION_MINUTES,
    Math.max(15, Number(body.sessionMinutes) || DEFAULT_SESSION_MINUTES)
  );

  if (!exempt) {
    const credits = await getLabCredits(userId);
    if (credits < MIN_CREDITS_TO_LAUNCH) {
      return json(402, {
        error: 'Insufficient lab credits.',
        credits,
        minRequired: MIN_CREDITS_TO_LAUNCH,
        buyCredits: true,
      });
    }
    if (credits < sessionMinutes) {
      return json(402, {
        error: `Need ${sessionMinutes} credits for this session. You have ${credits} min.`,
        credits,
        buyCredits: true,
      });
    }
    await reserveCredits(userId, sessionMinutes);
  }

  const labId = crypto.randomBytes(4).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionMinutes * 60 * 1000).toISOString();

  const labItem = {
    pk: userPk(userId),
    sk: labSk(labId),
    labId,
    userId,
    status: 'provisioning',
    instanceType,
    sessionMinutes,
    creditsReserved: exempt ? 0 : sessionMinutes,
    minutesUsed: 0,
    createdAt: now.toISOString(),
    expiresAt,
  };

  await ddb.send(new PutCommand({ TableName: LABS_TABLE, Item: labItem }));

  try {
    const runResult = await ec2.send(new RunInstancesCommand({
      ImageId: KALI_AMI_ID,
      InstanceType: instanceType,
      MinCount: 1,
      MaxCount: 1,
      SubnetId: LAB_SUBNET_ID,
      SecurityGroupIds: [LAB_SG_ID],
      IamInstanceProfile: { Name: LAB_INSTANCE_PROFILE },
      MetadataOptions: { HttpTokens: 'required', HttpEndpoint: 'enabled' },
      TagSpecifications: [{
        ResourceType: 'instance',
        Tags: [
          { Key: 'Name', Value: `netknife-lab-${labId}` },
          { Key: 'Project', Value: 'netknife' },
          { Key: 'LabId', Value: labId },
          { Key: 'UserId', Value: userId },
        ],
      }],
      UserData: Buffer.from(`#!/bin/bash
echo "NetKnife Lab ${labId}" > /opt/netknife/lab-id
`).toString('base64'),
    }));

    const instanceId = runResult.Instances?.[0]?.InstanceId;
    await ddb.send(new UpdateCommand({
      TableName: LABS_TABLE,
      Key: { pk: userPk(userId), sk: labSk(labId) },
      UpdateExpression: 'SET instanceId = :i, #s = :running, startedAt = :t',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':i': instanceId,
        ':running': 'running',
        ':t': new Date().toISOString(),
      },
    }));

    return json(200, {
      lab: formatLab({
        ...labItem,
        instanceId,
        status: 'running',
        startedAt: new Date().toISOString(),
      }),
    });
  } catch (e) {
    if (!exempt) await refundCredits(userId, sessionMinutes);
    await ddb.send(new UpdateCommand({
      TableName: LABS_TABLE,
      Key: { pk: userPk(userId), sk: labSk(labId) },
      UpdateExpression: 'SET #s = :failed, errorMessage = :err, stoppedAt = :t',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':failed': 'failed',
        ':err': e.message,
        ':t': new Date().toISOString(),
      },
    }));
    throw e;
  }
}

async function handleStatus(userId, body) {
  const labId = body.labId;
  if (!labId) return json(400, { error: 'labId required' });

  const r = await ddb.send(new GetCommand({
    TableName: LABS_TABLE,
    Key: { pk: userPk(userId), sk: labSk(labId) },
  }));
  if (!r.Item) return json(404, { error: 'Lab not found' });

  let lab = r.Item;

  if (lab.instanceId && lab.status === 'running') {
    try {
      const desc = await ec2.send(new DescribeInstancesCommand({ InstanceIds: [lab.instanceId] }));
      const state = desc.Reservations?.[0]?.Instances?.[0]?.State?.Name;
      if (state === 'terminated' || state === 'shutting-down') {
        lab = await finalizeLab(userId, lab, 'terminated');
      } else {
        const ssmInfo = await ssm.send(new DescribeInstanceInformationCommand({
          Filters: [{ Key: 'InstanceIds', Values: [lab.instanceId] }],
        }));
        lab.ssmOnline = (ssmInfo.InstanceInformationList?.length ?? 0) > 0;
      }
    } catch (e) {
      console.warn('Status check error:', e.message);
    }

    const started = lab.startedAt ? new Date(lab.startedAt).getTime() : Date.now();
    const minutesUsed = Math.ceil((Date.now() - started) / 60000);
    lab.minutesUsed = minutesUsed;

    if (lab.expiresAt && new Date(lab.expiresAt) < new Date() && lab.status === 'running') {
      lab = await handleStop(userId, { labId }, false);
    }
  }

  return json(200, { lab: formatLab(lab) });
}

async function finalizeLab(userId, lab, status) {
  const started = lab.startedAt ? new Date(lab.startedAt).getTime() : Date.now();
  const minutesUsed = Math.min(lab.sessionMinutes, Math.ceil((Date.now() - started) / 60000));
  const refund = Math.max(0, (lab.creditsReserved || 0) - minutesUsed);

  if (refund > 0) await refundCredits(userId, refund);

  const now = new Date().toISOString();
  await ddb.send(new UpdateCommand({
    TableName: LABS_TABLE,
    Key: { pk: userPk(userId), sk: labSk(lab.labId) },
    UpdateExpression: 'SET #s = :st, minutesUsed = :m, stoppedAt = :t, creditsRefunded = :r',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':st': status,
      ':m': minutesUsed,
      ':t': now,
      ':r': refund,
    },
  }));

  return { ...lab, status, minutesUsed, stoppedAt: now, creditsRefunded: refund };
}

async function handleStop(userId, body, isUserStop = true) {
  const labId = body.labId;
  if (!labId) return json(400, { error: 'labId required' });

  const r = await ddb.send(new GetCommand({
    TableName: LABS_TABLE,
    Key: { pk: userPk(userId), sk: labSk(labId) },
  }));
  if (!r.Item) return json(404, { error: 'Lab not found' });
  const lab = r.Item;

  if (['terminated', 'failed', 'stopping'].includes(lab.status)) {
    return json(200, { lab: formatLab(lab) });
  }

  await ddb.send(new UpdateCommand({
    TableName: LABS_TABLE,
    Key: { pk: userPk(userId), sk: labSk(labId) },
    UpdateExpression: 'SET #s = :stopping',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':stopping': 'stopping' },
  }));

  if (lab.instanceId) {
    try {
      await ec2.send(new TerminateInstancesCommand({ InstanceIds: [lab.instanceId] }));
    } catch (e) {
      console.warn('Terminate error:', e.message);
    }
  }

  const finalized = await finalizeLab(userId, lab, 'terminated');
  return json(200, { lab: formatLab(finalized), stoppedByUser: isUserStop });
}

async function handleCredits(userId, exempt) {
  if (exempt) {
    return json(200, {
      credits: 999999,
      rateCentsPerMinute: 0,
      isExempt: true,
    });
  }
  const credits = await getLabCredits(userId);
  return json(200, {
    credits,
    rateCentsPerMinute: RATE_CENTS_PER_MINUTE,
    rateDisplay: `$${(RATE_CENTS_PER_MINUTE * 60 / 100).toFixed(2)}/hr`,
    packs: Object.entries(CREDIT_PACKS).map(([id, p]) => ({
      id,
      minutes: p.minutes,
      hours: p.minutes / 60,
      available: Boolean(p.priceId),
    })),
  });
}

async function handleBuyCredits(userId, body, exempt) {
  if (exempt) return json(400, { error: 'Your account has unlimited lab access.' });
  if (!stripe) return json(503, { error: 'Billing is not configured.' });

  const packId = body.pack || 'starter';
  const pack = CREDIT_PACKS[packId];
  if (!pack?.priceId) {
    return json(503, { error: `Lab credit pack "${packId}" is not configured.` });
  }

  const billing = await getBilling(userId);
  const customerId = billing?.stripeCustomerId;
  if (!customerId) {
    return json(400, { error: 'Subscribe first to create a billing account, then buy lab credits.' });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [{ price: pack.priceId, quantity: 1 }],
    success_url: `${SITE_URL}/tools/kali-lab?credits=1`,
    cancel_url: `${SITE_URL}/tools/kali-lab`,
    metadata: {
      netknife_user_id: userId,
      type: 'lab_credits',
      pack: packId,
      minutes: String(pack.minutes),
    },
  });

  return json(200, { url: session.url });
}

exports.handler = async (event) => {
  const userId = getUserId(event);
  if (userId === 'unknown') return json(401, { error: 'Authentication required' });
  if (!LABS_TABLE) return json(503, { error: 'Labs table not configured' });

  const exempt = isBillingExempt(event);
  const body = (event.body && typeof event.body === 'string') ? JSON.parse(event.body) : (event.body || {});
  const action = body.action;

  try {
    switch (action) {
      case 'list':
        return json(200, { items: await listLabs(userId) });
      case 'launch':
        return await handleLaunch(userId, body, exempt);
      case 'status':
        return await handleStatus(userId, body);
      case 'stop':
        return await handleStop(userId, body);
      case 'credits':
        return await handleCredits(userId, exempt);
      case 'buy-credits':
        return await handleBuyCredits(userId, body, exempt);
      default:
        return json(400, { error: `Unknown action: ${action}` });
    }
  } catch (e) {
    console.error('Labs handler error:', e);
    const msg = e.message || 'Labs request failed';
    if (msg.includes('Pro subscription')) return json(402, { error: msg, upgrade: true });
    if (msg.includes('Insufficient lab credits')) return json(402, { error: msg, buyCredits: true });
    return json(500, { error: msg });
  }
};

// Exported for billing webhook to add credits
exports.addLabCredits = addLabCredits;
exports.CREDIT_PACKS = CREDIT_PACKS;
