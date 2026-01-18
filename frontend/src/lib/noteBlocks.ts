/**
 * Notion-like note block types for the Notes tool and report integration.
 */

export type NoteBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'numbered'; text: string }
  | { type: 'code'; language?: string; text: string }
  | { type: 'quote'; text: string }
  | { type: 'divider' }

export const BLOCK_TYPES = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'heading', label: 'Heading' },
  { value: 'bullet', label: 'Bullet list' },
  { value: 'numbered', label: 'Numbered list' },
  { value: 'code', label: 'Code block' },
  { value: 'quote', label: 'Quote' },
  { value: 'divider', label: 'Divider' },
] as const

export function createBlock(type: NoteBlock['type']): NoteBlock {
  switch (type) {
    case 'paragraph': return { type: 'paragraph', text: '' }
    case 'heading': return { type: 'heading', level: 1, text: '' }
    case 'bullet': return { type: 'bullet', text: '' }
    case 'numbered': return { type: 'numbered', text: '' }
    case 'code': return { type: 'code', text: '', language: '' }
    case 'quote': return { type: 'quote', text: '' }
    case 'divider': return { type: 'divider' }
  }
}

/** First line of content for a title, or empty */
export function noteTitle(blocks: NoteBlock[]): string {
  for (const b of blocks) {
    if (b.type === 'heading' && b.text.trim()) return b.text.trim().slice(0, 80)
    if ((b.type === 'paragraph' || b.type === 'bullet' || b.type === 'numbered') && b.text.trim()) {
      return b.text.trim().slice(0, 80)
    }
  }
  return 'Note'
}
