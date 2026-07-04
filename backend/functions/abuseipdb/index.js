/**
 * ==============================================================================
 * NETKNIFE - ABUSEIPDB LOOKUP LAMBDA
 * ==============================================================================
 *
 * Checks IP reputation against AbuseIPDB - a crowd-sourced database of
 * malicious IP addresses reported by security professionals worldwide.
 *
 * REQUEST:
 *   POST { "ip": "185.220.101.1" }
 *
 * ENVIRONMENT VARIABLES:
 * - CACHE_TABLE: DynamoDB table name
 * - CACHE_TTL_SECONDS: Cache TTL (default: 3600 = 1 hour)
 * - ABUSEIPDB_API_KEY: API key from abuseipdb.com
 * ==============================================================================
 */

const { createCacheClient } = require('netknife-common')
const {
  json,
  buildCacheKey,
  mapCategories,
  getThreatLevel,
  validateIp,
} = require('./validation')

// AbuseIPDB API endpoint
const ABUSEIPDB_API = 'https://api.abuseipdb.com/api/v2/check'

function createHandler(deps = {}) {
  const fetchFn = deps.fetch || fetch
  const apiKey = deps.apiKey ?? process.env.ABUSEIPDB_API_KEY
  const cacheTtlSeconds = deps.cacheTtlSeconds ?? Number(process.env.CACHE_TTL_SECONDS || '3600') // 1 hour
  const cache = deps.cache || createCacheClient({
    dynamodb: deps.dynamodb,
    cacheTable: deps.cacheTable ?? process.env.CACHE_TABLE,
    payloadField: 'data',
  })

  async function queryAbuseIPDB(ip) {
    const url = new URL(ABUSEIPDB_API)
    url.searchParams.set('ipAddress', ip)
    url.searchParams.set('maxAgeInDays', '90') // Reports from last 90 days
    url.searchParams.set('verbose', 'true') // Include recent reports

    const response = await fetchFn(url.toString(), {
      method: 'GET',
      headers: {
        Key: apiKey,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AbuseIPDB API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  return async function handler(event) {
    console.log('AbuseIPDB lookup request received')

    // Check if API key is configured
    if (!apiKey) {
      return json(500, {
        error: 'AbuseIPDB API key not configured',
        message: 'Please set ABUSEIPDB_API_KEY environment variable',
      })
    }

    // Parse request body
    let body
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
    } catch (e) {
      return json(400, { error: 'Invalid JSON body' })
    }

    const { ip } = body || {}

    const validationError = validateIp(ip)
    if (validationError) {
      return validationError
    }

    const cleanIP = ip.trim()

    // Check cache first
    const cacheKey = buildCacheKey(cleanIP)
    const cached = await cache.get(cacheKey)
    if (cached) {
      console.log(`Cache hit for ${cleanIP}`)
      return json(200, { ...cached, cached: true })
    }

    // Query AbuseIPDB
    try {
      console.log(`Querying AbuseIPDB for ${cleanIP}`)
      const apiResponse = await queryAbuseIPDB(cleanIP)

      if (!apiResponse.data) {
        throw new Error('Invalid response from AbuseIPDB')
      }

      const data = apiResponse.data
      const threatLevel = getThreatLevel(data.abuseConfidenceScore)

      // Build clean response
      const result = {
        ip: cleanIP,
        abuseConfidenceScore: data.abuseConfidenceScore,
        threatLevel: threatLevel,
        totalReports: data.totalReports,
        numDistinctUsers: data.numDistinctUsers,
        lastReportedAt: data.lastReportedAt,
        countryCode: data.countryCode,
        countryName: data.countryName,
        isp: data.isp,
        domain: data.domain,
        usageType: data.usageType,
        hostnames: data.hostnames || [],
        isTor: data.isTor,
        isWhitelisted: data.isWhitelisted,
        // Map category IDs to names
        categories: mapCategories(
          data.reports?.reduce((acc, r) => {
            r.categories?.forEach((c) => {
              if (!acc.includes(c)) acc.push(c)
            })
            return acc
          }, [])
        ),
        // Include recent reports (limited to 5 most recent)
        recentReports: (data.reports || []).slice(0, 5).map((r) => ({
          reportedAt: r.reportedAt,
          comment: r.comment,
          categories: mapCategories(r.categories),
          reporterId: r.reporterId,
          reporterCountryCode: r.reporterCountryCode,
        })),
        cached: false,
      }

      // Cache the result
      await cache.put(cacheKey, result, cacheTtlSeconds)

      return json(200, result)
    } catch (error) {
      console.error('AbuseIPDB query error:', error)
      return json(502, {
        error: 'Failed to query AbuseIPDB',
        message: error.message,
        ip: cleanIP,
      })
    }
  }
}

exports.createHandler = createHandler
exports.handler = createHandler()
