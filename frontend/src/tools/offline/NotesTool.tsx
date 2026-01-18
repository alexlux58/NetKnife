/**
 * Notion-like notes: block-based editor. Add notes to reports.
 * Blocks: paragraph, heading, bullet, numbered, code, quote, divider.
 */

import { useState } from 'react'
import { useReport, ReportCategory } from '../../lib/reportContext'
import { createBlock, noteTitle, type NoteBlock } from '../../lib/noteBlocks'
import NoteBlocksView from '../../components/NoteBlocksView'
import OutputCard from '../../components/OutputCard'

const BLOCK_OPTIONS: { type: NoteBlock['type']; label: string }[] = [
  { type: 'paragraph', label: 'Text' },
  { type: 'heading', label: 'Heading' },
  { type: 'bullet', label: 'Bullet' },
  { type: 'numbered', label: 'Numbered' },
  { type: 'code', label: 'Code' },
  { type: 'quote', label: 'Quote' },
  { type: 'divider', label: '—' },
]

export default function NotesTool() {
  const { addToReport, currentReport } = useReport()
  const [blocks, setBlocks] = useState<NoteBlock[]>([createBlock('paragraph')])
  const [added, setAdded] = useState(false)
  const [category, setCategory] = useState<ReportCategory>('general')

  function updateBlock(i: number, patch: Partial<NoteBlock>) {
    setBlocks((prev) => {
      const next = [...prev]
      const b = next[i]
      if (!b) return prev
      if (b.type === 'divider') return prev
      next[i] = { ...b, ...patch } as NoteBlock
      return next
    })
  }

  function insertBlockAfter(i: number, type: NoteBlock['type']) {
    setBlocks((prev) => {
      const next = [...prev]
      next.splice(i + 1, 0, createBlock(type))
      return next
    })
  }

  function removeBlock(i: number) {
    if (blocks.length <= 1) return
    setBlocks((prev) => prev.filter((_, j) => j !== i))
  }

  function addBlock(type: NoteBlock['type']) {
    setBlocks((prev) => [...prev, createBlock(type)])
  }

  function handleAddToReport() {
    const title = noteTitle(blocks)
    addToReport('notes', 'Notes', title, { blocks }, category)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const itemCount = currentReport?.items.length || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-gray-400 text-sm">
          Add blocks, write notes, then add to your report. Notes are saved with tool results.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ReportCategory)}
            className="input py-1.5 text-sm"
          >
            <option value="general">General</option>
            <option value="pentest">Pentest</option>
            <option value="breach">Breach</option>
            <option value="report">Report</option>
          </select>
          <button
            onClick={handleAddToReport}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors min-h-[40px] ${
              added ? 'bg-green-600 text-white' : 'btn-primary'
            }`}
          >
            {added ? '✓ Added to Report' : `Add to Report${itemCount > 0 ? ` (${itemCount})` : ''}`}
          </button>
        </div>
      </div>

      {/* Block type toolbar */}
      <div className="flex flex-wrap gap-1">
        {BLOCK_OPTIONS.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => addBlock(type)}
            className="px-2 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
          >
            + {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setBlocks([createBlock('paragraph')])}
          className="px-2 py-1.5 text-xs rounded bg-gray-800 hover:bg-red-900/40 text-gray-400"
        >
          Clear all
        </button>
      </div>

      {/* Block editor */}
      <div className="card p-4 space-y-3">
        {blocks.map((b, i) => (
          <div key={i} className="group flex gap-2">
            <div className="flex flex-col gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <select
                value={b.type}
                onChange={(e) => {
                  const t = e.target.value as NoteBlock['type']
                  if (t === 'divider') {
                    setBlocks((prev) => {
                      const n = [...prev]
                      n[i] = createBlock('divider')
                      return n
                    })
                  } else {
                    setBlocks((prev) => {
                      const n = [...prev]
                      const cur = n[i]
                      const text = (cur && cur.type !== 'divider' ? (cur as { text?: string }).text : '') ?? ''
                      n[i] = t === 'heading' ? { type: 'heading', level: 1, text } : t === 'code' ? { type: 'code', text, language: '' } : { type: t, text } as NoteBlock
                      return n
                    })
                  }
                }}
                className="input py-1 text-xs w-28"
              >
                {BLOCK_OPTIONS.map((o) => (
                  <option key={o.type} value={o.type}>{o.label}</option>
                ))}
              </select>
              <button type="button" onClick={() => insertBlockAfter(i, 'paragraph')} className="text-xs text-blue-400 hover:underline">+ below</button>
              <button type="button" onClick={() => removeBlock(i)} className="text-xs text-red-400 hover:underline">Remove</button>
            </div>
            <div className="flex-1 min-w-0 flex items-start gap-2">
              {b.type === 'divider' ? (
                <hr className="border-gray-600 w-full" />
              ) : b.type === 'heading' ? (
                <>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {([1, 2, 3] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => updateBlock(i, { level: l })}
                        className={`px-1.5 py-0.5 text-xs rounded ${b.level === l ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                      >
                        H{l}
                      </button>
                    ))}
                  </div>
                  <input
                    value={b.text}
                    onChange={(e) => updateBlock(i, { text: e.target.value })}
                    placeholder="Heading"
                    className={`input flex-1 ${b.level === 1 ? 'text-lg font-semibold' : b.level === 2 ? 'text-base font-medium' : 'text-sm'}`}
                  />
                </>
              ) : b.type === 'code' ? (
                <textarea
                  value={b.text}
                  onChange={(e) => updateBlock(i, { text: e.target.value })}
                  placeholder="Code..."
                  className="input w-full font-mono text-sm min-h-[100px]"
                  spellCheck={false}
                />
              ) : (
                <textarea
                  value={b.text}
                  onChange={(e) => updateBlock(i, { text: e.target.value })}
                  placeholder={b.type === 'paragraph' ? 'Write...' : b.type === 'quote' ? 'Quote...' : 'Item...'}
                  className="input w-full resize-y min-h-[2rem]"
                  rows={b.type === 'quote' ? 2 : 1}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview */}
      <OutputCard title="Preview" canCopy={false}>
        <NoteBlocksView blocks={blocks} />
      </OutputCard>
    </div>
  )
}
