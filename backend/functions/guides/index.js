/**
 * ==============================================================================
 * NETKNIFE - GUIDES LAMBDA (Action-Based Routing)
 * ==============================================================================
 *
 * Keeps consistency with existing NetKnife lambdas (e.g. `reports`, `billing`, `board`)
 * by using an `action` field for routing.
 *
 * MVP scope:
 * - saveProgress / getProgress / listProgress
 * - getContent (cached) / generateContent (delegates to Security Advisor if configured)
 *
 * Data model (DynamoDB):
 * - GUIDE_PROGRESS_TABLE: pk=USER#<sub>, sk=GUIDE#<guideId>#STEP#<stepId>
 * - GUIDE_CONTENT_TABLE:  pk=GUIDE#<guideId>, sk=STEP#<stepId>#v<version>
 *
 * NOTE: This is implemented as a backend foundation; guide step content can be
 * authored in frontend registry and/or AI-generated and cached here.
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const GUIDE_PROGRESS_TABLE = process.env.GUIDE_PROGRESS_TABLE;
const GUIDE_CONTENT_TABLE = process.env.GUIDE_CONTENT_TABLE;
const SECURITY_ADVISOR_LAMBDA_URL = process.env.SECURITY_ADVISOR_LAMBDA_URL || ""; // Optional: internal invoke via API Gateway

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

// Copy of the robust user extraction approach from `backend/functions/reports/index.js`
function getUserId(event) {
  try {
    let claims = {};
    if (event.requestContext?.authorizer?.jwt?.claims) {
      claims = event.requestContext.authorizer.jwt.claims;
    } else if (event.requestContext?.authorizer?.claims) {
      claims = event.requestContext.authorizer.claims;
    } else if (event.requestContext?.authorizer) {
      const auth = event.requestContext.authorizer;
      if (auth.sub || auth["cognito:username"]) claims = auth;
    }

    if (Object.keys(claims).length === 0) {
      const authHeader = event.headers?.authorization || event.headers?.Authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const token = authHeader.substring(7);
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
            claims = payload;
          }
        } catch {}
      }
    }

    return claims.sub || claims["cognito:username"] || "unknown";
  } catch {
    return "unknown";
  }
}

function requireTables() {
  if (!GUIDE_PROGRESS_TABLE) return { ok: false, error: "GUIDE_PROGRESS_TABLE not configured" };
  if (!GUIDE_CONTENT_TABLE) return { ok: false, error: "GUIDE_CONTENT_TABLE not configured" };
  return { ok: true };
}

function progressKey(userId, guideId, stepId) {
  return { pk: `USER#${userId}`, sk: `GUIDE#${guideId}#STEP#${stepId}` };
}

function contentKey(guideId, stepId, version = "1") {
  return { pk: `GUIDE#${guideId}`, sk: `STEP#${stepId}#v${version}` };
}

async function handleSaveProgress(userId, body) {
  const { guideId, stepId } = body;
  if (!guideId || !stepId) return json(400, { error: "Missing guideId or stepId" });

  const now = Math.floor(Date.now() / 1000);
  const item = {
    ...progressKey(userId, guideId, stepId),
    userId,
    guideId,
    stepId,
    completed: !!body.completed,
    completedAt: body.completed ? now : null,
    notes: typeof body.notes === "string" ? body.notes : "",
    findings: Array.isArray(body.findings) ? body.findings : [],
    scanResults: Array.isArray(body.scanResults) ? body.scanResults : [],
    toolResults: body.toolResults && typeof body.toolResults === "object" ? body.toolResults : {},
    // Collaboration fields
    shared: !!body.shared,
    collaborators: Array.isArray(body.collaborators) ? body.collaborators : [],
    lastViewedAt: now,
    updatedAt: now,
    ttl: now + 365 * 24 * 60 * 60,
  };

  await ddb.send(
    new PutCommand({
      TableName: GUIDE_PROGRESS_TABLE,
      Item: item,
    })
  );

  return json(200, { success: true, progress: item });
}

async function handleGetProgress(userId, body) {
  const { guideId, stepId } = body;
  if (!guideId) return json(400, { error: "Missing guideId" });

  if (stepId) {
    const result = await ddb.send(
      new GetCommand({
        TableName: GUIDE_PROGRESS_TABLE,
        Key: progressKey(userId, guideId, stepId),
      })
    );
    return json(200, { progress: result.Item || null });
  }

  const result = await ddb.send(
    new QueryCommand({
      TableName: GUIDE_PROGRESS_TABLE,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":sk": `GUIDE#${guideId}#STEP#`,
      },
    })
  );

  return json(200, { progress: result.Items || [] });
}

async function handleListProgress(userId) {
  // Lists all guide step progress for this user; frontend can aggregate.
  const result = await ddb.send(
    new QueryCommand({
      TableName: GUIDE_PROGRESS_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `USER#${userId}` },
    })
  );
  return json(200, { items: result.Items || [] });
}

async function handleGetContent(body) {
  const { guideId, stepId, version = "1" } = body;
  if (!guideId || !stepId) return json(400, { error: "Missing guideId or stepId" });
  const result = await ddb.send(
    new GetCommand({
      TableName: GUIDE_CONTENT_TABLE,
      Key: contentKey(guideId, stepId, String(version)),
    })
  );
  return json(200, { content: result.Item?.content || null, cached: !!result.Item });
}

// Validate AI-generated content before caching
function validateAIContent(content) {
  if (!content || typeof content !== "object") {
    return { valid: false, error: "Content must be an object" };
  }

  // Check for banned words/phrases (basic example)
  const bannedWords = ["hack", "exploit", "breach"]; // Expand as needed
  const contentStr = JSON.stringify(content).toLowerCase();
  for (const word of bannedWords) {
    if (contentStr.includes(word)) {
      return { valid: false, error: `Content contains inappropriate term: ${word}` };
    }
  }

  // Ensure content has required structure
  if (!content.overview && !content.description) {
    return { valid: false, error: "Content must have overview or description" };
  }

  return { valid: true };
}

async function handleGenerateContent(userId, body) {
  const { guideId, stepId, version = "1", userContext = "" } = body;
  if (!guideId || !stepId) return json(400, { error: "Missing guideId or stepId" });

  // If Security Advisor is not configured, return a helpful stub.
  if (!SECURITY_ADVISOR_LAMBDA_URL) {
    return json(200, {
      content: {
        overview: "AI generation is not configured for this environment.",
        notes: "Set SECURITY_ADVISOR_LAMBDA_URL and ensure /security-advisor is deployed.",
        guideId,
        stepId,
        citations: ["NetKnife Documentation"],
      },
      cached: false,
    });
  }

  // Delegate to Security Advisor to generate content.
  const res = await fetch(SECURITY_ADVISOR_LAMBDA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "generateGuideContent",
      guideId,
      stepId,
      userContext,
    }),
  });
  const data = await res.json();

  // Validate generated content
  const validation = validateAIContent(data?.content ?? data);
  if (!validation.valid) {
    return json(400, { error: `Content validation failed: ${validation.error}` });
  }

  const now = Math.floor(Date.now() / 1000);
  const generatedContent = data?.content ?? data;
  
  // Add citations if not present
  if (!generatedContent.citations) {
    generatedContent.citations = [
      "MITRE ATT&CK Framework",
      "MITRE D3FEND",
      "NIST Cybersecurity Framework",
    ];
  }

  const item = {
    ...contentKey(guideId, stepId, String(version)),
    guideId,
    stepId,
    version: String(version),
    content: generatedContent,
    generatedAt: now,
    generatedBy: userId,
    approved: false,
    validated: true,
    ratings: [], // Array of { userId, rating: 1-5, feedback: string, createdAt: timestamp }
    averageRating: null,
    ttl: now + 30 * 24 * 60 * 60, // 30 days for AI cache by default
  };

  await ddb.send(
    new PutCommand({
      TableName: GUIDE_CONTENT_TABLE,
      Item: item,
    })
  );

  return json(200, { content: item.content, cached: false });
}

async function handleRateContent(userId, body) {
  const { guideId, stepId, version = "1", rating, feedback } = body;
  if (!guideId || !stepId) return json(400, { error: "Missing guideId or stepId" });
  if (!rating || rating < 1 || rating > 5) return json(400, { error: "Rating must be 1-5" });

  const key = contentKey(guideId, stepId, String(version));
  const result = await ddb.send(new GetCommand({
    TableName: GUIDE_CONTENT_TABLE,
    Key: key,
  }));

  if (!result.Item) {
    return json(404, { error: "Content not found" });
  }

  const ratings = Array.isArray(result.Item.ratings) ? result.Item.ratings : [];
  const existingRatingIndex = ratings.findIndex((r) => r.userId === userId);
  const now = Math.floor(Date.now() / 1000);

  const newRating = {
    userId,
    rating: Number(rating),
    feedback: typeof feedback === "string" ? feedback : "",
    createdAt: now,
  };

  if (existingRatingIndex >= 0) {
    ratings[existingRatingIndex] = newRating;
  } else {
    ratings.push(newRating);
  }

  const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

  await ddb.send(
    new PutCommand({
      TableName: GUIDE_CONTENT_TABLE,
      Item: {
        ...result.Item,
        ratings,
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      },
    })
  );

  return json(200, { success: true, averageRating });
}

exports.handler = async (event) => {
  try {
    const tables = requireTables();
    if (!tables.ok) return json(500, { error: tables.error });

    const userId = getUserId(event);
    if (userId === "unknown") return json(401, { error: "Authentication required" });

    let body = {};
    if (event.body) {
      try {
        body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      } catch {
        return json(400, { error: "Invalid JSON body" });
      }
    }

    const action = String(body.action || "").trim();
    if (!action) return json(400, { error: "Missing required field: action" });

    switch (action) {
      case "saveProgress":
        return await handleSaveProgress(userId, body);
      case "getProgress":
        return await handleGetProgress(userId, body);
      case "listProgress":
        return await handleListProgress(userId);
      case "getContent":
        return await handleGetContent(body);
      case "generateContent":
        return await handleGenerateContent(userId, body);
      case "rateContent":
        return await handleRateContent(userId, body);
      default:
        return json(400, { error: `Unknown action: ${action}` });
    }
  } catch (e) {
    console.error("Guides Lambda error:", e);
    return json(500, { error: "Internal server error" });
  }
};

