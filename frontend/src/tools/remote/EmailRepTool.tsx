/**
 * ==============================================================================
 * NETKNIFE - EMAILREP.IO EMAIL REPUTATION TOOL
 * ==============================================================================
 * 
 * Check email reputation using EmailRep.io free API.
 * 
 * FEATURES:
 * - Email reputation scoring
 * - Suspicious activity detection
 * - Domain reputation
 * - Free tier: 10,000 queries/month
 * ==============================================================================
 */

import { useState } from 'react'
import { apiClient } from '../../lib/api'
import OutputCard from '../../components/OutputCard'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import AddToReportButton from '../../components/AddToReportButton'

interface EmailRepResult {
  email: string
  reputation: string
  suspicious: boolean
  references: number
  details: {
    blacklisted: boolean
    malicious_activity: boolean
    malicious_activity_recent: boolean
    credentials_leaked: boolean
    credentials_leaked_recent: boolean
    data_breach: boolean
    first_seen: string
    last_seen: string
    domain_exists: boolean
    domain_reputation: string
    new_domain: boolean
    days_since_domain_creation: number
    suspicious_tld: boolean
    spam: boolean
    free_provider: boolean
    disposable: boolean
    deliverable: boolean
    accept_all: boolean
    valid_mx: boolean
    primary_mx: string
    spoofable: boolean
    spf_strict: boolean
    dmarc_enforced: boolean
    profiles: string[]
  }
  cached?: boolean
}

export default function EmailRepTool() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EmailRepResult | null>(null)
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
      const data = await apiClient.post('/emailrep', { email })

      setResult(data as EmailRepResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check email reputation')
    } finally {
      setLoading(false)
    }
  }

  function getReputationColor(reputation: string) {
    switch (reputation?.toLowerCase()) {
      case 'high':
        return 'text-green-400'
      case 'medium':
        return 'text-yellow-400'
      case 'low':
        return 'text-red-400'
      default:
        return 'text-gray-400'
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
            {loading ? 'Checking...' : 'Check Reputation'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card bg-red-950/20 border-red-900/50 p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="emailrep"
              input={email}
              data={result}
              category="Email Intelligence"
            />
          </div>
          <OutputCard
            title="Email Reputation"
            canCopy={true}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Email:</span>
                <span className="font-mono text-sm">{result.email}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Reputation:</span>
                <span className={`font-medium ${getReputationColor(result.reputation)}`}>
                  {result.reputation?.toUpperCase() || 'Unknown'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Suspicious:</span>
                <span className={result.suspicious ? 'text-red-400' : 'text-green-400'}>
                  {result.suspicious ? 'Yes' : 'No'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">References:</span>
                <span className="text-sm">{result.references || 0}</span>
              </div>
            </div>
          </OutputCard>

          {result.details && (
            <OutputCard
              title="Detailed Information"
              canCopy={true}
            >
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-400">Domain Exists:</span>
                    <span className={`ml-2 ${result.details.domain_exists ? 'text-green-400' : 'text-red-400'}`}>
                      {result.details.domain_exists ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Domain Reputation:</span>
                    <span className={`ml-2 ${getReputationColor(result.details.domain_reputation || '')}`}>
                      {result.details.domain_reputation || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Free Provider:</span>
                    <span className="ml-2">{result.details.free_provider ? 'Yes' : 'No'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Disposable:</span>
                    <span className={`ml-2 ${result.details.disposable ? 'text-red-400' : 'text-green-400'}`}>
                      {result.details.disposable ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Deliverable:</span>
                    <span className={`ml-2 ${result.details.deliverable ? 'text-green-400' : 'text-red-400'}`}>
                      {result.details.deliverable ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Spam:</span>
                    <span className={`ml-2 ${result.details.spam ? 'text-red-400' : 'text-green-400'}`}>
                      {result.details.spam ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                
                {result.details.credentials_leaked && (
                  <div className="mt-3 p-2 bg-red-950/20 border border-red-900/50 rounded">
                    <p className="text-red-400 text-xs font-medium">⚠️ Credentials Leaked</p>
                    {result.details.credentials_leaked_recent && (
                      <p className="text-red-300 text-xs mt-1">Recent leak detected</p>
                    )}
                  </div>
                )}
                
                {result.details.data_breach && (
                  <div className="mt-2 p-2 bg-amber-950/20 border border-amber-900/50 rounded">
                    <p className="text-amber-400 text-xs font-medium">⚠️ Data Breach Detected</p>
                  </div>
                )}
                
                {result.details.malicious_activity && (
                  <div className="mt-2 p-2 bg-red-950/20 border border-red-900/50 rounded">
                    <p className="text-red-400 text-xs font-medium">⚠️ Malicious Activity Detected</p>
                  </div>
                )}
                
                {result.details.profiles && result.details.profiles.length > 0 && (
                  <div className="mt-3">
                    <p className="text-gray-400 text-xs mb-1">Found on platforms:</p>
                    <div className="flex flex-wrap gap-1">
                      {result.details.profiles.map((profile, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-800 rounded text-xs">
                          {profile}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </OutputCard>
          )}
          
          {result.cached && (
            <p className="text-xs text-gray-500 text-center">(Cached result)</p>
          )}
        </div>
      )}

      {/* Info */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">About EmailRep.io</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• Free tier: 10,000 queries/month</li>
          <li>• Checks email reputation across multiple sources</li>
          <li>• Detects suspicious activity and data breaches</li>
          <li>• Validates email deliverability</li>
        </ul>
      </div>
    </div>
  )
}
