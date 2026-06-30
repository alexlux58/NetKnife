/**
 * ==============================================================================
 * JSON VIEWER COMPONENT
 * ==============================================================================
 * 
 * A beautiful JSON viewer with:
 * - Syntax highlighted raw JSON view
 * - Pretty formatted table/card view
 * - Collapsible nested objects
 * - Copy to clipboard
 * - Toggle between views
 * ==============================================================================
 */

import { useState, useMemo } from 'react'
import { CheckIcon, ClipboardIcon, ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons'
import { copyToClipboard } from '../lib/utils'

// ------------------------------------------------------------------------------
// TYPES
// ------------------------------------------------------------------------------

interface JsonViewerProps {
  /** Data to display (can be any JSON-serializable value) */
  data?: unknown
  /** Alias for data prop */
  json?: unknown
  /** Card title */
  title?: string
  /** Default view mode */
  defaultView?: 'formatted' | 'raw'
  /** Max depth for nested object expansion */
  maxDepth?: number
  /** Error message to display instead of data */
  error?: string
  /** Additional content to render below the JSON */
  children?: React.ReactNode
}

// ------------------------------------------------------------------------------
// SYNTAX HIGHLIGHTING
// ------------------------------------------------------------------------------

function syntaxHighlight(json: string): string {
  // Escape HTML
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  
  // Apply syntax highlighting with CSS classes
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'text-amber-400' // number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-cyan-400' // key
        } else {
          cls = 'text-green-400' // string
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-purple-400' // boolean
      } else if (/null/.test(match)) {
        cls = 'text-gray-500' // null
      }
      return `<span class="${cls}">${match}</span>`
    }
  )
}

// ------------------------------------------------------------------------------
// COLLAPSIBLE VALUE COMPONENT
// ------------------------------------------------------------------------------

interface CollapsibleValueProps {
  label: string
  value: unknown
  depth: number
  maxDepth: number
}

function CollapsibleValue({ label, value, depth, maxDepth }: CollapsibleValueProps) {
  const [isOpen, setIsOpen] = useState(depth < 2) // Auto-expand first 2 levels
  
  const isObject = value !== null && typeof value === 'object'
  const isArray = Array.isArray(value)
  
  // Format display value for primitives
  const displayValue = useMemo(() => {
    if (value === null) return <span className="text-gray-500 italic">null</span>
    if (value === undefined) return <span className="text-gray-500 italic">undefined</span>
    if (typeof value === 'boolean') return <span className="text-purple-400">{String(value)}</span>
    if (typeof value === 'number') return <span className="text-amber-400">{value}</span>
    if (typeof value === 'string') {
      // Check if it's a URL
      if (value.match(/^https?:\/\//)) {
        return (
          <a 
            href={value} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline break-all"
          >
            {value}
          </a>
        )
      }
      // Check if it's a date
      if (value.match(/^\d{4}-\d{2}-\d{2}T/)) {
        return (
          <span className="text-green-400">
            {new Date(value).toLocaleString()}
            <span className="text-gray-600 text-xs ml-2">({value})</span>
          </span>
        )
      }
      // Check if it's an email
      if (value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return <span className="text-green-400">{value}</span>
      }
      return <span className="text-green-400 break-all">"{value}"</span>
    }
    return String(value)
  }, [value])
  
  if (!isObject) {
    return (
      <div className="flex items-start py-1 border-b border-gray-800/50 last:border-0">
        <span className="text-cyan-400 font-medium min-w-[120px] shrink-0">{label}:</span>
        <span className="ml-2">{displayValue}</span>
      </div>
    )
  }
  
  // For objects and arrays
  const entries = isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value as object)
  const isEmpty = entries.length === 0
  
  if (isEmpty) {
    return (
      <div className="flex items-start py-1 border-b border-gray-800/50 last:border-0">
        <span className="text-cyan-400 font-medium min-w-[120px] shrink-0">{label}:</span>
        <span className="ml-2 text-gray-500 italic">{isArray ? '[]' : '{}'}</span>
      </div>
    )
  }
  
  // Don't expand beyond maxDepth
  if (depth >= maxDepth) {
    return (
      <div className="flex items-start py-1 border-b border-gray-800/50 last:border-0">
        <span className="text-cyan-400 font-medium min-w-[120px] shrink-0">{label}:</span>
        <span className="ml-2 text-gray-500 italic">
          {isArray ? `[${entries.length} items]` : `{${entries.length} keys}`}
        </span>
      </div>
    )
  }
  
  return (
    <div className="py-1 border-b border-gray-800/50 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center w-full text-left hover:bg-gray-800/30 rounded px-1 -ml-1"
      >
        {isOpen ? (
          <ChevronDownIcon className="w-4 h-4 text-gray-500 shrink-0" />
        ) : (
          <ChevronRightIcon className="w-4 h-4 text-gray-500 shrink-0" />
        )}
        <span className="text-cyan-400 font-medium ml-1">{label}</span>
        <span className="text-gray-500 ml-2 text-sm">
          {isArray ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </button>
      
      {isOpen && (
        <div className="ml-4 pl-3 border-l border-gray-700/50 mt-1">
          {entries.map(([key, val]) => (
            <CollapsibleValue
              key={key}
              label={key}
              value={val}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------------------

export default function JsonViewer({ 
  data,
  json,
  title = 'Response',
  defaultView = 'formatted',
  maxDepth = 5,
  error,
  children,
}: JsonViewerProps) {
  const [view, setView] = useState<'formatted' | 'raw'>(defaultView)
  const [copied, setCopied] = useState(false)
  
  // Support both data and json props
  const displayData = data ?? json
  
  const jsonString = useMemo(() => {
    try {
      return JSON.stringify(displayData, null, 2)
    } catch {
      return String(displayData)
    }
  }, [displayData])
  
  const highlightedJson = useMemo(() => syntaxHighlight(jsonString), [jsonString])
  
  async function handleCopy() {
    try {
      await copyToClipboard(jsonString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error('Failed to copy')
    }
  }
  
  // Show error if present
  if (error) {
    return (
      <div className="card p-4 border-[var(--color-error)]/50 bg-[var(--color-error)]/10">
        <h3 className="font-medium text-[var(--color-accent-red)] mb-2">{title}</h3>
        <pre className="text-sm text-[var(--color-accent-red)] whitespace-pre-wrap">{error}</pre>
      </div>
    )
  }
  
  if (!displayData) return null
  
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/50">
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</span>
        
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md overflow-hidden border border-[var(--color-border)]">
            <button
              onClick={() => setView('formatted')}
              className={`px-3 py-1 text-xs transition-colors min-h-[44px] sm:min-h-0 ${
                view === 'formatted'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Formatted
            </button>
            <button
              onClick={() => setView('raw')}
              className={`px-3 py-1 text-xs transition-colors min-h-[44px] sm:min-h-0 ${
                view === 'raw'
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Raw JSON
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="p-2 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
            title="Copy to clipboard"
          >
            {copied ? (
              <CheckIcon className="w-4 h-4 text-green-400" />
            ) : (
              <ClipboardIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 max-h-[600px] overflow-auto">
        {view === 'raw' ? (
          <pre 
            className="text-sm font-mono whitespace-pre-wrap break-all"
            dangerouslySetInnerHTML={{ __html: highlightedJson }}
          />
        ) : (
          <div className="text-sm">
            {typeof displayData === 'object' && displayData !== null ? (
              Object.entries(displayData).map(([key, value]) => (
                <CollapsibleValue
                  key={key}
                  label={key}
                  value={value}
                  depth={0}
                  maxDepth={maxDepth}
                />
              ))
            ) : (
              <span>{String(displayData)}</span>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

