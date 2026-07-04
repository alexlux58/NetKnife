/**
 * ==============================================================================
 * NETKNIFE - BGP LOOKING GLASS LAMBDA
 * ==============================================================================
 *
 * Queries BGP routing information from public route servers using RIPEstat.
 * Shows BGP paths, AS paths, and routing visibility.
 *
 * FEATURES:
 * - Query by IP address or prefix
 * - Shows AS path from multiple vantage points
 * - Origin ASN identification
 * - Route visibility percentage
 *
 * REQUEST:
 *   POST { "query": "8.8.8.8" } or { "query": "8.8.8.0/24" }
 *
 * RESPONSE:
 *   {
 *     "query": "8.8.8.8",
 *     "prefix": "8.8.8.0/24",
 *     "origin_asn": 15169,
 *     "as_path": [...],
 *     "visibility": {...},
 *     ...
 *   }
 *
 * ==============================================================================
 */

const { createCacheClient } = require('netknife-common')
const { json, buildCacheKey, validateQuery } = require('./validation')

/** Fetch with an abort-based timeout and a default User-Agent. */
function makeFetchWithTimeout(fetchFn) {
  return async function fetchWithTimeout(url, timeout = 15000) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetchFn(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'NetKnife/1.0' },
      })
      clearTimeout(timeoutId)
      return response
    } catch (e) {
      clearTimeout(timeoutId)
      throw e
    }
  }
}

function createHandler(deps = {}) {
  const fetchFn = deps.fetch || fetch
  const fetchWithTimeout = makeFetchWithTimeout(fetchFn)
  const cacheTtlSeconds = deps.cacheTtlSeconds ?? Number(process.env.CACHE_TTL_SECONDS || '300') // 5 minutes
  const cache = deps.cache || createCacheClient({
    dynamodb: deps.dynamodb,
    cacheTable: deps.cacheTable ?? process.env.CACHE_TABLE,
    payloadField: 'data',
  })

  return async function handler(event) {
    let body
    try {
      body = JSON.parse(event.body)
    } catch (e) {
      return json(400, { error: 'Invalid JSON body' })
    }

    const { query } = body

    const validationError = validateQuery(query)
    if (validationError) {
      return validationError
    }

    const cleanQuery = query.trim()

    // Check cache
    const cacheKey = buildCacheKey(cleanQuery)
    const cached = await cache.get(cacheKey)
    if (cached) {
      return json(200, { ...cached, cached: true })
    }

    try {
      // Use RIPEstat API for BGP looking glass functionality
      const [prefixOverview, routingStatus, asPath] = await Promise.all([
        // Get prefix overview
        fetchWithTimeout(`https://stat.ripe.net/data/prefix-overview/data.json?resource=${encodeURIComponent(cleanQuery)}`)
          .then((r) => r.json()),
        // Get routing status
        fetchWithTimeout(`https://stat.ripe.net/data/routing-status/data.json?resource=${encodeURIComponent(cleanQuery)}`)
          .then((r) => r.json()),
        // Get AS path
        fetchWithTimeout(`https://stat.ripe.net/data/looking-glass/data.json?resource=${encodeURIComponent(cleanQuery)}`)
          .then((r) => r.json()),
      ])

      const prefixData = prefixOverview.data || {}
      const routingData = routingStatus.data || {}
      const pathData = asPath.data || {}

      // Extract origin ASNs
      const originAsns = (prefixData.asns || []).map((a) => ({
        asn: a.asn,
        holder: a.holder,
      }))

      // Extract routing visibility
      const visibility = {
        v4Visibility: routingData.visibility?.v4 || null,
        v6Visibility: routingData.visibility?.v6 || null,
        firstSeen: routingData.first_seen || null,
        lastSeen: routingData.last_seen || null,
      }

      // Extract AS paths from multiple RRCs
      const routes = (pathData.rrcs || []).slice(0, 20).map((rrc) => ({
        rrc: rrc.rrc,
        location: rrc.location,
        peers: (rrc.peers || []).slice(0, 5).map((peer) => ({
          asn: peer.asn_origin,
          prefix: peer.prefix,
          asPath: peer.as_path,
          community: peer.community,
        })),
      }))

      const result = {
        query: cleanQuery,
        prefix: prefixData.resource,
        isLessSpecific: prefixData.is_less_specific,
        block: {
          resource: prefixData.block?.resource,
          name: prefixData.block?.name,
          description: prefixData.block?.desc,
        },
        originAsns,
        visibility,
        routes,
        announcements: routingData.announced_space || 0,
        queriedAt: new Date().toISOString(),
      }

      // Cache results
      await cache.put(cacheKey, result, cacheTtlSeconds)

      return json(200, { ...result, cached: false })
    } catch (e) {
      console.error('BGP looking glass error:', e)
      return json(500, { error: 'BGP lookup failed', details: e.message })
    }
  }
}

exports.createHandler = createHandler
exports.handler = createHandler()
