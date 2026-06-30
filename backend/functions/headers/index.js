const dns = require('dns').promises
const {
  createResponse,
  isBlockedIP,
  analyzeSecurityHeaders,
  validateScanUrl,
} = require('./validation')

const REQUEST_TIMEOUT_MS = 5000
const MAX_REDIRECTS = 5

function createHandler(deps = {}) {
  const fetchFn = deps.fetch || fetch
  const dnsLookup = deps.dnsLookup || ((hostname) => dns.lookup(hostname, { all: true }))
  const requestTimeoutMs = deps.requestTimeoutMs ?? REQUEST_TIMEOUT_MS
  const maxRedirects = deps.maxRedirects ?? MAX_REDIRECTS

  async function resolveAndValidate(hostname) {
    const results = await dnsLookup(hostname)

    if (!results || results.length === 0) {
      throw new Error('DNS resolution failed')
    }

    for (const result of results) {
      if (isBlockedIP(result.address)) {
        throw new Error(`Blocked destination: ${result.address} (private/reserved IP)`)
      }
    }

    return results.map((r) => r.address)
  }

  async function fetchHeadersOnce(url) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)

    try {
      const response = await fetchFn(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'NetKnife/1.0 SecurityHeadersScanner',
          accept: '*/*',
        },
      })

      try {
        response.body?.cancel()
      } catch {
        // ignore
      }

      const headersObj = {}
      response.headers.forEach((value, key) => {
        headersObj[key] = value
      })

      return {
        status: response.status,
        location: response.headers.get('location'),
        headers: headersObj,
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  return async function handler(event) {
    try {
      const body = event.body ? JSON.parse(event.body) : {}
      const inputUrl = String(body.url || '').trim()
      const urlValidation = validateScanUrl(inputUrl)
      if (urlValidation.error) {
        return urlValidation.error
      }

      const parsedUrl = urlValidation.parsedUrl
      await resolveAndValidate(parsedUrl.hostname)

      const chain = []
      let currentUrl = parsedUrl.toString()

      for (let i = 0; i < maxRedirects; i++) {
        const curParsed = new URL(currentUrl)

        if (!['http:', 'https:'].includes(curParsed.protocol)) {
          throw new Error('Redirect to invalid protocol')
        }

        const hopPort = curParsed.port
          ? Number(curParsed.port)
          : curParsed.protocol === 'https:'
            ? 443
            : 80

        if (![80, 443].includes(hopPort)) {
          throw new Error('Redirect to invalid port')
        }

        await resolveAndValidate(curParsed.hostname)

        const result = await fetchHeadersOnce(currentUrl)
        const securityAnalysis = analyzeSecurityHeaders(new Map(Object.entries(result.headers)))

        chain.push({
          url: currentUrl,
          status: result.status,
          location: result.location,
          security_headers: securityAnalysis,
          headers: result.headers,
        })

        if (result.status >= 300 && result.status < 400 && result.location) {
          currentUrl = new URL(result.location, currentUrl).toString()
          continue
        }

        return createResponse(200, {
          input: inputUrl,
          final_url: currentUrl,
          redirects: chain.length - 1,
          chain,
        })
      }

      return createResponse(400, {
        error: 'Too many redirects',
        details: `Exceeded maximum of ${maxRedirects} redirects`,
        chain,
      })
    } catch (error) {
      console.error('Headers scan error:', error)

      const safe = [
        'Blocked destination:',
        'Too many redirects',
        'Invalid protocol',
        'Invalid port',
        'Malformed URL',
        'Invalid URL',
      ]
      const msg = error.message || ''
      const safeDetail = safe.some((s) => msg.startsWith(s)) ? msg : 'An unexpected error occurred.'

      return createResponse(500, {
        error: 'Headers scan failed',
        details: safeDetail,
      })
    }
  }
}

exports.createHandler = createHandler
exports.handler = createHandler()
