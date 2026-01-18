/**
 * ==============================================================================
 * NETKNIFE - CIDR RANGE CHECKER TOOL
 * ==============================================================================
 * 
 * Check if an IP address falls within a CIDR range.
 * Supports both IPv4 and IPv6.
 * 
 * FEATURES:
 * - Check single IP against single CIDR
 * - Check single IP against multiple CIDRs (bulk)
 * - Check multiple IPs against single CIDR
 * - Shows which CIDRs match and which don't
 * ==============================================================================
 */

import { useState } from 'react'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'

/**
 * Parse IPv4 address to 32-bit number
 */
function parseIPv4(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  
  let result = 0
  for (const part of parts) {
    const num = parseInt(part, 10)
    if (isNaN(num) || num < 0 || num > 255) return null
    result = (result << 8) | num
  }
  return result >>> 0 // Convert to unsigned 32-bit
}

/**
 * Parse IPv6 address to BigInt
 */
function parseIPv6(ip: string): bigint | null {
  // Expand :: shorthand
  let fullIp = ip.toLowerCase()
  
  if (fullIp.includes('::')) {
    const parts = fullIp.split('::')
    if (parts.length > 2) return null
    
    const left = parts[0] ? parts[0].split(':') : []
    const right = parts[1] ? parts[1].split(':') : []
    const missing = 8 - left.length - right.length
    
    if (missing < 0) return null
    
    const middle = Array(missing).fill('0')
    fullIp = [...left, ...middle, ...right].join(':')
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

/**
 * Check if IPv4 is in CIDR range
 */
function isIPv4InRange(ip: string, cidr: string): boolean | null {
  const [network, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)
  
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null
  
  const ipNum = parseIPv4(ip)
  const networkNum = parseIPv4(network)
  
  if (ipNum === null || networkNum === null) return null
  
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  return (ipNum & mask) === (networkNum & mask)
}

/**
 * Check if IPv6 is in CIDR range
 */
function isIPv6InRange(ip: string, cidr: string): boolean | null {
  const [network, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)
  
  if (isNaN(prefix) || prefix < 0 || prefix > 128) return null
  
  const ipBigInt = parseIPv6(ip)
  const networkBigInt = parseIPv6(network)
  
  if (ipBigInt === null || networkBigInt === null) return null
  
  if (prefix === 0) return true
  
  const shift = BigInt(128 - prefix)
  return (ipBigInt >> shift) === (networkBigInt >> shift)
}

/**
 * Detect IP version
 */
function detectIPVersion(ip: string): 4 | 6 | null {
  if (ip.includes(':')) return 6
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return 4
  return null
}

/**
 * Detect CIDR version
 */
function detectCIDRVersion(cidr: string): 4 | 6 | null {
  const network = cidr.split('/')[0]
  return detectIPVersion(network)
}

interface CheckResult {
  ip: string
  cidr: string
  isInRange: boolean | null
  error?: string
}

export default function CidrRangeTool() {
  const [ips, setIps] = useState('')
  const [cidrs, setCidrs] = useState('')
  const [results, setResults] = useState<CheckResult[]>([])

  const handleCheck = () => {
    const ipList = ips.split(/[\n,]/).map(s => s.trim()).filter(s => s)
    const cidrList = cidrs.split(/[\n,]/).map(s => s.trim()).filter(s => s)
    
    const checkResults: CheckResult[] = []
    
    for (const ip of ipList) {
      for (const cidr of cidrList) {
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
        
        const result = ipVersion === 4 
          ? isIPv4InRange(ip, cidr)
          : isIPv6InRange(ip, cidr)
        
        checkResults.push({ ip, cidr, isInRange: result })
      }
    }
    
    setResults(checkResults)
  }

  const matchCount = results.filter(r => r.isInRange === true).length
  const noMatchCount = results.filter(r => r.isInRange === false).length
  const errorCount = results.filter(r => r.isInRange === null).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">CIDR Range Checker</h1>
        <p className="text-gray-400 mt-1">
          Check if IP addresses fall within CIDR ranges
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">IP Addresses</h2>
            <p className="text-sm text-gray-400 mb-2">
              Enter IP addresses to check (one per line or comma-separated)
            </p>
            <textarea
              value={ips}
              onChange={(e) => setIps(e.target.value)}
              placeholder="192.168.1.50&#10;10.0.0.100&#10;2001:db8::1"
              className="input font-mono text-sm min-h-[120px]"
            />
          </div>
          
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">CIDR Ranges</h2>
            <p className="text-sm text-gray-400 mb-2">
              Enter CIDR ranges to check against (one per line or comma-separated)
            </p>
            <textarea
              value={cidrs}
              onChange={(e) => setCidrs(e.target.value)}
              placeholder="192.168.1.0/24&#10;10.0.0.0/8&#10;2001:db8::/32"
              className="input font-mono text-sm min-h-[120px]"
            />
          </div>
          
          <button
            onClick={handleCheck}
            disabled={!ips.trim() || !cidrs.trim()}
            className="btn btn-primary w-full"
          >
            Check Ranges
          </button>
        </div>

        {/* Results */}
        <OutputCard title="Check Results" canCopy={results.length > 0}>
          {results.length === 0 ? (
            <p className="text-gray-500">Enter IPs and CIDRs to check</p>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex gap-4 text-sm">
                <span className="text-emerald-400">✓ {matchCount} in range</span>
                <span className="text-red-400">✗ {noMatchCount} not in range</span>
                {errorCount > 0 && (
                  <span className="text-yellow-400">⚠ {errorCount} errors</span>
                )}
              </div>
              
              <div className="border-t border-[#30363d] pt-4 space-y-2 max-h-[400px] overflow-y-auto">
                {results.map((result, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded border ${
                      result.isInRange === true 
                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                        : result.isInRange === false
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-yellow-500/10 border-yellow-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-sm">
                        <span className="text-white">{result.ip}</span>
                        <span className="text-gray-500"> in </span>
                        <span className="text-blue-400">{result.cidr}</span>
                      </div>
                      {result.isInRange === true ? (
                        <span className="text-emerald-400 text-lg">✓</span>
                      ) : result.isInRange === false ? (
                        <span className="text-red-400 text-lg">✗</span>
                      ) : (
                        <span className="text-yellow-400 text-xs">{result.error}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </OutputCard>
        {results.length > 0 && (
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="cidr-range"
              input={`${ips.split(/[,\n]/).filter(Boolean).length} IPs, ${cidrs.split(/[,\n]/).filter(Boolean).length} CIDRs`}
              data={{ results, matchCount, noMatchCount, errorCount }}
              category="Network Intelligence"
            />
          </div>
        )}
      </div>

      {/* Common AWS CIDRs Reference */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Common CIDR Ranges</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <h4 className="font-medium text-blue-400 mb-2">RFC 1918 (Private)</h4>
            <ul className="space-y-1 text-gray-400 font-mono text-xs">
              <li>10.0.0.0/8</li>
              <li>172.16.0.0/12</li>
              <li>192.168.0.0/16</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-400 mb-2">AWS VPC Default</h4>
            <ul className="space-y-1 text-gray-400 font-mono text-xs">
              <li>172.31.0.0/16</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-400 mb-2">Link-Local</h4>
            <ul className="space-y-1 text-gray-400 font-mono text-xs">
              <li>169.254.0.0/16 (IPv4)</li>
              <li>fe80::/10 (IPv6)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-400 mb-2">Loopback</h4>
            <ul className="space-y-1 text-gray-400 font-mono text-xs">
              <li>127.0.0.0/8 (IPv4)</li>
              <li>::1/128 (IPv6)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-400 mb-2">Documentation</h4>
            <ul className="space-y-1 text-gray-400 font-mono text-xs">
              <li>192.0.2.0/24 (TEST-NET-1)</li>
              <li>198.51.100.0/24 (TEST-NET-2)</li>
              <li>203.0.113.0/24 (TEST-NET-3)</li>
              <li>2001:db8::/32 (IPv6)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-400 mb-2">CGNAT</h4>
            <ul className="space-y-1 text-gray-400 font-mono text-xs">
              <li>100.64.0.0/10</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

