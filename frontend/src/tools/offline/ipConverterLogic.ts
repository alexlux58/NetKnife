export interface Ipv4Representations {
  dotted: string
  decimal: string
  hex: string
  hexDotted: string
  binary: string
  binaryDotted: string
  octal: string
}

export interface Ipv6Representations {
  full: string
  compressed: string
  hex: string
  binary: string
}

export function parseIPv4(input: string): number | null {
  const trimmed = input.trim()

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) {
    const parts = trimmed.split('.').map(Number)
    if (parts.some((p) => p > 255)) return null
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  }

  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10)
    if (num > 0xffffffff) return null
    return num >>> 0
  }

  if (/^(0x)?[0-9a-fA-F]+$/.test(trimmed)) {
    const hex = trimmed.replace(/^0x/, '')
    if (hex.length > 8) return null
    return parseInt(hex, 16) >>> 0
  }

  if (/^(0x[0-9a-fA-F]{1,2}\.){3}0x[0-9a-fA-F]{1,2}$/.test(trimmed)) {
    const parts = trimmed.split('.').map((p) => parseInt(p, 16))
    if (parts.some((p) => p > 255)) return null
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  }

  if (/^[01]+$/.test(trimmed) && trimmed.length <= 32) {
    return parseInt(trimmed.padStart(32, '0'), 2) >>> 0
  }

  if (/^[01]{8}\.[01]{8}\.[01]{8}\.[01]{8}$/.test(trimmed)) {
    const parts = trimmed.split('.').map((p) => parseInt(p, 2))
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  }

  return null
}

export function ipv4ToRepresentations(num: number): Ipv4Representations {
  const o1 = (num >>> 24) & 0xff
  const o2 = (num >>> 16) & 0xff
  const o3 = (num >>> 8) & 0xff
  const o4 = num & 0xff

  return {
    dotted: `${o1}.${o2}.${o3}.${o4}`,
    decimal: num.toString(),
    hex: '0x' + num.toString(16).padStart(8, '0').toUpperCase(),
    hexDotted: `0x${o1.toString(16).padStart(2, '0')}.0x${o2.toString(16).padStart(2, '0')}.0x${o3.toString(16).padStart(2, '0')}.0x${o4.toString(16).padStart(2, '0')}`.toUpperCase(),
    binary: num.toString(2).padStart(32, '0'),
    binaryDotted: `${o1.toString(2).padStart(8, '0')}.${o2.toString(2).padStart(8, '0')}.${o3.toString(2).padStart(8, '0')}.${o4.toString(2).padStart(8, '0')}`,
    octal: '0' + num.toString(8),
  }
}

export function parseIPv6(input: string): bigint | null {
  const trimmed = input.trim().toLowerCase()

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

export function ipv6ToRepresentations(num: bigint): Ipv6Representations {
  const groups: string[] = []
  let temp = num
  for (let i = 0; i < 8; i++) {
    groups.unshift((temp & BigInt(0xffff)).toString(16).padStart(4, '0'))
    temp = temp >> BigInt(16)
  }
  const full = groups.join(':')

  let compressed = full
  const zeroRuns = compressed.match(/(^|:)(0000:)+0000(:|$)/g) || []
  if (zeroRuns.length > 0) {
    const longest = zeroRuns.reduce((a, b) => (a.length > b.length ? a : b))
    compressed = compressed.replace(longest, '::')
    compressed = compressed.replace(/:{3,}/, '::')
  }
  compressed = compressed.replace(/(^|:)0+([0-9a-f])/g, '$1$2')

  return {
    full,
    compressed,
    hex: '0x' + num.toString(16).padStart(32, '0'),
    binary: num.toString(2).padStart(128, '0'),
  }
}

export function convertIpInput(input: string): {
  type: 'ipv4' | 'ipv6' | null
  ipv4: Ipv4Representations | null
  ipv6: Ipv6Representations | null
} {
  const ipv4Num = parseIPv4(input)
  if (ipv4Num !== null) {
    return { type: 'ipv4', ipv4: ipv4ToRepresentations(ipv4Num), ipv6: null }
  }

  const ipv6Num = parseIPv6(input)
  if (ipv6Num !== null) {
    return { type: 'ipv6', ipv4: null, ipv6: ipv6ToRepresentations(ipv6Num) }
  }

  return { type: null, ipv4: null, ipv6: null }
}
