/**
 * ==============================================================================
 * NETKNIFE - COGNITO TRIGGERS (PreSignUp + PostConfirmation)
 * ==============================================================================
 *
 * PreSignUp:
 * - Reads signups_enabled from DynamoDB (auth config). If false, rejects sign-up (failsafe).
 * - Auto-confirms users and auto-verifies email so they can sign in immediately.
 * - Only applies failsafe to PreSignUp_SignUp; admin-created users are allowed.
 *
 * PostConfirmation:
 * - Stores sub, username, email, phone_number, createdAt in DynamoDB (signups table).
 * - Sends an SNS notification (username, email, phone, time).
 *
 * ENV: CONFIG_TABLE_NAME, SIGNUPS_TABLE_NAME, SNS_TOPIC_ARN
 *
 * Failsafe: Put item { id: "CONFIG", signups_enabled: false } in the config table
 * to disable new sign-ups. Omit or set true to allow.
 * ==============================================================================
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sns = new SNSClient({});

const CONFIG_TABLE = process.env.CONFIG_TABLE_NAME;
const SIGNUPS_TABLE = process.env.SIGNUPS_TABLE_NAME;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

/**
 * @param {object} event - Cognito trigger event
 * @returns {object} event (possibly modified)
 */
exports.handler = async (event) => {
  const trigger = event.triggerSource || '';

  const attrs = event.request?.userAttributes || {};
  const hasEmail = attrs.email && String(attrs.email).trim().length > 0;
  const hasPhone = attrs.phone_number && String(attrs.phone_number).trim().length > 0;

  if (trigger === 'PreSignUp_AdminCreateUser') {
    event.response.autoConfirmUser = true;
    // Only set autoVerify* when the attribute was provided; otherwise Cognito errors
    event.response.autoVerifyEmail = !!hasEmail;
    event.response.autoVerifyPhone = !!hasPhone;
    return event;
  }

  if (trigger === 'PreSignUp_SignUp') {
    if (CONFIG_TABLE) {
      try {
        const r = await ddb.send(new GetCommand({
          TableName: CONFIG_TABLE,
          Key: { id: 'CONFIG' },
        }));
        if (r.Item && r.Item.signups_enabled === false) {
          throw new Error('Sign-up is currently disabled. Contact the administrator.');
        }
      } catch (e) {
        if (e.message && e.message.includes('Sign-up is currently disabled')) throw e;
        console.error('Config read error:', e);
        throw new Error('Sign-up is temporarily unavailable. Please try again later.');
      }
    }
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = !!hasEmail;
    event.response.autoVerifyPhone = !!hasPhone;
    return event;
  }

  if (trigger === 'PostConfirmation_ConfirmSignUp' || trigger === 'PostConfirmation_ConfirmForgotPassword') {
    if (trigger === 'PostConfirmation_ConfirmForgotPassword') return event;

    const a = event.request?.userAttributes || {};
    const sub = a.sub || event.userName || '';
    const un = event.userName || '?';
    const email = (a.email && String(a.email).trim()) || '';
    const phone = (a.phone_number && String(a.phone_number).trim()) || '';
    const createdAt = new Date().toISOString();

    // Store email and phone in DynamoDB (pk = sub)
    if (SIGNUPS_TABLE && sub) {
      try {
        await ddb.send(new PutCommand({
          TableName: SIGNUPS_TABLE,
          Item: {
            pk: sub,
            username: un,
            email: email || '',
            phone_number: phone || '',
            createdAt,
          },
        }));
      } catch (e) {
        console.error('Signups PutItem error:', e);
      }
    }

    // SNS notification (includes email and phone)
    if (SNS_TOPIC_ARN) {
      const msg = `New NetKnife sign-up\nUsername: ${un}\nEmail: ${email || '-'}\nPhone: ${phone || '-'}\nTime: ${createdAt}`;
      try {
        await sns.send(new PublishCommand({
          TopicArn: SNS_TOPIC_ARN,
          Subject: `NetKnife: new sign-up (${un})`,
          Message: msg,
        }));
      } catch (e) {
        console.error('SNS publish error:', e);
      }
    }
    return event;
  }

  return event;
};
