/**
 * Activity dashboard: recent board actions (channel create, thread, comment, DM).
 * Admin-only (alex.lux or admin_usernames). User alex.lux can view other users' actions.
 */

import { useEffect, useState } from 'react'
import { activityList } from '../../lib/board'
import { ApiError } from '../../lib/api'

type Item = { action: string; userId: string; username: string; target: string; details: string; createdAt: string }

export default function ActivityPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])

  const load = () => {
    setLoading(true)
    setError(null)
    activityList()
      .then((r) => setItems(r.items || []))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 403) {
          setError('Only admins can view the activity dashboard.')
        } else {
          setError(e instanceof Error ? e.message : 'Failed to load activity')
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400" />
      </div>
    )
  }

  if (error && items.length === 0) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold mb-4">Activity</h1>
        <div className="card p-6 border-amber-900/50 bg-amber-950/20">
          <p className="text-amber-400">{error}</p>
        </div>
      </div>
    )
  }

  const actionLabel: Record<string, string> = {
    'channel-create': 'Channel created',
    'thread-create': 'Thread created',
    'comment-add': 'Comment',
    'dm-send': 'DM sent',
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Activity</h1>
        <button onClick={load} disabled={loading} className="btn-secondary text-sm py-2">
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <p className="text-gray-400 text-sm">
        Recent board actions: channels, threads, comments, DMs. Only admins can see this page.
      </p>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-[#30363d] font-medium">Recent</div>
        <ul className="divide-y divide-[#21262d] max-h-[60vh] overflow-y-auto">
          {items.length === 0 && <li className="px-4 py-6 text-gray-500 text-center text-sm">No activity yet</li>}
          {items.map((i, idx) => (
            <li key={idx} className="px-4 py-3 text-sm flex flex-wrap items-baseline gap-2">
              <span className="text-gray-500 text-xs shrink-0">{i.createdAt ? new Date(i.createdAt).toLocaleString() : '—'}</span>
              <span className="text-blue-400 font-medium shrink-0">{i.username || i.userId || '?'}</span>
              <span className="text-gray-400 shrink-0">{actionLabel[i.action] || i.action}</span>
              {i.target && <span className="text-gray-500 font-mono text-xs truncate max-w-[200px]" title={i.target}>{i.target}</span>}
              {i.details && <span className="text-gray-500 truncate max-w-[280px]" title={i.details}>{i.details}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
