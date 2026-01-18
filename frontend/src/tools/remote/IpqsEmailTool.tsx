/**
 * ==============================================================================
 * NETKNIFE - IPQUALITYSCORE EMAIL VERIFICATION TOOL
 * ==============================================================================
 * 
 * Email verification and validation using IPQualityScore.
 * ==============================================================================
 */

import { useState } from 'react'
import { apiClient } from '../../lib/api'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'
import RemoteDisclosure from '../../components/RemoteDisclosure'

interface IPQSEmailResult {
  success?: boolean
  valid: boolean
  disposable?: boolean
  smtp_score?: number
  overall_score?: number
  first_name?: string
  deliverability?: string
  catch_all?: boolean
  common?: boolean
  dns_valid?: boolean
  honeypot?: boolean
  recent_abuse?: boolean
  spamtrap_score?: string
  message?: string
  cached?: boolean
}

export default function IpqsEmailTool() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<IPQSEmailResult | null>(null)
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
      const data = await apiClient.post<IPQSEmailResult>('/ipqs-email', { email })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to verify email')
    } finally {
      setLoading(false)
    }
  }

  function getScoreColor(score: number) {
    if (score < 25) return 'text-green-400'
    if (score < 75) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="space-y-6">
      <RemoteDisclosure sends={['email address']} />

      <div>
        <label className="block text-sm font-medium mb-2">Email Address</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
            placeholder="test@example.com"
            className="input flex-1 font-mono"
          />
          <button
            onClick={handleCheck}
            disabled={loading || !email}
            className="btn-primary"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </div>
      </div>

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
              toolId="ipqs-email"
              input={email}
              data={result}
              category="Threat Intelligence"
            />
          </div>
          <OutputCard title="Email Validation" canCopy={true}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Valid:</span>
                <span className={result.valid ? 'text-green-400' : 'text-red-400'}>
                  {result.valid ? 'Yes' : 'No'}
                </span>
              </div>
              {result.deliverability && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Deliverability:</span>
                  <span className="text-sm capitalize">{result.deliverability}</span>
                </div>
              )}
              {result.overall_score !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Overall Score:</span>
                  <span className={`font-medium ${getScoreColor(result.overall_score)}`}>
                    {result.overall_score}/100
                  </span>
                </div>
              )}
              {result.smtp_score !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">SMTP Score:</span>
                  <span className={`font-medium ${getScoreColor(result.smtp_score)}`}>
                    {result.smtp_score}/100
                  </span>
                </div>
              )}
              {result.dns_valid !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">DNS Valid:</span>
                  <span className={result.dns_valid ? 'text-green-400' : 'text-red-400'}>
                    {result.dns_valid ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
            </div>
          </OutputCard>

          <OutputCard title="Risk Indicators" canCopy={true}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Disposable Email:</span>
                <span className={result.disposable ? 'text-red-400' : 'text-green-400'}>
                  {result.disposable ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Catch-All Domain:</span>
                <span className={result.catch_all ? 'text-yellow-400' : 'text-green-400'}>
                  {result.catch_all ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Honeypot/Spamtrap:</span>
                <span className={result.honeypot ? 'text-red-400' : 'text-green-400'}>
                  {result.honeypot ? 'Yes' : 'No'}
                </span>
              </div>
              {result.recent_abuse && (
                <div className="mt-3 p-2 bg-red-950/20 border border-red-900/50 rounded">
                  <p className="text-red-400 text-xs">Recent abuse detected</p>
                </div>
              )}
              {result.spamtrap_score && result.spamtrap_score !== 'none' && (
                <div className="mt-3 p-2 bg-yellow-950/20 border border-yellow-900/50 rounded">
                  <p className="text-yellow-400 text-xs">
                    Spamtrap Score: {result.spamtrap_score}
                  </p>
                </div>
              )}
            </div>
          </OutputCard>

          {result.first_name && (
            <OutputCard title="Additional Info" canCopy={true}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">First Name:</span>
                  <span className="text-sm">{result.first_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Common Email:</span>
                  <span className={result.common ? 'text-yellow-400' : 'text-green-400'}>
                    {result.common ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </OutputCard>
          )}
        </div>
      )}

      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">About IPQualityScore Email Verification</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• Free tier: 1,000 requests/month</li>
          <li>• Validates email syntax, domain, and MX records</li>
          <li>• Detects disposable emails and spamtraps</li>
          <li>• Scores: 0-100 (lower is better)</li>
          <li>• Uses fast mode (skips SMTP check for speed)</li>
        </ul>
      </div>
    </div>
  )
}
