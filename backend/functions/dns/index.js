/**
 * ==============================================================================
 * NETKNIFE - DNS RESOLVER LAMBDA FUNCTION
 * ==============================================================================
 * 
 * PURPOSE:
 * This Lambda function performs DNS lookups using DNS-over-HTTPS (DoH).
 * It provides a consistent, reliable way to resolve DNS records from AWS,
 * with results cached in DynamoDB to reduce upstream API calls.
 * 
 * HOW IT WORKS:
 * 1. Client sends POST request with domain name and record type
 * 2. Lambda checks DynamoDB cache for recent results
 * 3. If not cached, queries Cloudflare's DoH API (1.1.1.1)
 * 4. Caches successful results in DynamoDB with TTL
 * 5. Returns structured JSON response
 * 
 * INPUT FORMAT:
 * {
 *   "name": "example.com",     // Domain to resolve
 *   "type": "A"                 // Record type: A, AAAA, CNAME, MX, TXT, NS, SRV
 * }
 * 
 * OUTPUT FORMAT:
 * {
 *   "name": "example.com",
 *   "type": "A",
 *   "status": 0,                // DNS status code (0 = NOERROR)
 *   "answer": [...],            // DNS answer records
 *   "authority": [...],         // Authority section
 *   "cached": false             // Whether result came from cache
 * }
 * 
 * SECURITY:
 * - Input validation prevents injection attacks
 * - Only allows specific record types
 * - Uses HTTPS to Cloudflare (trusted upstream)
 * - No shell execution or arbitrary code
 * 
 * ENVIRONMENT VARIABLES:
 * - CACHE_TABLE: DynamoDB table name for caching
 * - CACHE_TTL_SECONDS: How long to cache results (default: 300)
 * 
 * ==============================================================================
 */

// AWS SDK v3 (included in Lambda Node.js 18+ runtime)
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

// Cloudflare DNS-over-HTTPS endpoint (JSON format)
const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

// Initialize DynamoDB client (SDK v3)
const ddbClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(ddbClient);

// Get configuration from environment variables
const CACHE_TABLE = process.env.CACHE_TABLE;
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "300");

// Allowed DNS record types (prevent abuse)
const ALLOWED_TYPES = new Set(["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"]);

/**
 * Creates a standardized API Gateway response object
 * 
 * @param {number} statusCode - HTTP status code (200, 400, 500, etc.)
 * @param {object} body - Response body to serialize as JSON
 * @returns {object} API Gateway Lambda proxy response
 */
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      // Prevent caching at CDN/browser level (we handle caching in DynamoDB)
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

/**
 * Attempts to retrieve a cached result from DynamoDB
 * 
 * @param {string} cacheKey - Unique identifier for the cached item
 * @returns {object|null} Cached value if found and not expired, null otherwise
 */
async function getCachedResult(cacheKey) {
  // Skip cache if table not configured
  if (!CACHE_TABLE) return null;

  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: CACHE_TABLE,
      Key: { cache_key: cacheKey },
    }));

    // Check if item exists
    if (!result.Item) return null;

    // Check if item has expired (belt and suspenders with DynamoDB TTL)
    const now = Math.floor(Date.now() / 1000);
    if (result.Item.expires_at <= now) return null;

    return result.Item.value;
  } catch (error) {
    // Log but don't fail - cache miss is acceptable
    console.error("Cache read error:", error);
    return null;
  }
}

/**
 * Stores a result in DynamoDB cache with TTL
 * 
 * @param {string} cacheKey - Unique identifier for the cached item
 * @param {object} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds
 */
async function setCachedResult(cacheKey, value, ttlSeconds) {
  // Skip cache if table not configured
  if (!CACHE_TABLE) return;

  try {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    
    await dynamodb.send(new PutCommand({
      TableName: CACHE_TABLE,
      Item: {
        cache_key: cacheKey,
        value: value,
        expires_at: expiresAt,
      },
    }));
  } catch (error) {
    // Log but don't fail - cache write is best-effort
    console.error("Cache write error:", error);
  }
}

/**
 * Validates the input domain name
 * 
 * @param {string} name - Domain name to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidDomain(name) {
  if (!name || typeof name !== "string") return false;
  if (name.length > 253) return false;
  
  // Allow letters, numbers, dots, hyphens (basic DNS character set)
  // This is intentionally permissive to allow IDN/punycode
  return /^[a-zA-Z0-9.-]+$/.test(name);
}

/**
 * Main Lambda handler
 * 
 * @param {object} event - API Gateway Lambda proxy event
 * @returns {object} API Gateway Lambda proxy response
 */
exports.handler = async (event) => {
  try {
    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    
    // Extract and normalize input
    const name = String(body.name || "").trim().toLowerCase();
    const type = String(body.type || "A").trim().toUpperCase();

    // Validate domain name
    if (!isValidDomain(name)) {
      return createResponse(400, { 
        error: "Invalid domain name",
        details: "Domain must be 1-253 characters, alphanumeric with dots and hyphens"
      });
    }

    // Validate record type
    if (!ALLOWED_TYPES.has(type)) {
      return createResponse(400, { 
        error: "Unsupported record type",
        allowed: Array.from(ALLOWED_TYPES)
      });
    }

    // Generate cache key
    const cacheKey = `dns:${type}:${name}`;

    // Check cache first
    const cached = await getCachedResult(cacheKey);
    if (cached) {
      // Return cached result with cache indicator
      return createResponse(200, { ...cached, cached: true });
    }

    // Build DoH request URL
    const url = new URL(DOH_ENDPOINT);
    url.searchParams.set("name", name);
    url.searchParams.set("type", type);

    // Query Cloudflare DoH
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        // Request JSON format (not DNS wireformat)
        "accept": "application/dns-json",
      },
    });

    // Parse response
    const data = await response.json();

    // Build result object
    const result = {
      name,
      type,
      status: data.Status,           // DNS RCODE (0 = NOERROR)
      answer: data.Answer || [],     // Answer section records
      authority: data.Authority || [], // Authority section
      comment: data.Comment || null, // Optional comment from resolver
    };

    // Cache successful results
    if (response.ok) {
      await setCachedResult(cacheKey, result, CACHE_TTL_SECONDS);
    }

    // Return result
    return createResponse(200, { ...result, cached: false });
  } catch (error) {
    // Log error for debugging
    console.error("DNS lookup error:", error);

    // Return generic error (don't leak internal details)
    return createResponse(500, { error: "DNS lookup failed" });
  }
};

