/**
 * ==============================================================================
 * NETKNIFE - BREACHDIRECTORY EMAIL BREACH CHECK TOOL
 * ==============================================================================
 * 
 * Check if an email has been compromised in data breaches.
 * 
 * ⚠️ NOTE: BreachDirectory.tk (free API) is currently offline.
 * This tool may not work. Consider using the HIBP (Password Breach) tool instead,
 * which provides similar functionality and is actively maintained.
 * 
 * FEATURES:
 * - Email breach lookup
 * - Free API (no key required) - NOTE: Service may be offline
 * - Lists breach sources
 * ==============================================================================
 */

import { useState } from 'react'
import { apiClient } from '../../lib/api'
import OutputCard from '../../components/OutputCard'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import AddToReportButton from '../../components/AddToReportButton'

interface BreachDirectoryResult {
  email: string
  found: boolean
  breaches: string[]
  count: number
  cached?: boolean
}

export default function BreachDirectoryTool() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BreachDirectoryResult | null>(null)
  const [error, setError] = useState('')

  async function handleCheck() {
    if (!email) {
      setError('Please enter an email address')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await apiClient.post('/breachdirectory', { email })

      setResult(data as BreachDirectoryResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check breaches')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <RemoteDisclosure sends={['email address']} />

      {/* Input */}
      <div>
        <label className="block text-sm font-medium mb-2">Email Address</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
            placeholder="user@example.com"
            className="input flex-1"
          />
          <button
            onClick={handleCheck}
            disabled={loading || !email}
            className="btn-primary"
          >
            {loading ? 'Checking...' : 'Check Breaches'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card bg-red-950/20 border-red-900/50 p-3">
          <p className="text-red-400 text-sm">{error}</p>
          {error.includes('offline') && (
            <div className="mt-2 p-2 bg-amber-950/20 border-amber-900/50 rounded text-xs">
              <p className="text-amber-300 mb-1">
                <strong>Service Unavailable:</strong> BreachDirectory.tk is offline.
              </p>
              <p className="text-amber-400">
                💡 <strong>Alternative:</strong> Use the <strong>Password Breach (HIBP)</strong> tool instead - it provides similar functionality and is actively maintained.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="breachdirectory"
              input={email}
              data={result}
              category="Email Intelligence"
            />
          </div>
          <OutputCard
            title="Breach Check Results"
            canCopy={true}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Email:</span>
                <span className="font-mono text-sm">{result.email}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Found in Breaches:</span>
                <span className={result.found ? 'text-red-400 font-medium' : 'text-green-400 font-medium'}>
                  {result.found ? `Yes (${result.count} breach${result.count !== 1 ? 'es' : ''})` : 'No'}
                </span>
              </div>
              
              {result.found && result.breaches.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-sm text-gray-400 mb-2">Breach Sources:</p>
                  <div className="space-y-1">
                    {result.breaches.map((breach, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-red-400">●</span>
                        <span className="text-sm">{breach}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {!result.found && (
                <div className="mt-4 p-3 bg-green-950/20 border border-green-900/50 rounded">
                  <p className="text-green-400 text-sm">
                    ✓ This email was not found in known data breaches.
                  </p>
                </div>
              )}
            </div>
          </OutputCard>
          
          {result.cached && (
            <p className="text-xs text-gray-500 text-center">(Cached result)</p>
          )}
        </div>
      )}

      {/* Info */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">About BreachDirectory</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• Free API (no key required)</li>
          <li>• Checks email against known data breaches</li>
          <li>• Lists all breach sources where email was found</li>
          <li>• Alternative to HIBP for breach checking</li>
        </ul>
        <p className="text-amber-400 text-xs mt-3">
          ⚠️ If your email appears in breaches, change your passwords immediately.
        </p>
      </div>
    </div>
  )
}
