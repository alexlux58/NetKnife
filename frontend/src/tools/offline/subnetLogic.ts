export function ipToInt(ip: string): number {
  const parts = ip.split('.').map((x) => Number(x))
  if (parts.length !== 4) throw new Error('Invalid IP format')
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) throw new Error('Invalid IP octet')
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

export function intToIp(n: number): string {
  return [
    (n >>> 24) & 255,
    (n >>> 16) & 255,
    (n >>> 8) & 255,
    n & 255,
  ].join('.')
}

export function maskFromCidr(cidr: number): number {
  if (cidr < 0 || cidr > 32) throw new Error('Invalid CIDR')
  return cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0
}

export function toBinaryDotted(n: number): string {
  const binary = n.toString(2).padStart(32, '0')
  return binary.match(/.{8}/g)?.join('.') ?? binary
}

export function parseIPv6(ip: string): bigint | null {
  const trimmed = ip.trim().toLowerCase()

  let expanded = trimmed
  if (expanded.includes('::')) {
    const parts = expanded.split('::')
    if (parts.length > 2) return null

    const left = parts[0] ? parts[0].split(':').filter(Boolean) : []
    const right = parts[1] ? parts[1].split(':').filter(Boolean) : []
    const missing = 8 - left.length - right.length

    if (missing < 0) return null

    expanded = [...left, ...Array(missing).fill('0'), ...right].join(':')
  }

  const groups = expanded.split(':')
  if (groups.length !== 8) return null

  let result = BigInt(0)
  for (const group of groups) {
    if (!/^[0-9a-f]{0,4}$/.test(group)) return null
    result = (result << BigInt(16)) | BigInt(parseInt(group || '0', 16))
  }

  return result
}

export function ipv6ToString(addr: bigint): string {
  const groups: string[] = []
  let temp = addr
  for (let i = 0; i < 8; i++) {
    groups.unshift((temp & BigInt(0xFFFF)).toString(16).padStart(4, '0'))
    temp = temp >> BigInt(16)
  }

  let compressed = groups.join(':')
  let longestRun: { start: number; length: number } | null = null
  let currentRun: { start: number; length: number } | null = null

  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === '0000') {
      if (!currentRun) {
        currentRun = { start: i, length: 1 }
      } else {
        currentRun.length++
      }
    } else if (currentRun) {
      if (!longestRun || currentRun.length > longestRun.length) {
        longestRun = { ...currentRun }
      }
      currentRun = null
    }
  }

  if (currentRun && (!longestRun || currentRun.length > longestRun.length)) {
    longestRun = currentRun
  }

  if (longestRun && longestRun.length > 1) {
    const before = groups.slice(0, longestRun.start)
    const after = groups.slice(longestRun.start + longestRun.length)
    if (before.length && after.length) {
      compressed = `${before.join(':')}::${after.join(':')}`
    } else if (before.length) {
      compressed = `${before.join(':')}::`
    } else if (after.length) {
      compressed = `::${after.join(':')}`
    } else {
      compressed = '::'
    }
  }

  return compressed
    .split(':')
    .map((g) => {
      if (g === '') return g
      if (g === '0000') return '0'
      return g.replace(/^0+/, '') || '0'
    })
    .join(':')
}

export function detectIPVersion(input: string): 'ipv4' | 'ipv6' | null {
  if (input.includes(':')) return 'ipv6'
  if (input.includes('.')) return 'ipv4'
  return null
}

export type SubnetResult =
  | { error: string }
  | Record<string, string | number>

export function calculateSubnet(input: string): SubnetResult {
  try {
    const [ipPart, cidrPart] = input.split('/')
    if (!ipPart || !cidrPart) throw new Error('Invalid CIDR notation (use IP/prefix)')

    const prefix = Number(cidrPart)
    const version = detectIPVersion(ipPart.trim())

    if (version === 'ipv4') {
      if (prefix < 0 || prefix > 32) throw new Error('IPv4 prefix must be 0-32')

      const ipInt = ipToInt(ipPart.trim())
      const mask = maskFromCidr(prefix)
      const wildcard = (~mask) >>> 0
      const network = ipInt & mask
      const broadcast = network | wildcard
      const hostCount = prefix >= 31 ? (prefix === 32 ? 1 : 2) : broadcast - network - 1
      const firstHost = prefix >= 31 ? network : network + 1
      const lastHost = prefix >= 31 ? broadcast : broadcast - 1

      return {
        version: 'ipv4',
        input: input.trim(),
        address: ipPart.trim(),
        prefix,
        netmask: intToIp(mask),
        netmask_binary: toBinaryDotted(mask),
        wildcard: intToIp(wildcard),
        network: intToIp(network),
        broadcast: intToIp(broadcast),
        first_host: intToIp(firstHost),
        last_host: intToIp(lastHost),
        usable_hosts: hostCount,
        total_addresses: Math.pow(2, 32 - prefix),
        host_range: `${intToIp(firstHost)} - ${intToIp(lastHost)}`,
      }
    }

    if (version === 'ipv6') {
      if (prefix < 0 || prefix > 128) throw new Error('IPv6 prefix must be 0-128')

      const ipBigInt = parseIPv6(ipPart.trim())
      if (ipBigInt === null) throw new Error('Invalid IPv6 address')

      const hostBits = 128 - prefix
      let network = ipBigInt

      if (hostBits > 0 && hostBits < 128) {
        const groups: bigint[] = []
        let temp = ipBigInt
        for (let i = 0; i < 8; i++) {
          groups.unshift(temp & BigInt(0xFFFF))
          temp = temp >> BigInt(16)
        }

        const fullGroupsToKeep = Math.floor(prefix / 16)
        const bitsInPartialGroup = prefix % 16

        for (let i = fullGroupsToKeep + (bitsInPartialGroup > 0 ? 1 : 0); i < 8; i++) {
          groups[i] = BigInt(0)
        }

        if (bitsInPartialGroup > 0 && fullGroupsToKeep < 8) {
          const mask = (BigInt(0xFFFF) >> BigInt(16 - bitsInPartialGroup)) << BigInt(16 - bitsInPartialGroup)
          groups[fullGroupsToKeep] = groups[fullGroupsToKeep] & mask
        }

        network = BigInt(0)
        for (const group of groups) {
          network = (network << BigInt(16)) | group
        }
      } else if (prefix === 128) {
        network = ipBigInt
      } else {
        network = BigInt(0)
      }

      const totalAddresses = prefix === 128 ? BigInt(1) : BigInt(2) ** BigInt(128 - prefix)
      const firstHost = network
      const lastHost = network + totalAddresses - BigInt(1)
      const usableHosts =
        prefix === 128 ? BigInt(1) : totalAddresses - (prefix < 127 ? BigInt(2) : BigInt(1))

      return {
        version: 'ipv6',
        input: input.trim(),
        address: ipPart.trim(),
        prefix,
        network: ipv6ToString(network),
        first_host: ipv6ToString(firstHost),
        last_host: ipv6ToString(lastHost),
        usable_hosts: usableHosts.toString(),
        total_addresses: totalAddresses.toString(),
        host_range: `${ipv6ToString(firstHost)} - ${ipv6ToString(lastHost)}`,
      }
    }

    throw new Error('Invalid IP address format')
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid input' }
  }
}
