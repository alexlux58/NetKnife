/**
 * ==============================================================================
 * NETKNIFE - RDAP LOOKUP TOOL
 * ==============================================================================
 * 
 * Performs RDAP (Registration Data Access Protocol) lookups.
 * RDAP is the modern, JSON-based replacement for WHOIS.
 * 
 * FEATURES:
 * - IP address lookups (v4 and v6)
 * - Domain lookups
 * - ASN information
 * - Structured JSON output
 * 
 * NOTE: This is a REMOTE tool - queries go through AWS to RDAP servers.
 * ==============================================================================
 */

import { useState } from 'react'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'

interface RdapResult {
  query: string
  rdap_url?: string
  status?: number
  data?: Record<string, unknown>
  cached?: boolean
}

export default function RdapTool() {
  const [query, setQuery] = useState('8.8.8.8')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RdapResult | null>(null)
  const [error, setError] = useState('')

  async function handleLookup() {
    setLoading(true)
    setError('')
    setResult(null)
    
    try {
      const res = await apiPost('/rdap', { query }) as RdapResult
      setResult(res)
    } catch (e) {
      if (e instanceof ApiError) {
        setError(`Error ${e.status}: ${JSON.stringify(e.body, null, 2)}`)
      } else {
        setError(String(e))
      }
    } finally {
      setLoading(false)
    }
  }

  const examples = [
    { label: 'Google DNS', value: '8.8.8.8' },
    { label: 'Cloudflare', value: '1.1.1.1' },
    { label: 'example.com', value: 'example.com' },
  ]

  return (
    <div className="space-y-6">
      {/* Remote disclosure */}
      <RemoteDisclosure
        sends={['IP address or domain name']}
        notes="Results cached for 24 hours. Uses rdap.org bootstrap aggregator."
      />

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input section */}
        <div className="space-y-4">
          {/* Query input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              IP Address or Domain
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="8.8.8.8 or example.com"
              className="input font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Supports IPv4, IPv6, and domain names
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleLookup}
              disabled={loading || !query}
              className="btn-primary"
            >
              {loading ? 'Looking up...' : 'Lookup'}
            </button>
          </div>

          {/* Examples */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Examples</label>
            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  key={ex.value}
                  onClick={() => setQuery(ex.value)}
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

          {/* Info card */}
          <div className="card p-4 text-sm">
            <h4 className="font-medium mb-2">What is RDAP?</h4>
            <p className="text-gray-400">
              RDAP (Registration Data Access Protocol) is the modern replacement 
              for WHOIS. It returns structured JSON data about IP allocations, 
              domain registrations, and ASN assignments.
            </p>
          </div>
        </div>

        {/* Output section */}
        <div className="space-y-4">
          {result && (
            <>
              {/* Add to Report Button */}
              <div className="flex items-center justify-end">
                <AddToReportButton
                  toolId="rdap"
                  input={query}
                  data={result}
                  category="DNS & Domain"
                />
              </div>
              {/* Summary card */}
              <div className="card p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Query:</span>
                    <span className="ml-2 font-mono">{result.query}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <span className={`ml-2 ${result.status === 200 ? 'text-green-400' : 'text-red-400'}`}>
                      {result.status}
                    </span>
                  </div>
                  {result.rdap_url && (
                    <div className="col-span-2">
                      <span className="text-gray-500">RDAP Server:</span>
                      <a 
                        href={result.rdap_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-400 hover:underline text-xs break-all"
                      >
                        {result.rdap_url}
                      </a>
                    </div>
                  )}
                  {result.cached && (
                    <div className="col-span-2">
                      <span className="badge text-gray-500">Cached result</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Full JSON result */}
              <JsonViewer data={result.data || result} title="RDAP Response" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

