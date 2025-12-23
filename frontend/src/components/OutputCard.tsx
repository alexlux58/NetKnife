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
  /** Output value to display */
  value: string
  /** Optional callback when copied */
  onCopy?: () => void
}

export default function OutputCard({ title, value, onCopy }: OutputCardProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'redacted'>('idle')

  async function handleCopy(redact: boolean) {
    const textToCopy = redact ? redactSecrets(value) : value
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
        
        {/* Copy buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleCopy(false)}
            disabled={!value}
            className={`btn-primary text-xs py-1 px-2 ${
              copyState === 'copied' ? 'bg-green-600' : ''
            }`}
          >
            {copyState === 'copied' ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={() => handleCopy(true)}
            disabled={!value}
            className={`btn-secondary text-xs py-1 px-2 ${
              copyState === 'redacted' ? 'bg-green-600 text-white' : ''
            }`}
          >
            {copyState === 'redacted' ? 'Copied!' : 'Copy (redacted)'}
          </button>
        </div>
      </div>

      {/* Content */}
      <pre className="p-4 text-sm overflow-auto whitespace-pre-wrap font-mono min-h-[150px] max-h-[500px] scrollbar-thin">
        {value || <span className="text-gray-500">No output yet</span>}
      </pre>
    </div>
  )
}

