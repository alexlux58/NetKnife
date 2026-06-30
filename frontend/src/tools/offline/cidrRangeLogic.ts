export function parseIPv4(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null

  let result = 0
  for (const part of parts) {
    const num = parseInt(part, 10)
    if (isNaN(num) || num < 0 || num > 255) return null
    result = (result << 8) | num
  }
  return result >>> 0
}

export function parseIPv6(ip: string): bigint | null {
  let fullIp = ip.toLowerCase()

  if (fullIp.includes('::')) {
    const parts = fullIp.split('::')
    if (parts.length > 2) return null

    const left = parts[0] ? parts[0].split(':') : []
    const right = parts[1] ? parts[1].split(':') : []
    const missing = 8 - left.length - right.length

    if (missing < 0) return null

    fullIp = [...left, ...Array(missing).fill('0'), ...right].join(':')
  }

  const groups = fullIp.split(':')
  if (groups.length !== 8) return null

  let result = BigInt(0)
  for (const group of groups) {
    if (!/^[0-9a-f]{0,4}$/.test(group)) return null
    result = (result << BigInt(16)) | BigInt(parseInt(group || '0', 16))
  }

  return result
}

export function isIPv4InRange(ip: string, cidr: string): boolean | null {
  const [network, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)

  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null

  const ipNum = parseIPv4(ip)
  const networkNum = parseIPv4(network)

  if (ipNum === null || networkNum === null) return null

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  return (ipNum & mask) === (networkNum & mask)
}

export function isIPv6InRange(ip: string, cidr: string): boolean | null {
  const [network, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)

  if (isNaN(prefix) || prefix < 0 || prefix > 128) return null

  const ipBigInt = parseIPv6(ip)
  const networkBigInt = parseIPv6(network)

  if (ipBigInt === null || networkBigInt === null) return null
  if (prefix === 0) return true

  const shift = BigInt(128 - prefix)
  return ipBigInt >> shift === networkBigInt >> shift
}

export function detectIPVersion(ip: string): 4 | 6 | null {
  if (ip.includes(':')) return 6
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return 4
  return null
}

export function detectCIDRVersion(cidr: string): 4 | 6 | null {
  return detectIPVersion(cidr.split('/')[0])
}

export interface CheckResult {
  ip: string
  cidr: string
  isInRange: boolean | null
  error?: string
}

export function checkIpAgainstCidrs(ips: string[], cidrs: string[]): CheckResult[] {
  const checkResults: CheckResult[] = []

  for (const ip of ips) {
    for (const cidr of cidrs) {
      const ipVersion = detectIPVersion(ip)
      const cidrVersion = detectCIDRVersion(cidr)

      if (!ipVersion) {
        checkResults.push({ ip, cidr, isInRange: null, error: 'Invalid IP format' })
        continue
      }

      if (!cidrVersion) {
        checkResults.push({ ip, cidr, isInRange: null, error: 'Invalid CIDR format' })
        continue
      }

      if (ipVersion !== cidrVersion) {
        checkResults.push({ ip, cidr, isInRange: null, error: 'IP and CIDR version mismatch' })
        continue
      }

      if (ipVersion === 4 && parseIPv4(ip) === null) {
        checkResults.push({ ip, cidr, isInRange: null, error: 'Invalid IP format' })
        continue
      }

      if (ipVersion === 6 && parseIPv6(ip) === null) {
        checkResults.push({ ip, cidr, isInRange: null, error: 'Invalid IP format' })
        continue
      }

      const result = ipVersion === 4 ? isIPv4InRange(ip, cidr) : isIPv6InRange(ip, cidr)
      checkResults.push({ ip, cidr, isInRange: result })
    }
  }

  return checkResults
}
