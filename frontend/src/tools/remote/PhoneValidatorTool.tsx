/**
 * ==============================================================================
 * NETKNIFE - PHONE NUMBER VALIDATOR TOOL
 * ==============================================================================
 * 
 * Validate phone numbers using NumLookup free API.
 * ==============================================================================
 */

import { useState } from 'react'
import { apiClient } from '../../lib/api'
import OutputCard from '../../components/OutputCard'
import AddToReportButton from '../../components/AddToReportButton'
import RemoteDisclosure from '../../components/RemoteDisclosure'

interface PhoneResult {
  valid: boolean
  number: string
  country?: string
  country_code?: string
  carrier?: string
  line_type?: string
  cached?: boolean
}

export default function PhoneValidatorTool() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PhoneResult | null>(null)
  const [error, setError] = useState('')

  async function handleValidate() {
    if (!phone) {
      setError('Please enter a phone number')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await apiClient.post<PhoneResult>('/phone-validator', { phone })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to validate phone number')
    } finally {
      setLoading(false)
    }
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
            onKeyPress={(e) => e.key === 'Enter' && handleValidate()}
            placeholder="+1234567890, (123) 456-7890, or 1234567890"
            className="input flex-1 font-mono"
          />
          <button
            onClick={handleValidate}
            disabled={loading || !phone}
            className="btn-primary"
          >
            {loading ? 'Validating...' : 'Validate'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card bg-red-950/20 border-red-900/50 p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <>
          <OutputCard title="Phone Validation Results" canCopy={true}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Number:</span>
                <span className="font-mono text-sm">{result.number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Valid:</span>
                <span className={result.valid ? 'text-green-400' : 'text-red-400'}>
                  {result.valid ? 'Yes' : 'No'}
                </span>
              </div>
              {result.country && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Country:</span>
                  <span className="text-sm">{result.country} {result.country_code && `(${result.country_code})`}</span>
                </div>
              )}
              {result.carrier && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Carrier:</span>
                  <span className="text-sm">{result.carrier}</span>
                </div>
              )}
              {result.line_type && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Line Type:</span>
                  <span className="text-sm capitalize">{result.line_type}</span>
                </div>
              )}
            </div>
          </OutputCard>
          <div className="flex items-center justify-end mt-2">
            <AddToReportButton
              toolId="phone-validator"
              input={phone}
              data={result}
              category="Threat Intelligence"
            />
          </div>
        </>
      )}

      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">About NumLookup</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• Free tier available</li>
          <li>• Validates phone numbers and detects carriers</li>
          <li>• Identifies line type (mobile, landline, VoIP)</li>
          <li>• Auto-adds US country code (+1) for 10-digit numbers</li>
        </ul>
        <p className="text-amber-400 text-xs mt-3">
          💡 Tip: For better results, try the IPQualityScore Phone Validation tool which may have more comprehensive coverage.
        </p>
      </div>
    </div>
  )
}
