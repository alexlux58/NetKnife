/**
 * ==============================================================================
 * NETKNIFE - IPQUALITYSCORE PHONE VALIDATION TOOL
 * ==============================================================================
 * 
 * Phone number validation and reputation using IPQualityScore.
 * ==============================================================================
 */

import { useState } from 'react'
import { apiClient } from '../../lib/api'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'
import RemoteDisclosure from '../../components/RemoteDisclosure'

interface IPQSPhoneResult {
  success?: boolean
  valid: boolean
  active?: boolean | null
  formatted?: string
  local_format?: string
  country_code?: string
  line_type?: string
  carrier?: string
  risky?: boolean
  recent_abuse?: boolean
  fraud_score?: number
  message?: string
  cached?: boolean
}

export default function IpqsPhoneTool() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<IPQSPhoneResult | null>(null)
  const [error, setError] = useState('')

  async function handleCheck() {
    if (!phone) {
      setError('Please enter a phone number')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await apiClient.post<IPQSPhoneResult>('/ipqs-phone', { phone })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to validate phone')
    } finally {
      setLoading(false)
    }
  }

  function getFraudScoreColor(score: number) {
    if (score < 25) return 'text-green-400'
    if (score < 75) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="space-y-6">
      <RemoteDisclosure sends={['phone number']} />

      <div>
        <label className="block text-sm font-medium mb-2">Phone Number</label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
            placeholder="+1234567890 or (123) 456-7890"
            className="input flex-1 font-mono"
          />
          <button
            onClick={handleCheck}
            disabled={loading || !phone}
            className="btn-primary"
          >
            {loading ? 'Validating...' : 'Validate Phone'}
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
              toolId="ipqs-phone"
              input={phone}
              data={result}
              category="Threat Intelligence"
            />
          </div>
          <OutputCard title="Phone Validation" canCopy={true}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Valid:</span>
                <span className={result.valid ? 'text-green-400' : 'text-red-400'}>
                  {result.valid ? 'Yes' : 'No'}
                </span>
              </div>
              {result.active != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Active (in service):</span>
                  <span className={result.active ? 'text-green-400' : 'text-amber-400'}>
                    {result.active ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
              {result.message && (
                <div className="pt-2 border-t border-[var(--color-border)]">
                  <span className="text-sm text-gray-400">Reason: </span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{result.message}</span>
                </div>
              )}
              {result.formatted && result.formatted !== 'N/A' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Formatted:</span>
                  <span className="text-sm font-mono">{result.formatted}</span>
                </div>
              )}
              {result.local_format && result.local_format !== 'N/A' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Local Format:</span>
                  <span className="text-sm">{result.local_format}</span>
                </div>
              )}
              {result.country_code && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Country:</span>
                  <span className="text-sm">{result.country_code}</span>
                </div>
              )}
              {result.line_type && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Line Type:</span>
                  <span className="text-sm capitalize">{result.line_type}</span>
                </div>
              )}
              {result.carrier && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Carrier:</span>
                  <span className="text-sm">{result.carrier}</span>
                </div>
              )}
            </div>
          </OutputCard>

          {result.fraud_score !== undefined && (
            <OutputCard title="Risk Assessment" canCopy={true}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Fraud Score:</span>
                  <span className={`font-medium ${getFraudScoreColor(result.fraud_score)}`}>
                    {result.fraud_score}/100
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Risky:</span>
                  <span className={result.risky ? 'text-red-400' : 'text-green-400'}>
                    {result.risky ? 'Yes' : 'No'}
                  </span>
                </div>
                {result.recent_abuse && (
                  <div className="mt-3 p-2 bg-red-950/20 border border-red-900/50 rounded">
                    <p className="text-red-400 text-xs">Recent abuse detected</p>
                  </div>
                )}
              </div>
            </OutputCard>
          )}
        </div>
      )}

      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">About IPQualityScore Phone Validation</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• Free tier: 1,000 requests/month</li>
          <li>• Validates phone format and carrier information</li>
          <li>• Detects risky numbers and recent abuse</li>
          <li>• Fraud score: 0-100 (lower is better)</li>
          <li>• Supports international formats</li>
        </ul>
      </div>
    </div>
  )
}
