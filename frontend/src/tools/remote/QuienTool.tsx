/**
 * Quien — domain/IP lookup with quien-style tabs (WHOIS, DNS, Mail, TLS, HTTP).
 */

import { useEffect } from 'react'
import RemoteDisclosure from '../../components/RemoteDisclosure'
import AddToReportButton from '../../components/AddToReportButton'
import { ApiError } from '../../lib/api'
import { useToolState } from '../../lib/useToolState'
import { fetchQuienBundle, QUIEN_TABS, type QuienBundle, type QuienTab } from './quienFetch'
import { QuienTabPanel } from './quienPanels'

export default function QuienTool() {
  const [state, setState] = useToolState(
    'quien',
    {
      query: 'alexflux.com',
      tab: 'whois' as QuienTab,
      loading: false,
      bundle: null as QuienBundle | null,
      error: '',
    },
    { exclude: ['bundle'] }
  )
  const { query, tab, loading, bundle, error } = state

  async function handleLookup() {
    const q = query.trim()
    if (!q) return
    setState({ loading: true, error: '', bundle: null })
    try {
      const result = await fetchQuienBundle(q)
      if (!result.whois && result.tabErrors.whois) {
        throw new Error(result.tabErrors.whois)
      }
      setState({ bundle: result, loading: false, tab: result.isDomain ? tab : 'whois' })
    } catch (e) {
      if (e instanceof ApiError) {
        setState({ error: `Error ${e.status}: ${JSON.stringify(e.body)}`, loading: false })
      } else {
        setState({ error: e instanceof Error ? e.message : String(e), loading: false })
      }
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!bundle || loading) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const match = QUIEN_TABS.find((t) => t.shortcut === e.key)
      if (!match) return
      if (match.domainOnly && !bundle.isDomain) return
      e.preventDefault()
      setState({ tab: match.id })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bundle, loading, setState])

  const examples = [
    { label: 'alexflux.com', value: 'alexflux.com' },
    { label: 'Google DNS', value: '8.8.8.8' },
    { label: 'Cloudflare', value: '1.1.1.1' },
  ]

  const visibleTabs = QUIEN_TABS.filter((t) => !t.domainOnly || bundle?.isDomain !== false)

  return (
    <div className="space-y-6">
      <RemoteDisclosure
        sends={['Domain name or IP address']}
        notes="Multi-tab domain recon like the quien CLI: WHOIS, DNS, mail auth, TLS, and HTTP headers."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Domain or IP</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setState({ query: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              placeholder="alexflux.com or 8.8.8.8"
              className="input font-mono"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={handleLookup} disabled={loading || !query.trim()} className="btn-primary">
              {loading ? 'Looking up…' : 'Lookup'}
            </button>
            {examples.map((ex) => (
              <button
                key={ex.value}
                type="button"
                onClick={() => setState({ query: ex.value })}
                className="btn-secondary text-xs py-1 px-2"
              >
                {ex.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="card bg-red-950/30 border-red-900/50 p-4 text-sm text-red-400">{error}</div>
          )}

          <div className="card p-4 text-sm text-gray-400 space-y-2">
            <p>
              Tabbed domain recon like the quien CLI. Domains load WHOIS, DNS, mail auth, TLS, and HTTP in one lookup.
            </p>
            <p className="text-xs text-gray-500">
              Keyboard: press <kbd className="px-1 rounded bg-gray-800">w</kbd>{' '}
              <kbd className="px-1 rounded bg-gray-800">d</kbd>{' '}
              <kbd className="px-1 rounded bg-gray-800">m</kbd>{' '}
              <kbd className="px-1 rounded bg-gray-800">s</kbd>{' '}
              <kbd className="px-1 rounded bg-gray-800">h</kbd> to switch tabs after a lookup.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {bundle && (
            <>
              <div className="flex justify-end">
                <AddToReportButton toolId="quien" input={query} data={bundle} category="DNS & Domain" />
              </div>

              <div className="flex flex-wrap gap-1 border-b border-gray-700 pb-0">
                {visibleTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setState({ tab: t.id })}
                    className={`px-3 py-2 text-sm font-medium rounded-t transition-colors ${
                      tab === t.id
                        ? 'bg-[#0d1117] text-cyan-400 border border-gray-700 border-b-[#0d1117] -mb-px'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="text-gray-500 mr-1">[{t.shortcut}]</span>
                    {t.label}
                  </button>
                ))}
              </div>

              <QuienTabPanel tab={tab} bundle={bundle} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
