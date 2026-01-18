/**
 * ==============================================================================
 * NETKNIFE - IPQUALITYSCORE IP REPUTATION TOOL
 * ==============================================================================
 * 
 * IP reputation and fraud detection using IPQualityScore.
 * ==============================================================================
 */

import { useState } from 'react'
import { apiClient } from '../../lib/api'
import OutputCard from '../../components/OutputCard'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import AddToReportButton from '../../components/AddToReportButton'

interface IPQSResult {
  success: boolean
  fraud_score: number
  country_code?: string
  region?: string
  city?: string
  ISP?: string
  organization?: string
  vpn?: boolean
  proxy?: boolean
  tor?: boolean
  bot?: boolean
  recent_abuse?: boolean
  cached?: boolean
}

export default function IpQualityScoreTool() {
  const [ip, setIp] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<IPQSResult | null>(null)
  const [error, setError] = useState('')

  async function handleCheck() {
    if (!ip) {
      setError('Please enter an IP address')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await apiClient.post<IPQSResult>('/ipqualityscore', { ip })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check IP reputation')
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
      <RemoteDisclosure sends={['IP address']} />

      <div>
        <label className="block text-sm font-medium mb-2">IP Address</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
            placeholder="8.8.8.8"
            className="input flex-1 font-mono"
          />
          <button
            onClick={handleCheck}
            disabled={loading || !ip}
            className="btn-primary"
          >
            {loading ? 'Checking...' : 'Check Reputation'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card bg-red-950/20 border-red-900/50 p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {result && result.success && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="ipqualityscore"
              input={ip}
              data={result}
              category="IP Intelligence"
            />
          </div>
          <OutputCard title="IP Reputation" canCopy={true}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Fraud Score:</span>
                <span className={`font-medium ${getFraudScoreColor(result.fraud_score || 0)}`}>
                  {result.fraud_score || 0}/100
                </span>
              </div>
              {result.country_code && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Location:</span>
                  <span className="text-sm">
                    {result.city && `${result.city}, `}
                    {result.region && `${result.region}, `}
                    {result.country_code}
                  </span>
                </div>
              )}
              {result.ISP && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">ISP:</span>
                  <span className="text-sm">{result.ISP}</span>
                </div>
              )}
              {result.organization && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Organization:</span>
                  <span className="text-sm">{result.organization}</span>
                </div>
              )}
            </div>
          </OutputCard>

          <OutputCard title="Threat Indicators" canCopy={true}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">VPN:</span>
                <span className={result.vpn ? 'text-red-400' : 'text-green-400'}>
                  {result.vpn ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Proxy:</span>
                <span className={result.proxy ? 'text-red-400' : 'text-green-400'}>
                  {result.proxy ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Tor:</span>
                <span className={result.tor ? 'text-red-400' : 'text-green-400'}>
                  {result.tor ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Bot:</span>
                <span className={result.bot ? 'text-red-400' : 'text-green-400'}>
                  {result.bot ? 'Yes' : 'No'}
                </span>
              </div>
              {result.recent_abuse && (
                <div className="mt-3 p-2 bg-red-950/20 border border-red-900/50 rounded">
                  <p className="text-red-400 text-xs">⚠️ Recent abuse detected</p>
                </div>
              )}
            </div>
          </OutputCard>
        </div>
      )}

      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">About IPQualityScore</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• Free tier: 100 requests/day</li>
          <li>• Fraud score: 0-100 (lower is better)</li>
          <li>• Detects VPN, proxy, Tor, and bot traffic</li>
          <li>• Requires API key (free signup)</li>
        </ul>
      </div>
    </div>
  )
}
