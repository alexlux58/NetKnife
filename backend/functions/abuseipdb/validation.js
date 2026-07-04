const { createResponse } = require('netknife-common')

// Abuse category mapping (from AbuseIPDB documentation)
const ABUSE_CATEGORIES = {
  1: 'DNS Compromise',
  2: 'DNS Poisoning',
  3: 'Fraud Orders',
  4: 'DDoS Attack',
  5: 'FTP Brute-Force',
  6: 'Ping of Death',
  7: 'Phishing',
  8: 'Fraud VoIP',
  9: 'Open Proxy',
  10: 'Web Spam',
  11: 'Email Spam',
  12: 'Blog Spam',
  13: 'VPN IP',
  14: 'Port Scan',
  15: 'Hacking',
  16: 'SQL Injection',
  17: 'Spoofing',
  18: 'Brute-Force',
  19: 'Bad Web Bot',
  20: 'Exploited Host',
  21: 'Web App Attack',
  22: 'SSH',
  23: 'IoT Targeted',
}

/** Lowercase-header JSON response (preserves original behavior). */
function json(statusCode, body) {
  return createResponse(statusCode, body)
}

function isValidIPv4(ip) {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => {
    const n = Number(p)
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p
  })
}

function isValidIPv6(ip) {
  const ipv6Regex = /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(?:ffff(?::0{1,4})?:)?(?:(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9]))$/i
  return ipv6Regex.test(ip)
}

function isValidIP(ip) {
  return isValidIPv4(ip) || isValidIPv6(ip)
}

function isPrivateIP(ip) {
  if (isValidIPv4(ip)) {
    const parts = ip.split('.').map(Number)
    if (parts[0] === 10) return true
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    if (parts[0] === 192 && parts[1] === 168) return true
    if (parts[0] === 127) return true
    if (parts[0] === 169 && parts[1] === 254) return true
    if (parts[0] === 0) return true
  }
  if (isValidIPv6(ip)) {
    const lower = ip.toLowerCase()
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
    if (lower.startsWith('fe80')) return true
    if (lower === '::1' || lower === '::') return true
  }
  return false
}

/** Build the DynamoDB cache key for an AbuseIPDB lookup. */
function buildCacheKey(ip) {
  return `abuseipdb:${ip}`
}

/** Convert category IDs to human-readable names. */
function mapCategories(categoryIds) {
  if (!categoryIds || !Array.isArray(categoryIds)) return []
  return categoryIds.map((id) => ({
    id,
    name: ABUSE_CATEGORIES[id] || `Unknown (${id})`,
  }))
}

/** Derive a threat level from the abuse confidence score. */
function getThreatLevel(score) {
  if (score >= 75) return { level: 'critical', color: 'red', emoji: '🔴' }
  if (score >= 50) return { level: 'high', color: 'orange', emoji: '🟠' }
  if (score >= 25) return { level: 'medium', color: 'yellow', emoji: '🟡' }
  if (score > 0) return { level: 'low', color: 'blue', emoji: '🔵' }
  return { level: 'clean', color: 'green', emoji: '🟢' }
}

/**
 * Validate the request IP. Returns null when valid, or a ready-to-return
 * API Gateway response describing the problem.
 */
function validateIp(ip) {
  if (!ip || typeof ip !== 'string') {
    return json(400, { error: 'Missing required parameter: ip' })
  }
  const cleanIP = ip.trim()
  if (!isValidIP(cleanIP)) {
    return json(400, { error: 'Invalid IP address format' })
  }
  if (isPrivateIP(cleanIP)) {
    return json(400, { error: 'Private/reserved IP addresses cannot be checked', ip: cleanIP })
  }
  return null
}

module.exports = {
  ABUSE_CATEGORIES,
  json,
  isValidIPv4,
  isValidIPv6,
  isValidIP,
  isPrivateIP,
  buildCacheKey,
  mapCategories,
  getThreatLevel,
  validateIp,
}
