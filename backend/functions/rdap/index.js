/**
 * ==============================================================================
 * NETKNIFE - RDAP LOOKUP LAMBDA FUNCTION
 * ==============================================================================
 * 
 * PURPOSE:
 * This Lambda function performs RDAP (Registration Data Access Protocol) lookups.
 * RDAP is the modern, JSON-based replacement for WHOIS, providing structured
 * information about IP addresses and domain registrations.
 * 
 * WHAT IS RDAP?
 * - RDAP = Registration Data Access Protocol
 * - Returns JSON instead of unstructured text (like WHOIS)
 * - Uses HTTPS (secure transport)
 * - Standardized format across registries
 * - Provides information about:
 *   - IP address allocations (who owns a netblock)
 *   - Domain registrations (registrar, nameservers, contacts)
 *   - ASN assignments (autonomous system numbers)
 * 
 * HOW IT WORKS:
 * 1. Client sends POST request with IP or domain
 * 2. Lambda checks DynamoDB cache for recent results
 * 3. If not cached, queries rdap.org bootstrap aggregator
 * 4. Follows redirects to appropriate RIR/registrar RDAP server
 * 5. Caches results for 24 hours
 * 6. Returns structured JSON response
 * 
 * INPUT FORMAT:
 * {
 *   "query": "8.8.8.8"          // IP address (v4/v6) or domain name
 * }
 * 
 * SECURITY:
 * - Only allows queries to known RDAP hosts (allowlist)
 * - Manual redirect following with host validation
 * - Limit on redirect count (prevents redirect loops)
 * - Input validation
 * 
 * ENVIRONMENT VARIABLES:
 * - CACHE_TABLE: DynamoDB table name for caching
 * - CACHE_TTL_SECONDS: How long to cache results (default: 86400 = 24h)
 * 
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

// Initialize DynamoDB client (SDK v3)
const ddbClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(ddbClient);

// Get configuration from environment
const CACHE_TABLE = process.env.CACHE_TABLE;
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "86400");

// Maximum number of redirects to follow
const MAX_REDIRECTS = 5;

// Allowlist of trusted RDAP hosts
// This prevents SSRF by only allowing redirects to known RDAP servers
const ALLOWED_RDAP_HOSTS = new Set([
  // Bootstrap aggregator
  "rdap.org",
  // Regional Internet Registries (RIRs)
  "rdap.arin.net",      // North America
  "rdap.db.ripe.net",   // Europe, Middle East, Central Asia
  "rdap.apnic.net",     // Asia Pacific
  "rdap.lacnic.net",    // Latin America
  "rdap.afrinic.net",   // Africa
  // Major domain registries
  "rdap.verisign.com",
  "rdap.markmonitor.com",
  "rdap.godaddy.com",
]);

/**
 * Creates a standardized API Gateway response
 */
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

/**
 * Cache operations
 */
async function getCachedResult(cacheKey) {
  if (!CACHE_TABLE) return null;
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: CACHE_TABLE,
      Key: { cache_key: cacheKey },
    }));
    if (!result.Item) return null;
    if (result.Item.expires_at <= Math.floor(Date.now() / 1000)) return null;
    return result.Item.value;
  } catch (error) {
    console.error("Cache read error:", error);
    return null;
  }
}

async function setCachedResult(cacheKey, value, ttlSeconds) {
  if (!CACHE_TABLE) return;
  try {
    await dynamodb.send(new PutCommand({
      TableName: CACHE_TABLE,
      Item: {
        cache_key: cacheKey,
        value: value,
        expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
      },
    }));
  } catch (error) {
    console.error("Cache write error:", error);
  }
}

/**
 * Determines if a string looks like an IP address (v4 or v6)
 * 
 * @param {string} query - The query string to check
 * @returns {boolean} True if it looks like an IP address
 */
function looksLikeIP(query) {
  // IPv4: digits and dots only
  if (/^[0-9.]+$/.test(query)) return true;
  // IPv6: contains colons (::, 2001:db8::1, etc.)
  if (query.includes(":")) return true;
  return false;
}

/**
 * Determines if a string looks like a domain name
 * 
 * @param {string} query - The query string to check
 * @returns {boolean} True if it looks like a domain
 */
function looksLikeDomain(query) {
  // Must contain a dot, be alphanumeric with hyphens, and not end with dot
  return (
    /^[a-z0-9.-]+$/i.test(query) &&
    query.includes(".") &&
    !query.endsWith(".")
  );
}

/**
 * Fetches RDAP data with manual redirect handling
 * This allows us to validate each redirect URL against our allowlist
 * 
 * @param {string} startUrl - Initial RDAP URL
 * @param {number} maxRedirects - Maximum redirects to follow
 * @returns {object} { status, url, data }
 */
async function fetchRdapWithRedirects(startUrl, maxRedirects) {
  let currentUrl = startUrl;
  
  for (let i = 0; i <= maxRedirects; i++) {
    // Parse and validate URL
    const urlObj = new URL(currentUrl);
    
    // Security check: only allow known RDAP hosts
    if (!ALLOWED_RDAP_HOSTS.has(urlObj.hostname)) {
      throw new Error(`Disallowed RDAP host: ${urlObj.hostname}`);
    }

    // Make request with redirect disabled (we handle it manually)
    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",  // Don't follow redirects automatically
      headers: {
        "accept": "application/rdap+json, application/json",
        "user-agent": "NetKnife/1.0",
      },
    });

    // Handle redirects (3xx status codes)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect without Location header");
      }
      // Resolve relative URLs
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    // Parse response body
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // If not valid JSON, return raw text wrapped in object
      data = { raw: text };
    }

    return {
      status: response.status,
      url: currentUrl,
      data: data,
    };
  }

  throw new Error("Too many redirects");
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  try {
    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    
    // Extract and normalize query
    const query = String(body.query || "").trim().toLowerCase();

    // Validate query
    if (!query || query.length > 253) {
      return createResponse(400, {
        error: "Invalid query",
        details: "Query must be 1-253 characters",
      });
    }

    // Check cache first
    const cacheKey = `rdap:${query}`;
    const cached = await getCachedResult(cacheKey);
    if (cached) {
      return createResponse(200, { ...cached, cached: true });
    }

    // Determine query type and build RDAP URL
    let rdapUrl;
    if (looksLikeIP(query)) {
      // IP address lookup
      rdapUrl = `https://rdap.org/ip/${encodeURIComponent(query)}`;
    } else if (looksLikeDomain(query)) {
      // Domain lookup
      rdapUrl = `https://rdap.org/domain/${encodeURIComponent(query)}`;
    } else {
      return createResponse(400, {
        error: "Invalid query format",
        details: "Query must be an IP address (v4/v6) or domain name",
      });
    }

    // Fetch RDAP data
    const rdapResult = await fetchRdapWithRedirects(rdapUrl, MAX_REDIRECTS);

    // Build result
    const result = {
      query,
      rdap_url: rdapResult.url,
      status: rdapResult.status,
      data: rdapResult.data,
    };

    // Cache successful results
    if (rdapResult.status >= 200 && rdapResult.status < 300) {
      await setCachedResult(cacheKey, result, CACHE_TTL_SECONDS);
    }

    return createResponse(200, { ...result, cached: false });
  } catch (error) {
    console.error("RDAP lookup error:", error);
    
    return createResponse(500, {
      error: "RDAP lookup failed",
      details: error.message || "Unknown error",
    });
  }
};

