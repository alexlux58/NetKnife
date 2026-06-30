/**
 * ==============================================================================
 * NETKNIFE - REVERSE DNS (PTR) LOOKUP LAMBDA
 * ==============================================================================
 *
 * Performs reverse DNS lookups to find PTR records for IP addresses.
 * Uses DNS-over-HTTPS (DoH) for reliable, consistent resolution.
 * ==============================================================================
 */

const { createResponse, createCacheClient } = require('netknife-common')

const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || '3600')

const cache = createCacheClient({
  payloadField: 'data',
  logReadError: (error) => console.warn('Cache get error:', error.message),
  logWriteError: (error) => console.warn('Cache put error:', error.message),
})

function json(statusCode, body) {
  return createResponse(statusCode, body, { headerStyle: 'title' })
}

function isIPv4(ip) {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => {
    const n = Number(p)
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p
  })
}

function isIPv6(ip) {
  return /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip)
    || /^::$/.test(ip)
    || /^::1$/.test(ip)
}

function ipToArpa(ip) {
  if (isIPv4(ip)) {
    return `${ip.split('.').reverse().join('.')}.in-addr.arpa`
  }

  if (isIPv6(ip)) {
    const expanded = expandIPv6(ip)
    const nibbles = expanded.replace(/:/g, '').split('').reverse().join('.')
    return `${nibbles}.ip6.arpa`
  }

  return null
}

function expandIPv6(ip) {
  const parts = ip.split('::')
  if (parts.length === 1) {
    return ip.split(':').map((p) => p.padStart(4, '0')).join(':')
  }

  const left = parts[0] ? parts[0].split(':') : []
  const right = parts[1] ? parts[1].split(':') : []
  const missing = 8 - left.length - right.length
  const middle = Array(missing).fill('0000')

  return [...left.map((p) => p.padStart(4, '0')), ...middle, ...right.map((p) => p.padStart(4, '0'))].join(':')
}

async function queryDoH(name, type) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`

  const response = await fetch(url, {
    headers: {
      Accept: 'application/dns-json',
    },
    timeout: 5000,
  })

  if (!response.ok) {
    throw new Error(`DoH query failed: ${response.status}`)
  }

  return response.json()
}

exports.handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const ip = String(body.ip || '').trim()

    if (!ip) {
      return json(400, { error: 'Missing required field: ip' })
    }

    if (!isIPv4(ip) && !isIPv6(ip)) {
      return json(400, { error: 'Invalid IP address format' })
    }

    const arpa = ipToArpa(ip)
    if (!arpa) {
      return json(400, { error: 'Could not convert IP to ARPA format' })
    }

    const cacheKey = `ptr:${ip}`
    const cached = await cache.get(cacheKey)
    if (cached) {
      return json(200, { ...cached, cached: true })
    }

    const dohResult = await queryDoH(arpa, 'PTR')

    const ptrRecords = (dohResult.Answer || [])
      .filter((r) => r.type === 12)
      .map((r) => r.data.replace(/\.$/, ''))

    const result = {
      ip,
      arpa,
      ipVersion: isIPv4(ip) ? 4 : 6,
      ptr: ptrRecords.length > 0 ? ptrRecords : null,
      ptrCount: ptrRecords.length,
      status: dohResult.Status,
      statusText: dohResult.Status === 0 ? 'NOERROR'
        : dohResult.Status === 3 ? 'NXDOMAIN'
          : `RCODE_${dohResult.Status}`,
    }

    await cache.put(cacheKey, result, TTL_SECONDS)

    return json(200, { ...result, cached: false })
  } catch (error) {
    console.error('Reverse DNS error:', error)
    return json(500, { error: error.message || 'Server error' })
  }
}
