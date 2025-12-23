/**
 * ==============================================================================
 * NETKNIFE - DIFF TOOL
 * ==============================================================================
 * 
 * Compare two text blocks and show differences.
 * 
 * FEATURES:
 * - Line-by-line diff
 * - Word-level diff
 * - Unified or side-by-side view
 * - Syntax highlighting for changes
 * - Copy individual blocks
 * ==============================================================================
 */

import { useState, useMemo } from 'react'
import { diffLines, diffWords } from 'diff'

type DiffMode = 'lines' | 'words'
type ViewMode = 'unified' | 'split'

export default function DiffTool() {
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [diffMode, setDiffMode] = useState<DiffMode>('lines')
  const [viewMode, setViewMode] = useState<ViewMode>('unified')

  const differences = useMemo(() => {
    if (!leftText && !rightText) return []
    
    if (diffMode === 'lines') {
      return diffLines(leftText, rightText)
    } else {
      return diffWords(leftText, rightText)
    }
  }, [leftText, rightText, diffMode])

  const stats = useMemo(() => {
    let additions = 0
    let deletions = 0
    let unchanged = 0
    
    differences.forEach(part => {
      const count = diffMode === 'lines' 
        ? (part.value.match(/\n/g) || []).length + (part.value.endsWith('\n') ? 0 : 1)
        : part.value.split(/\s+/).filter(Boolean).length
      
      if (part.added) additions += count
      else if (part.removed) deletions += count
      else unchanged += count
    })
    
    return { additions, deletions, unchanged }
  }, [differences, diffMode])

  const loadExample = () => {
    setLeftText(`server {
    listen 80;
    server_name example.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
    }
    
    access_log /var/log/nginx/access.log;
}`)
    setRightText(`server {
    listen 443 ssl;
    server_name example.com;
    
    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
}`)
  }

  const swapTexts = () => {
    const temp = leftText
    setLeftText(rightText)
    setRightText(temp)
  }

  const renderUnifiedDiff = () => {
    return (
      <div className="font-mono text-sm">
        {differences.map((part, index) => {
          const className = part.added
            ? 'bg-emerald-500/20 text-emerald-300'
            : part.removed
            ? 'bg-red-500/20 text-red-300'
            : 'text-gray-400'
          
          const prefix = part.added ? '+' : part.removed ? '-' : ' '
          
          if (diffMode === 'lines') {
            const lines = part.value.split('\n')
            return lines.map((line, lineIndex) => {
              if (lineIndex === lines.length - 1 && line === '') return null
              return (
                <div key={`${index}-${lineIndex}`} className={`px-4 py-0.5 ${className}`}>
                  <span className="select-none opacity-50 mr-2">{prefix}</span>
                  {line || ' '}
                </div>
              )
            })
          } else {
            return (
              <span key={index} className={`${className} ${part.added || part.removed ? 'px-0.5 rounded' : ''}`}>
                {part.value}
              </span>
            )
          }
        })}
      </div>
    )
  }

  const renderSplitDiff = () => {
    // Build line arrays for split view
    const leftLines: { value: string; type: 'unchanged' | 'removed' | 'empty' }[] = []
    const rightLines: { value: string; type: 'unchanged' | 'added' | 'empty' }[] = []
    
    differences.forEach(part => {
      const lines = part.value.split('\n').filter((_, i, arr) => !(i === arr.length - 1 && arr[i] === ''))
      
      if (part.removed) {
        lines.forEach(line => {
          leftLines.push({ value: line, type: 'removed' })
          rightLines.push({ value: '', type: 'empty' })
        })
      } else if (part.added) {
        lines.forEach(line => {
          leftLines.push({ value: '', type: 'empty' })
          rightLines.push({ value: line, type: 'added' })
        })
      } else {
        lines.forEach(line => {
          leftLines.push({ value: line, type: 'unchanged' })
          rightLines.push({ value: line, type: 'unchanged' })
        })
      }
    })
    
    // Merge adjacent empty lines
    const mergedLeft: typeof leftLines = []
    const mergedRight: typeof rightLines = []
    
    let i = 0
    while (i < Math.max(leftLines.length, rightLines.length)) {
      const left = leftLines[i] || { value: '', type: 'empty' as const }
      const right = rightLines[i] || { value: '', type: 'empty' as const }
      
      // Try to pair removed with added
      if (left.type === 'removed' && right.type === 'empty') {
        // Look ahead for an added line
        let j = i + 1
        while (j < rightLines.length && rightLines[j].type === 'empty') j++
        if (j < rightLines.length && rightLines[j].type === 'added') {
          mergedLeft.push(left)
          mergedRight.push(rightLines[j])
          rightLines[j] = { value: '', type: 'empty' }
        } else {
          mergedLeft.push(left)
          mergedRight.push(right)
        }
      } else {
        mergedLeft.push(left)
        mergedRight.push(right)
      }
      i++
    }
    
    const getLineClass = (type: string) => {
      switch (type) {
        case 'removed': return 'bg-red-500/20'
        case 'added': return 'bg-emerald-500/20'
        case 'empty': return 'bg-[#1c1c1c]'
        default: return ''
      }
    }
    
    return (
      <div className="grid grid-cols-2 gap-0 font-mono text-sm">
        <div className="border-r border-[#30363d]">
          <div className="px-3 py-1 bg-red-500/10 text-red-400 font-medium text-xs border-b border-[#30363d]">
            Original
          </div>
          {mergedLeft.map((line, index) => (
            <div key={index} className={`px-3 py-0.5 ${getLineClass(line.type)}`}>
              <span className={line.type === 'removed' ? 'text-red-300' : 'text-gray-400'}>
                {line.value || '\u00A0'}
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 font-medium text-xs border-b border-[#30363d]">
            Modified
          </div>
          {mergedRight.map((line, index) => (
            <div key={index} className={`px-3 py-0.5 ${getLineClass(line.type)}`}>
              <span className={line.type === 'added' ? 'text-emerald-300' : 'text-gray-400'}>
                {line.value || '\u00A0'}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Diff Tool</h1>
        <p className="text-gray-400 mt-1">
          Compare two text blocks and highlight differences
        </p>
      </div>

      {/* Controls */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Mode:</span>
            <div className="flex bg-[#161b22] rounded-lg p-1">
              <button
                onClick={() => setDiffMode('lines')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  diffMode === 'lines' ? 'bg-blue-500 text-white' : 'text-gray-400'
                }`}
              >
                Lines
              </button>
              <button
                onClick={() => setDiffMode('words')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  diffMode === 'words' ? 'bg-blue-500 text-white' : 'text-gray-400'
                }`}
              >
                Words
              </button>
            </div>
          </div>

          {/* View Toggle */}
          {diffMode === 'lines' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">View:</span>
              <div className="flex bg-[#161b22] rounded-lg p-1">
                <button
                  onClick={() => setViewMode('unified')}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    viewMode === 'unified' ? 'bg-blue-500 text-white' : 'text-gray-400'
                  }`}
                >
                  Unified
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    viewMode === 'split' ? 'bg-blue-500 text-white' : 'text-gray-400'
                  }`}
                >
                  Split
                </button>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <button
            onClick={swapTexts}
            className="px-3 py-1 text-sm text-gray-400 hover:text-white border border-[#30363d] rounded hover:bg-[#21262d] transition-colors"
          >
            ⇄ Swap
          </button>

          {/* Example Button */}
          <button
            onClick={loadExample}
            className="px-3 py-1 text-sm text-blue-400 hover:text-blue-300"
          >
            Load Example
          </button>

          {/* Stats */}
          {(leftText || rightText) && (
            <div className="flex items-center gap-3 ml-auto text-sm">
              <span className="text-emerald-400">+{stats.additions}</span>
              <span className="text-red-400">-{stats.deletions}</span>
              <span className="text-gray-500">{stats.unchanged} unchanged</span>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-red-400">Original Text</label>
            <button
              onClick={() => setLeftText('')}
              className="text-xs text-gray-500 hover:text-white"
            >
              Clear
            </button>
          </div>
          <textarea
            value={leftText}
            onChange={(e) => setLeftText(e.target.value)}
            placeholder="Paste original text here..."
            className="input font-mono text-sm min-h-[200px]"
            spellCheck={false}
          />
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-emerald-400">Modified Text</label>
            <button
              onClick={() => setRightText('')}
              className="text-xs text-gray-500 hover:text-white"
            >
              Clear
            </button>
          </div>
          <textarea
            value={rightText}
            onChange={(e) => setRightText(e.target.value)}
            placeholder="Paste modified text here..."
            className="input font-mono text-sm min-h-[200px]"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Diff Output */}
      {differences.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 bg-[#161b22] border-b border-[#30363d] text-sm text-gray-400">
            Differences
          </div>
          <div className="max-h-[500px] overflow-auto">
            {diffMode === 'lines' && viewMode === 'split' 
              ? renderSplitDiff() 
              : renderUnifiedDiff()
            }
          </div>
        </div>
      )}

      {/* Empty State */}
      {!leftText && !rightText && (
        <div className="card p-8 text-center text-gray-500">
          <p>Enter text in both fields to see differences</p>
        </div>
      )}
    </div>
  )
}

