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

const { createCacheClient } = require('netknife-common')
const { json, parseRequest } = require('./validation')

// PeeringDB API base URL
const PEERINGDB_API_BASE = 'https://www.peeringdb.com/api'

function createHandler(deps = {}) {
  const fetchFn = deps.fetch || fetch
  const cacheTtlSeconds = deps.cacheTtlSeconds ?? Number(process.env.CACHE_TTL_SECONDS || '3600')
  const cache = deps.cache || createCacheClient({
    dynamodb: deps.dynamodb,
    cacheTable: deps.cacheTable ?? process.env.CACHE_TABLE,
    payloadField: 'data',
  })

  return async function handler(event) {
    try {
      // Parse request body
      let raw = {}
      if (event.body) {
        try {
          raw = JSON.parse(event.body)
        } catch {
          return json(400, { error: 'Invalid JSON body' })
        }
      }

      // Validate parameters and build the query
      const parsed = parseRequest(raw)
      if (parsed.error) {
        return parsed.error
      }

      const { resource, asn, name, queryString, cacheKey } = parsed

      // Check cache first
      const cached = await cache.get(cacheKey)
      if (cached) {
        console.log('Cache hit:', cacheKey)
        return json(200, { ...cached, cached: true })
      }

      // Build PeeringDB API URL
      const url = `${PEERINGDB_API_BASE}/${resource}${queryString ? `?${queryString}` : ''}`
      console.log('Fetching:', url)

      // Make request to PeeringDB with timeout
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      let response
      try {
        response = await fetchFn(url, {
          headers: {
            accept: 'application/json',
            'user-agent': 'NetKnife/1.0 (Network Tools)',
          },
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }

      // Parse response
      const data = await response.json()

      // Build output object
      const output = {
        resource,
        asn: asn || null,
        name: name || null,
        status: response.status,
        data,
      }

      // Always return HTTP 200, even if PeeringDB returned 404.
      // The PeeringDB status is in the response body so the frontend can
      // display "not found" results gracefully. Only successful responses
      // are cached.
      if (response.ok) {
        await cache.put(cacheKey, output, cacheTtlSeconds)
      }

      return json(200, {
        ...output,
        cached: false,
      })
    } catch (err) {
      console.error('Handler error:', err)

      // Handle abort/timeout
      if (err.name === 'AbortError') {
        return json(504, { error: 'Request to PeeringDB timed out' })
      }

      return json(500, { error: 'Server error processing request' })
    }
  }
}

exports.createHandler = createHandler
exports.handler = createHandler()
