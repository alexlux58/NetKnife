/**
 * ==============================================================================
 * NETKNIFE - ASN DETAILS LAMBDA
 * ==============================================================================
 *
 * Fetches detailed Autonomous System Number (ASN) information using
 * RIPEstat and BGPView APIs.
 *
 * FEATURES:
 * - ASN overview and holder info
 * - Announced prefixes
 * - Peer count and upstream/downstream info
 * - RIR allocation info
 *
 * REQUEST:
 *   POST { "asn": "13335" } or { "asn": "AS13335" }
 *
 * RESPONSE:
 *   {
 *     "asn": 13335,
 *     "holder": "CLOUDFLARENET",
 *     "description": "Cloudflare, Inc.",
 *     "country": "US",
 *     "prefixes": { "ipv4": [...], "ipv6": [...] },
 *     "peers": { "upstreams": [...], "downstreams": [...] },
 *     ...
 *   }
 *
 * ==============================================================================
 */

const { createResponse, createCacheClient } = require("netknife-common");
const { parseAsn, buildCacheKey, validateAsn } = require("./validation");

/**
 * Response helper preserving the original Title-case Content-Type header.
 * CORS headers are supplied by API Gateway's cors_configuration.
 */
function json(statusCode, body) {
  return createResponse(statusCode, body, { headerStyle: "title" });
}

function createHandler(deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const cacheTtlSeconds = deps.cacheTtlSeconds ?? Number(process.env.CACHE_TTL_SECONDS || "3600"); // 1 hour
  const cache = deps.cache || createCacheClient({
    dynamodb: deps.dynamodb,
    cacheTable: deps.cacheTable ?? process.env.CACHE_TABLE,
    payloadField: "data",
  });

  /**
   * Fetch data with timeout
   */
  async function fetchWithTimeout(url, timeout = 10000, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetchImpl(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "User-Agent": "NetKnife/1.0",
          ...(options.headers || {}),
        }
      });
      clearTimeout(timeoutId);
      return response;
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw e;
    }
  }

  return async function handler(event) {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return json(400, { error: "Invalid JSON body" });
  }

  const { asn: asnInput } = body;
  const asn = parseAsn(asnInput);

  const validationError = validateAsn(asn);
  if (validationError) {
    return validationError;
  }

  // Check cache
  const cacheKey = buildCacheKey(asn);
  const cached = await cache.get(cacheKey);
  if (cached) {
    return json(200, { ...cached, cached: true });
  }

  try {
    // Fetch data from BGPView API (more comprehensive than RIPEstat for basic info)
    const [asnResponseHttp, prefixesResponseHttp, peersResponseHttp] = await Promise.all([
      fetchWithTimeout(`https://api.bgpview.io/asn/${asn}`, 15000),
      fetchWithTimeout(`https://api.bgpview.io/asn/${asn}/prefixes`, 15000),
      fetchWithTimeout(`https://api.bgpview.io/asn/${asn}/peers`, 15000),
    ]);

    // Check HTTP response status
    if (!asnResponseHttp.ok) {
      return json(502, { 
        error: "BGPView API error", 
        details: `ASN endpoint returned ${asnResponseHttp.status}` 
      });
    }

    // Parse JSON responses
    const [asnResponse, prefixesResponse, peersResponse] = await Promise.all([
      asnResponseHttp.json(),
      prefixesResponseHttp.ok ? prefixesResponseHttp.json() : { data: {} },
      peersResponseHttp.ok ? peersResponseHttp.json() : { data: {} },
    ]);

    if (asnResponse.status !== "ok" || !asnResponse.data) {
      return json(404, { error: `ASN ${asn} not found` });
    }

    const asnData = asnResponse.data;
    const prefixData = prefixesResponse.data || {};
    const peerData = peersResponse.data || {};

    const result = {
      asn,
      name: asnData.name,
      description: asnData.description_short || asnData.description_full,
      country: asnData.country_code,
      rir: asnData.rir_allocation?.rir_name,
      rirAllocationDate: asnData.rir_allocation?.date_allocated,
      website: asnData.website,
      emailContacts: asnData.email_contacts,
      abuseContacts: asnData.abuse_contacts,
      lookingGlass: asnData.looking_glass,
      trafficEstimation: asnData.traffic_estimation,
      trafficRatio: asnData.traffic_ratio,
      
      prefixes: {
        ipv4Count: prefixData.ipv4_prefixes?.length || 0,
        ipv6Count: prefixData.ipv6_prefixes?.length || 0,
        ipv4: (prefixData.ipv4_prefixes || []).slice(0, 50).map(p => ({
          prefix: p.prefix,
          name: p.name,
          description: p.description,
          countryCode: p.country_code,
        })),
        ipv6: (prefixData.ipv6_prefixes || []).slice(0, 50).map(p => ({
          prefix: p.prefix,
          name: p.name,
          description: p.description,
          countryCode: p.country_code,
        })),
      },
      
      peers: {
        upstreamCount: peerData.ipv4_upstreams?.length || 0,
        downstreamCount: peerData.ipv4_downstreams?.length || 0,
        upstreams: (peerData.ipv4_upstreams || []).slice(0, 20).map(p => ({
          asn: p.asn,
          name: p.name,
          description: p.description,
          countryCode: p.country_code,
        })),
        downstreams: (peerData.ipv4_downstreams || []).slice(0, 20).map(p => ({
          asn: p.asn,
          name: p.name,
          description: p.description,
          countryCode: p.country_code,
        })),
      },
      
      queriedAt: new Date().toISOString(),
    };

    // Cache results
    await cache.put(cacheKey, result, cacheTtlSeconds);

    return json(200, { ...result, cached: false });
  } catch (e) {
    console.error("ASN lookup error:", e);
    
    // Provide more helpful error messages
    let errorMessage = e.message || "Unknown error";
    if (errorMessage.includes("timeout") || errorMessage.includes("abort")) {
      errorMessage = "Request timed out. The BGPView API may be slow or unavailable.";
    } else if (errorMessage.includes("fetch")) {
      errorMessage = "Network error connecting to BGPView API.";
    }
    
    return json(500, { 
      error: "ASN lookup failed", 
      details: errorMessage,
      hint: "This tool uses the BGPView API. If the error persists, the API may be temporarily unavailable."
    });
  }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();

