/**
 * ==============================================================================
 * NETKNIFE - SECURITYTRAILS LAMBDA
 * ==============================================================================
 *
 * Queries SecurityTrails API for domain and DNS history.
 *
 * FEATURES:
 * - Historical DNS records
 * - WHOIS history
 * - Associated domains
 * - Subdomain enumeration
 *
 * REQUIRES: SECURITYTRAILS_API_KEY environment variable
 *
 * REQUEST:
 *   POST { "domain": "example.com" }
 *
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "3600"); // 1 hour
const ST_API_KEY = process.env.SECURITYTRAILS_API_KEY;

const ST_API_BASE = "https://api.securitytrails.com/v1";

/**
 * Standard JSON response helper
 */
function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

/**
 * Cache helpers
 */
async function cacheGet(key) {
  if (!CACHE_TABLE) return null;
  try {
    const result = await ddb.send(new GetCommand({
      TableName: CACHE_TABLE,
      Key: { cache_key: key },
    }));
    if (result.Item && result.Item.expires_at > Math.floor(Date.now() / 1000)) {
      return result.Item.data;
    }
  } catch (e) {
    console.error("Cache get error:", e);
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
    console.error("Cache put error:", e);
  }
}

/**
 * Validate domain
 */
function isValidDomain(domain) {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(domain);
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  if (!ST_API_KEY) {
    return json(501, { error: "SecurityTrails integration not configured. API key required." });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return json(400, { error: "Invalid JSON body" });
  }

  const { domain } = body;

  if (!domain || !isValidDomain(domain)) {
    return json(400, { error: "Invalid domain" });
  }

  const cleanDomain = domain.toLowerCase().trim();

  // Check cache
  const cacheKey = `securitytrails-${cleanDomain}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return json(200, { ...cached, cached: true });
  }

  try {
    // Fetch domain info and subdomains in parallel
    const headers = {
      "APIKEY": ST_API_KEY,
      "Accept": "application/json",
    };

    const [domainResponse, subdomainsResponse] = await Promise.all([
      fetch(`${ST_API_BASE}/domain/${cleanDomain}`, { headers }),
      fetch(`${ST_API_BASE}/domain/${cleanDomain}/subdomains`, { headers }),
    ]);

    if (!domainResponse.ok) {
      if (domainResponse.status === 404) {
        return json(404, { error: "Domain not found in SecurityTrails database" });
      }
      if (domainResponse.status === 401 || domainResponse.status === 403) {
        return json(401, { error: "Invalid or insufficient SecurityTrails API key" });
      }
      if (domainResponse.status === 429) {
        return json(429, { error: "SecurityTrails rate limit exceeded" });
      }
      return json(domainResponse.status, { error: `SecurityTrails API error: ${domainResponse.statusText}` });
    }

    const domainData = await domainResponse.json();
    const subdomainsData = subdomainsResponse.ok ? await subdomainsResponse.json() : null;

    const result = {
      domain: cleanDomain,
      
      // Current DNS records
      currentDns: {
        a: domainData.current_dns?.a?.values || [],
        aaaa: domainData.current_dns?.aaaa?.values || [],
        mx: domainData.current_dns?.mx?.values || [],
        ns: domainData.current_dns?.ns?.values || [],
        soa: domainData.current_dns?.soa?.values || [],
        txt: domainData.current_dns?.txt?.values || [],
      },
      
      // Alexa rank
      alexaRank: domainData.alexa_rank,
      
      // Host provider
      hostProvider: domainData.host_provider,
      
      // Mail provider
      mailProvider: domainData.mail_provider,
      
      // Subdomains (limited)
      subdomainCount: subdomainsData?.subdomain_count || 0,
      subdomains: (subdomainsData?.subdomains || []).slice(0, 50),
      
      // Name servers count
      nameServerCount: domainData.name_server_count,
      
      queriedAt: new Date().toISOString(),
    };

    // Cache results
    await cachePut(cacheKey, result, TTL_SECONDS);

    return json(200, { ...result, cached: false });
  } catch (e) {
    console.error("SecurityTrails error:", e);
    return json(500, { error: "SecurityTrails lookup failed", details: e.message });
  }
};

