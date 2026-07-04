/**
 * ==============================================================================
 * NETKNIFE - GREYNOISE LAMBDA
 * ==============================================================================
 *
 * Queries GreyNoise API for internet scanner and noise detection.
 *
 * FEATURES:
 * - IP classification (benign, malicious, unknown)
 * - Scanner/noise detection
 * - Bot detection
 * - Activity metadata
 *
 * REQUIRES: GREYNOISE_API_KEY environment variable
 *
 * REQUEST:
 *   POST { "ip": "8.8.8.8" }
 *
 * ==============================================================================
 */

const { createCacheClient } = require('netknife-common')
const { json, buildCacheKey, validateIp } = require('./validation')

// Community API (free) vs Enterprise API
const GREYNOISE_API_BASE = 'https://api.greynoise.io/v3/community'

function createHandler(deps = {}) {
  const fetchFn = deps.fetch || fetch
  const apiKey = deps.apiKey ?? process.env.GREYNOISE_API_KEY
  const cacheTtlSeconds = deps.cacheTtlSeconds ?? Number(process.env.CACHE_TTL_SECONDS || '3600') // 1 hour
  const cache = deps.cache || createCacheClient({
    dynamodb: deps.dynamodb,
    cacheTable: deps.cacheTable ?? process.env.CACHE_TABLE,
    payloadField: 'data',
  })

  return async function handler(event) {
    if (!apiKey) {
      return json(501, { error: 'GreyNoise integration not configured. API key required.' })
    }

    let body
    try {
      body = JSON.parse(event.body)
    } catch (e) {
      return json(400, { error: 'Invalid JSON body' })
    }

    const { ip } = body

    const validationError = validateIp(ip)
    if (validationError) {
      return validationError
    }

    // Check cache
    const cacheKey = buildCacheKey(ip)
    const cached = await cache.get(cacheKey)
    if (cached) {
      return json(200, { ...cached, cached: true })
    }

    try {
      const response = await fetchFn(`${GREYNOISE_API_BASE}/${ip}`, {
        headers: {
          key: apiKey,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          // IP not seen by GreyNoise - this is actually useful info
          const result = {
            ip,
            noise: false,
            riot: false,
            classification: 'unknown',
            message: 'IP has not been observed by GreyNoise scanners',
            queriedAt: new Date().toISOString(),
          }
          await cache.put(cacheKey, result, cacheTtlSeconds)
          return json(200, { ...result, cached: false })
        }
        if (response.status === 401) {
          return json(401, { error: 'Invalid GreyNoise API key' })
        }
        if (response.status === 429) {
          return json(429, { error: 'GreyNoise rate limit exceeded' })
        }
        return json(response.status, { error: `GreyNoise API error: ${response.statusText}` })
      }

      const data = await response.json()

      const result = {
        ip,

        // Is this IP generating internet noise?
        noise: data.noise || false,

        // Is this IP part of a known benign service (RIOT)?
        riot: data.riot || false,

        // Classification: benign, malicious, or unknown
        classification: data.classification || 'unknown',

        // Human-readable name (if known)
        name: data.name,

        // Link to GreyNoise visualizer
        link: data.link,

        // Last seen timestamp
        lastSeen: data.last_seen,

        // Message
        message: data.message,

        queriedAt: new Date().toISOString(),
      }

      // Cache results
      await cache.put(cacheKey, result, cacheTtlSeconds)

      return json(200, { ...result, cached: false })
    } catch (e) {
      console.error('GreyNoise error:', e)
      return json(500, { error: 'GreyNoise lookup failed', details: e.message })
    }
  }
}

exports.createHandler = createHandler
exports.handler = createHandler()
