/**
 * ==============================================================================
 * NETKNIFE - IP-API.COM IP GEOLOCATION LAMBDA
 * ==============================================================================
 *
 * IP geolocation and information using ip-api.com free API.
 *
 * FEATURES:
 * - IP geolocation (city, country, coordinates)
 * - ISP and organization info
 * - ASN information
 * - Timezone
 * - Free tier: 45 requests/minute (no API key needed)
 *
 * API: http://ip-api.com/
 *
 * REQUEST:
 *   POST { "ip": "8.8.8.8" }
 *
 * RESPONSE:
 *   {
 *     "status": "success",
 *     "country": "United States",
 *     "city": "Mountain View",
 *     "lat": 37.4056,
 *     "lon": -122.0775,
 *     "isp": "Google LLC",
 *     "org": "Google Public DNS",
 *     "as": "AS15169 Google LLC",
 *     ...
 *   }
 * ==============================================================================
 */

const { createResponse, createCacheClient } = require('netknife-common')
const {
  normalizeIpRequest,
  validateIpRequest,
  buildCacheKey,
} = require('./validation')

const IP_API_URL = 'http://ip-api.com/json/'

function createHandler(deps = {}) {
  const fetchFn = deps.fetch || fetch
  const cacheTtlSeconds = deps.cacheTtlSeconds ?? Number(process.env.CACHE_TTL_SECONDS || '86400')
  const cache = deps.cache || createCacheClient({
    dynamodb: deps.dynamodb,
    cacheTable: deps.cacheTable ?? process.env.CACHE_TABLE,
    payloadField: 'data',
  })

  async function queryIPAPI(ip) {
    const url = `${IP_API_URL}${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,query`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetchFn(url, {
        headers: { 'User-Agent': 'NetKnife-IPGeolocation/1.0' },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`IP-API error: ${response.status}`)
      }

      return await response.json()
    } catch (e) {
      clearTimeout(timeoutId)
      if (e.name === 'AbortError') {
        throw new Error('Request timeout')
      }
      throw e
    }
  }

  return async function handler(event) {
    try {
      const body = event.body ? JSON.parse(event.body) : {}
      const ip = normalizeIpRequest(body)

      const validationError = validateIpRequest(ip)
      if (validationError) {
        return validationError
      }

      const cacheKey = buildCacheKey(ip)
      const cached = await cache.get(cacheKey)
      if (cached) {
        return createResponse(200, { ...cached, cached: true }, { headerStyle: 'title' })
      }

      const result = await queryIPAPI(ip)

      if (result.status === 'fail') {
        return createResponse(400, { error: result.message || 'IP lookup failed' }, { headerStyle: 'title' })
      }

      await cache.put(cacheKey, result, cacheTtlSeconds)

      return createResponse(200, { ...result, cached: false }, { headerStyle: 'title' })
    } catch (e) {
      console.error('IP-API check error:', e)
      return createResponse(500, { error: e.message || 'Server error' }, { headerStyle: 'title' })
    }
  }
}

exports.createHandler = createHandler
exports.handler = createHandler()
