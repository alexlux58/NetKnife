/**
 * ==============================================================================
 * NETKNIFE - OSINT DASHBOARD - CONSOLIDATED THREAT INTELLIGENCE
 * ==============================================================================
 * 
 * Comprehensive OSINT dashboard that aggregates results from multiple tools
 * to provide a complete threat intelligence picture.
 * 
 * FEATURES:
 * - Multi-source email analysis (breach, reputation, verification)
 * - Multi-source IP analysis (reputation, geolocation, threat indicators)
 * - Domain analysis (DNS, WHOIS, security)
 * - Risk scoring and recommendations
 * - Consolidated view for faster decision-making
 * ==============================================================================
 */

import { useState } from 'react'
import { apiClient } from '../../lib/api'
import OutputCard from '../../components/OutputCard'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import AddToReportButton from '../../components/AddToReportButton'

interface DashboardResult {
  input: string
  type: 'email' | 'ip' | 'domain'
  emailResults?: {
    emailrep?: any
    breachdirectory?: any
    hibp?: any
    hunter?: any
    ipqsEmail?: any
  }
  ipResults?: {
    ipapi?: any
    abuseipdb?: any
    ipqualityscore?: any
    greynoise?: any
  }
  domainResults?: {
    dns?: any
    rdap?: any
    securitytrails?: any
  }
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  recommendations: string[]
  timestamp: string
}

export default function OsintDashboardTool() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DashboardResult | null>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'summary' | 'email' | 'ip' | 'domain'>('summary')

  function detectType(value: string): 'email' | 'ip' | 'domain' {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email'
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value) || /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(value)) return 'ip'
    return 'domain'
  }

  async function handleAnalyze() {
    if (!input) {
      setError('Please enter an email, IP address, or domain')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    const type = detectType(input)
    const results: Partial<DashboardResult> = {
      input,
      type,
      emailResults: {},
      ipResults: {},
      domainResults: {},
      recommendations: [],
    }

    try {
      // Run checks in parallel based on type
      const promises: Promise<any>[] = []

      if (type === 'email') {
        // Email checks - run in parallel, handle errors gracefully
        const emailrepPromise = apiClient.post('/emailrep', { email: input })
          .catch(e => ({ error: e.message, source: 'EmailRep.io' }))
        
        const breachdirectoryPromise = apiClient.post('/breachdirectory', { email: input })
          .catch(e => ({ error: e.message, source: 'BreachDirectory' }))
        
        const hunterPromise = apiClient.post('/hunter', { email: input })
          .catch(e => ({ error: e.message, source: 'Hunter.io', requiresKey: true }))
        
        const ipqsEmailPromise = apiClient.post('/ipqs-email', { email: input })
          .catch(e => ({ error: e.message, source: 'IPQualityScore Email', requiresKey: true }))
        
        const [emailrep, breachdirectory, hunter, ipqsEmail] = await Promise.all([
          emailrepPromise,
          breachdirectoryPromise,
          hunterPromise,
          ipqsEmailPromise
        ])
        results.emailResults = { emailrep, breachdirectory, hunter, ipqsEmail }
      } else if (type === 'ip') {
        // IP checks
        promises.push(
          apiClient.post('/ip-api', { ip: input }).catch(e => ({ error: e.message })),
          apiClient.post('/abuseipdb', { ip: input }).catch(e => ({ error: e.message })),
          apiClient.post('/ipqualityscore', { ip: input }).catch(e => ({ error: e.message })),
        )
        const [ipapi, abuseipdb, ipqualityscore] = await Promise.all(promises)
        results.ipResults = { ipapi, abuseipdb, ipqualityscore }
      } else {
        // Domain checks - run in parallel, handle errors gracefully
        const dnsPromise = apiClient.post('/dns', { name: input, type: 'A' })
          .catch(e => ({ error: e.message, source: 'DNS' }))
        
        const rdapPromise = apiClient.post('/rdap', { query: input })
          .catch(e => ({ error: e.message, source: 'RDAP' }))
        
        const [dns, rdap] = await Promise.all([dnsPromise, rdapPromise])
        results.domainResults = { dns, rdap }
      }

      // Calculate risk score
      let riskScore = 0
      const recommendations: string[] = []

      if (type === 'email') {
        if (results.emailResults?.breachdirectory?.found) {
          riskScore += 40
          recommendations.push('Email found in data breaches - change passwords immediately')
        }
        if (results.emailResults?.emailrep?.suspicious) {
          riskScore += 30
          recommendations.push('Email flagged as suspicious - exercise caution')
        }
        if (results.emailResults?.emailrep?.details?.credentials_leaked) {
          riskScore += 25
          recommendations.push('Credentials leaked - change password and enable 2FA')
        }
        if (results.emailResults?.emailrep?.reputation === 'low') {
          riskScore += 20
        }
        if (results.emailResults?.ipqsEmail?.disposable) {
          riskScore += 25
          recommendations.push('Disposable email detected - may indicate temporary account')
        }
        if (results.emailResults?.ipqsEmail?.honeypot) {
          riskScore += 30
          recommendations.push('Email flagged as honeypot/spamtrap - do not use')
        }
        if (results.emailResults?.ipqsEmail?.recent_abuse) {
          riskScore += 35
          recommendations.push('Recent abuse detected on email - investigate immediately')
        }
        if (results.emailResults?.ipqsEmail?.overall_score > 75) {
          riskScore += 30
        }
      } else if (type === 'ip') {
        if (results.ipResults?.abuseipdb?.abuseConfidenceScore > 75) {
          riskScore += 50
          recommendations.push('High abuse confidence score - IP may be malicious')
        }
        if (results.ipResults?.ipqualityscore?.fraud_score > 75) {
          riskScore += 40
          recommendations.push('High fraud score - IP likely associated with fraud')
        }
        if (results.ipResults?.ipqualityscore?.vpn || results.ipResults?.ipqualityscore?.proxy) {
          riskScore += 15
          recommendations.push('IP uses VPN/Proxy - may indicate anonymity attempts')
        }
        if (results.ipResults?.ipqualityscore?.tor) {
          riskScore += 20
          recommendations.push('IP uses Tor network - high anonymity')
        }
        if (results.ipResults?.ipqualityscore?.recent_abuse) {
          riskScore += 30
          recommendations.push('Recent abuse detected - monitor closely')
        }
      }

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
      if (riskScore >= 75) riskLevel = 'critical'
      else if (riskScore >= 50) riskLevel = 'high'
      else if (riskScore >= 25) riskLevel = 'medium'

      setResult({
        ...results,
        riskScore,
        riskLevel,
        recommendations,
        timestamp: new Date().toISOString(),
      } as DashboardResult)

      // Set active tab based on type
      setActiveTab(type)

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to analyze')
    } finally {
      setLoading(false)
    }
  }

  function getRiskColor(level: string) {
    switch (level) {
      case 'critical': return 'text-red-500 bg-red-950/30 border-red-900/50'
      case 'high': return 'text-orange-400 bg-orange-950/30 border-orange-900/50'
      case 'medium': return 'text-yellow-400 bg-yellow-950/30 border-yellow-900/50'
      default: return 'text-green-400 bg-green-950/30 border-green-900/50'
    }
  }

  return (
    <div className="space-y-6">
      <RemoteDisclosure sends={['email address', 'IP address', 'or domain name']} />

      {/* Header */}
      <div className="card p-4">
        <h2 className="text-xl font-bold mb-2">OSINT Dashboard</h2>
        <p className="text-sm text-gray-400">
          Comprehensive threat intelligence from multiple sources. Enter an email, IP address, or domain.
        </p>
      </div>

      {/* Input */}
      <div>
        <label className="block text-sm font-medium mb-2">Email, IP Address, or Domain</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
            placeholder="user@example.com, 8.8.8.8, or example.com"
            className="input flex-1"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !input}
            className="btn-primary"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
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
              toolId="osint-dashboard"
              input={input}
              data={result}
              category="Threat Intelligence"
            />
          </div>

          {/* Risk Summary */}
          <div className={`card p-4 border-2 ${getRiskColor(result.riskLevel)}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Risk Assessment</h3>
              <span className={`px-3 py-1 rounded text-sm font-medium capitalize ${getRiskColor(result.riskLevel)}`}>
                {result.riskLevel} Risk
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Risk Score:</span>
                <span className="text-2xl font-bold">{result.riskScore}/100</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${
                    result.riskLevel === 'critical' ? 'bg-red-500' :
                    result.riskLevel === 'high' ? 'bg-orange-400' :
                    result.riskLevel === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${result.riskScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <OutputCard title="Recommendations" canCopy={true}>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-400 mt-1">•</span>
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </OutputCard>
          )}

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 text-sm transition-colors ${
                activeTab === 'summary'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Summary
            </button>
            {result.type === 'email' && (
              <button
                onClick={() => setActiveTab('email')}
                className={`px-4 py-2 text-sm transition-colors ${
                  activeTab === 'email'
                    ? 'border-b-2 border-blue-500 text-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Email Details
              </button>
            )}
            {result.type === 'ip' && (
              <button
                onClick={() => setActiveTab('ip')}
                className={`px-4 py-2 text-sm transition-colors ${
                  activeTab === 'ip'
                    ? 'border-b-2 border-blue-500 text-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                IP Details
              </button>
            )}
            {result.type === 'domain' && (
              <button
                onClick={() => setActiveTab('domain')}
                className={`px-4 py-2 text-sm transition-colors ${
                  activeTab === 'domain'
                    ? 'border-b-2 border-blue-500 text-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Domain Details
              </button>
            )}
          </div>

          {/* Tab Content */}
          {activeTab === 'summary' && (
            <OutputCard title="Summary" canCopy={true}>
              <div className="space-y-4">
                <div>
                  <span className="text-sm text-gray-400">Input:</span>
                  <span className="ml-2 font-mono">{result.input}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Type:</span>
                  <span className="ml-2 capitalize">{result.type}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Analyzed:</span>
                  <span className="ml-2">{new Date(result.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </OutputCard>
          )}

          {activeTab === 'email' && result.emailResults && (
            <div className="space-y-4">
              {result.emailResults.emailrep && (
                <OutputCard 
                  title="EmailRep.io" 
                  canCopy={!result.emailResults.emailrep.error}
                >
                  {result.emailResults.emailrep.error ? (
                    <div className="text-red-400 text-sm">
                      {result.emailResults.emailrep.error}
                      {result.emailResults.emailrep.requiresKey && (
                        <p className="text-xs text-gray-400 mt-1">API key may be required</p>
                      )}
                    </div>
                  ) : (
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(result.emailResults.emailrep, null, 2)}
                    </pre>
                  )}
                </OutputCard>
              )}
              {result.emailResults.breachdirectory && (
                <OutputCard 
                  title="BreachDirectory" 
                  canCopy={!result.emailResults.breachdirectory.error}
                >
                  {result.emailResults.breachdirectory.error ? (
                    <div className="text-red-400 text-sm">
                      {result.emailResults.breachdirectory.error}
                    </div>
                  ) : (
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(result.emailResults.breachdirectory, null, 2)}
                    </pre>
                  )}
                </OutputCard>
              )}
              {result.emailResults.hunter && (
                <OutputCard 
                  title="Hunter.io" 
                  canCopy={!result.emailResults.hunter.error}
                >
                  {result.emailResults.hunter.error ? (
                    <div className="text-red-400 text-sm">
                      {result.emailResults.hunter.error}
                      {result.emailResults.hunter.requiresKey && (
                        <p className="text-xs text-gray-400 mt-1">API key required - configure in terraform.tfvars</p>
                      )}
                    </div>
                  ) : (
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(result.emailResults.hunter, null, 2)}
                    </pre>
                  )}
                </OutputCard>
              )}
              {result.emailResults.ipqsEmail && (
                <OutputCard 
                  title="IPQualityScore Email" 
                  canCopy={!result.emailResults.ipqsEmail.error}
                >
                  {result.emailResults.ipqsEmail.error ? (
                    <div className="text-red-400 text-sm">
                      {result.emailResults.ipqsEmail.error}
                      {result.emailResults.ipqsEmail.requiresKey && (
                        <p className="text-xs text-gray-400 mt-1">API key required - configure in terraform.tfvars</p>
                      )}
                    </div>
                  ) : (
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(result.emailResults.ipqsEmail, null, 2)}
                    </pre>
                  )}
                </OutputCard>
              )}
            </div>
          )}

          {activeTab === 'ip' && result.ipResults && (
            <div className="space-y-4">
              {result.ipResults.ipapi && !result.ipResults.ipapi.error && (
                <OutputCard title="IP-API.com" canCopy={true}>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(result.ipResults.ipapi, null, 2)}
                  </pre>
                </OutputCard>
              )}
              {result.ipResults.abuseipdb && !result.ipResults.abuseipdb.error && (
                <OutputCard title="AbuseIPDB" canCopy={true}>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(result.ipResults.abuseipdb, null, 2)}
                  </pre>
                </OutputCard>
              )}
              {result.ipResults.ipqualityscore && !result.ipResults.ipqualityscore.error && (
                <OutputCard title="IPQualityScore" canCopy={true}>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(result.ipResults.ipqualityscore, null, 2)}
                  </pre>
                </OutputCard>
              )}
            </div>
          )}

          {activeTab === 'domain' && result.domainResults && (
            <div className="space-y-4">
              {result.domainResults.dns && (
                <OutputCard 
                  title="DNS" 
                  canCopy={!result.domainResults.dns.error}
                >
                  {result.domainResults.dns.error ? (
                    <div className="text-red-400 text-sm">{result.domainResults.dns.error}</div>
                  ) : (
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(result.domainResults.dns, null, 2)}
                    </pre>
                  )}
                </OutputCard>
              )}
              {result.domainResults.rdap && (
                <OutputCard 
                  title="RDAP" 
                  canCopy={!result.domainResults.rdap.error}
                >
                  {result.domainResults.rdap.error ? (
                    <div className="text-red-400 text-sm">{result.domainResults.rdap.error}</div>
                  ) : (
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(result.domainResults.rdap, null, 2)}
                    </pre>
                  )}
                </OutputCard>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="card p-4 text-sm">
        <h4 className="font-medium mb-2">About OSINT Dashboard</h4>
        <p className="text-gray-400 text-xs mb-2">
          This dashboard aggregates results from multiple OSINT sources to provide a comprehensive threat intelligence view.
        </p>
        <ul className="text-gray-400 space-y-1 text-xs">
          <li>• <strong>Email:</strong> Checks reputation, breaches, and verification</li>
          <li>• <strong>IP:</strong> Checks reputation, geolocation, and threat indicators</li>
          <li>• <strong>Domain:</strong> Checks DNS, WHOIS, and security records</li>
        </ul>
      </div>
    </div>
  )
}
