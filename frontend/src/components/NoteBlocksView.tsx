/**
 * Read-only renderer for note blocks. Used in Report Builder and PDF.
 */

import type { NoteBlock } from '../lib/noteBlocks'

interface NoteBlocksViewProps {
  blocks: NoteBlock[]
  className?: string
}

export default function NoteBlocksView({ blocks, className = '' }: NoteBlocksViewProps) {
  if (!blocks || blocks.length === 0) {
    return <p className="text-gray-500 text-sm italic">Empty note</p>
  }

  return (
    <div className={`space-y-2 text-sm ${className}`}>
      {blocks.map((b, i) => {
        if (b.type === 'paragraph') {
          return <p key={i} className="text-gray-300 whitespace-pre-wrap">{b.text || '\u00a0'}</p>
        }
        if (b.type === 'heading') {
          const Tag = `h${b.level}` as 'h1' | 'h2' | 'h3'
          const size = b.level === 1 ? 'text-lg' : b.level === 2 ? 'text-base' : 'text-sm'
          return <Tag key={i} className={`font-semibold text-white ${size}`}>{b.text || '\u00a0'}</Tag>
        }
        if (b.type === 'bullet') {
          return <li key={i} className="text-gray-300 list-disc list-inside whitespace-pre-wrap">{b.text || '\u00a0'}</li>
        }
        if (b.type === 'numbered') {
          return <li key={i} className="text-gray-300 list-decimal list-inside whitespace-pre-wrap">{b.text || '\u00a0'}</li>
        }
        if (b.type === 'code') {
          return (
            <pre key={i} className="bg-gray-900 rounded p-3 text-xs text-gray-300 overflow-x-auto">
              <code>{b.text || '\u00a0'}</code>
            </pre>
          )
        }
        if (b.type === 'quote') {
          return <blockquote key={i} className="border-l-2 border-blue-500 pl-3 text-gray-400 italic">{b.text || '\u00a0'}</blockquote>
        }
        if (b.type === 'divider') {
          return <hr key={i} className="border-gray-600 my-2" />
        }
        return null
      })}
    </div>
  )
}
