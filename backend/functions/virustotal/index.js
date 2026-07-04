/**
 * ==============================================================================
 * NETKNIFE - VIRUSTOTAL LAMBDA
 * ==============================================================================
 *
 * Queries VirusTotal API for IP/domain/URL reputation.
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

const { createCacheClient } = require('netknife-common')
const { json, validateRequest, buildTarget } = require('./validation')

function createHandler(deps = {}) {
  const fetchFn = deps.fetch || fetch
  const apiKey = deps.apiKey ?? process.env.VIRUSTOTAL_API_KEY
  const cacheTtlSeconds = deps.cacheTtlSeconds ?? Number(process.env.CACHE_TTL_SECONDS || '3600') // 1 hour
  const cache = deps.cache || createCacheClient({
    dynamodb: deps.dynamodb,
    cacheTable: deps.cacheTable ?? process.env.CACHE_TABLE,
    payloadField: 'data',
  })

  return async function handler(event) {
    if (!apiKey) {
      return json(501, { error: 'VirusTotal integration not configured. API key required.' })
    }

    let body
    try {
      body = JSON.parse(event.body)
    } catch (e) {
      return json(400, { error: 'Invalid JSON body' })
    }

    const { type, value } = body

    const validationError = validateRequest(type, value)
    if (validationError) {
      return validationError
    }

    const { apiUrl, cacheKey } = buildTarget(type, value)

    // Check cache
    const cached = await cache.get(cacheKey)
    if (cached) {
      return json(200, { ...cached, cached: true })
    }

    try {
      const response = await fetchFn(apiUrl, {
        headers: {
          'x-apikey': apiKey,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return json(404, { error: 'Resource not found in VirusTotal database' })
        }
        if (response.status === 401) {
          return json(401, { error: 'Invalid VirusTotal API key' })
        }
        if (response.status === 429) {
          return json(429, { error: 'VirusTotal rate limit exceeded' })
        }
        return json(response.status, { error: `VirusTotal API error: ${response.statusText}` })
      }

      const data = await response.json()
      const attrs = data.data?.attributes || {}

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
          .filter(([, v]) => v.category === 'malicious' || v.category === 'suspicious')
          .slice(0, 20)
          .map(([engine, res]) => ({
            engine,
            category: res.category,
            result: res.result,
          })),

        queriedAt: new Date().toISOString(),
      }

      // Cache results
      await cache.put(cacheKey, result, cacheTtlSeconds)

      return json(200, { ...result, cached: false })
    } catch (e) {
      console.error('VirusTotal error:', e)
      return json(500, { error: 'VirusTotal lookup failed', details: e.message })
    }
  }
}

exports.createHandler = createHandler
exports.handler = createHandler()
