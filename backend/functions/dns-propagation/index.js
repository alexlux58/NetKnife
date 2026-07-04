/**
 * ==============================================================================
 * NETKNIFE - DNS PROPAGATION CHECKER LAMBDA
 * ==============================================================================
 *
 * Queries multiple public DNS resolvers to check DNS propagation status.
 * Shows if DNS changes have propagated globally.
 *
 * REQUEST:
 *   POST { "name": "example.com", "type": "A" }
 *
 * ==============================================================================
 */

const { createCacheClient } = require('netknife-common')
const {
  DNS_RESOLVERS,
  json,
  validateRequest,
  buildCacheKey,
  computeConsistency,
} = require('./validation')

function createHandler(deps = {}) {
  const fetchFn = deps.fetch || fetch
  const cacheTtlSeconds = deps.cacheTtlSeconds ?? Number(process.env.CACHE_TTL_SECONDS || '300') // 5 minutes
  const cache = deps.cache || createCacheClient({
    dynamodb: deps.dynamodb,
    cacheTable: deps.cacheTable ?? process.env.CACHE_TABLE,
    payloadField: 'data',
  })

  /**
   * Query a DNS resolver using DNS-over-HTTPS.
   * (Note: preserves existing behavior — all resolvers are proxied via
   * Cloudflare DoH.)
   */
  async function queryResolver(resolver, name, type) {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetchFn(url, {
        headers: { Accept: 'application/dns-json' },
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        return { resolver: resolver.name, ip: resolver.ip, location: resolver.location, error: `HTTP ${response.status}` }
      }

      const data = await response.json()

      return {
        resolver: resolver.name,
        ip: resolver.ip,
        location: resolver.location,
        status: data.Status,
        answers: data.Answer || [],
        ttl: data.Answer?.[0]?.TTL,
      }
    } catch (e) {
      return {
        resolver: resolver.name,
        ip: resolver.ip,
        location: resolver.location,
        error: e.name === 'AbortError' ? 'Timeout' : e.message,
      }
    }
  }

  return async function handler(event) {
    let body
    try {
      body = JSON.parse(event.body)
    } catch (e) {
      return json(400, { error: 'Invalid JSON body' })
    }

    const { name, type = 'A' } = body

    const validationError = validateRequest(name, type)
    if (validationError) {
      return validationError
    }

    const recordType = String(type).toUpperCase()

    // Check cache
    const cacheKey = buildCacheKey(name, type)
    const cached = await cache.get(cacheKey)
    if (cached) {
      return json(200, { ...cached, cached: true })
    }

    // Query all resolvers in parallel
    const results = await Promise.all(
      DNS_RESOLVERS.map((resolver) => queryResolver(resolver, name, recordType))
    )

    const consistent = computeConsistency(results)

    const response = {
      name,
      type: recordType,
      results,
      consistent,
      checkedAt: new Date().toISOString(),
    }

    // Cache results
    await cache.put(cacheKey, response, cacheTtlSeconds)

    return json(200, { ...response, cached: false })
  }
}

exports.createHandler = createHandler
exports.handler = createHandler()
