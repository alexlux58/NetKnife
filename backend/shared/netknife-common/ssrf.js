const net = require('net')

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map((x) => Number(x))
  if (parts.length !== 4) return true
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true

  const [a, b] = parts

  if (a === 127) return true
  if (a === 0) return true
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true

  return false
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase()

  if (normalized === '::1' || normalized === '::') return true
  if (normalized.startsWith('fe80:')) return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (normalized.startsWith('ff')) return true

  return false
}

function isBlockedIP(ip) {
  const version = net.isIP(ip)
  if (version === 4) return isPrivateIPv4(ip)
  if (version === 6) return isPrivateIPv6(ip)
  return true
}

function validateHostname(hostname) {
  const host = String(hostname || '').trim()
  if (!host || host.length > 253) {
    return { ok: false, error: 'Host must be 1-253 characters' }
  }

  if (net.isIP(host)) {
    if (isBlockedIP(host)) {
      return { ok: false, error: 'Blocked destination (private/reserved IP)' }
    }
    return { ok: true, value: host }
  }

  if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
    return { ok: false, error: 'Host must be a DNS name or IP address' }
  }

  return { ok: true, value: host }
}

async function resolveAndValidateHost(hostname, dnsLookup) {
  const validated = validateHostname(hostname)
  if (!validated.ok) return validated

  if (net.isIP(validated.value)) {
    return { ok: true, value: validated.value, addresses: [validated.value] }
  }

  const lookup = dnsLookup || require('dns').promises.lookup
  const results = await lookup(validated.value, { all: true })
  if (!results || results.length === 0) {
    return { ok: false, error: 'DNS resolution failed' }
  }

  for (const result of results) {
    if (isBlockedIP(result.address)) {
      return { ok: false, error: `Blocked destination: ${result.address} (private/reserved IP)` }
    }
  }

  return { ok: true, value: validated.value, addresses: results.map((r) => r.address) }
}

function validateTlsPort(port) {
  const value = port == null || port === '' ? 443 : Number(port)
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    return { ok: false, error: 'Port must be 1-65535' }
  }
  return { ok: true, value }
}

function looksLikeIPv4(query) {
  return /^[0-9.]+$/.test(query)
}

function looksLikeIPv6(query) {
  return query.includes(':')
}

function looksLikeDomain(query) {
  return (
    /^[a-z0-9.-]+$/i.test(query) &&
    query.includes('.') &&
    !query.endsWith('.')
  )
}

function validateRdapQuery(query) {
  const value = String(query || '').trim().toLowerCase()
  if (!value || value.length > 253) {
    return { ok: false, error: 'Query must be 1-253 characters' }
  }
  if (looksLikeIPv4(value) || looksLikeIPv6(value) || looksLikeDomain(value)) {
    if (net.isIP(value) && isBlockedIP(value)) {
      return { ok: false, error: 'Cannot query private/reserved IP addresses' }
    }
    return { ok: true, value, kind: looksLikeDomain(value) ? 'domain' : 'ip' }
  }
  return { ok: false, error: 'Query must be an IP address (v4/v6) or domain name' }
}

const ALLOWED_RDAP_HOSTS = new Set([
  'rdap.org',
  'rdap.arin.net',
  'rdap.db.ripe.net',
  'rdap.apnic.net',
  'rdap.lacnic.net',
  'rdap.afrinic.net',
  'rdap.verisign.com',
  'rdap.markmonitor.com',
  'rdap.godaddy.com',
])

function isAllowedRdapHost(hostname) {
  return ALLOWED_RDAP_HOSTS.has(String(hostname || '').toLowerCase())
}

function validateTracerouteTarget(target) {
  const value = String(target || '').trim()
  if (!value || value.length > 253) {
    return { ok: false, error: 'Invalid target. Must be an IP address or hostname.' }
  }

  if (net.isIP(value)) {
    if (isBlockedIP(value)) {
      return { ok: false, error: 'Cannot trace to private/reserved IP addresses.' }
    }
    return { ok: true, value, kind: 'ip' }
  }

  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(value)) {
    return { ok: false, error: 'Invalid target. Must be an IP address or hostname.' }
  }

  return { ok: true, value, kind: 'hostname' }
}

module.exports = {
  isPrivateIPv4,
  isPrivateIPv6,
  isBlockedIP,
  validateHostname,
  resolveAndValidateHost,
  validateTlsPort,
  looksLikeIPv4,
  looksLikeIPv6,
  looksLikeDomain,
  validateRdapQuery,
  ALLOWED_RDAP_HOSTS,
  isAllowedRdapHost,
  validateTracerouteTarget,
}
