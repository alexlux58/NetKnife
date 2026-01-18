/**
 * ==============================================================================
 * NETKNIFE - SECURITYTRAILS TOOL
 * ==============================================================================
 */

import { useState } from 'react'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'

interface StResult {
  domain: string
  currentDns: {
    a: { ip: string }[]
    aaaa: { ip: string }[]
    mx: { hostname: string; priority: number }[]
    ns: { nameserver: string }[]
    txt: { value: string }[]
  }
  alexaRank?: number
  hostProvider?: string[]
  mailProvider?: string[]
  subdomainCount: number
  subdomains: string[]
}

export default function SecurityTrailsTool() {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<StResult | null>(null)
  const [error, setError] = useState('')

  async function handleLookup() {
    setLoading(true)
    setError('')
    setResult(null)
    
    try {
      const data = await apiPost<StResult>('/security-trails', { domain })
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
        <h1 className="text-2xl font-bold">SecurityTrails</h1>
        <p className="text-gray-400 mt-1">
          Domain intelligence, DNS history, and subdomain enumeration
        </p>
      </div>

      <RemoteDisclosure 
        sends={['Domain name']} 
        notes="Requires SecurityTrails API key. Shows current DNS, subdomains, and host providers."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="input"
            />
          </div>
          <button onClick={handleLookup} disabled={loading || !domain} className="btn btn-primary w-full">
            {loading ? 'Looking up...' : 'Lookup Domain'}
          </button>
        </div>

        <div className="space-y-4">
          {result && (
            <>
              {/* Add to Report Button */}
              <div className="flex items-center justify-end">
                <AddToReportButton
                  toolId="security-trails"
                  input={domain}
                  data={result}
                  category="Email Security"
                />
              </div>
              <div className="card p-6">
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <div className="text-gray-500">Subdomains Found</div>
                    <div className="text-2xl font-bold text-blue-400">{result.subdomainCount}</div>
                  </div>
                  {result.alexaRank && (
                    <div>
                      <div className="text-gray-500">Alexa Rank</div>
                      <div className="text-2xl font-bold">#{result.alexaRank.toLocaleString()}</div>
                    </div>
                  )}
                </div>
                
                {result.hostProvider && result.hostProvider.length > 0 && (
                  <div className="mb-2">
                    <div className="text-sm text-gray-500">Host Provider</div>
                    <div>{result.hostProvider.join(', ')}</div>
                  </div>
                )}
                
                {result.mailProvider && result.mailProvider.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-500">Mail Provider</div>
                    <div>{result.mailProvider.join(', ')}</div>
                  </div>
                )}
              </div>

              {result.currentDns && (
                <div className="card p-4">
                  <h3 className="font-medium mb-3">Current DNS Records</h3>
                  <div className="space-y-3 text-sm">
                    {result.currentDns.a.length > 0 && (
                      <div>
                        <span className="text-blue-400">A: </span>
                        <span className="font-mono">{result.currentDns.a.map(r => r.ip).join(', ')}</span>
                      </div>
                    )}
                    {result.currentDns.aaaa.length > 0 && (
                      <div>
                        <span className="text-purple-400">AAAA: </span>
                        <span className="font-mono">{result.currentDns.aaaa.map(r => r.ip).join(', ')}</span>
                      </div>
                    )}
                    {result.currentDns.ns.length > 0 && (
                      <div>
                        <span className="text-green-400">NS: </span>
                        <span className="font-mono">{result.currentDns.ns.map(r => r.nameserver).join(', ')}</span>
                      </div>
                    )}
                    {result.currentDns.mx.length > 0 && (
                      <div>
                        <span className="text-yellow-400">MX: </span>
                        <span className="font-mono">{result.currentDns.mx.map(r => `${r.priority} ${r.hostname}`).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {result.subdomains.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-medium mb-2">Subdomains (first 50)</h3>
                  <div className="flex flex-wrap gap-1 max-h-[200px] overflow-y-auto">
                    {result.subdomains.map((sub, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[#21262d] rounded text-xs font-mono">
                        {sub}.{result.domain}
                      </span>
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

