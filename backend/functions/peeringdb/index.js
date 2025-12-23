/**
 * ==============================================================================
 * NETKNIFE - PEERINGDB LAMBDA FUNCTION
 * ==============================================================================
 *
 * This Lambda proxies queries to the PeeringDB API for network/IX information.
 * PeeringDB is a freely available database of networks, internet exchanges,
 * and interconnection data maintained by the peering community.
 *
 * SUPPORTED RESOURCES:
 * - net: Networks (ASN info, peering policy)
 * - org: Organizations
 * - ix: Internet Exchanges
 * - fac: Facilities (data centers)
 *
 * SECURITY:
 * - Input validation (allowed resources only)
 * - Query parameter sanitization
 * - Caching to reduce load on PeeringDB
 *
 * CACHING:
 * Results are cached in DynamoDB for 1 hour to:
 * - Reduce load on PeeringDB API
 * - Stay within anonymous rate limits (20 req/min)
 * - Improve response times
 *
 * ENVIRONMENT VARIABLES:
 * - CACHE_TABLE: DynamoDB table name for caching
 * - CACHE_TTL_SECONDS: Cache TTL (default: 3600 = 1 hour)
 *
 * INPUT (JSON POST body):
 * {
 *   "resource": "net" | "org" | "ix" | "fac",
 *   "asn": "13335" (optional, for net lookups),
 *   "name": "Cloudflare" (optional, partial match)
 * }
 *
 * OUTPUT:
 * {
 *   "resource": "net",
 *   "asn": "13335",
 *   "name": null,
 *   "status": 200,
 *   "data": { ... PeeringDB response ... },
 *   "cached": false
 * }
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

// Initialize DynamoDB client
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "3600");

// PeeringDB API base URL
const PEERINGDB_API_BASE = "https://www.peeringdb.com/api";

// Allowed resource types (whitelist for security)
const ALLOWED_RESOURCES = new Set(["net", "org", "ix", "fac"]);

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

/**
 * Creates a JSON HTTP response
 */
function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * Retrieves a cached item from DynamoDB
 */
async function cacheGet(key) {
  if (!CACHE_TABLE) return null;
  
  try {
    const result = await ddb.send(new GetCommand({
      TableName: CACHE_TABLE,
      Key: { cache_key: key },
    }));
    
    // Check if item exists and hasn't expired
    if (result.Item && result.Item.expires_at > Math.floor(Date.now() / 1000)) {
      return result.Item.data;
    }
  } catch (err) {
    console.error("Cache get error:", err.message);
  }
  
  return null;
}

/**
 * Stores an item in DynamoDB cache with TTL
 */
async function cachePut(key, data, ttlSeconds) {
  if (!CACHE_TABLE) return;
  
  try {
    await ddb.send(new PutCommand({
      TableName: CACHE_TABLE,
      Item: {
        cache_key: key,
        data,
        expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
      },
    }));
  } catch (err) {
    console.error("Cache put error:", err.message);
  }
}

/**
 * Validates and sanitizes a string parameter
 * Returns empty string if invalid
 */
function sanitizeParam(value) {
  if (!value || typeof value !== "string") return "";
  // Remove any potentially dangerous characters
  // Allow alphanumeric, spaces, dots, hyphens, and underscores
  return value.trim().replace(/[^a-zA-Z0-9\s.\-_]/g, "");
}

/**
 * Validates ASN format (should be numeric)
 */
function validateAsn(asn) {
  if (!asn) return "";
  const cleaned = String(asn).replace(/[^0-9]/g, "");
  // ASN should be 1-10 digits (up to 4294967295)
  if (cleaned.length > 10) return "";
  return cleaned;
}

// ==============================================================================
// MAIN HANDLER
// ==============================================================================

/**
 * Lambda handler for PeeringDB queries
 */
exports.handler = async (event) => {
  try {
    // Parse request body
    let raw = {};
    if (event.body) {
      try {
        raw = JSON.parse(event.body);
      } catch {
        return json(400, { error: "Invalid JSON body" });
      }
    }

    // Extract and validate parameters
    const resource = String(raw.resource || "").trim().toLowerCase();
    const asn = validateAsn(raw.asn);
    const name = sanitizeParam(raw.name);

    // Validate resource type
    if (!ALLOWED_RESOURCES.has(resource)) {
      return json(400, {
        error: "Invalid resource type. Must be one of: net, org, ix, fac",
      });
    }

    // Need at least one query parameter
    if (!asn && !name) {
      return json(400, {
        error: "At least one of 'asn' or 'name' is required",
      });
    }

    // Build query parameters
    const queryParams = [];
    if (asn) queryParams.push(`asn=${encodeURIComponent(asn)}`);
    // PeeringDB uses __icontains for case-insensitive partial match
    if (name) queryParams.push(`name__icontains=${encodeURIComponent(name)}`);

    const queryString = queryParams.join("&");

    // Check cache first
    const cacheKey = `peeringdb:${resource}:${queryString}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      console.log("Cache hit:", cacheKey);
      return json(200, { ...cached, cached: true });
    }

    // Build PeeringDB API URL
    const url = `${PEERINGDB_API_BASE}/${resource}${queryString ? `?${queryString}` : ""}`;
    console.log("Fetching:", url);

    // Make request to PeeringDB with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let response;
    try {
      response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "NetKnife/1.0 (Network Tools)",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    // Parse response
    const data = await response.json();

    // Build output object
    const output = {
      resource,
      asn: asn || null,
      name: name || null,
      status: response.status,
      data,
    };

    // Only cache successful responses
    if (response.ok) {
      await cachePut(cacheKey, output, TTL_SECONDS);
    }

    return json(response.ok ? 200 : response.status, {
      ...output,
      cached: false,
    });
  } catch (err) {
    console.error("Handler error:", err);
    
    // Handle abort/timeout
    if (err.name === "AbortError") {
      return json(504, { error: "Request to PeeringDB timed out" });
    }
    
    return json(500, { error: "Server error processing request" });
  }
};
