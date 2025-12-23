/**
 * ==============================================================================
 * NETKNIFE - CENSYS TOOL
 * ==============================================================================
 */

import { useState } from 'react'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'

interface CensysResult {
  ip: string
  lastUpdated: string
  location: {
    city: string
    country: string
    countryCode: string
  }
  autonomousSystem: {
    asn: number
    name: string
    description: string
  }
  operatingSystem?: {
    product: string
    vendor: string
    version: string
  }
  services: {
    port: number
    serviceName: string
    transportProtocol: string
    certificate?: {
      fingerprint: string
      issuer: string
      subject: string
    }
    software?: { vendor: string; product: string; version: string }[]
  }[]
  labels: string[]
}

export default function CensysTool() {
  const [ip, setIp] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CensysResult | null>(null)
  const [error, setError] = useState('')

  async function handleLookup() {
    setLoading(true)
    setError('')
    setResult(null)
    
    try {
      const data = await apiPost<CensysResult>('/censys', { ip })
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
        <h1 className="text-2xl font-bold">Censys</h1>
        <p className="text-gray-400 mt-1">
          Internet-wide scanning and host discovery
        </p>
      </div>

      <RemoteDisclosure 
        sends={['IP address']} 
        notes="Requires Censys API ID and Secret. Shows services, certificates, and OS detection."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">IP Address</label>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="8.8.8.8"
              className="input font-mono"
            />
          </div>
          <button onClick={handleLookup} disabled={loading || !ip} className="btn btn-primary w-full">
            {loading ? 'Searching...' : 'Search Censys'}
          </button>
        </div>

        <div className="space-y-4">
          {result && (
            <>
              <div className="card p-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Location</div>
                    <div className="font-medium">{result.location.city}, {result.location.country}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">ASN</div>
                    <div className="font-medium font-mono">AS{result.autonomousSystem.asn}</div>
                    <div className="text-xs text-gray-500">{result.autonomousSystem.name}</div>
                  </div>
                  {result.operatingSystem && (
                    <div className="col-span-2">
                      <div className="text-gray-500">Operating System</div>
                      <div className="font-medium">
                        {result.operatingSystem.vendor} {result.operatingSystem.product} {result.operatingSystem.version}
                      </div>
                    </div>
                  )}
                </div>
                
                {result.labels.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm text-gray-500 mb-1">Labels</div>
                    <div className="flex flex-wrap gap-1">
                      {result.labels.map((l, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">{l}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {result.services.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-medium mb-2">Services ({result.services.length})</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {result.services.map((s, i) => (
                      <div key={i} className="p-2 bg-[#161b22] rounded text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-blue-400">{s.port}/{s.transportProtocol}</span>
                          <span className="text-gray-300">{s.serviceName}</span>
                        </div>
                        {s.software && s.software.length > 0 && (
                          <div className="text-xs text-gray-500">
                            {s.software.map(sw => `${sw.vendor} ${sw.product} ${sw.version}`).join(', ')}
                          </div>
                        )}
                        {s.certificate && (
                          <div className="text-xs text-emerald-400 mt-1">
                            🔒 {s.certificate.subject}
                          </div>
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

