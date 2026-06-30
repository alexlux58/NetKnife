export function parseIPv6(ip: string): { address: bigint; groups: string[] } | null {
  const trimmed = ip.trim().toLowerCase()

  if (trimmed.includes('.')) {
    const parts = trimmed.split(':')
    const lastPart = parts[parts.length - 1]
    if (lastPart.includes('.')) {
      const ipv4Parts = lastPart.split('.').map(Number)
      if (ipv4Parts.length === 4 && ipv4Parts.every((p) => p >= 0 && p <= 255)) {
        const ipv4Num = (ipv4Parts[0] << 24) + (ipv4Parts[1] << 16) + (ipv4Parts[2] << 8) + ipv4Parts[3]
        const ipv6Num = (BigInt(0xffff) << BigInt(32)) | BigInt(ipv4Num)
        const groups = [
          '0', '0', '0', '0', '0', 'ffff',
          ipv4Parts[0].toString(16).padStart(2, '0') + ipv4Parts[1].toString(16).padStart(2, '0'),
          ipv4Parts[2].toString(16).padStart(2, '0') + ipv4Parts[3].toString(16).padStart(2, '0'),
        ]
        return { address: ipv6Num, groups }
      }
    }
  }

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
  const normalizedGroups: string[] = []
  for (const group of groups) {
    if (!/^[0-9a-f]{0,4}$/.test(group)) return null
    const value = parseInt(group || '0', 16)
    normalizedGroups.push(value.toString(16).padStart(4, '0'))
    result = (result << BigInt(16)) | BigInt(value)
  }

  return { address: result, groups: normalizedGroups }
}

export function compressIPv6(groups: string[]): string {
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
    const before = groups.slice(0, longestRun.start).join(':')
    const after = groups.slice(longestRun.start + longestRun.length).join(':')
    compressed = [before, after].filter(Boolean).join('::')
    if (!compressed.includes('::')) compressed = '::' + compressed
  }

  return compressed
    .split(':')
    .map((g) => (g === '0000' ? '0' : g.replace(/^0+/, '') || '0'))
    .join(':')
}

export function detectAddressType(address: bigint, groups: string[]): {
  type: string
  scope: string
  description: string
  embeddedIPv4?: string
} {
  const firstGroup = parseInt(groups[0], 16)
  const firstTwoGroups = (parseInt(groups[0], 16) << 16) | parseInt(groups[1], 16)

  if (address === BigInt(0)) {
    return { type: 'Unspecified', scope: 'None', description: 'All zeros - used as "no address" placeholder' }
  }

  if (address === BigInt(1)) {
    return { type: 'Loopback', scope: 'Host', description: 'Localhost equivalent (::1)' }
  }

  if (firstTwoGroups === 0 && parseInt(groups[2], 16) === 0xffff) {
    const ipv4 = [
      parseInt(groups[6].substring(0, 2), 16),
      parseInt(groups[6].substring(2, 4), 16),
      parseInt(groups[7].substring(0, 2), 16),
      parseInt(groups[7].substring(2, 4), 16),
    ].join('.')
    return {
      type: 'IPv4-mapped',
      scope: 'Global',
      description: 'IPv4 address embedded in IPv6 (::ffff:x.x.x.x)',
      embeddedIPv4: ipv4,
    }
  }

  if (firstTwoGroups === 0 && parseInt(groups[2], 16) === 0 && parseInt(groups[3], 16) === 0) {
    const ipv4 = [
      parseInt(groups[6].substring(0, 2), 16),
      parseInt(groups[6].substring(2, 4), 16),
      parseInt(groups[7].substring(0, 2), 16),
      parseInt(groups[7].substring(2, 4), 16),
    ].join('.')
    return {
      type: 'IPv4-compatible (deprecated)',
      scope: 'Global',
      description: 'Deprecated IPv4-compatible format',
      embeddedIPv4: ipv4,
    }
  }

  if ((firstGroup & 0xffc0) === 0xfe80) {
    return {
      type: 'Link-local unicast',
      scope: 'Link',
      description: 'Automatically assigned, valid only on local network segment (fe80::/10)',
    }
  }

  if ((firstGroup & 0xfe00) === 0xfc00) {
    return {
      type: 'Unique local unicast (ULA)',
      scope: 'Global',
      description: 'Private IPv6 addresses (fc00::/7), similar to IPv4 private ranges',
    }
  }

  if ((firstGroup & 0xff00) === 0xff00) {
    const flags = (parseInt(groups[0], 16) >> 12) & 0xf
    const scope = parseInt(groups[0], 16) & 0xf
    const scopeNames: Record<number, string> = {
      0: 'Reserved',
      1: 'Interface-local',
      2: 'Link-local',
      4: 'Admin-local',
      5: 'Site-local',
      8: 'Organization-local',
      14: 'Global',
      15: 'Reserved',
    }
    return {
      type: 'Multicast',
      scope: scopeNames[scope] || `Unknown (${scope})`,
      description: `Multicast address (flags: ${flags.toString(2).padStart(4, '0')})`,
    }
  }

  if ((firstGroup & 0xe000) === 0x2000) {
    return {
      type: 'Global unicast',
      scope: 'Global',
      description: 'Public routable IPv6 address (2000::/3)',
    }
  }

  if ((firstGroup & 0xff00) === 0x2002) {
    const ipv4 = [
      parseInt(groups[1].substring(0, 2), 16),
      parseInt(groups[1].substring(2, 4), 16),
      parseInt(groups[2].substring(0, 2), 16),
      parseInt(groups[2].substring(2, 4), 16),
    ].join('.')
    return {
      type: '6to4',
      scope: 'Global',
      description: '6to4 tunnel endpoint (2002::/16)',
      embeddedIPv4: ipv4,
    }
  }

  if ((firstGroup & 0xff00) === 0x2001 && parseInt(groups[1], 16) === 0) {
    return {
      type: 'Teredo',
      scope: 'Global',
      description: 'Teredo tunnel address (2001::/32)',
    }
  }

  return { type: 'Unknown/Reserved', scope: 'Unknown', description: 'Address type not recognized' }
}

export function reverseDNS(groups: string[]): string {
  const reversed = [...groups].reverse()
  const nibbles: string[] = []
  for (const group of reversed) {
    for (const char of group) {
      nibbles.push(char)
    }
  }
  return nibbles.join('.') + '.ip6.arpa'
}

export function analyzeIpv6(input: string) {
  const parsed = parseIPv6(input)
  if (!parsed) {
    return { error: 'Invalid IPv6 address' as const }
  }

  const { address, groups } = parsed
  const typeInfo = detectAddressType(address, groups)

  return {
    input: input.trim(),
    valid: true as const,
    full: groups.join(':'),
    compressed: compressIPv6(groups),
    reverse_dns: reverseDNS(groups),
    address_type: typeInfo.type,
    scope: typeInfo.scope,
    description: typeInfo.description,
    embedded_ipv4: typeInfo.embeddedIPv4 || null,
    hex: '0x' + address.toString(16).padStart(32, '0'),
    decimal: address.toString(),
    binary: address.toString(2).padStart(128, '0'),
  }
}
