/**
 * ==============================================================================
 * NETKNIFE - IP ADDRESS CONVERTER TOOL
 * ==============================================================================
 * 
 * Convert between different IP address representations.
 * 
 * FEATURES:
 * - Decimal (dotted) ↔ Integer ↔ Hex ↔ Binary
 * - IPv4 and IPv6 support
 * - Real-time conversion as you type
 * - Bit-level visualization
 * ==============================================================================
 */

import { useState, useEffect } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'

interface Ipv4Representations {
  dotted: string
  decimal: string
  hex: string
  hexDotted: string
  binary: string
  binaryDotted: string
  octal: string
}

interface Ipv6Representations {
  full: string
  compressed: string
  hex: string
  binary: string
}

/**
 * Parse IPv4 from any format
 */
function parseIPv4(input: string): number | null {
  const trimmed = input.trim()
  
  // Dotted decimal (192.168.1.1)
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) {
    const parts = trimmed.split('.').map(Number)
    if (parts.some(p => p > 255)) return null
    return (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0
  }
  
  // Pure decimal (3232235777)
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10)
    if (num > 0xFFFFFFFF) return null
    return num >>> 0
  }
  
  // Hex (0xC0A80101 or C0A80101)
  if (/^(0x)?[0-9a-fA-F]+$/.test(trimmed)) {
    const hex = trimmed.replace(/^0x/, '')
    if (hex.length > 8) return null
    return parseInt(hex, 16) >>> 0
  }
  
  // Dotted hex (0xC0.0xA8.0x01.0x01)
  if (/^(0x[0-9a-fA-F]{1,2}\.){3}0x[0-9a-fA-F]{1,2}$/.test(trimmed)) {
    const parts = trimmed.split('.').map(p => parseInt(p, 16))
    if (parts.some(p => p > 255)) return null
    return (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0
  }
  
  // Binary (11000000101010000000000100000001)
  if (/^[01]+$/.test(trimmed) && trimmed.length <= 32) {
    return parseInt(trimmed.padStart(32, '0'), 2) >>> 0
  }
  
  // Dotted binary (11000000.10101000.00000001.00000001)
  if (/^[01]{8}\.[01]{8}\.[01]{8}\.[01]{8}$/.test(trimmed)) {
    const parts = trimmed.split('.').map(p => parseInt(p, 2))
    return (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0
  }
  
  return null
}

/**
 * Convert IPv4 number to all representations
 */
function ipv4ToRepresentations(num: number): Ipv4Representations {
  const o1 = (num >>> 24) & 0xFF
  const o2 = (num >>> 16) & 0xFF
  const o3 = (num >>> 8) & 0xFF
  const o4 = num & 0xFF
  
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

/**
 * Parse IPv6 to BigInt
 */
function parseIPv6(input: string): bigint | null {
  const trimmed = input.trim().toLowerCase()
  
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
  for (const group of groups) {
    if (!/^[0-9a-f]{0,4}$/.test(group)) return null
    result = (result << BigInt(16)) | BigInt(parseInt(group || '0', 16))
  }
  
  return result
}

/**
 * Convert IPv6 BigInt to representations
 */
function ipv6ToRepresentations(num: bigint): Ipv6Representations {
  // Full form
  const groups: string[] = []
  let temp = num
  for (let i = 0; i < 8; i++) {
    groups.unshift((temp & BigInt(0xFFFF)).toString(16).padStart(4, '0'))
    temp = temp >> BigInt(16)
  }
  const full = groups.join(':')
  
  // Compressed form
  let compressed = full
  // Find longest run of zeros
  const zeroRuns = compressed.match(/(^|:)(0000:)+0000(:|$)/g) || []
  if (zeroRuns.length > 0) {
    const longest = zeroRuns.reduce((a, b) => a.length > b.length ? a : b)
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

export default function IpConverterTool() {
  const [input, setInput] = useState('192.168.1.1')
  const [ipv4Result, setIpv4Result] = useState<Ipv4Representations | null>(null)
  const [ipv6Result, setIpv6Result] = useState<Ipv6Representations | null>(null)
  const [inputType, setInputType] = useState<'ipv4' | 'ipv6'>('ipv4')

  useEffect(() => {
    // Try IPv4 first
    const ipv4Num = parseIPv4(input)
    if (ipv4Num !== null) {
      setIpv4Result(ipv4ToRepresentations(ipv4Num))
      setIpv6Result(null)
      setInputType('ipv4')
      return
    }
    
    // Try IPv6
    const ipv6Num = parseIPv6(input)
    if (ipv6Num !== null) {
      setIpv6Result(ipv6ToRepresentations(ipv6Num))
      setIpv4Result(null)
      setInputType('ipv6')
      return
    }
    
    // Invalid
    setIpv4Result(null)
    setIpv6Result(null)
  }, [input])

  const renderBinaryVisualization = (binary: string) => {
    return (
      <div className="font-mono text-xs">
        <div className="flex flex-wrap gap-1">
          {binary.split('.').map((octet, i) => (
            <div key={i} className="flex">
              {octet.split('').map((bit, j) => (
                <span
                  key={j}
                  className={`w-3 h-5 flex items-center justify-center ${
                    bit === '1' ? 'bg-blue-500 text-white' : 'bg-[#21262d] text-gray-500'
                  }`}
                >
                  {bit}
                </span>
              ))}
              {i < 3 && <span className="mx-1 text-gray-500">.</span>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">IP Address Converter</h1>
        <p className="text-gray-400 mt-1">
          Convert between decimal, hex, binary, and other IP representations
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Input</h2>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter IPv4 or IPv6 address"
            className="input font-mono text-lg"
          />
          <p className="text-xs text-gray-500 mt-2">
            Accepts: dotted decimal, integer, hex (0x prefix), binary, dotted binary
          </p>
          
          {/* Quick examples */}
          <div className="mt-4">
            <div className="text-sm text-gray-400 mb-2">Examples:</div>
            <div className="flex flex-wrap gap-2">
              {['192.168.1.1', '10.0.0.1', '3232235777', '0xC0A80101', '::1', '2001:db8::1'].map(ex => (
                <button
                  key={ex}
                  onClick={() => setInput(ex)}
                  className="text-xs px-2 py-1 rounded bg-[#21262d] text-gray-400 hover:text-white transition-colors font-mono"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Detection</h2>
          {ipv4Result || ipv6Result ? (
            <div className="text-lg">
              <span className={`px-3 py-1 rounded font-medium ${
                inputType === 'ipv4' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-purple-500/20 text-purple-400'
              }`}>
                {inputType.toUpperCase()}
              </span>
              <span className="text-gray-400 ml-3">Valid address detected</span>
            </div>
          ) : (
            <div className="text-yellow-400">
              Enter a valid IPv4 or IPv6 address
            </div>
          )}
        </div>
      </div>

      {/* IPv4 Results */}
      {ipv4Result && (
        <div className="space-y-4">
          {/* Add to Report Button */}
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="ip-converter"
              input={input}
              data={ipv4Result}
              category="Network Intelligence"
            />
          </div>
          <h2 className="text-lg font-semibold">IPv4 Representations</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <OutputCard title="Dotted Decimal" canCopy>
              <div className="font-mono text-xl text-blue-400">{ipv4Result.dotted}</div>
            </OutputCard>
            
            <OutputCard title="Decimal (Integer)" canCopy>
              <div className="font-mono text-xl text-green-400">{ipv4Result.decimal}</div>
            </OutputCard>
            
            <OutputCard title="Hexadecimal" canCopy>
              <div className="font-mono text-xl text-purple-400">{ipv4Result.hex}</div>
            </OutputCard>
            
            <OutputCard title="Dotted Hex" canCopy>
              <div className="font-mono text-lg text-purple-400">{ipv4Result.hexDotted}</div>
            </OutputCard>
            
            <OutputCard title="Octal" canCopy>
              <div className="font-mono text-xl text-orange-400">{ipv4Result.octal}</div>
            </OutputCard>
            
            <OutputCard title="Binary" canCopy>
              <div className="font-mono text-xs text-cyan-400 break-all">{ipv4Result.binary}</div>
            </OutputCard>
          </div>

          {/* Binary Visualization */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Binary Visualization</h3>
            {renderBinaryVisualization(ipv4Result.binaryDotted)}
            <div className="flex justify-between mt-2 text-xs text-gray-500 font-mono">
              <span>Octet 1</span>
              <span>Octet 2</span>
              <span>Octet 3</span>
              <span>Octet 4</span>
            </div>
          </div>
        </div>
      )}

      {/* IPv6 Results */}
      {ipv6Result && (
        <div className="space-y-4">
          {/* Add to Report Button */}
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="ip-converter"
              input={input}
              data={ipv6Result}
              category="Network Intelligence"
            />
          </div>
          <h2 className="text-lg font-semibold">IPv6 Representations</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <OutputCard title="Full Form" canCopy>
              <div className="font-mono text-sm text-blue-400 break-all">{ipv6Result.full}</div>
            </OutputCard>
            
            <OutputCard title="Compressed" canCopy>
              <div className="font-mono text-xl text-green-400">{ipv6Result.compressed}</div>
            </OutputCard>
            
            <OutputCard title="Hexadecimal" canCopy>
              <div className="font-mono text-xs text-purple-400 break-all">{ipv6Result.hex}</div>
            </OutputCard>
            
            <OutputCard title="Binary (128 bits)" canCopy>
              <div className="font-mono text-[10px] text-cyan-400 break-all leading-relaxed">
                {ipv6Result.binary.match(/.{16}/g)?.join('\n')}
              </div>
            </OutputCard>
          </div>
        </div>
      )}

      {/* Reference */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Reference</h3>
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div>
            <div className="text-blue-400 font-medium mb-2">IPv4 Formats</div>
            <ul className="space-y-1 text-gray-400 text-xs">
              <li>192.168.1.1 (dotted decimal)</li>
              <li>3232235777 (integer)</li>
              <li>0xC0A80101 (hex)</li>
              <li>0300.0250.0001.0001 (octal)</li>
            </ul>
          </div>
          <div>
            <div className="text-purple-400 font-medium mb-2">IPv6 Formats</div>
            <ul className="space-y-1 text-gray-400 text-xs">
              <li>2001:0db8:0000:0000:0000:0000:0000:0001</li>
              <li>2001:db8::1 (compressed)</li>
              <li>::1 (loopback)</li>
              <li>::ffff:192.168.1.1 (mapped IPv4)</li>
            </ul>
          </div>
          <div>
            <div className="text-green-400 font-medium mb-2">Conversion Notes</div>
            <ul className="space-y-1 text-gray-400 text-xs">
              <li>IPv4: 32 bits (4 bytes)</li>
              <li>IPv6: 128 bits (16 bytes)</li>
              <li>Each octet: 0-255 (8 bits)</li>
              <li>Max IPv4: 4,294,967,295</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

