import { describe, expect, it } from 'vitest'
import { DEFAULT_MERMAID, MERMAID_TEMPLATES } from './mermaidTemplates'

describe('mermaidTemplates', () => {
  it('has templates with valid code', () => {
    expect(MERMAID_TEMPLATES.length).toBeGreaterThan(0)
    for (const t of MERMAID_TEMPLATES) {
      expect(t.code.trim().length).toBeGreaterThan(10)
      expect(t.name).toBeTruthy()
    }
  })

  it('default matches first template', () => {
    expect(DEFAULT_MERMAID).toBe(MERMAID_TEMPLATES[0].code)
  })
})
