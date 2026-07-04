/**
 * ==============================================================================
 * NETKNIFE - SHODAN LAMBDA
 * ==============================================================================
 *
 * Queries Shodan API for host information and exposed services.
 *
 * FEATURES:
 * - Open ports and services
 * - Banners and version info
 * - Vulnerabilities (CVEs)
 * - Geolocation
 * - Historical data
 *
 * REQUIRES: SHODAN_API_KEY environment variable
 *
 * REQUEST:
 *   POST { "ip": "8.8.8.8" }
 *
 * RESPONSE:
 *   {
 *     "ip": "8.8.8.8",
 *     "ports": [53, 443],
 *     "vulns": [...],
 *     "data": [...]
 *   }
 *
 * ==============================================================================
 */

const { createCacheClient } = require('netknife-common')
const { json, isValidIP, isValidHostname, isPrivateIP, buildCacheKey } = require('./validation')

const SHODAN_API_BASE = 'https://api.shodan.io'

/** Fetch with an abort-based timeout and a default User-Agent. */
function makeFetchWithTimeout(fetchFn) {
  return async function fetchWithTimeout(url, timeout = 10000, options = {}) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetchFn(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'NetKnife/1.0',
          ...(options.headers || {}),
        },
      })
      clearTimeout(timeoutId)
      return response
    } catch (e) {
      clearTimeout(timeoutId)
      if (e.name === 'AbortError') {
        throw new Error('Request timeout')
      }
      throw e
    }
  }
}

function createHandler(deps = {}) {
  const fetchFn = deps.fetch || fetch
  const fetchWithTimeout = makeFetchWithTimeout(fetchFn)
  const apiKey = deps.apiKey ?? process.env.SHODAN_API_KEY
  const cacheTtlSeconds = deps.cacheTtlSeconds ?? Number(process.env.CACHE_TTL_SECONDS || '3600') // 1 hour
  const cache = deps.cache || createCacheClient({
    dynamodb: deps.dynamodb,
    cacheTable: deps.cacheTable ?? process.env.CACHE_TABLE,
    payloadField: 'data',
  })

  return async function handler(event) {
    if (!apiKey) {
      return json(501, { error: 'Shodan integration not configured. API key required.' })
    }

    let body
    try {
      body = JSON.parse(event.body)
    } catch (e) {
      return json(400, { error: 'Invalid JSON body' })
    }

    const { ip: input } = body

    if (!input || typeof input !== 'string') {
      return json(400, { error: 'Invalid input. Must be an IP address or hostname.' })
    }

    const cleanInput = input.trim()

    // Resolve hostname to IP if needed
    let targetIP = cleanInput
    const originalInput = cleanInput

    if (!isValidIP(cleanInput)) {
      // It's not an IP, try to resolve as hostname
      if (!isValidHostname(cleanInput)) {
        return json(400, { error: 'Invalid IP address or hostname' })
      }

      try {
        // Use DNS-over-HTTPS to resolve hostname
        const dnsResponse = await fetchWithTimeout(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanInput)}&type=A`,
          10000,
          { headers: { Accept: 'application/dns-json' } }
        )

        if (!dnsResponse.ok) {
          return json(502, { error: 'DNS resolution failed', details: `HTTP ${dnsResponse.status}` })
        }

        const dnsData = await dnsResponse.json()
        if (dnsData.Answer && dnsData.Answer.length > 0) {
          targetIP = dnsData.Answer[0].data
        } else {
          return json(400, { error: 'Could not resolve hostname to IP address' })
        }
      } catch (e) {
        return json(500, {
          error: 'DNS resolution failed',
          details: e.message || 'Unknown error',
        })
      }
    }

    // Validate resolved IP
    if (!isValidIP(targetIP)) {
      return json(400, { error: 'Resolved address is not a valid IP' })
    }

    if (isPrivateIP(targetIP)) {
      return json(400, { error: 'Cannot query private IP addresses' })
    }

    // Check cache (use resolved IP for cache key)
    const cacheKey = buildCacheKey(targetIP)
    const cached = await cache.get(cacheKey)
    if (cached) {
      return json(200, { ...cached, cached: true, originalInput })
    }

    try {
      const response = await fetchWithTimeout(
        `${SHODAN_API_BASE}/shodan/host/${targetIP}?key=${apiKey}`,
        15000
      )

      if (!response.ok) {
        if (response.status === 404) {
          return json(404, { error: 'No information available for this IP', ip: targetIP })
        }
        if (response.status === 401) {
          return json(401, { error: 'Invalid Shodan API key' })
        }
        return json(response.status, { error: `Shodan API error: ${response.statusText}` })
      }

      const data = await response.json()

      const result = {
        ip: data.ip_str,
        originalInput: originalInput !== targetIP ? originalInput : undefined,
        hostnames: data.hostnames || [],
        city: data.city,
        region: data.region_code,
        country: data.country_code,
        countryName: data.country_name,
        org: data.org,
        isp: data.isp,
        asn: data.asn,
        latitude: data.latitude,
        longitude: data.longitude,
        lastUpdate: data.last_update,

        // Open ports
        ports: data.ports || [],

        // Vulnerabilities
        vulns: data.vulns || [],

        // Services/banners
        services: (data.data || []).map((service) => ({
          port: service.port,
          transport: service.transport,
          product: service.product,
          version: service.version,
          cpe: service.cpe,
          banner: service.data?.substring(0, 500), // Truncate long banners
          ssl: service.ssl
            ? {
                cert: {
                  subject: service.ssl.cert?.subject,
                  issuer: service.ssl.cert?.issuer,
                  expires: service.ssl.cert?.expires,
                },
                versions: service.ssl.versions,
              }
            : null,
        })),

        // Tags
        tags: data.tags || [],

        queriedAt: new Date().toISOString(),
      }

      // Cache results
      await cache.put(cacheKey, result, cacheTtlSeconds)

      return json(200, { ...result, cached: false })
    } catch (e) {
      console.error('Shodan error:', e)

      // Provide more helpful error messages
      let errorMessage = e.message || 'Unknown error'
      if (errorMessage.includes('timeout') || errorMessage.includes('abort')) {
        errorMessage = 'Request timed out. The Shodan API may be slow or unavailable.'
      } else if (errorMessage.includes('fetch')) {
        errorMessage = 'Network error connecting to Shodan API.'
      }

      return json(500, {
        error: 'Shodan lookup failed',
        details: errorMessage,
        hint: 'This tool uses the Shodan API. If the error persists, the API may be temporarily unavailable or rate-limited.',
      })
    }
  }
}

exports.createHandler = createHandler
exports.handler = createHandler()
