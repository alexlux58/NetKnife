import { useEffect, useState } from 'react'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import AddToReportButton from '../../components/AddToReportButton'
import { scannersListConfigs, scannersSaveConfig, scannersDeleteConfig, scannersRunScan, scannersListScans, type ScannerConfig, type ScanItem } from '../../lib/scanners'
import { ApiError } from '../../lib/api'

export default function VulnScannerTool() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [configs, setConfigs] = useState<ScannerConfig[]>([])
  const [scans, setScans] = useState<ScanItem[]>([])

  const [newScannerId, setNewScannerId] = useState('local-nessus')
  const [newType, setNewType] = useState<'nessus' | 'greenbone' | 'agent' | 'cloud-nuclei' | 'cloud-trivy'>('nessus')
  const [newName, setNewName] = useState('My Nessus')
  const [newEndpoint, setNewEndpoint] = useState('https://scanner.local:8834')

  const [scannerType, setScannerType] = useState<'cloud' | 'agent'>('agent')
  const [scannerId, setScannerId] = useState('')
  const [target, setTarget] = useState('example.com')
  const [scanProfile, setScanProfile] = useState<'quick' | 'full'>('quick')
  
  // Filtering state
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [minCvss, setMinCvss] = useState<number>(0)
  const [selectedScan, setSelectedScan] = useState<ScanItem | null>(null)

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const [c, s] = await Promise.all([scannersListConfigs(), scannersListScans()])
      setConfigs(c.items || [])
      setScans(s.items || [])
    } catch (e) {
      if (e instanceof ApiError) setError(`Error ${e.status}: ${JSON.stringify(e.body)}`)
      else setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh().catch(() => {})
  }, [])

  async function saveConfig() {
    setLoading(true)
    setError('')
    try {
      await scannersSaveConfig({
        scannerId: newScannerId.trim(),
        type: newType,
        name: newName.trim() || newScannerId.trim(),
        endpoint: newEndpoint.trim(),
      })
      await refresh()
    } catch (e) {
      if (e instanceof ApiError) setError(`Error ${e.status}: ${JSON.stringify(e.body)}`)
      else setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function removeConfig(id: string) {
    setLoading(true)
    setError('')
    try {
      await scannersDeleteConfig(id)
      await refresh()
    } catch (e) {
      if (e instanceof ApiError) setError(`Error ${e.status}: ${JSON.stringify(e.body)}`)
      else setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function runScan() {
    setLoading(true)
    setError('')
    try {
      const res = await scannersRunScan({
        scannerType,
        scannerId: scannerId || undefined,
        target,
        scanProfile,
      })
      setScans((prev) => [res.scan, ...prev])
    } catch (e) {
      if (e instanceof ApiError) setError(`Error ${e.status}: ${JSON.stringify(e.body)}`)
      else setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vulnerability Scanners</h1>
        <p className="text-gray-400 mt-1">
          Configure scanners (agent/on-prem) and run scans. Cloud scanners are supported as a future upgrade.
        </p>
      </div>

      <RemoteDisclosure
        sends={['Target', 'Optional scanner configuration']}
        notes="This tool stores scan metadata. Agent/on-prem scanners require connectivity from your network; cloud scans cannot target private IPs."
      />

      {error && (
        <div className="card bg-red-950/30 border-red-900/50 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h3 className="font-medium">Add / Update Scanner</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Scanner ID</label>
                <input className="input" value={newScannerId} onChange={(e) => setNewScannerId(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select className="input" value={newType} onChange={(e) => setNewType(e.target.value as any)}>
                  <option value="nessus">Nessus</option>
                  <option value="greenbone">Greenbone</option>
                  <option value="agent">Agent</option>
                  <option value="cloud-nuclei">Cloud: Nuclei (future)</option>
                  <option value="cloud-trivy">Cloud: Trivy (future)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Endpoint (optional)</label>
                <input className="input font-mono" value={newEndpoint} onChange={(e) => setNewEndpoint(e.target.value)} />
              </div>
            </div>
            <button className="btn-primary" onClick={saveConfig} disabled={loading || !newScannerId.trim()}>
              {loading ? 'Saving...' : 'Save Scanner'}
            </button>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="font-medium">Configured Scanners</h3>
            {configs.length === 0 ? (
              <div className="text-sm text-gray-500">No scanners configured yet.</div>
            ) : (
              <div className="space-y-2">
                {configs.map((c) => (
                  <div key={c.scannerId} className="p-3 rounded bg-[#161b22] flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500 mt-1 font-mono break-all">{c.scannerId}</div>
                      {c.endpoint && <div className="text-xs text-gray-500 mt-1 break-all">{c.endpoint}</div>}
                      <div className="text-xs text-gray-600 mt-1">Type: {c.type}</div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button className="btn-secondary text-xs" onClick={() => setScannerId(c.scannerId)}>
                        Use
                      </button>
                      <button className="btn-danger text-xs" onClick={() => removeConfig(c.scannerId)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Run Scan</h3>
              <button className="btn-secondary text-xs" onClick={refresh} disabled={loading}>
                Refresh
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mode</label>
                <select className="input" value={scannerType} onChange={(e) => setScannerType(e.target.value as any)}>
                  <option value="agent">Agent / On-prem</option>
                  <option value="cloud">Cloud (future)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Profile</label>
                <select className="input" value={scanProfile} onChange={(e) => setScanProfile(e.target.value as any)}>
                  <option value="quick">Quick</option>
                  <option value="full">Full</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Target</label>
                <input className="input font-mono" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="example.com / https://example.com / 1.2.3.4" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Scanner ID (optional)</label>
                <input className="input font-mono" value={scannerId} onChange={(e) => setScannerId(e.target.value)} placeholder="Pick from configured scanners" />
              </div>
            </div>

            <button className="btn-primary" onClick={runScan} disabled={loading || !target.trim()}>
              {loading ? 'Running...' : 'Run Scan'}
            </button>
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Recent Scans</h3>
              {scans.length > 0 && (
                <AddToReportButton toolId="vuln-scanner" input="recent-scans" data={scans.slice(0, 10)} category="pentest" />
              )}
            </div>
            {scans.length === 0 ? (
              <div className="text-sm text-gray-500">No scans yet.</div>
            ) : (
              <>
                <div className="flex gap-2 mb-3 flex-wrap">
                  <select
                    className="input text-xs"
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="info">Info</option>
                  </select>
                  <input
                    type="number"
                    className="input text-xs w-20"
                    min="0"
                    max="10"
                    step="0.1"
                    value={minCvss}
                    onChange={(e) => setMinCvss(parseFloat(e.target.value) || 0)}
                    placeholder="Min CVSS"
                  />
                </div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {scans
                    .filter((s) => {
                      if (severityFilter !== 'all' && Array.isArray(s.findings)) {
                        const hasSeverity = s.findings.some((f: any) => f.severity === severityFilter)
                        if (!hasSeverity) return false
                      }
                      if (minCvss > 0 && Array.isArray(s.findings)) {
                        const hasMinCvss = s.findings.some((f: any) => (f.cvssScore || 0) >= minCvss)
                        if (!hasMinCvss) return false
                      }
                      return true
                    })
                    .map((s) => (
                      <div
                        key={s.scanId}
                        className={`p-3 rounded bg-[#161b22] space-y-1 cursor-pointer hover:bg-[#1c2128] ${
                          selectedScan?.scanId === s.scanId ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => setSelectedScan(s)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-mono text-xs text-cyan-400 break-all">{s.target}</div>
                          <span className="text-xs text-gray-500">{s.status}</span>
                        </div>
                        <div className="text-xs text-gray-500">Mode: {s.scannerType} • Profile: {s.scanProfile}</div>
                        {Array.isArray(s.findings) && s.findings.length > 0 && (
                          <div className="text-xs text-gray-300">
                            Findings: {s.findings.length}
                            {s.findings[0]?.cvssScore && (
                              <span className="ml-2">Max CVSS: {s.findings[0].cvssScore}</span>
                            )}
                            {s.findings[0]?.epssScore && (
                              <span className="ml-2">EPSS: {(s.findings[0].epssScore * 100).toFixed(1)}%</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
                {selectedScan && Array.isArray(selectedScan.findings) && selectedScan.findings.length > 0 && (
                  <div className="mt-4 p-3 rounded bg-[#161b22] border border-[#30363d]">
                    <h4 className="font-medium mb-2 text-sm">Findings Details</h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {selectedScan.findings
                        .filter((f: any) => {
                          if (severityFilter !== 'all' && f.severity !== severityFilter) return false
                          if (minCvss > 0 && (f.cvssScore || 0) < minCvss) return false
                          return true
                        })
                        .map((f: any, idx: number) => (
                          <div key={idx} className="text-xs p-2 rounded bg-[#0d1117]">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`px-1.5 py-0.5 rounded text-xs ${
                                  f.severity === 'critical'
                                    ? 'bg-red-500/20 text-red-400'
                                    : f.severity === 'high'
                                    ? 'bg-orange-500/20 text-orange-400'
                                    : f.severity === 'medium'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : f.severity === 'low'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                }`}
                              >
                                {f.severity}
                              </span>
                              {f.cvssScore && (
                                <span className="text-gray-400">CVSS: {f.cvssScore}</span>
                              )}
                              {f.epssScore && (
                                <span className="text-gray-400">EPSS: {(f.epssScore * 100).toFixed(1)}%</span>
                              )}
                            </div>
                            <div className="font-medium text-gray-300">{f.title}</div>
                            {f.description && <div className="text-gray-500 mt-1">{f.description}</div>}
                            {f.cve && (
                              <a
                                href={`https://cve.mitre.org/cgi-bin/cvename.cgi?name=${f.cve}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline text-xs mt-1 inline-block"
                              >
                                {f.cve}
                              </a>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="text-xs text-gray-500">
              Note: execution is currently stubbed; wiring real Nuclei/Trivy/agent execution is next.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

