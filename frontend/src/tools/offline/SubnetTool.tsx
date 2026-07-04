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
import { calculateSubnet, type SubnetResult } from './subnetLogic'

function formatCount(value: string | number): string {
  const raw = String(value)
  if (!/^\d+$/.test(raw)) return raw
  try {
    return BigInt(raw).toLocaleString()
  } catch {
    return raw
  }
}

function ResultRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 border-b border-[#21262d] last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="font-mono text-white text-sm text-right">{value}</span>
    </div>
  )
}

function formatSubnetForCopy(result: Record<string, string | number>): string {
  const labels: Record<string, string> = {
    input: 'Input',
    network: 'Network',
    broadcast: 'Broadcast',
    netmask: 'Netmask',
    netmask_binary: 'Netmask (binary)',
    wildcard: 'Wildcard',
    host_range: 'Host range',
    first_host: 'First host',
    last_host: 'Last host',
    usable_hosts: 'Usable hosts',
    total_addresses: 'Total addresses',
  }
  return Object.entries(labels)
    .filter(([key]) => key in result)
    .map(([key, label]) => `${label}: ${result[key]}`)
    .join('\n')
}

function SubnetResultDisplay({ result }: { result: Record<string, string | number> }) {
  const isV4 = result.version === 'ipv4'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-lg text-white">{String(result.input)}</span>
        <span className="badge-offline text-xs uppercase">{String(result.version)}</span>
      </div>

      <div className="rounded-lg border border-[#30363d] overflow-hidden">
        <div className="px-4 py-2 border-b border-[#30363d] bg-[#161b22] text-xs font-medium text-gray-500 uppercase tracking-wide">
          Network
        </div>
        <div className="px-4 bg-[#0d1117]">
          <ResultRow label="Network" value={String(result.network)} />
          {isV4 && result.broadcast != null && (
            <ResultRow label="Broadcast" value={String(result.broadcast)} />
          )}
        </div>
      </div>

      {isV4 && (
        <div className="rounded-lg border border-[#30363d] overflow-hidden">
          <div className="px-4 py-2 border-b border-[#30363d] bg-[#161b22] text-xs font-medium text-gray-500 uppercase tracking-wide">
            Masks
          </div>
          <div className="px-4 bg-[#0d1117]">
            <ResultRow label="Netmask" value={String(result.netmask)} />
            <ResultRow label="Wildcard" value={String(result.wildcard)} />
            {result.netmask_binary != null && (
              <details className="py-2 border-b border-[#21262d] last:border-0">
                <summary className="text-gray-400 text-sm cursor-pointer hover:text-gray-300">
                  Netmask (binary)
                </summary>
                <p className="font-mono text-xs text-gray-500 mt-2 break-all">{String(result.netmask_binary)}</p>
              </details>
            )}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[#30363d] overflow-hidden">
        <div className="px-4 py-2 border-b border-[#30363d] bg-[#161b22] text-xs font-medium text-gray-500 uppercase tracking-wide">
          Hosts
        </div>
        <div className="px-4 bg-[#0d1117]">
          <ResultRow label="Host range" value={String(result.host_range)} />
          <ResultRow label="First host" value={String(result.first_host)} />
          <ResultRow label="Last host" value={String(result.last_host)} />
          <ResultRow label="Usable hosts" value={formatCount(result.usable_hosts)} />
          <ResultRow label="Total addresses" value={formatCount(result.total_addresses)} />
        </div>
      </div>
    </div>
  )
}

function isSubnetError(result: SubnetResult): result is { error: string } {
  return 'error' in result
}

export default function SubnetTool() {
  const [input, setInput] = useState('192.168.1.0/24')
  const [showResult, setShowResult] = useState(false)

  const result = useMemo(() => calculateSubnet(input), [input])

  function handleCalculate() {
    setShowResult(true)
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
        {showResult && (
          <div className="space-y-4">
            {!isSubnetError(result) && (
              <div className="flex items-center justify-end">
                <AddToReportButton
                  toolId="subnet"
                  input={input}
                  data={result}
                  category="Network Intelligence"
                />
              </div>
            )}
            <OutputCard
              title="Calculation Result"
              value={isSubnetError(result) ? undefined : formatSubnetForCopy(result)}
              canCopy={!isSubnetError(result)}
              error={isSubnetError(result) ? result.error : undefined}
            >
              {!isSubnetError(result) && <SubnetResultDisplay result={result} />}
            </OutputCard>
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
