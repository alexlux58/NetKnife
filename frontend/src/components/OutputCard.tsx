/**
 * ==============================================================================
 * NETKNIFE - OUTPUT CARD COMPONENT
 * ==============================================================================
 * 
 * Displays tool output with copy functionality.
 * 
 * FEATURES:
 * - Monospace formatted output
 * - Copy to clipboard button
 * - Copy (redacted) button for sharing
 * - Scrollable for long output
 * 
 * USAGE:
 * ```tsx
 * <OutputCard
 *   title="Result"
 *   value={jsonOutput}
 *   onCopy={() => console.log('Copied!')}
 * />
 * ```
 * ==============================================================================
 */

import { useState } from 'react'
import { copyToClipboard, redactSecrets } from '../lib/utils'

interface OutputCardProps {
  /** Card title */
  title: string
  /** Output value to display (string or use children) */
  value?: string
  /** Optional callback when copied */
  onCopy?: () => void
  /** Whether to show copy buttons */
  canCopy?: boolean
  /** Children content (alternative to value) */
  children?: React.ReactNode
}

export default function OutputCard({ title, value, onCopy, canCopy = false, children }: OutputCardProps) {
  const displayValue = value || (children ? '' : '')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'redacted'>('idle')

  async function handleCopy(redact: boolean) {
    if (!displayValue) return
    const textToCopy = redact ? redactSecrets(displayValue) : displayValue
    await copyToClipboard(textToCopy)
    setCopyState(redact ? 'redacted' : 'copied')
    onCopy?.()
    
    // Reset after 2 seconds
    setTimeout(() => setCopyState('idle'), 2000)
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
        <h3 className="font-medium">{title}</h3>
        
        {/* Copy buttons - only show if canCopy or value exists */}
        {(canCopy || displayValue) && (
          <div className="flex gap-2">
            <button
              onClick={() => handleCopy(false)}
              disabled={!displayValue}
              className={`btn-primary text-xs py-1 px-2 ${
                copyState === 'copied' ? 'bg-green-600' : ''
              }`}
            >
              {copyState === 'copied' ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={() => handleCopy(true)}
              disabled={!displayValue}
              className={`btn-secondary text-xs py-1 px-2 ${
                copyState === 'redacted' ? 'bg-green-600 text-white' : ''
              }`}
            >
              {copyState === 'redacted' ? 'Copied!' : 'Copy (redacted)'}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 text-sm overflow-auto min-h-[150px] max-h-[500px] scrollbar-thin">
        {children ? (
          children
        ) : displayValue ? (
          <pre className="whitespace-pre-wrap font-mono">{displayValue}</pre>
        ) : (
          <span className="text-gray-500">No output yet</span>
        )}
      </div>
    </div>
  )
}

