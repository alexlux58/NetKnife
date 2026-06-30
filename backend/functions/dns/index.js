const { createResponse, createCacheClient } = require('netknife-common')
const {
  normalizeDnsRequest,
  validateDnsRequest,
  buildCacheKey,
} = require('./validation')

const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query'

function createHandler(deps = {}) {
  const fetchFn = deps.fetch || fetch
  const cacheTtlSeconds = deps.cacheTtlSeconds ?? Number(process.env.CACHE_TTL_SECONDS || '300')
  const cache = deps.cache || createCacheClient({
    dynamodb: deps.dynamodb,
    cacheTable: deps.cacheTable ?? process.env.CACHE_TABLE,
    payloadField: 'value',
  })

  return async function handler(event) {
    try {
      const body = event.body ? JSON.parse(event.body) : {}
      const { name, type } = normalizeDnsRequest(body)
      const validationError = validateDnsRequest(name, type)
      if (validationError) {
        return createResponse(validationError.statusCode, validationError.body)
      }

      const cacheKey = buildCacheKey(type, name)
      const cached = await cache.get(cacheKey)
      if (cached) {
        return createResponse(200, { ...cached, cached: true })
      }

      const url = new URL(DOH_ENDPOINT)
      url.searchParams.set('name', name)
      url.searchParams.set('type', type)

      const response = await fetchFn(url.toString(), {
        method: 'GET',
        headers: { accept: 'application/dns-json' },
      })

      const data = await response.json()
      const result = {
        name,
        type,
        status: data.Status,
        answer: data.Answer || [],
        authority: data.Authority || [],
        comment: data.Comment || null,
      }

      if (response.ok) {
        await cache.put(cacheKey, result, cacheTtlSeconds)
      }

      return createResponse(200, { ...result, cached: false })
    } catch (error) {
      console.error('DNS lookup error:', error)
      return createResponse(500, { error: 'DNS lookup failed' })
    }
  }
}

exports.createHandler = createHandler
exports.handler = createHandler()
