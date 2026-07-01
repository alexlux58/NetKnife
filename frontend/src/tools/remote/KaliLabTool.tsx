import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import {
  labsList,
  labsLaunch,
  labsStop,
  labsStatus,
  labsCredits,
  labsBuyCredits,
  type LabItem,
  type LabCredits,
} from '../../lib/labs'
import { ApiError } from '../../lib/api'
import { useBilling } from '../../lib/BillingContext'

type Tab = 'launch' | 'terminal' | 'tools' | 'history'

const TOOLS = [
  { id: 'trivy', name: 'Trivy', desc: 'Container, K8s, IaC vulnerability scanning' },
  { id: 'prowler', name: 'Prowler', desc: 'AWS/Azure/GCP security audits' },
  { id: 'scout-suite', name: 'Scout Suite', desc: 'Multi-cloud posture assessment' },
  { id: 'checkov', name: 'Checkov', desc: 'Terraform & IaC misconfigurations' },
  { id: 'kube-bench', name: 'kube-bench', desc: 'CIS Kubernetes benchmark' },
  { id: 'steampipe', name: 'Steampipe', desc: 'SQL over cloud APIs' },
]

export default function KaliLabTool() {
  const { hasPro } = useBilling()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('launch')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [credits, setCredits] = useState<LabCredits | null>(null)
  const [activeLab, setActiveLab] = useState<LabItem | null>(null)
  const [history, setHistory] = useState<LabItem[]>([])
  const [instanceType, setInstanceType] = useState<'small' | 'standard' | 'large'>('standard')
  const [sessionMinutes, setSessionMinutes] = useState(60)

  const refresh = useCallback(async () => {
    setError('')
    try {
      const [c, list] = await Promise.all([labsCredits(), labsList()])
      setCredits(c)
      setHistory(list.items || [])
      const running = (list.items || []).find((l) =>
        ['provisioning', 'running', 'stopping'].includes(l.status)
      )
      setActiveLab(running || null)
      if (running?.status === 'running') setTab('terminal')
    } catch (e) {
      if (e instanceof ApiError) setError(`Error ${e.status}: ${JSON.stringify(e.body)}`)
      else setError(String(e))
    }
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  // Poll active lab status
  useEffect(() => {
    if (!activeLab || !['provisioning', 'running'].includes(activeLab.status)) return
    const id = setInterval(async () => {
      try {
        const { lab } = await labsStatus(activeLab.labId)
        setActiveLab(lab)
        if (lab.status === 'terminated' || lab.status === 'failed') {
          await refresh()
        }
      } catch {
        /* ignore poll errors */
      }
    }, 10000)
    return () => clearInterval(id)
  }, [activeLab, refresh])

  useEffect(() => {
    if (searchParams.get('credits') === '1') {
      refresh().catch(() => {})
    }
  }, [searchParams, refresh])

  async function handleLaunch() {
    setLoading(true)
    setError('')
    try {
      const { lab } = await labsLaunch({ instanceType, sessionMinutes })
      setActiveLab(lab)
      setTab('terminal')
      await refresh()
    } catch (e) {
      if (e instanceof ApiError) {
        const body = e.body as { error?: string; buyCredits?: boolean; upgrade?: boolean }
        setError(body?.error || `Error ${e.status}`)
        if (body?.buyCredits || body?.upgrade) {
          window.dispatchEvent(new CustomEvent('netknife:show-upgrade'))
        }
      } else setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleStop() {
    if (!activeLab) return
    setLoading(true)
    setError('')
    try {
      const { lab } = await labsStop(activeLab.labId)
      setActiveLab(lab.status === 'terminated' ? null : lab)
      setTab('launch')
      await refresh()
    } catch (e) {
      if (e instanceof ApiError) setError(`Error ${e.status}: ${JSON.stringify(e.body)}`)
      else setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleBuyCredits(pack: 'starter' | 'standard' | 'power') {
    setLoading(true)
    setError('')
    try {
      const { url } = await labsBuyCredits(pack)
      window.location.href = url
    } catch (e) {
      if (e instanceof ApiError) setError(`Error ${e.status}: ${JSON.stringify(e.body)}`)
      else setError(String(e))
      setLoading(false)
    }
  }

  const creditDisplay = credits?.isExempt
    ? 'Unlimited'
    : `${credits?.credits ?? 0} min`

  return (
    <div className="space-y-4">
      <RemoteDisclosure
        sends={['lab launch request', 'instance metadata']}
        notes="Kali VMs run in a private AWS subnet. Access via SSM Session Manager only — no inbound ports."
      />

      {/* Credits bar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-sm text-gray-400">Lab credits</span>
          <p className="text-xl font-semibold text-white">{creditDisplay}</p>
          {credits?.rateDisplay && !credits.isExempt && (
            <p className="text-xs text-gray-500">{credits.rateDisplay} after included time</p>
          )}
        </div>
        {!credits?.isExempt && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary text-sm"
              disabled={loading}
              onClick={() => handleBuyCredits('starter')}
            >
              +2 hr ($2)
            </button>
            <button
              type="button"
              className="btn btn-secondary text-sm"
              disabled={loading}
              onClick={() => handleBuyCredits('standard')}
            >
              +6 hr ($5)
            </button>
            <button
              type="button"
              className="btn btn-primary text-sm"
              disabled={loading}
              onClick={() => handleBuyCredits('power')}
            >
              +16 hr ($12)
            </button>
          </div>
        )}
      </div>

      {searchParams.get('credits') === '1' && (
        <div className="card border-green-900/50 bg-green-950/20 p-3 text-sm text-green-300">
          Lab credits added successfully.
        </div>
      )}

      {error && (
        <div className="card border-red-900/50 bg-red-950/20 p-3 text-sm text-red-300">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {(['launch', 'terminal', 'tools', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-blue-400 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Launch tab */}
      {tab === 'launch' && (
        <div className="card p-4 space-y-4">
          {!hasPro && !credits?.isExempt && (
            <p className="text-amber-400 text-sm">
              Pro subscription required to launch Kali Labs.{' '}
              <a href="/pricing" className="underline">Subscribe</a>
            </p>
          )}

          {activeLab && ['provisioning', 'running'].includes(activeLab.status) ? (
            <div className="space-y-2">
              <p className="text-white">
                Lab <code className="text-blue-300">{activeLab.labId}</code> is{' '}
                <span className="text-green-400">{activeLab.status}</span>
              </p>
              <button type="button" className="btn btn-primary" onClick={() => setTab('terminal')}>
                Go to Terminal
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm text-gray-400">Instance size</span>
                  <select
                    className="input w-full"
                    value={instanceType}
                    onChange={(e) => setInstanceType(e.target.value as typeof instanceType)}
                  >
                    <option value="small">Small (t3.small)</option>
                    <option value="standard">Standard (t3.medium)</option>
                    <option value="large">Large (t3.large)</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-gray-400">Session length (minutes)</span>
                  <select
                    className="input w-full"
                    value={sessionMinutes}
                    onChange={(e) => setSessionMinutes(Number(e.target.value))}
                  >
                    <option value={30}>30 min</option>
                    <option value={60}>60 min</option>
                    <option value={120}>2 hours</option>
                    <option value={240}>4 hours (max)</option>
                  </select>
                </label>
              </div>

              <p className="text-sm text-gray-400">
                Reserves {sessionMinutes} credits. Unused time is refunded when you stop early.
                Auto-terminates at session end.
              </p>

              <button
                type="button"
                className="btn btn-primary w-full sm:w-auto"
                disabled={loading || (!hasPro && !credits?.isExempt)}
                onClick={handleLaunch}
              >
                {loading ? 'Launching…' : 'Launch Kali Lab'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Terminal tab */}
      {tab === 'terminal' && (
        <div className="card p-4 space-y-4">
          {!activeLab || activeLab.status === 'terminated' ? (
            <p className="text-gray-400">No active lab. Launch one from the Launch tab.</p>
          ) : (
            <>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status</span>
                  <span className="text-white capitalize">{activeLab.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Instance</span>
                  <span className="text-white font-mono text-xs">{activeLab.instanceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Time used</span>
                  <span className="text-white">{activeLab.minutesUsed} / {activeLab.sessionMinutes} min</span>
                </div>
                {activeLab.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Expires</span>
                    <span className="text-white">{new Date(activeLab.expiresAt).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>

              {activeLab.ssmUrl && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">
                    Open the terminal in AWS Session Manager. Phase 2 will embed an in-page terminal here.
                  </p>
                  <a
                    href={activeLab.ssmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary inline-flex"
                  >
                    Open SSM Terminal (new tab)
                  </a>
                </div>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                disabled={loading || activeLab.status === 'stopping'}
                onClick={handleStop}
              >
                Stop Lab
              </button>
            </>
          )}
        </div>
      )}

      {/* Tools tab */}
      {tab === 'tools' && (
        <div className="card p-4">
          <p className="text-sm text-gray-400 mb-4">
            Pre-installed on the Kali AMI. Run via <code className="text-blue-300">netknife-tools list</code> in your lab terminal.
          </p>
          <ul className="space-y-3">
            {TOOLS.map((t) => (
              <li key={t.id} className="border-b border-gray-800 pb-3 last:border-0">
                <span className="text-white font-medium">{t.name}</span>
                <p className="text-sm text-gray-400">{t.desc}</p>
                <code className="text-xs text-blue-300">netknife-tools run {t.id}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="card p-4">
          {history.length === 0 ? (
            <p className="text-gray-400">No lab sessions yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((l) => (
                <li key={l.labId} className="flex flex-wrap justify-between gap-2 text-sm border-b border-gray-800 py-2">
                  <span className="font-mono text-blue-300">{l.labId}</span>
                  <span className="capitalize text-gray-300">{l.status}</span>
                  <span className="text-gray-500">{l.minutesUsed} min · {l.instanceType}</span>
                  <span className="text-gray-600 text-xs">{new Date(l.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
