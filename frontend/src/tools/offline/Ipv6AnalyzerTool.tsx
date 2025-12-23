/**
 * ==============================================================================
 * NETKNIFE - IPv6 ADDRESS ANALYZER TOOL
 * ==============================================================================
 * 
 * Comprehensive IPv6 address analysis and validation.
 * 
 * FEATURES:
 * - Address type detection (global unicast, link-local, unique local, etc.)
 * - Scope identification
 * - Compressed/expanded form conversion
 * - Reverse DNS format (PTR record format)
 * - Embedded IPv4 detection (IPv4-mapped/embedded)
 * - Address validation
 * 
 * All analysis happens client-side - no data leaves the browser.
 * ==============================================================================
 */

import { useState, useMemo } from 'react'
import OutputCard from '../../components/OutputCard'

/**
 * Parse and validate IPv6 address
 */
function parseIPv6(ip: string): { address: bigint; groups: string[] } | null {
  const trimmed = ip.trim().toLowerCase()
  
  // Handle IPv4-mapped IPv6 (::ffff:192.168.1.1)
  if (trimmed.includes('.')) {
    const parts = trimmed.split(':')
    const lastPart = parts[parts.length - 1]
    if (lastPart.includes('.')) {
      // Extract IPv4 part
      const ipv4Parts = lastPart.split('.').map(Number)
      if (ipv4Parts.length === 4 && ipv4Parts.every(p => p >= 0 && p <= 255)) {
        const ipv4Num = (ipv4Parts[0] << 24) + (ipv4Parts[1] << 16) + (ipv4Parts[2] << 8) + ipv4Parts[3]
        const ipv6Num = (BigInt(0xFFFF) << BigInt(32)) | BigInt(ipv4Num)
        const groups = ['0', '0', '0', '0', '0', 'ffff', 
          ipv4Parts[0].toString(16).padStart(2, '0') + ipv4Parts[1].toString(16).padStart(2, '0'),
          ipv4Parts[2].toString(16).padStart(2, '0') + ipv4Parts[3].toString(16).padStart(2, '0')]
        return { address: ipv6Num, groups }
      }
    }
  }
  
  // Handle :: expansion
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

/**
 * Get compressed form of IPv6
 */
function compressIPv6(groups: string[]): string {
  let compressed = groups.join(':')
  
  // Find longest run of zeros
  let longestRun: { start: number; length: number } | null = null
  let currentRun: { start: number; length: number } | null = null
  
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === '0000') {
      if (!currentRun) {
        currentRun = { start: i, length: 1 }
      } else {
        currentRun.length++
      }
    } else {
      if (currentRun) {
        if (!longestRun || currentRun.length > longestRun.length) {
          longestRun = { ...currentRun }
        }
        currentRun = null
      }
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
  
  // Remove leading zeros from each group
  compressed = compressed.split(':').map(g => {
    if (g === '0000') return '0'
    return g.replace(/^0+/, '') || '0'
  }).join(':')
  
  return compressed
}

/**
 * Detect IPv6 address type
 */
function detectAddressType(address: bigint, groups: string[]): {
  type: string
  scope: string
  description: string
  embeddedIPv4?: string
} {
  const firstGroup = parseInt(groups[0], 16)
  const firstTwoGroups = (parseInt(groups[0], 16) << 16) | parseInt(groups[1], 16)
  
  // Unspecified (::/128)
  if (address === BigInt(0)) {
    return {
      type: 'Unspecified',
      scope: 'None',
      description: 'All zeros - used as "no address" placeholder'
    }
  }
  
  // Loopback (::1/128)
  if (address === BigInt(1)) {
    return {
      type: 'Loopback',
      scope: 'Host',
      description: 'Localhost equivalent (::1)'
    }
  }
  
  // IPv4-mapped (::ffff:0:0/96)
  if (firstTwoGroups === 0 && parseInt(groups[2], 16) === 0xffff) {
    const ipv4 = [
      parseInt(groups[6].substring(0, 2), 16),
      parseInt(groups[6].substring(2, 4), 16),
      parseInt(groups[7].substring(0, 2), 16),
      parseInt(groups[7].substring(2, 4), 16)
    ].join('.')
    return {
      type: 'IPv4-mapped',
      scope: 'Global',
      description: 'IPv4 address embedded in IPv6 (::ffff:x.x.x.x)',
      embeddedIPv4: ipv4
    }
  }
  
  // IPv4-compatible (deprecated, ::x.x.x.x)
  if (firstTwoGroups === 0 && parseInt(groups[2], 16) === 0 && parseInt(groups[3], 16) === 0) {
    const ipv4 = [
      parseInt(groups[6].substring(0, 2), 16),
      parseInt(groups[6].substring(2, 4), 16),
      parseInt(groups[7].substring(0, 2), 16),
      parseInt(groups[7].substring(2, 4), 16)
    ].join('.')
    return {
      type: 'IPv4-compatible (deprecated)',
      scope: 'Global',
      description: 'Deprecated IPv4-compatible format',
      embeddedIPv4: ipv4
    }
  }
  
  // Link-local (fe80::/10)
  if ((firstGroup & 0xffc0) === 0xfe80) {
    return {
      type: 'Link-local unicast',
      scope: 'Link',
      description: 'Automatically assigned, valid only on local network segment (fe80::/10)'
    }
  }
  
  // Unique local (fc00::/7)
  if ((firstGroup & 0xfe00) === 0xfc00) {
    return {
      type: 'Unique local unicast (ULA)',
      scope: 'Global',
      description: 'Private IPv6 addresses (fc00::/7), similar to IPv4 private ranges'
    }
  }
  
  // Multicast (ff00::/8)
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
      15: 'Reserved'
    }
    return {
      type: 'Multicast',
      scope: scopeNames[scope] || `Unknown (${scope})`,
      description: `Multicast address (flags: ${flags.toString(2).padStart(4, '0')})`
    }
  }
  
  // Global unicast (2000::/3)
  if ((firstGroup & 0xe000) === 0x2000) {
    return {
      type: 'Global unicast',
      scope: 'Global',
      description: 'Public routable IPv6 address (2000::/3)'
    }
  }
  
  // 6to4 (2002::/16)
  if ((firstGroup & 0xff00) === 0x2002) {
    const ipv4 = [
      parseInt(groups[1].substring(0, 2), 16),
      parseInt(groups[1].substring(2, 4), 16),
      parseInt(groups[2].substring(0, 2), 16),
      parseInt(groups[2].substring(2, 4), 16)
    ].join('.')
    return {
      type: '6to4',
      scope: 'Global',
      description: '6to4 tunnel endpoint (2002::/16)',
      embeddedIPv4: ipv4
    }
  }
  
  // Teredo (2001::/32)
  if ((firstGroup & 0xff00) === 0x2001 && parseInt(groups[1], 16) === 0) {
    return {
      type: 'Teredo',
      scope: 'Global',
      description: 'Teredo tunnel address (2001::/32)'
    }
  }
  
  return {
    type: 'Unknown/Reserved',
    scope: 'Unknown',
    description: 'Address type not recognized'
  }
}

/**
 * Generate reverse DNS format (PTR record)
 */
function reverseDNS(groups: string[]): string {
  // Reverse the groups and join with dots, add .ip6.arpa
  const reversed = [...groups].reverse()
  const nibbles: string[] = []
  for (const group of reversed) {
    for (const char of group) {
      nibbles.push(char)
    }
  }
  return nibbles.join('.') + '.ip6.arpa'
}

export default function Ipv6AnalyzerTool() {
  const [input, setInput] = useState('2001:0db8:85a3:0000:0000:8a2e:0370:7334')
  const [output, setOutput] = useState('')

  const analysis = useMemo(() => {
    const parsed = parseIPv6(input)
    if (!parsed) {
      return { error: 'Invalid IPv6 address' }
    }

    const { address, groups } = parsed
    const full = groups.join(':')
    const compressed = compressIPv6(groups)
    const typeInfo = detectAddressType(address, groups)
    const reverse = reverseDNS(groups)

    return {
      input: input.trim(),
      valid: true,
      full: full,
      compressed: compressed,
      reverse_dns: reverse,
      address_type: typeInfo.type,
      scope: typeInfo.scope,
      description: typeInfo.description,
      embedded_ipv4: typeInfo.embeddedIPv4 || null,
      hex: '0x' + address.toString(16).padStart(32, '0'),
      decimal: address.toString(),
      binary: address.toString(2).padStart(128, '0'),
    }
  }, [input])

  function handleAnalyze() {
    setOutput(JSON.stringify(analysis, null, 2))
  }

  function loadExample(type: 'global' | 'linklocal' | 'multicast' | 'ula' | 'mapped') {
    const examples = {
      global: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      linklocal: 'fe80::1',
      multicast: 'ff02::1',
      ula: 'fd00::1',
      mapped: '::ffff:192.168.1.1'
    }
    setInput(examples[type])
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-blue-950/30 border-blue-900/50 p-4 text-sm">
        <div className="flex items-start gap-2">
          <span className="text-blue-400">ℹ️</span>
          <div>
            <div className="font-medium text-blue-300 mb-1">IPv6 Address Analyzer</div>
            <div className="text-blue-400/80">
              Analyzes IPv6 addresses to determine type, scope, and format. All processing happens locally in your browser.
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">IPv6 Address</label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="2001:0db8::1"
              className="input font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Supports compressed (::) and expanded forms
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAnalyze}
              disabled={!analysis || 'error' in analysis}
              className="btn-primary"
            >
              Analyze Address
            </button>
          </div>

          {/* Examples */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Examples</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => loadExample('global')}
                className="btn-secondary text-xs py-1 px-2"
              >
                Global Unicast
              </button>
              <button
                onClick={() => loadExample('linklocal')}
                className="btn-secondary text-xs py-1 px-2"
              >
                Link-local
              </button>
              <button
                onClick={() => loadExample('multicast')}
                className="btn-secondary text-xs py-1 px-2"
              >
                Multicast
              </button>
              <button
                onClick={() => loadExample('ula')}
                className="btn-secondary text-xs py-1 px-2"
              >
                Unique Local
              </button>
              <button
                onClick={() => loadExample('mapped')}
                className="btn-secondary text-xs py-1 px-2"
              >
                IPv4-mapped
              </button>
            </div>
          </div>

          {/* Error display */}
          {'error' in analysis && (
            <div className="card bg-red-950/30 border-red-900/50 p-4 text-sm text-red-400">
              {analysis.error}
            </div>
          )}

          {/* Results preview */}
          {!('error' in analysis) && analysis.valid && (
            <div className="card p-4 space-y-3">
              <h4 className="font-medium text-sm">Quick Info</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Type:</span>
                  <span className="ml-2 text-cyan-400">{analysis.address_type}</span>
                </div>
                <div>
                  <span className="text-gray-500">Scope:</span>
                  <span className="ml-2 text-green-400">{analysis.scope}</span>
                </div>
                <div>
                  <span className="text-gray-500">Compressed:</span>
                  <span className="ml-2 font-mono text-xs">{analysis.compressed}</span>
                </div>
                {analysis.embedded_ipv4 && (
                  <div>
                    <span className="text-gray-500">Embedded IPv4:</span>
                    <span className="ml-2 font-mono text-xs">{analysis.embedded_ipv4}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Output section */}
        <OutputCard title="Analysis Result" value={output} />
      </div>
    </div>
  )
}

