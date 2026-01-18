/**
 * ==============================================================================
 * NETKNIFE - SHODAN TOOL
 * ==============================================================================
 */

import { useState } from 'react'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'

interface ShodanResult {
  ip: string
  hostnames: string[]
  city: string
  country: string
  org: string
  isp: string
  asn: string
  ports: number[]
  vulns: string[]
  services: {
    port: number
    transport: string
    product?: string
    version?: string
    banner?: string
  }[]
  tags: string[]
}

export default function ShodanTool() {
  const [ip, setIp] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ShodanResult | null>(null)
  const [error, setError] = useState('')

  async function handleLookup() {
    setLoading(true)
    setError('')
    setResult(null)
    
    try {
      const data = await apiPost<ShodanResult>('/shodan', { ip })
      setResult(data)
    } catch (e) {
      if (e instanceof ApiError) {
        setError(`Error ${e.status}: ${formatJson(e.body)}`)
      } else {
        setError(String(e))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shodan</h1>
        <p className="text-gray-400 mt-1">
          Internet-connected device search and vulnerability scan
        </p>
      </div>

      <RemoteDisclosure 
        sends={['IP address or hostname']} 
        notes="Requires Shodan API key. Shows exposed ports, services, and known vulnerabilities. Hostnames are automatically resolved to IP addresses."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">IP Address or Hostname</label>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="8.8.8.8 or example.com"
              className="input font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter an IP address or hostname (will be resolved automatically)
            </p>
          </div>
          <button onClick={handleLookup} disabled={loading || !ip} className="btn btn-primary w-full">
            {loading ? 'Searching...' : 'Search Shodan'}
          </button>
        </div>

        <div className="space-y-4">
          {result && (
            <>
              {/* Add to Report Button */}
              <div className="flex items-center justify-end">
                <AddToReportButton
                  toolId="shodan"
                  input={ip}
                  data={result}
                  category="Threat Intelligence"
                />
              </div>
              <div className="card p-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Organization</div>
                    <div className="font-medium">{result.org}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">ISP</div>
                    <div className="font-medium">{result.isp}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Location</div>
                    <div className="font-medium">{result.city}, {result.country}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">ASN</div>
                    <div className="font-medium font-mono">{result.asn}</div>
                  </div>
                </div>
                
                {result.hostnames.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm text-gray-500 mb-1">Hostnames</div>
                    <div className="flex flex-wrap gap-1">
                      {result.hostnames.map((h, i) => (
                        <span key={i} className="px-2 py-0.5 bg-[#21262d] rounded text-xs">{h}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {result.ports.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-medium mb-2">Open Ports ({result.ports.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.ports.map(p => (
                      <span key={p} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm font-mono">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.vulns.length > 0 && (
                <div className="card p-4 border-l-4 border-red-500">
                  <h3 className="font-medium mb-2 text-red-400">Vulnerabilities ({result.vulns.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.vulns.map(v => (
                      <a
                        key={v}
                        href={`https://nvd.nist.gov/vuln/detail/${v}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-mono hover:underline"
                      >
                        {v}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {result.services.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-medium mb-2">Services</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {result.services.map((s, i) => (
                      <div key={i} className="p-2 bg-[#161b22] rounded text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-blue-400">{s.port}/{s.transport}</span>
                          {s.product && <span className="text-gray-300">{s.product} {s.version}</span>}
                        </div>
                        {s.banner && (
                          <pre className="text-xs text-gray-500 mt-1 overflow-x-auto">{s.banner.substring(0, 200)}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <JsonViewer title="Full Response" json={result} error={error} />
        </div>
      </div>
    </div>
  )
}

