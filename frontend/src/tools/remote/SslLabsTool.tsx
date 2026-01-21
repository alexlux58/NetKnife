/**
 * ==============================================================================
 * NETKNIFE - SSL LABS TOOL
 * ==============================================================================
 */

import RemoteDisclosure from '../../components/RemoteDisclosure'
import JsonViewer from '../../components/JsonViewer'
import AddToReportButton from '../../components/AddToReportButton'
import { apiPost, ApiError } from '../../lib/api'
import { formatJson } from '../../lib/utils'
import { useToolState } from '../../lib/useToolState'

interface CertificateInfo {
  subject?: string
  issuer?: string
  validFrom?: string | number
  validTo?: string | number
  serialNumber?: string
  signatureAlgorithm?: string
  keyAlg?: string
  keySize?: number
  commonNames?: string[]
  altNames?: string[]
  issues?: number[]
  fingerprint?: string
  fingerprintSha1?: string
}

// Helper to parse DN (Distinguished Name) fields like "CN=example.com, O=Company, OU=Org Unit"
function parseDN(dn: string): { CN?: string; O?: string; OU?: string; full: string } {
  if (!dn) return { full: dn || '' };
  const parts: Record<string, string> = {};
  const full = dn;
  
  // Parse format: CN=example.com, O=Company, OU=Org Unit
  const matches = dn.match(/([A-Z]+)=([^,]+)/g);
  if (matches) {
    matches.forEach(match => {
      const [key, ...valueParts] = match.split('=');
      const value = valueParts.join('=').trim();
      parts[key.trim()] = value;
    });
  }
  
  return {
    CN: parts.CN,
    O: parts.O,
    OU: parts.OU,
    full,
  };
}

interface SslLabsResult {
  host: string
  status: string
  grade?: string
  gradeTrustIgnored?: string
  hasWarnings?: boolean
  isExceptional?: boolean
  endpoints?: {
    ipAddress: string
    grade: string
    hasWarnings: boolean
  }[]
  protocols?: { name: string; version: string }[]
  certificate?: CertificateInfo | null
  vulnerabilities?: Record<string, boolean | number>
  message?: string
  progress?: number
}

const gradeColors: Record<string, string> = {
  'A+': 'text-emerald-400 bg-emerald-400/20',
  'A': 'text-emerald-400 bg-emerald-400/20',
  'A-': 'text-green-400 bg-green-400/20',
  'B': 'text-yellow-400 bg-yellow-400/20',
  'C': 'text-orange-400 bg-orange-400/20',
  'D': 'text-red-400 bg-red-400/20',
  'E': 'text-red-500 bg-red-500/20',
  'F': 'text-red-600 bg-red-600/20',
  'T': 'text-red-600 bg-red-600/20',
}

export default function SslLabsTool() {
  const [state, setState] = useToolState(
    'ssl-labs',
    { host: 'example.com', loading: false, result: null as SslLabsResult | null, error: '' },
    { exclude: ['result', 'loading', 'error'] }
  )
  const { host, loading, result, error } = state

  async function handleCheck() {
    setState({ loading: true, error: '', result: null })
    try {
      const data = await apiPost<SslLabsResult>('/ssl-labs', { host })
      setState({ result: data, loading: false })
    } catch (e) {
      if (e instanceof ApiError) {
        setState({ error: `Error ${e.status}: ${formatJson(e.body)}`, loading: false })
      } else {
        setState({ error: String(e), loading: false })
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SSL Labs</h1>
        <p className="text-gray-400 mt-1">
          Qualys SSL Server Test - comprehensive SSL/TLS grade
        </p>
      </div>

      <RemoteDisclosure 
        sends={['Hostname']} 
        notes="Uses cached results from SSL Labs. New scans may take several minutes."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Hostname</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setState({ host: e.target.value })}
              placeholder="example.com"
              className="input"
            />
          </div>
          <button onClick={handleCheck} disabled={loading || !host} className="btn btn-primary w-full">
            {loading ? 'Checking...' : 'Check SSL Grade'}
          </button>
        </div>

        <div className="space-y-4">
          {result && (
            <>
              {/* Add to Report Button */}
              {result.status === 'ready' && result.grade && (
                <div className="flex items-center justify-end">
                  <AddToReportButton
                    toolId="ssl-labs"
                    input={host}
                    data={result}
                    category="Certificates & TLS"
                  />
                </div>
              )}
              {result.status === 'ready' && result.grade && (
            <div className="card p-6 text-center">
              <div className="text-sm text-gray-500 mb-2">SSL Grade</div>
              <div className={`inline-block text-6xl font-bold px-6 py-3 rounded-lg ${gradeColors[result.grade] || 'text-gray-400'}`}>
                {result.grade}
              </div>
              {result.hasWarnings && (
                <div className="mt-2 text-yellow-400 text-sm">⚠ Has warnings</div>
              )}
              {result.isExceptional && (
                <div className="mt-2 text-emerald-400 text-sm">✓ Exceptional configuration</div>
              )}
            </div>
          )}

          {result && result.status === 'pending' && (
            <div className="card p-6 text-center space-y-3">
              <div className="text-yellow-400">⏳ {result.message}</div>
              <button 
                onClick={handleCheck} 
                disabled={loading}
                className="btn btn-secondary mt-4"
              >
                {loading ? 'Checking...' : 'Check Again'}
              </button>
            </div>
          )}

          {result && result.status === 'in_progress' && (
            <div className="card p-6 text-center space-y-3">
              <div className="text-blue-400">🔄 {result.message}</div>
              {result.progress !== undefined && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-500">Progress: {result.progress}%</div>
                  {result.progress >= 100 ? (
                    <div className="space-y-2">
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div className="text-sm text-yellow-400 mt-2">
                        ⚠ Scan complete but results are finalizing. Click "Check SSL Grade" again to fetch final results.
                      </div>
                    </div>
                  ) : result.progress > 0 ? (
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${result.progress}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              )}
              <button 
                onClick={handleCheck} 
                disabled={loading}
                className={`btn mt-4 ${result.progress !== undefined && result.progress >= 100 ? 'btn-primary' : 'btn-secondary'}`}
              >
                {loading ? 'Checking...' : (result.progress !== undefined && result.progress >= 100) ? 'Fetch Final Results' : 'Check Again'}
              </button>
            </div>
          )}

          {result && result.certificate && (() => {
            const cert = result.certificate;
            const subjectDN = parseDN(cert.subject || '');
            const issuerDN = parseDN(cert.issuer || '');
            
            // Parse dates - handle both string and number formats
            const validFromDate = cert.validFrom ? new Date(cert.validFrom) : null;
            const validToDate = cert.validTo ? new Date(cert.validTo) : null;
            const daysRemaining = validToDate ? Math.floor((validToDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
            
            return (
              <div className="card p-4 space-y-4">
                <h3 className="font-medium mb-3">Certificate Information</h3>
                
                {/* Issued To (Subject) */}
                {cert.subject && (
                  <div className="space-y-2">
                    <span className="text-gray-500 block text-xs uppercase mb-2">Issued To</span>
                    <div className="space-y-1 text-sm pl-2 border-l-2 border-cyan-500/30">
                      {subjectDN.CN && (
                        <div>
                          <span className="text-gray-400">Common Name (CN): </span>
                          <span className="font-mono text-cyan-400">{subjectDN.CN}</span>
                        </div>
                      )}
                      {subjectDN.O && (
                        <div>
                          <span className="text-gray-400">Organization (O): </span>
                          <span className="text-gray-300">{subjectDN.O}</span>
                        </div>
                      )}
                      {subjectDN.OU && (
                        <div>
                          <span className="text-gray-400">Organizational Unit (OU): </span>
                          <span className="text-gray-300">{subjectDN.OU}</span>
                        </div>
                      )}
                      {!subjectDN.CN && !subjectDN.O && !subjectDN.OU && (
                        <div className="font-mono text-cyan-400 text-xs">{cert.subject}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Issued By (Issuer) */}
                {cert.issuer && (
                  <div className="space-y-2">
                    <span className="text-gray-500 block text-xs uppercase mb-2">Issued By</span>
                    <div className="space-y-1 text-sm pl-2 border-l-2 border-purple-500/30">
                      {issuerDN.CN && (
                        <div>
                          <span className="text-gray-400">Common Name (CN): </span>
                          <span className="font-mono text-purple-400">{issuerDN.CN}</span>
                        </div>
                      )}
                      {issuerDN.O && (
                        <div>
                          <span className="text-gray-400">Organization (O): </span>
                          <span className="text-gray-300">{issuerDN.O}</span>
                        </div>
                      )}
                      {issuerDN.OU && (
                        <div>
                          <span className="text-gray-400">Organizational Unit (OU): </span>
                          <span className="text-gray-300">{issuerDN.OU}</span>
                        </div>
                      )}
                      {!issuerDN.CN && !issuerDN.O && !issuerDN.OU && (
                        <div className="font-mono text-purple-400 text-xs">{cert.issuer}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Validity Period */}
                {(validFromDate || validToDate) && (
                  <div className="space-y-2">
                    <span className="text-gray-500 block text-xs uppercase mb-2">Validity Period</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {validFromDate && (
                        <div>
                          <span className="text-gray-400 block mb-1">Issued On</span>
                          <span className="text-gray-300">
                            {validFromDate.toLocaleString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      {validToDate && (
                        <div>
                          <span className="text-gray-400 block mb-1">Expires On</span>
                          <span className={(() => {
                            if (daysRemaining === null) return 'text-gray-300';
                            if (daysRemaining < 0) return 'text-red-400';
                            if (daysRemaining < 30) return 'text-orange-400';
                            if (daysRemaining < 90) return 'text-yellow-400';
                            return 'text-gray-300';
                          })()}>
                            {validToDate.toLocaleString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                            {daysRemaining !== null && (
                              <span className="ml-2 text-xs">
                                ({daysRemaining < 0 
                                  ? `Expired ${Math.abs(daysRemaining)} days ago`
                                  : `${daysRemaining} days remaining`})
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SHA-256 Fingerprint */}
                {cert.fingerprint && (
                  <div className="space-y-2">
                    <span className="text-gray-500 block text-xs uppercase mb-2">SHA-256 Fingerprints</span>
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-gray-400">Certificate: </span>
                        <span className="font-mono text-xs text-gray-300 break-all">{cert.fingerprint}</span>
                      </div>
                    </div>
                  </div>
                )}

              {/* Key Information */}
              {(result.certificate.keyAlg || result.certificate.keySize) && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {result.certificate.keyAlg && result.certificate.keySize && (
                    <div>
                      <span className="text-gray-500 block text-xs uppercase mb-1">Key</span>
                      <span>
                        {result.certificate.keyAlg} {result.certificate.keySize}-bit
                      </span>
                    </div>
                  )}
                  {result.certificate.signatureAlgorithm && (
                    <div>
                      <span className="text-gray-500 block text-xs uppercase mb-1">Signature</span>
                      <span className="text-xs">{result.certificate.signatureAlgorithm}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Common Names & SANs */}
              {((result.certificate.commonNames && result.certificate.commonNames.length > 0) || 
                (result.certificate.altNames && result.certificate.altNames.length > 0)) && (
                <div>
                  <span className="text-gray-500 block text-xs uppercase mb-2">Domains Covered</span>
                  <div className="flex flex-wrap gap-1">
                    {result.certificate.commonNames?.map((cn, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400 font-mono">
                        {cn}
                      </span>
                    ))}
                    {result.certificate.altNames?.map((an, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400 font-mono">
                        {an}
                      </span>
                    ))}
                  </div>
                </div>
              )}

                {/* Serial Number */}
                {cert.serialNumber && (
                  <div className="space-y-2">
                    <span className="text-gray-500 block text-xs uppercase mb-1">Serial Number</span>
                    <span className="font-mono text-xs text-gray-300 break-all">{cert.serialNumber}</span>
                  </div>
                )}

                {/* Key Information */}
                {(cert.keyAlg || cert.keySize) && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {cert.keyAlg && cert.keySize && (
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Key Algorithm</span>
                        <span>
                          {cert.keyAlg} {cert.keySize}-bit
                        </span>
                      </div>
                    )}
                    {cert.signatureAlgorithm && (
                      <div>
                        <span className="text-gray-500 block text-xs uppercase mb-1">Signature Algorithm</span>
                        <span className="text-xs">{cert.signatureAlgorithm}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Common Names & SANs */}
                {((cert.commonNames && cert.commonNames.length > 0) || 
                  (cert.altNames && cert.altNames.length > 0)) && (
                  <div>
                    <span className="text-gray-500 block text-xs uppercase mb-2">Domains Covered</span>
                    <div className="flex flex-wrap gap-1">
                      {cert.commonNames?.map((cn, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400 font-mono">
                          {cn}
                        </span>
                      ))}
                      {cert.altNames?.map((an, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400 font-mono">
                          {an}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Certificate Issues */}
                {cert.issues && cert.issues.length > 0 && (
                  <div>
                    <span className="text-gray-500 block text-xs uppercase mb-2">Issues</span>
                    <div className="space-y-1">
                      {cert.issues.map((issue, i) => (
                        <div key={i} className="text-xs text-yellow-400">
                          {issue === 1 && '⚠ Certificate not valid'}
                          {issue === 2 && '⚠ Certificate not trusted'}
                          {issue === 3 && '⚠ Certificate not valid for domain'}
                          {issue === 4 && '⚠ Certificate chain incomplete'}
                          {issue === 5 && '⚠ Certificate expired'}
                          {issue === 6 && '⚠ Certificate self-signed'}
                          {issue === 7 && '⚠ Certificate revoked'}
                          {issue === 8 && '⚠ Certificate blacklisted'}
                          {issue === 9 && '⚠ Certificate pinning mismatch'}
                          {issue === 10 && '⚠ Certificate weak signature'}
                          {!issue || (issue > 10 && `Issue code: ${issue}`)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {result && result.protocols && (
            <div className="card p-4">
              <h3 className="font-medium mb-2">Supported Protocols</h3>
              <div className="flex flex-wrap gap-2">
                {result.protocols.map((p, i) => (
                  <span key={i} className={`px-2 py-1 rounded text-xs ${
                    p.name.includes('1.3') ? 'bg-emerald-500/20 text-emerald-400' :
                    p.name.includes('1.2') ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {p.name} {p.version}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result && result.vulnerabilities && (
            <div className="card p-4">
              <h3 className="font-medium mb-2">Vulnerability Checks</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(result.vulnerabilities).map(([vuln, status]) => (
                  <div key={vuln} className={`flex items-center gap-2 ${status ? 'text-red-400' : 'text-emerald-400'}`}>
                    {status ? '✗' : '✓'} {vuln}
                  </div>
                ))}
              </div>
            </div>
          )}

          <JsonViewer title="Full Response" json={result} error={error} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

