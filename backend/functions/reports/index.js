/**
 * ==============================================================================
 * NETKNIFE - REPORTS & CHAT STORAGE LAMBDA
 * ==============================================================================
 * 
 * Manages user reports and Security Advisor chat history.
 * 
 * FEATURES:
 * - Save/retrieve Security Advisor chats
 * - Save/retrieve reports (collected tool results)
 * - List all reports/chats for a user
 * - Delete reports/chats
 * - User-scoped data (isolated by Cognito user ID)
 * 
 * REQUEST:
 *   POST /reports { "action": "save", "type": "chat|report", "data": {...} }
 *   POST /reports { "action": "list", "type": "chat|report" }
 *   POST /reports { "action": "get", "id": "report-id" }
 *   POST /reports { "action": "delete", "id": "report-id" }
 * 
 * RESPONSE:
 *   { "success": true, "id": "...", "data": {...} }
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const REPORTS_TABLE = process.env.REPORTS_TABLE;

// Extract user ID from JWT claims
function getUserId(event) {
  try {
    // API Gateway HTTP API v2 passes JWT claims in requestContext.authorizer.jwt.claims
    // Try multiple possible locations for JWT claims
    let claims = {};
    
    // Standard location: requestContext.authorizer.jwt.claims
    if (event.requestContext?.authorizer?.jwt?.claims) {
      claims = event.requestContext.authorizer.jwt.claims;
    }
    // Alternative: sometimes claims are directly in authorizer
    else if (event.requestContext?.authorizer?.claims) {
      claims = event.requestContext.authorizer.claims;
    }
    // Fallback: check if authorizer has claim properties directly
    else if (event.requestContext?.authorizer) {
      const auth = event.requestContext.authorizer;
      // Check if sub or cognito:username are directly on authorizer
      if (auth.sub || auth['cognito:username']) {
        claims = auth;
      }
    }
    
    // If still no claims, try extracting from Authorization header as fallback
    if (Object.keys(claims).length === 0) {
      const authHeader = event.headers?.authorization || event.headers?.Authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          // Decode JWT token (without verification - just for user ID extraction)
          const token = authHeader.substring(7);
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            claims = payload;
          }
        } catch (e) {
          console.warn('Failed to decode JWT from header:', e);
        }
      }
    }
    
    // Log for debugging if no claims found - show full authorizer structure
    if (Object.keys(claims).length === 0) {
      const auth = event.requestContext?.authorizer || {};
      console.warn('No JWT claims found. Full authorizer structure:', JSON.stringify(auth, null, 2));
      console.warn('Full requestContext:', JSON.stringify(event.requestContext, null, 2));
      console.warn('Headers:', JSON.stringify(event.headers, null, 2));
    }
    
    return claims.sub || claims['cognito:username'] || 'unknown';
  } catch (e) {
    console.error('Error extracting user ID:', e);
    return 'unknown';
  }
}

// ------------------------------------------------------------------------------
// RESPONSE HELPER
// ------------------------------------------------------------------------------

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

// ------------------------------------------------------------------------------
// SAVE REPORT/CHAT
// ------------------------------------------------------------------------------

async function saveReport(userId, type, data) {
  if (!REPORTS_TABLE) {
    throw new Error("Reports table not configured");
  }

  const id = data.id || `report_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const timestamp = new Date().toISOString();
  const payload = data.data || data;
  // Use title from payload (e.g. chatData.title, reportToSave.title) when available
  const title = payload.title || data.title || (type === 'chat' ? 'Security Advisor Chat' : 'Report');

  const item = {
    pk: `${userId}#${type}`,  // Partition key: userId#type
    sk: id,                    // Sort key: report/chat ID
    userId,
    type,
    id,
    title,
    data: payload,
    createdAt: timestamp,
    updatedAt: timestamp,
    ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year TTL
  };

  await ddb.send(new PutCommand({
    TableName: REPORTS_TABLE,
    Item: item,
  }));

  return { id, ...item };
}

// ------------------------------------------------------------------------------
// GET REPORT/CHAT
// ------------------------------------------------------------------------------

async function getReport(userId, type, id) {
  if (!REPORTS_TABLE) {
    throw new Error("Reports table not configured");
  }

  const result = await ddb.send(new GetCommand({
    TableName: REPORTS_TABLE,
    Key: {
      pk: `${userId}#${type}`,
      sk: id,
    },
  }));

  if (!result.Item || result.Item.userId !== userId) {
    return null;
  }

  return result.Item;
}

// ------------------------------------------------------------------------------
// LIST REPORTS/CHATS
// ------------------------------------------------------------------------------

async function listReports(userId, type, category) {
  if (!REPORTS_TABLE) {
    throw new Error("Reports table not configured");
  }

  const queryParams = {
    TableName: REPORTS_TABLE,
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: {
      ":pk": `${userId}#${type}`,
    },
    ScanIndexForward: false, // Most recent first
    Limit: 100,
  };

  // Add category filter if provided
  if (category) {
    queryParams.FilterExpression = "#category = :category";
    queryParams.ExpressionAttributeNames = {
      "#category": "category"
    };
    queryParams.ExpressionAttributeValues[":category"] = category;
  }

  const result = await ddb.send(new QueryCommand(queryParams));

  return (result.Items || []).map(item => ({
    id: item.id,
    title: item.title,
    category: item.category,
    type: item.type,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

// ------------------------------------------------------------------------------
// DELETE REPORT/CHAT
// ------------------------------------------------------------------------------

async function deleteReport(userId, type, id) {
  if (!REPORTS_TABLE) {
    throw new Error("Reports table not configured");
  }

  // Verify ownership before deleting
  const existing = await getReport(userId, type, id);
  if (!existing) {
    throw new Error("Report not found or access denied");
  }

  await ddb.send(new DeleteCommand({
    TableName: REPORTS_TABLE,
    Key: {
      pk: `${userId}#${type}`,
      sk: id,
    },
  }));

  return { success: true };
}

// ------------------------------------------------------------------------------
// LAMBDA HANDLER
// ------------------------------------------------------------------------------

exports.handler = async (event) => {
  try {
    const userId = getUserId(event);
    if (userId === 'unknown') {
      // Log the event structure for debugging
      console.error('Unable to identify user. Event structure:', JSON.stringify({
        hasRequestContext: !!event.requestContext,
        requestContextType: typeof event.requestContext,
        authorizer: event.requestContext?.authorizer ? 'exists' : 'missing',
        jwt: event.requestContext?.authorizer?.jwt ? 'exists' : 'missing',
        claims: event.requestContext?.authorizer?.jwt?.claims ? 'exists' : 'missing',
      }));
      return json(401, { error: "Unable to identify user - authentication required" });
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const action = body.action;
    const type = body.type || 'report';

    if (!action) {
      return json(400, { error: "Missing required field: action" });
    }

    if (!REPORTS_TABLE) {
      return json(500, { error: "Reports table not configured" });
    }

    switch (action) {
      case 'save':
        const saved = await saveReport(userId, type, body);
        return json(200, { success: true, ...saved });

      case 'get':
        if (!body.id) {
          return json(400, { error: "Missing required field: id" });
        }
        const report = await getReport(userId, type, body.id);
        if (!report) {
          return json(404, { error: "Report not found" });
        }
        return json(200, { success: true, ...report });

      case 'list':
        const category = body.category; // Optional category filter
        const reports = await listReports(userId, type, category);
        return json(200, { success: true, reports });

      case 'delete':
        if (!body.id) {
          return json(400, { error: "Missing required field: id" });
        }
        await deleteReport(userId, type, body.id);
        return json(200, { success: true });

      default:
        return json(400, { error: `Unknown action: ${action}` });
    }

  } catch (e) {
    console.error("Reports handler error:", e);
    return json(500, { error: e.message || "Server error" });
  }
};
