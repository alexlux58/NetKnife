/**
 * ==============================================================================
 * NETKNIFE - CLOUDWATCH ALARMS DASHBOARD LAMBDA
 * ==============================================================================
 *
 * Returns NetKnife CloudWatch alarms for an in-app dashboard. Restricted to
 * users in ALARMS_DASHBOARD_USERNAMES (e.g. alex.lux).
 *
 * POST /alarms { } -> { alarms: [...], history?: [...] }
 *
 * ENV: ALARM_PREFIX (e.g. netknife-dev), ALARMS_DASHBOARD_USERNAMES (comma list)
 * ==============================================================================
 */

const { CloudWatchClient, DescribeAlarmsCommand, DescribeAlarmHistoryCommand } = require('@aws-sdk/client-cloudwatch');

const cw = new CloudWatchClient({});
const ALARM_PREFIX = process.env.ALARM_PREFIX || 'netknife-dev';
const ALLOWED = (process.env.ALARMS_DASHBOARD_USERNAMES || 'alex.lux').split(',').map((s) => s.trim().toLowerCase());

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function getUsername(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims || event.requestContext?.authorizer?.claims || {};
  return (claims['cognito:username'] || claims.preferred_username || '').toLowerCase();
}

exports.handler = async (event) => {
  try {
    const username = getUsername(event);
    if (!username || !ALLOWED.includes(username)) {
      return json(403, { error: 'Only allowed users can view the alarms dashboard.' });
    }

    const prefix = ALARM_PREFIX ? `${ALARM_PREFIX}-` : '';

    const [alarmsRes, historyRes] = await Promise.all([
      cw.send(new DescribeAlarmsCommand({
        AlarmNamePrefix: prefix || undefined,
        StateValue: undefined, // all states
      })),
      cw.send(new DescribeAlarmHistoryCommand({
        AlarmNamePrefix: prefix || undefined,
        HistoryItemType: 'StateUpdate',
        StartDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24h
        MaxRecords: 50,
      })),
    ]);

    const alarms = (alarmsRes.MetricAlarms || []).map((a) => ({
      name: a.AlarmName,
      description: a.AlarmDescription || null,
      state: a.StateValue,
      stateReason: a.StateReason || null,
      stateUpdated: a.StateUpdatedTimestamp ? new Date(a.StateUpdatedTimestamp).toISOString() : null,
      metric: a.MetricName,
      namespace: a.Namespace,
      dimensions: a.Dimensions || [],
      threshold: a.Threshold,
      comparison: a.ComparisonOperator,
      period: a.Period,
      statistic: a.Statistic || a.ExtendedStatistic,
    }));

    const history = (historyRes.AlarmHistoryItems || []).map((h) => ({
      name: h.AlarmName,
      type: h.HistoryItemType,
      summary: h.HistorySummary || null,
      timestamp: h.Timestamp ? new Date(h.Timestamp).toISOString() : null,
    }));

    return json(200, { alarms, history, region: process.env.AWS_REGION || 'us-west-2' });
  } catch (e) {
    console.error('Alarms Lambda error:', e);
    return json(500, { error: e.message || 'Failed to fetch alarms' });
  }
};
