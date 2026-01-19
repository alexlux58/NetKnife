/**
 * ==============================================================================
 * NETKNIFE - IP-API.COM IP GEOLOCATION TOOL
 * ==============================================================================
 * 
 * IP geolocation and information using ip-api.com free API.
 * 
 * FEATURES:
 * - IP geolocation (city, country, coordinates)
 * - ISP and organization info
 * - ASN information
 * - Timezone
 * - Free tier: 45 requests/minute (no API key needed)
 * ==============================================================================
 */

import { apiClient } from '../../lib/api'
import OutputCard from '../../components/OutputCard'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import AddToReportButton from '../../components/AddToReportButton'
import { useToolState } from '../../lib/useToolState'

interface IpApiResult {
  status: string
  country: string
  countryCode: string
  region: string
  regionName: string
  city: string
  zip: string
  lat: number
  lon: number
  timezone: string
  isp: string
  org: string
  as: string
  asname: string
  query: string
  cached?: boolean
}

export default function IpApiTool() {
  const [state, setState] = useToolState(
    'ip-api',
    { ip: '', loading: false, result: null as IpApiResult | null, error: '' },
    { exclude: ['result'] }
  )
  const { ip, loading, result, error } = state

  async function handleLookup() {
    if (!ip) {
      setState({ error: 'Please enter an IP address' })
      return
    }
    setState({ loading: true, error: '', result: null })
    try {
      const data = await apiClient.post('/ip-api', { ip })
      setState({ result: data as IpApiResult, loading: false })
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : 'Failed to lookup IP', loading: false })
    }
  }

  return (
    <div className="space-y-6">
      <RemoteDisclosure sends={['IP address']} />

      {/* Input */}
      <div>
        <label className="block text-sm font-medium mb-2">IP Address</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={ip}
            onChange={(e) => setState({ ip: e.target.value })}
            onKeyPress={(e) => e.key === 'Enter' && handleLookup()}
            placeholder="8.8.8.8"
            className="input flex-1 font-mono"
          />
          <button
            onClick={handleLookup}
            disabled={loading || !ip}
            className="btn-primary"
          >
            {loading ? 'Looking up...' : 'Lookup IP'}
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
      {result && result.status === 'success' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <AddToReportButton
              toolId="ip-api"
              input={ip}
              data={result}
              category="IP Intelligence"
            />
          </div>
          <OutputCard
            title="IP Geolocation"
            canCopy={true}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sm text-gray-400">IP Address:</span>
                  <div className="font-mono text-sm mt-1">{result.query}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Country:</span>
                  <div className="text-sm mt-1">{result.country} ({result.countryCode})</div>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Region:</span>
                  <div className="text-sm mt-1">{result.regionName} ({result.region})</div>
                </div>
                <div>
                  <span className="text-sm text-gray-400">City:</span>
                  <div className="text-sm mt-1">{result.city}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-400">ZIP Code:</span>
                  <div className="text-sm mt-1">{result.zip || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Timezone:</span>
                  <div className="text-sm mt-1">{result.timezone}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Coordinates:</span>
                  <div className="text-sm mt-1">
                    {result.lat}, {result.lon}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-400">ISP:</span>
                  <div className="text-sm mt-1">{result.isp}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Organization:</span>
                  <div className="text-sm mt-1">{result.org}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-400">ASN:</span>
                  <div className="text-sm mt-1 font-mono">{result.as}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-400">AS Name:</span>
                  <div className="text-sm mt-1">{result.asname}</div>
                </div>
              </div>
              
              {result.lat && result.lon && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <a
                    href={`https://www.google.com/maps?q=${result.lat},${result.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    View on Google Maps →
                  </a>
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
        <h4 className="font-medium mb-2">About IP-API.com</h4>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• Free tier: 45 requests/minute (no API key required)</li>
          <li>• Provides IP geolocation and ISP information</li>
          <li>• Includes ASN and organization details</li>
          <li>• Results are cached for 24 hours</li>
        </ul>
      </div>
    </div>
  )
}
