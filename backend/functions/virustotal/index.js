/**
 * ==============================================================================
 * NETKNIFE - VIRUSTOTAL LAMBDA
 * ==============================================================================
 *
 * Queries VirusTotal API for IP/domain/URL reputation.
 *
 * FEATURES:
 * - Multi-engine scan results
 * - Malware detection history
 * - Domain/URL categorization
 * - Last analysis stats
 *
 * REQUIRES: VIRUSTOTAL_API_KEY environment variable
 *
 * REQUEST:
 *   POST { "type": "ip", "value": "8.8.8.8" }
 *   POST { "type": "domain", "value": "example.com" }
 *   POST { "type": "url", "value": "https://example.com/path" }
 *
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || "3600"); // 1 hour
const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY;

const VT_API_BASE = "https://www.virustotal.com/api/v3";

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
 * Lambda handler
 */
exports.handler = async (event) => {
  if (!VT_API_KEY) {
    return json(501, { error: "VirusTotal integration not configured. API key required." });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return json(400, { error: "Invalid JSON body" });
  }

  const { type, value } = body;

  if (!type || !value) {
    return json(400, { error: "Missing 'type' or 'value' parameter" });
  }

  const validTypes = ["ip", "domain", "url"];
  if (!validTypes.includes(type)) {
    return json(400, { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
  }

  // Build API URL based on type
  let apiUrl;
  let cacheKey;
  
  switch (type) {
    case "ip":
      apiUrl = `${VT_API_BASE}/ip_addresses/${encodeURIComponent(value)}`;
      cacheKey = `vt-ip-${value}`;
      break;
    case "domain":
      apiUrl = `${VT_API_BASE}/domains/${encodeURIComponent(value)}`;
      cacheKey = `vt-domain-${value}`;
      break;
    case "url":
      // URL needs to be base64 encoded
      const urlId = Buffer.from(value).toString('base64').replace(/=/g, '');
      apiUrl = `${VT_API_BASE}/urls/${urlId}`;
      cacheKey = `vt-url-${urlId}`;
      break;
  }

  // Check cache
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return json(200, { ...cached, cached: true });
  }

  try {
    const response = await fetch(apiUrl, {
      headers: {
        "x-apikey": VT_API_KEY,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return json(404, { error: "Resource not found in VirusTotal database" });
      }
      if (response.status === 401) {
        return json(401, { error: "Invalid VirusTotal API key" });
      }
      if (response.status === 429) {
        return json(429, { error: "VirusTotal rate limit exceeded" });
      }
      return json(response.status, { error: `VirusTotal API error: ${response.statusText}` });
    }

    const data = await response.json();
    const attrs = data.data?.attributes || {};

    const result = {
      type,
      value,
      id: data.data?.id,
      
      // Analysis stats
      lastAnalysisStats: attrs.last_analysis_stats,
      lastAnalysisDate: attrs.last_analysis_date 
        ? new Date(attrs.last_analysis_date * 1000).toISOString() 
        : null,
      
      // Reputation
      reputation: attrs.reputation,
      
      // Categorization (for domains/URLs)
      categories: attrs.categories,
      
      // IP-specific
      asOwner: attrs.as_owner,
      asn: attrs.asn,
      country: attrs.country,
      continent: attrs.continent,
      network: attrs.network,
      
      // Domain-specific
      registrar: attrs.registrar,
      creationDate: attrs.creation_date 
        ? new Date(attrs.creation_date * 1000).toISOString() 
        : null,
      lastUpdateDate: attrs.last_update_date 
        ? new Date(attrs.last_update_date * 1000).toISOString() 
        : null,
      lastDnsRecords: attrs.last_dns_records,
      
      // URL-specific
      finalUrl: attrs.last_final_url,
      title: attrs.title,
      
      // Tags
      tags: attrs.tags,
      
      // Detailed results (limited to save space)
      lastAnalysisResults: Object.entries(attrs.last_analysis_results || {})
        .filter(([_, v]) => v.category === 'malicious' || v.category === 'suspicious')
        .slice(0, 20)
        .map(([engine, result]) => ({
          engine,
          category: result.category,
          result: result.result,
        })),
      
      queriedAt: new Date().toISOString(),
    };

    // Cache results
    await cachePut(cacheKey, result, TTL_SECONDS);

    return json(200, { ...result, cached: false });
  } catch (e) {
    console.error("VirusTotal error:", e);
    return json(500, { error: "VirusTotal lookup failed", details: e.message });
  }
};

