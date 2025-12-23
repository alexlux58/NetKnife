/**
 * ==============================================================================
 * NETKNIFE - PEERINGDB QUERY TOOL
 * ==============================================================================
 * 
 * Queries PeeringDB for network and interconnection information.
 * 
 * PEERINGDB RESOURCES:
 * - net: Networks (ASN info, peering policy)
 * - org: Organizations
 * - ix: Internet Exchanges
 * - fac: Facilities (data centers)
 * 
 * FEATURES:
 * - ASN lookup
 * - Name search
 * - Cached results (1 hour)
 * 
 * NOTE: This is a REMOTE tool - queries go through AWS to PeeringDB API.
 * ==============================================================================
 */

import { useState } from 'react'
import OutputCard from '../../components/OutputCard'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'

const RESOURCES = ['net', 'org', 'ix', 'fac'] as const

export default function PeeringDbTool() {
  const [resource, setResource] = useState<typeof RESOURCES[number]>('net')
  const [asn, setAsn] = useState('13335')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')

  async function handleQuery() {
    setLoading(true)
    setError('')
    
    try {
      const body: Record<string, string> = { resource }
      if (asn) body.asn = asn
      if (name) body.name = name
      
      const result = await apiPost('/peeringdb', body)
      setOutput(formatJson(result))
    } catch (e) {
      if (e instanceof ApiError) {
        setError(`Error ${e.status}: ${formatJson(e.body)}`)
      } else {
        setError(String(e))
      }
      setOutput('')
    } finally {
      setLoading(false)
    }
  }

  const examples = [
    { label: 'Cloudflare (AS13335)', asn: '13335', resource: 'net' as const },
    { label: 'Google (AS15169)', asn: '15169', resource: 'net' as const },
    { label: 'DE-CIX Frankfurt', asn: '', name: 'DE-CIX Frankfurt', resource: 'ix' as const },
  ]

  function loadExample(ex: typeof examples[0]) {
    setResource(ex.resource)
    setAsn(ex.asn)
    setName(ex.name || '')
  }

  return (
    <div className="space-y-6">
      {/* Remote disclosure */}
      <RemoteDisclosure
        sends={['Resource type', 'ASN or name query']}
        notes="Results cached for 1 hour. Anonymous API has 20 req/min limit."
      />

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input section */}
        <div className="space-y-4">
          {/* Resource type */}
          <div>
            <label className="block text-sm font-medium mb-2">Resource Type</label>
            <div className="flex gap-2">
              {RESOURCES.map((r) => (
                <button
                  key={r}
                  onClick={() => setResource(r)}
                  className={resource === r ? 'btn-primary py-1 px-3' : 'btn-secondary py-1 px-3'}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              net=Networks, org=Organizations, ix=Exchanges, fac=Facilities
            </p>
          </div>

          {/* ASN input */}
          <div>
            <label className="block text-sm font-medium mb-2">ASN (for net lookups)</label>
            <input
              type="text"
              value={asn}
              onChange={(e) => setAsn(e.target.value)}
              placeholder="13335"
              className="input font-mono w-40"
            />
          </div>

          {/* Name search */}
          <div>
            <label className="block text-sm font-medium mb-2">Name Search (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cloudflare"
              className="input"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleQuery}
              disabled={loading || (!asn && !name)}
              className="btn-primary"
            >
              {loading ? 'Querying...' : 'Query PeeringDB'}
            </button>
          </div>

          {/* Examples */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Examples</label>
            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => loadExample(ex)}
                  className="btn-secondary text-xs py-1 px-2"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="card bg-red-950/30 border-red-900/50 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Info */}
          <div className="card p-4 text-sm">
            <h4 className="font-medium mb-2">What is PeeringDB?</h4>
            <p className="text-gray-400">
              PeeringDB is a freely available database of networks, facilities, 
              and interconnection data maintained by the Internet peering community.
              It's used for peering coordination and network planning.
            </p>
          </div>
        </div>

        {/* Output section */}
        <OutputCard title="PeeringDB Result" value={output} />
      </div>
    </div>
  )
}

