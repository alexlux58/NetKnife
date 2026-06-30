import { describe, expect, it } from 'vitest'
import { createBlock, noteTitle, type NoteBlock } from './noteBlocks'

describe('createBlock', () => {
  it('creates blocks for each type', () => {
    expect(createBlock('paragraph')).toEqual({ type: 'paragraph', text: '' })
    expect(createBlock('heading')).toEqual({ type: 'heading', level: 1, text: '' })
    expect(createBlock('divider')).toEqual({ type: 'divider' })
  })
})

describe('noteTitle', () => {
  it('uses first heading text', () => {
    const blocks: NoteBlock[] = [
      { type: 'heading', level: 2, text: '  Incident notes  ' },
      { type: 'paragraph', text: 'ignored' },
    ]
    expect(noteTitle(blocks)).toBe('Incident notes')
  })

  it('falls back to first paragraph and default title', () => {
    expect(noteTitle([{ type: 'paragraph', text: 'First line' }])).toBe('First line')
    expect(noteTitle([{ type: 'divider' }])).toBe('Note')
  })

  it('truncates long titles to 80 characters', () => {
    const long = 'x'.repeat(100)
    expect(noteTitle([{ type: 'heading', level: 1, text: long }])).toHaveLength(80)
  })
})
