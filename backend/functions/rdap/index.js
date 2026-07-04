const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb')
const {
  createResponse,
  validateRdapQuery,
  isAllowedRdapHost,
  MAX_REDIRECTS,
  buildRdapUrl,
} = require('./validation')

const CACHE_TABLE = process.env.CACHE_TABLE
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || '86400')
const FETCH_TIMEOUT_MS = 8000

function createHandler(deps = {}) {
  const ddb = deps.ddb || DynamoDBDocumentClient.from(deps.ddbClient || new DynamoDBClient({}))
  const fetchFn = deps.fetch || fetch
  const cacheTable = deps.cacheTable ?? CACHE_TABLE
  const cacheTtlSeconds = deps.cacheTtlSeconds ?? CACHE_TTL_SECONDS

  async function getCachedResult(cacheKey) {
    if (!cacheTable) return null
    try {
      const result = await ddb.send(new GetCommand({
        TableName: cacheTable,
        Key: { cache_key: cacheKey },
      }))
      if (!result.Item) return null
      if (result.Item.expires_at <= Math.floor(Date.now() / 1000)) return null
      return result.Item.value
    } catch (error) {
      console.error('Cache read error:', error)
      return null
    }
  }

  async function setCachedResult(cacheKey, value, ttlSeconds) {
    if (!cacheTable) return
    try {
      await ddb.send(new PutCommand({
        TableName: cacheTable,
        Item: {
          cache_key: cacheKey,
          value,
          expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
        },
      }))
    } catch (error) {
      console.error('Cache write error:', error)
    }
  }

  async function fetchRdapWithRedirects(startUrl, maxRedirects) {
    let currentUrl = startUrl

    for (let i = 0; i <= maxRedirects; i++) {
      const urlObj = new URL(currentUrl)
      if (!isAllowedRdapHost(urlObj.hostname)) {
        throw new Error(`Disallowed RDAP host: ${urlObj.hostname}`)
      }

      const response = await fetchFn(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          accept: 'application/rdap+json, application/json',
          'user-agent': 'NetKnife/1.0',
        },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) throw new Error('Redirect without Location header')
        currentUrl = new URL(location, currentUrl).toString()
        continue
      }

      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        data = { raw: text }
      }

      return {
        status: response.status,
        url: currentUrl,
        data,
      }
    }

    throw new Error('Too many redirects')
  }

  return async function handler(event) {
    try {
      const body = event.body ? JSON.parse(event.body) : {}
      const validated = validateRdapQuery(body.query)
      if (!validated.ok) {
        return createResponse(400, {
          error: 'Invalid query',
          details: validated.error,
        })
      }

      const { value: query, kind } = validated
      const cacheKey = `rdap:${query}`
      const cached = await getCachedResult(cacheKey)
      if (cached) {
        return createResponse(200, { ...cached, cached: true })
      }

      const rdapUrl = buildRdapUrl(query, kind)
      const rdapResult = await fetchRdapWithRedirects(rdapUrl, MAX_REDIRECTS)
      const result = {
        query,
        rdap_url: rdapResult.url,
        status: rdapResult.status,
        data: rdapResult.data,
      }

      if (rdapResult.status >= 200 && rdapResult.status < 300) {
        await setCachedResult(cacheKey, result, cacheTtlSeconds)
      }

      return createResponse(200, { ...result, cached: false })
    } catch (error) {
      console.error('RDAP lookup error:', error)
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      return createResponse(timedOut ? 504 : 500, {
        error: timedOut ? 'RDAP lookup timed out' : 'RDAP lookup failed',
        details: error.message || 'Unknown error',
      })
    }
  }
}

exports.createHandler = createHandler
exports.handler = createHandler()
