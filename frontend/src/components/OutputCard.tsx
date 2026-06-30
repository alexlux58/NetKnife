/**
 * ==============================================================================
 * NETKNIFE - OUTPUT CARD COMPONENT
 * ==============================================================================
 */

import { useState } from 'react'
import { copyToClipboard, redactSecrets } from '../lib/utils'

interface OutputCardProps {
  title: string
  value?: string
  onCopy?: () => void
  canCopy?: boolean
  children?: React.ReactNode
  loading?: boolean
  error?: string
  emptyMessage?: string
}

export default function OutputCard({
  title,
  value,
  onCopy,
  canCopy = false,
  children,
  loading = false,
  error,
  emptyMessage = 'No output yet',
}: OutputCardProps) {
  const displayValue = value || (children ? '' : '')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'redacted'>('idle')

  async function handleCopy(redact: boolean) {
    if (!displayValue) return
    const textToCopy = redact ? redactSecrets(displayValue) : displayValue
    await copyToClipboard(textToCopy)
    setCopyState(redact ? 'redacted' : 'copied')
    onCopy?.()
    setTimeout(() => setCopyState('idle'), 2000)
  }

  const showCopy = (canCopy || displayValue) && !loading && !error

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="font-medium text-sm sm:text-base truncate text-[var(--color-text-primary)]">{title}</h3>

        {showCopy && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => handleCopy(false)}
              disabled={!displayValue}
              className={`btn-primary text-xs !py-2 !px-3 min-h-[40px] sm:min-h-[32px] ${
                copyState === 'copied' ? 'bg-green-600' : ''
              }`}
            >
              {copyState === 'copied' ? 'Copied!' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() => handleCopy(true)}
              disabled={!displayValue}
              className={`btn-secondary text-xs !py-2 !px-3 min-h-[40px] sm:min-h-[32px] ${
                copyState === 'redacted' ? 'bg-green-600 text-white' : ''
              }`}
            >
              {copyState === 'redacted' ? 'Copied!' : 'Redacted'}
            </button>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4 text-sm overflow-auto min-h-[120px] max-h-[50vh] sm:max-h-[500px] scrollbar-thin">
        {loading ? (
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]" role="status">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[var(--color-accent-blue)]" />
            Loading…
          </div>
        ) : error ? (
          <p className="text-[var(--color-accent-red)] whitespace-pre-wrap" role="alert">{error}</p>
        ) : children ? (
          children
        ) : displayValue ? (
          <pre className="whitespace-pre-wrap font-mono text-[var(--color-text-primary)]">{displayValue}</pre>
        ) : (
          <span className="text-[var(--color-text-muted)]">{emptyMessage}</span>
        )}
      </div>
    </div>
  )
}
