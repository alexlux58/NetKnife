/**
 * ==============================================================================
 * NETKNIFE - HAVE I BEEN PWNED (HIBP) PASSWORD CHECK LAMBDA
 * ==============================================================================
 * 
 * Checks if a password has appeared in known data breaches using the
 * Have I Been Pwned Pwned Passwords API with k-anonymity.
 * 
 * SECURITY:
 * - Uses k-anonymity: only the first 5 chars of the SHA-1 hash are sent
 * - The full password never leaves the client OR this Lambda
 * - HIBP cannot determine the actual password being checked
 * 
 * REQUEST:
 *   POST { "hashPrefix": "5BAA6" }
 *   (Client sends only first 5 chars of SHA-1 hash)
 * 
 * RESPONSE:
 *   {
 *     "hashPrefix": "5BAA6",
 *     "matchCount": 1234567,
 *     "suffixes": ["1E4C9B93F3F0682250B6CF8331B7EE68FD8:3730471", ...],
 *     "cached": false
 *   }
 * 
 * CLIENT USAGE:
 *   1. SHA-1 hash the password
 *   2. Send first 5 hex chars to this API
 *   3. Check if the remaining hash suffix appears in the response
 * 
 * CACHING:
 *   Results are cached for 24 hours (breaches don't change that often).
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "86400"); // 24 hours

const HIBP_API = "https://api.pwnedpasswords.com/range/";

// ------------------------------------------------------------------------------
// CACHE HELPERS
// ------------------------------------------------------------------------------

async function cacheGet(key) {
  if (!CACHE_TABLE) return null;
  try {
    const res = await ddb.send(new GetCommand({ TableName: CACHE_TABLE, Key: { cache_key: key } }));
    if (res.Item && res.Item.expires_at > Math.floor(Date.now() / 1000)) {
      return res.Item.data;
    }
  } catch (e) {
    console.warn("Cache get error:", e.message);
  }
  return null;
}

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
  } catch (e) {
    console.warn("Cache put error:", e.message);
  }
}

// ------------------------------------------------------------------------------
// VALIDATION
// ------------------------------------------------------------------------------

function isValidHashPrefix(prefix) {
  // Must be exactly 5 hexadecimal characters
  return /^[0-9A-Fa-f]{5}$/.test(prefix);
}

// ------------------------------------------------------------------------------
// HIBP API QUERY
// ------------------------------------------------------------------------------

async function queryHIBP(hashPrefix) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(`${HIBP_API}${hashPrefix}`, {
      headers: {
        "User-Agent": "NetKnife-PasswordChecker",
        "Add-Padding": "true", // Adds padding to prevent timing attacks
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HIBP API error: ${response.status}`);
    }
    
    const text = await response.text();
    return text;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw e;
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
// LAMBDA HANDLER
// ------------------------------------------------------------------------------

exports.handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const hashPrefix = String(body.hashPrefix || "").trim().toUpperCase();
    
    // Validate hash prefix
    if (!hashPrefix) {
      return json(400, { error: "Missing required field: hashPrefix" });
    }
    
    if (!isValidHashPrefix(hashPrefix)) {
      return json(400, { 
        error: "Invalid hash prefix. Must be exactly 5 hexadecimal characters.",
        hint: "The client should SHA-1 hash the password and send the first 5 chars."
      });
    }
    
    // Check cache
    const cacheKey = `hibp:${hashPrefix}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return json(200, { ...cached, cached: true });
    }
    
    // Query HIBP API
    const hibpResponse = await queryHIBP(hashPrefix);
    
    // Parse response (format: SUFFIX:COUNT per line)
    const lines = hibpResponse.trim().split("\n");
    const suffixes = lines.map(line => {
      const [suffix, count] = line.split(":");
      return {
        suffix: suffix.trim(),
        count: parseInt(count, 10) || 0,
      };
    }).filter(s => s.count > 0); // Remove padding entries (count=0)
    
    // Calculate total breached passwords with this prefix
    const totalBreaches = suffixes.reduce((sum, s) => sum + s.count, 0);
    
    const result = {
      hashPrefix,
      totalSuffixes: suffixes.length,
      totalBreaches,
      // Return suffixes as array of "SUFFIX:COUNT" strings for easy client lookup
      suffixes: suffixes.map(s => `${s.suffix}:${s.count}`),
    };
    
    // Cache result
    await cachePut(cacheKey, result, TTL_SECONDS);
    
    return json(200, { ...result, cached: false });
    
  } catch (e) {
    console.error("HIBP check error:", e);
    return json(500, { error: e.message || "Server error" });
  }
};

