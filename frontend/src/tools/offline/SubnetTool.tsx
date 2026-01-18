/**
 * ==============================================================================
 * NETKNIFE - SUBNET CALCULATOR TOOL
 * ==============================================================================
 * 
 * A sipcalc-style subnet calculator that runs entirely in the browser.
 * 
 * FEATURES:
 * - IPv4 and IPv6 CIDR parsing
 * - Network address calculation
 * - Broadcast address calculation (IPv4 only)
 * - Netmask and wildcard mask (IPv4 only)
 * - First/last usable host
 * - Host count
 * 
 * All calculations happen client-side - no data leaves the browser.
 * ==============================================================================
 */

import { useState, useMemo } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'

/**
 * Converts IP string to 32-bit integer
 */
function ipToInt(ip: string): number {
  const parts = ip.split('.').map((x) => Number(x))
  if (parts.length !== 4) throw new Error('Invalid IP format')
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) throw new Error('Invalid IP octet')
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

/**
 * Converts 32-bit integer to IP string
 */
function intToIp(n: number): string {
  return [
    (n >>> 24) & 255,
    (n >>> 16) & 255,
    (n >>> 8) & 255,
    n & 255,
  ].join('.')
}

/**
 * Creates netmask from CIDR prefix length
 */
function maskFromCidr(cidr: number): number {
  if (cidr < 0 || cidr > 32) throw new Error('Invalid CIDR')
  return cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0
}

/**
 * Formats number in binary with dots every 8 bits
 */
function toBinaryDotted(n: number): string {
  const binary = n.toString(2).padStart(32, '0')
  return binary.match(/.{8}/g)?.join('.') ?? binary
}

/**
 * Parse IPv6 address to BigInt
 */
function parseIPv6(ip: string): bigint | null {
  const trimmed = ip.trim().toLowerCase()
  
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
 * Convert BigInt IPv6 to compressed string
 */
function ipv6ToString(addr: bigint): string {
  const groups: string[] = []
  let temp = addr
  for (let i = 0; i < 8; i++) {
    groups.unshift((temp & BigInt(0xFFFF)).toString(16).padStart(4, '0'))
    temp = temp >> BigInt(16)
  }
  
  // Compress longest run of zeros
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
 * Detect if input is IPv4 or IPv6
 */
function detectIPVersion(input: string): 'ipv4' | 'ipv6' | null {
  if (input.includes(':')) return 'ipv6'
  if (input.includes('.')) return 'ipv4'
  return null
}

export default function SubnetTool() {
  const [input, setInput] = useState('192.168.1.0/24')
  const [output, setOutput] = useState('')

  const result = useMemo(() => {
    try {
      // Parse CIDR notation
      const [ipPart, cidrPart] = input.split('/')
      if (!ipPart || !cidrPart) throw new Error('Invalid CIDR notation (use IP/prefix)')
      
      const prefix = Number(cidrPart)
      const version = detectIPVersion(ipPart.trim())
      
      if (version === 'ipv4') {
        if (prefix < 0 || prefix > 32) throw new Error('IPv4 prefix must be 0-32')
        
        const ipInt = ipToInt(ipPart.trim())
        
        // Calculate network properties
        const mask = maskFromCidr(prefix)
        const wildcard = (~mask) >>> 0
        const network = ipInt & mask
        const broadcast = network | wildcard
        
        // Calculate host range
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
      } else if (version === 'ipv6') {
        if (prefix < 0 || prefix > 128) throw new Error('IPv6 prefix must be 0-128')
        
        const ipBigInt = parseIPv6(ipPart.trim())
        if (ipBigInt === null) throw new Error('Invalid IPv6 address')
        
        // Calculate network address by zeroing out host bits
        // For IPv6, we work with the address as 8 groups of 16 bits
        const hostBits = 128 - prefix
        let network = ipBigInt
        
        // Zero out the host portion
        if (hostBits > 0 && hostBits < 128) {
          // Break address into 8 groups of 16 bits
          const groups: bigint[] = []
          let temp = ipBigInt
          for (let i = 0; i < 8; i++) {
            groups.unshift(temp & BigInt(0xFFFF))
            temp = temp >> BigInt(16)
          }
          
          // Calculate which groups and bits to keep
          const bitsPerGroup = 16
          const fullGroupsToKeep = Math.floor(prefix / bitsPerGroup)
          const bitsInPartialGroup = prefix % bitsPerGroup
          
          // Zero out groups in host portion (from right to left)
          for (let i = fullGroupsToKeep + (bitsInPartialGroup > 0 ? 1 : 0); i < 8; i++) {
            groups[i] = BigInt(0)
          }
          
          // Zero out partial bits in the boundary group
          if (bitsInPartialGroup > 0 && fullGroupsToKeep < 8) {
            const keepBits = bitsInPartialGroup
            const mask = (BigInt(0xFFFF) >> BigInt(16 - keepBits)) << BigInt(16 - keepBits)
            groups[fullGroupsToKeep] = groups[fullGroupsToKeep] & mask
          }
          
          // Reconstruct network address
          network = BigInt(0)
          for (const group of groups) {
            network = (network << BigInt(16)) | group
          }
        } else if (prefix === 128) {
          network = ipBigInt
        } else {
          network = BigInt(0)
        }
        
        // Calculate host range
        const totalAddresses = prefix === 128 ? BigInt(1) : BigInt(2) ** BigInt(128 - prefix)
        const firstHost = network
        const lastHost = network + totalAddresses - BigInt(1)
        
        // IPv6 doesn't have broadcast, but we can show the last address
        const usableHosts = prefix === 128 
          ? BigInt(1) 
          : totalAddresses - (prefix < 127 ? BigInt(2) : BigInt(1)) // Subtract network and (if applicable) last address

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
      } else {
        throw new Error('Invalid IP address format')
      }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Invalid input' }
    }
  }, [input])

  function handleCalculate() {
    setOutput(JSON.stringify(result, null, 2))
  }

  function loadExample(type: 'ipv4' | 'ipv6' = 'ipv4') {
    if (type === 'ipv4') {
      setInput('10.0.0.0/22')
    } else {
      setInput('2001:db8::/32')
    }
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="card bg-green-950/20 border-green-900/50">
        <div className="p-4 flex items-center gap-3">
          <span className="badge-offline">OFFLINE</span>
          <span className="text-sm text-gray-400">
            All calculations run in your browser. No data is sent to any server.
          </span>
        </div>
      </div>

      {/* Input and Output */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              CIDR Notation
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="192.168.1.0/24"
              className="input font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter IPv4 or IPv6 address with prefix length (e.g., 10.0.0.0/8 or 2001:db8::/32)
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={handleCalculate} className="btn-primary">
              Calculate
            </button>
            <button onClick={() => loadExample('ipv4')} className="btn-secondary">
              IPv4 Example
            </button>
            <button onClick={() => loadExample('ipv6')} className="btn-secondary">
              IPv6 Example
            </button>
          </div>
        </div>

        {/* Output section */}
        {output && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <AddToReportButton
                toolId="subnet"
                input={input}
                data={result}
                category="Network Intelligence"
              />
            </div>
            <OutputCard title="Calculation Result" value={output} />
          </div>
        )}
      </div>

      {/* Reference Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Quick reference */}
        <div className="card p-4 text-sm">
          <h4 className="font-medium mb-2">Common Prefixes</h4>
          <div className="grid grid-cols-2 gap-2 text-gray-400">
            <div>/8 = 16.7M hosts</div>
            <div>/16 = 65,534 hosts</div>
            <div>/24 = 254 hosts</div>
            <div>/28 = 14 hosts</div>
            <div>/30 = 2 hosts (P2P)</div>
            <div>/32 = 1 host</div>
          </div>
        </div>

        {/* AWS Subnet Reference */}
        <div className="card p-4 text-sm">
          <h4 className="font-medium mb-2 text-amber-400">☁️ AWS VPC Subnets</h4>
          <p className="text-gray-500 text-xs mb-3">
            AWS reserves 5 IPs per subnet (first 4 + last)
          </p>
          <div className="space-y-1 text-gray-400">
            <div className="grid grid-cols-2 gap-2">
              <span>/16</span>
              <span>65,531 usable</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span>/20</span>
              <span>4,091 usable</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span>/24</span>
              <span>251 usable</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span>/26</span>
              <span>59 usable</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span>/27</span>
              <span>27 usable</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span>/28</span>
              <span className="text-amber-400">11 usable (min)</span>
            </div>
          </div>
        </div>

        {/* AWS Reserved IPs */}
        <div className="card p-4 text-sm">
          <h4 className="font-medium mb-2 text-amber-400">AWS Reserved IPs</h4>
          <p className="text-gray-500 text-xs mb-2">
            Example: 10.0.0.0/24 subnet
          </p>
          <div className="space-y-1 text-gray-400 font-mono text-xs">
            <div className="flex justify-between">
              <span>10.0.0.0</span>
              <span className="text-gray-500">Network address</span>
            </div>
            <div className="flex justify-between">
              <span>10.0.0.1</span>
              <span className="text-gray-500">VPC Router</span>
            </div>
            <div className="flex justify-between">
              <span>10.0.0.2</span>
              <span className="text-gray-500">DNS Server</span>
            </div>
            <div className="flex justify-between">
              <span>10.0.0.3</span>
              <span className="text-gray-500">Future use</span>
            </div>
            <div className="flex justify-between">
              <span>10.0.0.255</span>
              <span className="text-gray-500">Broadcast</span>
            </div>
          </div>
          <p className="text-xs text-green-400 mt-2">
            ✓ Usable: .4 through .254
          </p>
        </div>

        {/* AWS ASN & IP Info */}
        <div className="card p-4 text-sm">
          <h4 className="font-medium mb-2 text-amber-400">AWS Network Info</h4>
          <div className="space-y-2 text-gray-400 text-xs">
            <div>
              <span className="text-gray-500">AWS ASN:</span>
              <span className="ml-2 font-mono">16509</span>
              <span className="text-gray-600 ml-1">(Amazon)</span>
            </div>
            <div>
              <span className="text-gray-500">GovCloud:</span>
              <span className="ml-2 font-mono">8987</span>
            </div>
            <div>
              <span className="text-gray-500">CloudFront:</span>
              <span className="ml-2 font-mono">14618</span>
            </div>
            <div className="border-t border-gray-700 pt-2 mt-2">
              <p className="text-gray-500 mb-1">AWS IP Ranges:</p>
              <div className="font-mono space-y-0.5">
                <div>3.x, 13.x, 15.x</div>
                <div>52.x, 54.x (partial)</div>
              </div>
            </div>
            <div className="border-t border-gray-700 pt-2 mt-2">
              <p className="text-gray-500 mb-1">VPC CIDR:</p>
              <div className="font-mono">/16 to /28</div>
            </div>
            <div className="border-t border-gray-700 pt-2 mt-2">
              <p className="text-gray-500 mb-1">Metadata IPs:</p>
              <div className="font-mono space-y-0.5">
                <div>169.254.169.254</div>
                <div>169.254.170.2</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
