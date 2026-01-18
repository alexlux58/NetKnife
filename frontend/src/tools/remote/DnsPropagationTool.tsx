/**
 * ==============================================================================
 * NETKNIFE - DNS PROPAGATION TOOL
 * ==============================================================================
 */

import { useState } from 'react'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'

interface ResolverResult {
  resolver: string
  ip: string
  location: string
  answers?: { name: string; type: number; TTL: number; data: string }[]
  ttl?: number
  error?: string
}

interface PropagationResult {
  name: string
  type: string
  results: ResolverResult[]
  consistent: boolean
  checkedAt: string
}

export default function DnsPropagationTool() {
  const [name, setName] = useState('example.com')
  const [type, setType] = useState('A')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PropagationResult | null>(null)
  const [error, setError] = useState('')

  async function handleCheck() {
    setLoading(true)
    setError('')
    setResult(null)
    
    try {
      const data = await apiPost<PropagationResult>('/dns-propagation', { name, type })
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
        <h1 className="text-2xl font-bold">DNS Propagation Checker</h1>
        <p className="text-gray-400 mt-1">
          Check if DNS changes have propagated across global resolvers
        </p>
      </div>

      <RemoteDisclosure sends={['Domain name', 'Record type']} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Domain Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="example.com"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Record Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <button onClick={handleCheck} disabled={loading || !name} className="btn btn-primary w-full">
            {loading ? 'Checking...' : 'Check Propagation'}
          </button>
        </div>

        <div className="space-y-4">
          {result && (
            <div className={`card p-4 border-l-4 ${result.consistent ? 'border-emerald-500' : 'border-yellow-500'}`}>
              <div className="text-lg font-bold">
                {result.consistent ? '✓ Fully Propagated' : '⚠ Inconsistent Results'}
              </div>
              <p className="text-sm text-gray-400">
                {result.consistent 
                  ? 'All resolvers return the same records'
                  : 'Different resolvers are returning different results'}
              </p>
            </div>
          )}
          
          {result && (
            <div className="card p-4">
              <h3 className="font-medium mb-3">Resolver Results</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {result.results.map((r, i) => (
                  <div key={i} className={`p-3 rounded ${r.error ? 'bg-red-500/10' : 'bg-[#161b22]'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-blue-400">{r.resolver}</span>
                      <span className="text-xs text-gray-500">{r.location}</span>
                    </div>
                    {r.error ? (
                      <span className="text-red-400 text-sm">{r.error}</span>
                    ) : r.answers && r.answers.length > 0 ? (
                      <div className="text-sm font-mono text-gray-300">
                        {r.answers.map((a, j) => (
                          <div key={j}>{a.data} (TTL: {a.TTL})</div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">No records</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <JsonViewer title="Raw Response" json={result} error={error} />
          
          {result && (
            <div className="flex items-center justify-end">
              <AddToReportButton
                toolId="dns-propagation"
                input={`${name} (${type})`}
                data={result}
                category="DNS & Domain"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

