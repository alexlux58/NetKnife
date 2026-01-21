/**
 * CloudWatch Alarms dashboard. Admin-only (alex.lux or admin_usernames).
 * Replaces or complements email alerts with an in-app view.
 */

import { useEffect, useState } from 'react'
import { apiClient, ApiError } from '../../lib/api'

interface Alarm {
  name: string
  description: string | null
  state: string
  stateReason: string | null
  stateUpdated: string | null
  metric: string
  namespace: string
  threshold?: number
  comparison?: string
  period?: number
  statistic?: string
}

interface HistoryItem {
  name: string
  type: string
  summary: string | null
  timestamp: string | null
}

interface AlarmsResponse {
  alarms: Alarm[]
  history: HistoryItem[]
  region: string
}

function consoleAlarmsUrl(region: string) {
  const r = region || 'us-west-2'
  return `https://${r}.console.aws.amazon.com/cloudwatch/home?region=${r}#alarmsV2:`
}

export default function AlarmsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AlarmsResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiClient
      .post<AlarmsResponse>('/alarms', {})
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 403) {
          setError('Only allowed users can view the alarms dashboard.')
        } else {
          setError(e instanceof Error ? e.message : 'Failed to load alarms')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const refresh = () => {
    setLoading(true)
    setError(null)
    apiClient
      .post<AlarmsResponse>('/alarms', {})
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold mb-4">Alarms</h1>
        <div className="card p-6 border-amber-900/50 bg-amber-950/20">
          <p className="text-amber-400">{error}</p>
        </div>
      </div>
    )
  }

  const alarms = data?.alarms ?? []
  const history = data?.history ?? []
  const inAlarm = alarms.filter((a) => a.state === 'ALARM')
  const ok = alarms.filter((a) => a.state === 'OK')
  const other = alarms.filter((a) => a.state !== 'ALARM' && a.state !== 'OK')

  const stateBadge = (state: string) => {
    const c =
      state === 'ALARM'
        ? 'bg-red-500/20 text-red-400 border-red-900/50'
        : state === 'OK'
          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-900/50'
          : 'bg-gray-500/20 text-gray-400 border-gray-700'
    return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${c}`}>{state}</span>
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">CloudWatch Alarms</h1>
        <div className="flex items-center gap-2">
          <a
            href={consoleAlarmsUrl(data?.region ?? '')}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-400 hover:underline"
          >
            Open in AWS Console
          </a>
          <button onClick={refresh} disabled={loading} className="btn-secondary text-sm py-2">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <p className="text-gray-400 text-sm">
        NetKnife ops alarms (Lambda, API Gateway). Email alerts are unchanged; this is an in-app view. Only admins can see this page.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-2xl font-bold text-red-400">{inAlarm.length}</div>
          <div className="text-xs text-gray-400">In alarm</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-emerald-400">{ok.length}</div>
          <div className="text-xs text-gray-400">OK</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-400">{other.length}</div>
          <div className="text-xs text-gray-400">Other</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold">{alarms.length}</div>
          <div className="text-xs text-gray-400">Total</div>
        </div>
      </div>

      {/* Alarms table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-[#30363d] font-medium">Alarms</div>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-gray-400 border-b border-[#30363d]">
                <th className="px-3 sm:px-4 py-2">State</th>
                <th className="px-3 sm:px-4 py-2">Name</th>
                <th className="px-3 sm:px-4 py-2 hidden md:table-cell">Metric</th>
                <th className="px-3 sm:px-4 py-2 hidden lg:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody>
              {alarms.map((a) => (
                <tr key={a.name} className="border-b border-[#21262d] last:border-0">
                  <td className="px-3 sm:px-4 py-2">{stateBadge(a.state)}</td>
                  <td className="px-3 sm:px-4 py-2">
                    <div className="space-y-1">
                      <span className="font-mono text-xs break-all">{a.name}</span>
                    {a.stateReason && (
                        <div className="text-gray-500 text-xs max-w-md">{a.stateReason}</div>
                      )}
                      <div className="md:hidden text-gray-400 text-xs">
                        {a.namespace} / {a.metric}
                      </div>
                      <div className="lg:hidden text-gray-500 text-xs">
                        {a.stateUpdated ? new Date(a.stateUpdated).toLocaleString() : '—'}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-2 text-gray-400 hidden md:table-cell">
                    {a.namespace} / {a.metric}
                  </td>
                  <td className="px-3 sm:px-4 py-2 text-gray-500 text-xs hidden lg:table-cell">
                    {a.stateUpdated ? new Date(a.stateUpdated).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent history */}
      {history.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#30363d] font-medium">Recent state changes (24h)</div>
          <ul className="divide-y divide-[#21262d] max-h-64 overflow-y-auto">
            {history.map((h, i) => (
              <li key={i} className="px-4 py-2 text-sm flex flex-wrap items-baseline gap-2">
                <span className="text-gray-500 text-xs">{h.timestamp ? new Date(h.timestamp).toLocaleString() : '—'}</span>
                <span className="font-mono text-xs">{h.name}</span>
                {h.summary && <span className="text-gray-400 truncate">{h.summary}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
