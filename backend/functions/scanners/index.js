/**
 * ==============================================================================
 * NETKNIFE - SCANNERS LAMBDA (Action-Based Routing)
 * ==============================================================================
 *
 * MVP backend foundation for vulnerability scanner integrations.
 * - Scanner configs are stored as metadata in DynamoDB and secrets in Secrets Manager (future).
 * - Scan runs are stored in DynamoDB; cloud/agent execution is stubbed for now.
 *
 * ACTIONS:
 * - saveScannerConfig / listScannerConfigs / deleteScannerConfig
 * - scan / getScan / listScans
 *
 * Tables:
 * - SCANNER_CONFIGS_TABLE: pk=USER#<sub>, sk=SCANNER#<scannerId>
 * - SCAN_RESULTS_TABLE:    pk=USER#<sub>, sk=SCAN#<scanId>
 *
 * This is intentionally minimal and safe-by-default: it validates targets and
 * does not perform network scanning from Lambda until explicit implementation.
 * ==============================================================================
 */

const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const { SecretsManagerClient, GetSecretValueCommand, CreateSecretCommand, UpdateSecretCommand, DeleteSecretCommand } = require("@aws-sdk/client-secrets-manager");

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const secretsManager = new SecretsManagerClient({});

const SCANNER_CONFIGS_TABLE = process.env.SCANNER_CONFIGS_TABLE;
const SCAN_RESULTS_TABLE = process.env.SCAN_RESULTS_TABLE;

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
    return claims.sub || claims["cognito:username"] || "unknown";
  } catch {
    return "unknown";
  }
}

function requireTables() {
  if (!SCANNER_CONFIGS_TABLE) return { ok: false, error: "SCANNER_CONFIGS_TABLE not configured" };
  if (!SCAN_RESULTS_TABLE) return { ok: false, error: "SCAN_RESULTS_TABLE not configured" };
  return { ok: true };
}

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map((x) => Number(x));
  if (parts.length !== 4) return true;
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 127 || a === 0) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function looksLikeIPv4(s) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(s);
}

function looksLikeDomain(s) {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(s);
}

function validateTarget(target, scannerType) {
  const t = String(target || "").trim().toLowerCase();
  if (!t) throw new Error("Target is required");
  if (t.length > 2048) throw new Error("Target too long");
  if (t.includes(".amazonaws.com") || t.includes(".amazon.com")) throw new Error("Cannot scan AWS infrastructure");

  // Cloud scanners must not accept private IPs.
  if (scannerType === "cloud" && looksLikeIPv4(t) && isPrivateIPv4(t)) {
    throw new Error("Cloud scanners cannot scan private IPs. Use agent scanners on your network.");
  }

  // Allow IPv4, domain, URL-ish (very light), CIDR-ish
  const cidr = /^(\d{1,3}(\.\d{1,3}){3})\/\d{1,2}$/.test(t);
  const urlish = /^https?:\/\//.test(t);
  if (!(looksLikeIPv4(t) || looksLikeDomain(t) || cidr || urlish)) {
    throw new Error("Invalid target format");
  }

  return t;
}

function userPk(userId) {
  return `USER#${userId}`;
}

async function handleSaveScannerConfig(userId, body) {
  const { scannerId, type, name, endpoint, apiKey, username, password } = body;
  if (!scannerId || !type) return json(400, { error: "Missing scannerId or type" });

  const now = Math.floor(Date.now() / 1000);
  let secretArn = body.secretArn || "";

  // Store credentials in Secrets Manager if provided
  if (apiKey || username || password) {
    const secretId = `netknife/${userId}/${scannerId}`;
    const secretValue = JSON.stringify({
      apiKey: apiKey || "",
      username: username || "",
      password: password || "",
      updatedAt: now,
    });

    try {
      // Try to update existing secret
      try {
        // Try to update existing secret
        const updateResult = await secretsManager.send(
          new UpdateSecretCommand({
            SecretId: secretId,
            SecretString: secretValue,
          })
        );
        secretArn = updateResult.ARN || secretId;
      } catch (updateErr) {
        // If secret doesn't exist, create it
        if (updateErr.name === "ResourceNotFoundException" || updateErr.name === "InvalidRequestException") {
          try {
            const createResult = await secretsManager.send(
              new CreateSecretCommand({
                Name: secretId,
                Description: `Scanner credentials for ${scannerId}`,
                SecretString: secretValue,
              })
            );
            secretArn = createResult.ARN || secretId;
          } catch (createErr) {
            console.error("Failed to create secret:", createErr);
            throw createErr;
          }
        } else {
          throw updateErr;
        }
      }
    } catch (secretErr) {
      console.error("Secrets Manager error:", secretErr);
      return json(500, { error: "Failed to store credentials in Secrets Manager" });
    }
  }

  const item = {
    pk: userPk(userId),
    sk: `SCANNER#${scannerId}`,
    userId,
    scannerId,
    type,
    name: name || scannerId,
    endpoint: endpoint || "",
    secretArn: secretArn || "",
    status: "unknown",
    lastHealthCheck: null,
    createdAt: now,
    updatedAt: now,
    ttl: now + 365 * 24 * 60 * 60,
  };

  await ddb.send(new PutCommand({ TableName: SCANNER_CONFIGS_TABLE, Item: item }));
  return json(200, { success: true, config: item });
}

async function handleListScannerConfigs(userId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: SCANNER_CONFIGS_TABLE,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: { ":pk": userPk(userId), ":sk": "SCANNER#" },
    })
  );
  // Don't return secret ARNs in list (security best practice)
  const items = (result.Items || []).map((item) => {
    const { secretArn, ...rest } = item;
    return { ...rest, hasCredentials: !!secretArn };
  });
  return json(200, { items });
}

// Helper to retrieve scanner credentials from Secrets Manager
async function getScannerCredentials(userId, scannerId) {
  const configResult = await ddb.send(
    new GetCommand({
      TableName: SCANNER_CONFIGS_TABLE,
      Key: { pk: userPk(userId), sk: `SCANNER#${scannerId}` },
    })
  );

  if (!configResult.Item || !configResult.Item.secretArn) {
    return null;
  }

  try {
    const secretResult = await secretsManager.send(
      new GetSecretValueCommand({ SecretId: configResult.Item.secretArn })
    );
    return JSON.parse(secretResult.SecretString || "{}");
  } catch (err) {
    console.error("Failed to retrieve secret:", err);
    return null;
  }
}

async function handleDeleteScannerConfig(userId, body) {
  const { scannerId } = body;
  if (!scannerId) return json(400, { error: "Missing scannerId" });

  // Get config to find secret ARN
  const configResult = await ddb.send(
    new GetCommand({
      TableName: SCANNER_CONFIGS_TABLE,
      Key: { pk: userPk(userId), sk: `SCANNER#${scannerId}` },
    })
  );

  // Delete from DynamoDB
  await ddb.send(
    new DeleteCommand({
      TableName: SCANNER_CONFIGS_TABLE,
      Key: { pk: userPk(userId), sk: `SCANNER#${scannerId}` },
    })
  );

  // Delete secret from Secrets Manager if it exists
  if (configResult.Item?.secretArn) {
    try {
      await secretsManager.send(
        new DeleteSecretCommand({
          SecretId: configResult.Item.secretArn,
          ForceDeleteWithoutRecovery: true, // Immediate deletion
        })
      );
    } catch (secretErr) {
      // Log but don't fail if secret deletion fails (may already be deleted)
      console.warn("Failed to delete secret:", secretErr);
    }
  }

  return json(200, { success: true });
}

async function handleScan(userId, body) {
  const scannerType = String(body.scannerType || "cloud").trim(); // cloud | agent
  const target = validateTarget(body.target, scannerType);
  const scanProfile = String(body.scanProfile || "quick").trim();
  const scanId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const item = {
    pk: userPk(userId),
    sk: `SCAN#${scanId}`,
    userId,
    scanId,
    scannerType,
    scannerId: body.scannerId || null,
    target,
    scanProfile,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    findings: [],
    raw: null,
    ttl: now + 90 * 24 * 60 * 60,
  };

  await ddb.send(new PutCommand({ TableName: SCAN_RESULTS_TABLE, Item: item }));

  // MVP: no execution; mark as completed with stub so UI flows.
  const completed = {
    ...item,
    status: "completed",
    updatedAt: now,
    completedAt: now,
    findings: [
      {
        id: "stub",
        severity: "info",
        title: "Scanner execution is not enabled yet",
        description:
          "This is a placeholder scan result. Implement cloud scanner execution (Nuclei/Trivy) or agent callbacks to populate real findings.",
        cvssScore: null,
        cvssVector: null,
        epssScore: null,
        cve: null,
        remediation: [],
      },
    ],
  };
  await ddb.send(
    new PutCommand({
      TableName: SCAN_RESULTS_TABLE,
      Item: completed,
    })
  );

  return json(200, { scan: completed });
}

async function handleGetScan(userId, body) {
  const { scanId } = body;
  if (!scanId) return json(400, { error: "Missing scanId" });
  const result = await ddb.send(
    new GetCommand({
      TableName: SCAN_RESULTS_TABLE,
      Key: { pk: userPk(userId), sk: `SCAN#${scanId}` },
    })
  );
  return json(200, { scan: result.Item || null });
}

async function handleListScans(userId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: SCAN_RESULTS_TABLE,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: { ":pk": userPk(userId), ":sk": "SCAN#" },
      ScanIndexForward: false,
    })
  );
  return json(200, { items: result.Items || [] });
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
      case "saveScannerConfig":
        return await handleSaveScannerConfig(userId, body);
      case "listScannerConfigs":
        return await handleListScannerConfigs(userId);
      case "deleteScannerConfig":
        return await handleDeleteScannerConfig(userId, body);
      case "scan":
        return await handleScan(userId, body);
      case "getScan":
        return await handleGetScan(userId, body);
      case "listScans":
        return await handleListScans(userId);
      default:
        return json(400, { error: `Unknown action: ${action}` });
    }
  } catch (e) {
    console.error("Scanners Lambda error:", e);
    return json(500, { error: "Internal server error" });
  }
};

