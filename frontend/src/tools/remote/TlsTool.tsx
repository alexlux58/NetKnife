/**
 * ==============================================================================
 * NETKNIFE - TLS INSPECTOR TOOL
 * ==============================================================================
 * 
 * Inspects TLS certificates for any host and port.
 * 
 * FEATURES:
 * - Certificate chain inspection
 * - Expiry date and days remaining
 * - Subject Alternative Names (SANs)
 * - SHA-256 fingerprints
 * - Key type and size
 * - Signature algorithm
 * 
 * NOTE: This is a REMOTE tool - connections are made from AWS Lambda.
 * ==============================================================================
 */

import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'
import { useToolState } from '../../lib/useToolState'

interface Certificate {
  subject: string
  issuer: string
  validFrom: string
  validTo: string
  daysRemaining: number
  serialNumber: string
  signatureAlgorithm: string
  keyType: string
  keySize: number | string
  fingerprint: string
  sans: string[]
}

interface TlsResult {
  host: string
  port: number
  protocol?: string
  cipher?: string
  days_remaining?: number
  chain: Certificate[]
}

export default function TlsTool() {
  const [state, setState] = useToolState(
    'tls',
    { host: 'example.com', port: '443', sni: '', loading: false, result: null as TlsResult | null, error: '' },
    { exclude: ['result', 'loading', 'error'] }
  )
  const { host, port, sni, loading, result, error } = state

  async function handleInspect() {
    setState({ loading: true, error: '', result: null })
    try {
      const res = await apiPost('/tls', {
        host,
        port: Number(port),
        sni: sni || host,
      }) as any

      // Transform backend response (snake_case) to frontend format (camelCase)
      const transformed: TlsResult = {
        host: res.host,
        port: res.port,
        protocol: res.protocol || '',
        cipher: res.cipher || '',
        days_remaining: res.days_remaining,
        chain: (res.chain || []).map((cert: any) => {
          // Calculate days remaining for each certificate
          const validTo = new Date(cert.valid_to).getTime()
          const now = Date.now()
          const daysRemaining = Math.floor((validTo - now) / (1000 * 60 * 60 * 24))
          
          // Handle key size - can be number or string (for EC curves)
          let keySize: number | string = cert.public_key_size
          if (typeof keySize === 'string' && keySize.includes('prime')) {
            // EC curve name like "prime256v1" - extract bit size if possible
            if (keySize.includes('256')) keySize = 256
            else if (keySize.includes('384')) keySize = 384
            else if (keySize.includes('521')) keySize = 521
          }
          
          return {
            subject: cert.subject || '',
            issuer: cert.issuer || '',
            validFrom: cert.valid_from || '',
            validTo: cert.valid_to || '',
            daysRemaining,
            serialNumber: cert.serial_number || '',
            signatureAlgorithm: cert.signature_algorithm || '',
            keyType: cert.public_key_type || '',
            keySize,
            fingerprint: cert.fingerprint_sha256 || '',
            sans: (cert.san || []).map((san: string) => {
              // Remove "DNS:" prefix if present
              return san.replace(/^DNS:/i, '').trim()
            }),
          }
        }),
      }
      
      setState({ result: transformed, loading: false })
    } catch (e) {
      if (e instanceof ApiError) {
        setState({ error: `Error ${e.status}: ${JSON.stringify(e.body, null, 2)}`, loading: false })
      } else {
        setState({ error: String(e), loading: false })
      }
    }
  }

  function loadExample() {
    setState({ host: 'github.com', port: '443', sni: '' })
  }

  // Get color based on days remaining
  function getDaysColor(days: number): string {
    if (days < 0) return 'text-red-500 bg-red-950/50'
    if (days < 14) return 'text-red-400 bg-red-950/30'
    if (days < 30) return 'text-orange-400 bg-orange-950/30'
    if (days < 60) return 'text-yellow-400 bg-yellow-950/30'
    return 'text-green-400 bg-green-950/30'
  }

  return (
    <div className="space-y-6">
      {/* Remote disclosure */}
      <RemoteDisclosure
        sends={['Hostname', 'Port', 'SNI hostname']}
        notes="Lambda connects to the target and retrieves certificate chain. Inspects even invalid/expired certs."
      />

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input section */}
        <div className="space-y-4">
          {/* Host input */}
          <div>
            <label className="block text-sm font-medium mb-2">Host</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setState({ host: e.target.value })}
              placeholder="example.com"
              className="input font-mono"
            />
          </div>

          {/* Port input */}
          <div>
            <label className="block text-sm font-medium mb-2">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setState({ port: e.target.value })}
              placeholder="443"
              className="input font-mono w-32"
            />
          </div>

          {/* SNI input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              SNI (optional)
            </label>
            <input
              type="text"
              value={sni}
              onChange={(e) => setState({ sni: e.target.value })}
              placeholder={host || 'Same as host'}
              className="input font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Server Name Indication - useful for shared hosting
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleInspect}
              disabled={loading || !host}
              className="btn-primary"
            >
              {loading ? 'Inspecting...' : 'Inspect Certificate'}
            </button>
            <button onClick={loadExample} className="btn-secondary">
              Example
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="card bg-red-950/30 border-red-900/50 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Common ports */}
          <div className="card p-4 text-sm">
            <h4 className="font-medium mb-2">Common TLS Ports</h4>
            <div className="grid grid-cols-2 gap-2 text-gray-400">
              <div>443 - HTTPS</div>
              <div>465 - SMTPS</div>
              <div>636 - LDAPS</div>
              <div>993 - IMAPS</div>
              <div>995 - POP3S</div>
              <div>8443 - Alt HTTPS</div>
            </div>
          </div>
        </div>

        {/* Output section */}
        <div className="space-y-4">
          {result && (
            <>
              {/* Add to Report Button */}
              <div className="flex items-center justify-end">
                <AddToReportButton
                  toolId="tls"
                  input={`${host}:${port}`}
                  data={result}
                  category="Certificates & TLS"
                />
              </div>
              {/* Connection summary */}
              <div className="card p-4">
                <h4 className="font-medium mb-3">Connection</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Host:</span>
                    <span className="ml-2 font-mono">{result.host}:{result.port}</span>
                  </div>
                  {result.protocol && (
                    <div>
                      <span className="text-gray-500">Protocol:</span>
                      <span className="ml-2 text-green-400">{result.protocol}</span>
                    </div>
                  )}
                  {result.cipher && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Cipher:</span>
                      <span className="ml-2 font-mono text-xs">{result.cipher}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Certificate chain */}
              {result.chain?.map((cert, idx) => (
                <div key={idx} className="card overflow-hidden">
                  <div className="p-3 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-400">
                        {idx === 0 ? '🔐 Leaf Certificate' : idx === result.chain.length - 1 ? '🏛️ Root CA' : '📜 Intermediate'}
                      </span>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${getDaysColor(cert.daysRemaining)}`}>
                      {cert.daysRemaining < 0 
                        ? `Expired ${Math.abs(cert.daysRemaining)} days ago`
                        : `${cert.daysRemaining} days remaining`
                      }
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    {/* Subject & Issuer */}
                    <div className="grid gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Subject</span>
                        <span className="font-mono text-cyan-400">{cert.subject}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Issuer</span>
                        <span className="font-mono text-gray-300">{cert.issuer}</span>
                      </div>
                    </div>

                    {/* Validity */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Valid From</span>
                        <span>
                          {cert.validFrom 
                            ? (() => {
                                try {
                                  return new Date(cert.validFrom).toLocaleDateString()
                                } catch {
                                  return cert.validFrom
                                }
                              })()
                            : 'Invalid Date'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Valid To</span>
                        <span className={cert.daysRemaining < 30 ? 'text-orange-400' : ''}>
                          {cert.validTo
                            ? (() => {
                                try {
                                  return new Date(cert.validTo).toLocaleDateString()
                                } catch {
                                  return cert.validTo
                                }
                              })()
                            : 'Invalid Date'}
                        </span>
                      </div>
                    </div>

                    {/* Technical details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Key</span>
                        <span>
                          {cert.keyType || 'Unknown'} {cert.keySize 
                            ? (typeof cert.keySize === 'number' ? `${cert.keySize}-bit` : cert.keySize)
                            : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Signature</span>
                        <span className="text-xs">{cert.signatureAlgorithm || 'Unknown'}</span>
                      </div>
                    </div>

                    {/* SANs (only for leaf cert) */}
                    {idx === 0 && cert.sans?.length > 0 && (
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-2">
                          Subject Alternative Names ({cert.sans.length})
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {cert.sans.slice(0, 10).map((san, i) => (
                            <span key={i} className="px-2 py-0.5 text-xs rounded bg-gray-800 font-mono">
                              {san}
                            </span>
                          ))}
                          {cert.sans.length > 10 && (
                            <span className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-500">
                              +{cert.sans.length - 10} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Fingerprint */}
                    <div>
                      <span className="text-gray-500 block text-xs uppercase mb-1">SHA-256 Fingerprint</span>
                      <span className="font-mono text-xs text-gray-400 break-all">{cert.fingerprint}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Full JSON result */}
              <JsonViewer data={result} title="Full Response" defaultView="raw" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
