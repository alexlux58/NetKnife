/**
 * ==============================================================================
 * NETKNIFE - HUNTER.IO EMAIL VERIFICATION TOOL
 * ==============================================================================
 * 
 * Email verification and finder using Hunter.io free API.
 * ==============================================================================
 */

import { useState } from 'react'
import { apiClient } from '../../lib/api'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'
import RemoteDisclosure from '../../components/RemoteDisclosure'

interface HunterResult {
  data?: {
    email?: string
    result?: string
    score?: number
    sources?: Array<{ domain: string; uri: string }>
  }
  emails?: Array<{
    value: string
    type: string
    confidence: number
  }>
  cached?: boolean
}

export default function HunterTool() {
  const [email, setEmail] = useState('')
  const [domain, setDomain] = useState('')
  const [mode, setMode] = useState<'email' | 'domain'>('email')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<HunterResult | null>(null)
  const [error, setError] = useState('')

  async function handleCheck() {
    if (mode === 'email' && !email) {
      setError('Please enter an email address')
      return
    }
    if (mode === 'domain' && !domain) {
      setError('Please enter a domain')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await apiClient.post<HunterResult>('/hunter', 
        mode === 'email' ? { email } : { domain }
      )
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check')
    } finally {
      setLoading(false)
    }
  }

  function getResultColor(result?: string) {
    switch (result?.toLowerCase()) {
      case 'deliverable':
        return 'text-green-400'
      case 'undeliverable':
        return 'text-red-400'
      case 'risky':
        return 'text-yellow-400'
      default:
        return 'text-gray-400'
    }
  }

  return (
    <div className="space-y-6">
      <RemoteDisclosure sends={['email address']} />

      <div className="flex gap-2">
        <button
          onClick={() => setMode('email')}
          className={`px-4 py-2 rounded text-sm transition-colors ${
            mode === 'email'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Email Verification
        </button>
        <button
          onClick={() => setMode('domain')}
          className={`px-4 py-2 rounded text-sm transition-colors ${
            mode === 'domain'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Domain Search
        </button>
      </div>

      {mode === 'email' ? (
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
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-2">Domain</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
              placeholder="example.com"
              className="input flex-1"
            />
            <button
              onClick={handleCheck}
              disabled={loading || !domain}
              className="btn-primary"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="card bg-red-950/20 border-red-900/50 p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Add to Report Button */}
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="hunter"
              input={mode === 'email' ? email : domain}
              data={result}
              category="Email Security"
            />
          </div>
          {result.data?.email && (
            <OutputCard title="Email Verification" canCopy={true}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Email:</span>
                  <span className="font-mono text-sm">{result.data.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Result:</span>
                  <span className={`font-medium ${getResultColor(result.data.result)}`}>
                    {result.data.result || 'Unknown'}
                  </span>
                </div>
                {result.data.score !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Score:</span>
                    <span className="text-sm">{result.data.score}/100</span>
                  </div>
                )}
              </div>
            </OutputCard>
          )}

          {result.emails && result.emails.length > 0 && (
            <OutputCard title="Found Emails" canCopy={true}>
              <div className="space-y-2">
                {result.emails.map((email, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                    <span className="font-mono text-sm">{email.value}</span>
                    <div className="flex gap-2 text-xs text-gray-400">
                      <span>{email.type}</span>
                      <span>•</span>
                      <span>{email.confidence}% confidence</span>
                    </div>
                  </div>
                ))}
              </div>
            </OutputCard>
          )}
        </div>
      )}

      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">About Hunter.io</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• Free tier: 25 requests/month</li>
          <li>• Email verification and finder</li>
          <li>• Domain search for finding emails</li>
          <li>• Requires API key (free signup)</li>
        </ul>
      </div>
    </div>
  )
}
