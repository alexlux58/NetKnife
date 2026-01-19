/**
 * ==============================================================================
 * NETKNIFE - CLOUDFLARE SPEED TEST
 * ==============================================================================
 *
 * Runs Cloudflare's speed test in the browser (same tech as speed.cloudflare.com).
 * Measures: download, upload, latency, jitter. No API key—uses public endpoints.
 *
 * Uses @cloudflare/speedtest → speed.cloudflare.com/__down, /__up
 * ==============================================================================
 */

import { useState, useRef, useCallback } from 'react'
import AddToReportButton from '../../components/AddToReportButton'

function formatMs(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${Math.round(n)} ms`
}

type Phase = 'idle' | 'latency' | 'download' | 'upload' | 'done'

interface Summary {
  downloadMbps: number | undefined
  uploadMbps: number | undefined
  latencyMs: number | undefined
  jitterMs: number | undefined
}

export default function CloudflareSpeedTestTool() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const instanceRef = useRef<{ stop?: () => void } | null>(null)

  const runTest = useCallback(async () => {
    setError('')
    setSummary(null)
    setPhase('latency')

    try {
      const mod = await import('@cloudflare/speedtest')
      const SpeedTest = (mod as { default?: unknown }).default
      if (typeof SpeedTest !== 'function') {
        setError('Speed test module could not be loaded.')
        setPhase('idle')
        return
      }

      // Omit packetLoss: it requires turn-creds from speed.cloudflare.com, which is
      // CORS-blocked when called from tools.alexflux.com. Packet loss is deprecated
      // per @cloudflare/speedtest README. We keep latency, download, upload, jitter.
      const measurements = [
        { type: 'latency' as const, numPackets: 1 },
        { type: 'download' as const, bytes: 1e5, count: 1, bypassMinDuration: true },
        { type: 'latency' as const, numPackets: 20 },
        { type: 'download' as const, bytes: 1e5, count: 9 },
        { type: 'download' as const, bytes: 1e6, count: 8 },
        { type: 'upload' as const, bytes: 1e5, count: 8 },
        { type: 'upload' as const, bytes: 1e6, count: 6 },
        { type: 'download' as const, bytes: 1e7, count: 6 },
        { type: 'upload' as const, bytes: 1e7, count: 4 },
        { type: 'download' as const, bytes: 2.5e7, count: 4 },
        { type: 'upload' as const, bytes: 2.5e7, count: 4 },
        { type: 'download' as const, bytes: 1e8, count: 3 },
        { type: 'upload' as const, bytes: 5e7, count: 3 },
        { type: 'download' as const, bytes: 2.5e8, count: 2 },
      ]

      const test = new (SpeedTest as new (opts?: { autoStart?: boolean; measureDownloadLoadedLatency?: boolean; measureUploadLoadedLatency?: boolean; measurements?: unknown[] }) => {
        onFinish?: (r: unknown) => void
        onResultsChange?: (info: { type?: string }) => void
        onError?: (e: unknown) => void
        stop?: () => void
      })({
        autoStart: true,
        measureDownloadLoadedLatency: false,
        measureUploadLoadedLatency: false,
        measurements,
      })

      instanceRef.current = test

      test.onResultsChange = (info: { type?: string }) => {
        const t = (info?.type || '').toLowerCase()
        if (t === 'latency') setPhase('latency')
        else if (t === 'download') setPhase('download')
        else if (t === 'upload') setPhase('upload')
      }

      test.onFinish = (results: unknown) => {
        instanceRef.current = null
        setPhase('done')
        const r = results as {
          getSummary?: () => { download?: number; upload?: number; latency?: number; jitter?: number }
          getDownloadBandwidth?: () => number | undefined
          getUploadBandwidth?: () => number | undefined
          getUnloadedLatency?: () => number | undefined
          getUnloadedJitter?: () => number | undefined
        }
        const s = r?.getSummary?.() ?? {}
        setSummary({
          downloadMbps: (s.download ?? r?.getDownloadBandwidth?.()) != null
            ? ((s.download ?? r?.getDownloadBandwidth?.()) as number) / 1_000_000
            : undefined,
          uploadMbps: (s.upload ?? r?.getUploadBandwidth?.()) != null
            ? ((s.upload ?? r?.getUploadBandwidth?.()) as number) / 1_000_000
            : undefined,
          latencyMs: (s.latency ?? r?.getUnloadedLatency?.()) as number | undefined,
          jitterMs: (s.jitter ?? r?.getUnloadedJitter?.()) as number | undefined,
        })
      }

      test.onError = (e: unknown) => {
        instanceRef.current = null
        setPhase('idle')
        setError(e instanceof Error ? e.message : String(e))
      }
    } catch (e) {
      setPhase('idle')
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const stopTest = useCallback(() => {
    if (instanceRef.current?.stop) {
      instanceRef.current.stop()
      instanceRef.current = null
    }
    setPhase('idle')
  }, [])

  const isRunning = phase === 'latency' || phase === 'download' || phase === 'upload'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cloudflare Speed Test</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Measure download, upload, latency, and jitter in-browser. Uses the same tech as{' '}
          <a href="https://speed.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            speed.cloudflare.com
          </a>
          . Results can be added to Reports.
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Run the test here to save results to a report, or use the <strong>Speed test</strong> link in the top bar to open speed.cloudflare.com for the full experience.
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={runTest}
            disabled={isRunning}
            className="btn-primary"
          >
            {isRunning ? 'Running…' : 'Run speed test'}
          </button>
          {isRunning && (
            <button type="button" onClick={stopTest} className="btn-secondary">
              Stop
            </button>
          )}
          {isRunning && (
            <span className="text-sm text-[var(--color-text-secondary)]">
              {phase === 'latency' && 'Measuring latency…'}
              {phase === 'download' && 'Measuring download…'}
              {phase === 'upload' && 'Measuring upload…'}
            </span>
          )}
        </div>
      </div>

      {summary && phase === 'done' && (
        <>
          <div className="flex justify-end">
            <AddToReportButton
              toolId="cloudflare-speedtest"
              input=""
              data={{
                downloadMbps: summary.downloadMbps,
                uploadMbps: summary.uploadMbps,
                latencyMs: summary.latencyMs,
                jitterMs: summary.jitterMs,
                source: 'Cloudflare speed test (speed.cloudflare.com)',
              }}
              category="Network Intelligence"
            />
          </div>
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Results</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Download</div>
                <div className="text-xl font-mono text-[var(--color-accent-green)]">
                  {summary.downloadMbps != null
                    ? summary.downloadMbps >= 1000
                      ? `${(summary.downloadMbps / 1000).toFixed(2)} Gbps`
                      : `${summary.downloadMbps.toFixed(2)} Mbps`
                    : '—'}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Upload</div>
                <div className="text-xl font-mono text-[var(--color-accent-blue)]">
                  {summary.uploadMbps != null
                    ? summary.uploadMbps >= 1000
                      ? `${(summary.uploadMbps / 1000).toFixed(2)} Gbps`
                      : `${summary.uploadMbps.toFixed(2)} Mbps`
                    : '—'}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Latency</div>
                <div className="text-xl font-mono">{formatMs(summary.latencyMs)}</div>
              </div>
              <div className="p-4 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Jitter</div>
                <div className="text-xl font-mono">{formatMs(summary.jitterMs)}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
