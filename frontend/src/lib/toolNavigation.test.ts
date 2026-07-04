// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  fuzzyScore,
  recordRecentTool,
  toggleFavoriteTool,
  setSidebarExpandedCategories,
} from './toolNavigation'

// This jsdom build does not provide a Storage implementation, so install a
// minimal in-memory localStorage before each test.
function installLocalStorageMock() {
  const store = new Map<string, string>()
  const mock: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
  }
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = mock
  ;(window as unknown as { localStorage: Storage }).localStorage = mock
}

beforeEach(() => {
  installLocalStorageMock()
})

describe('fuzzyScore', () => {
  it('returns 1 for an empty query (everything matches)', () => {
    expect(fuzzyScore('', 'anything')).toBe(1)
    expect(fuzzyScore('   ', 'anything')).toBe(1)
  })

  it('scores exact match highest, then prefix, word-prefix, substring', () => {
    expect(fuzzyScore('dns', 'dns')).toBe(100)
    expect(fuzzyScore('dns', 'dns lookup')).toBe(80)
    expect(fuzzyScore('look', 'dns lookup')).toBe(60)
    expect(fuzzyScore('ook', 'dns lookup')).toBe(40)
  })

  it('returns 0 when no field matches', () => {
    expect(fuzzyScore('zzz', 'dns lookup', 'subnet')).toBe(0)
  })

  it('takes the best score across multiple fields', () => {
    expect(fuzzyScore('subnet', 'dns lookup', 'subnet calculator')).toBe(80)
  })

  it('is case-insensitive and ignores undefined fields', () => {
    expect(fuzzyScore('DNS', 'dns', undefined)).toBe(100)
  })
})

describe('recordRecentTool', () => {
  it('adds a tool as most-recent-first', () => {
    recordRecentTool('a')
    recordRecentTool('b')
    expect(JSON.parse(localStorage.getItem('netknife:recents')!)).toEqual(['b', 'a'])
  })

  it('deduplicates and moves an existing tool to the front', () => {
    recordRecentTool('a')
    recordRecentTool('b')
    recordRecentTool('a')
    expect(JSON.parse(localStorage.getItem('netknife:recents')!)).toEqual(['a', 'b'])
  })

  it('caps the list at 8 entries', () => {
    for (let i = 0; i < 12; i++) recordRecentTool(`tool-${i}`)
    const recents = JSON.parse(localStorage.getItem('netknife:recents')!)
    expect(recents).toHaveLength(8)
    expect(recents[0]).toBe('tool-11')
  })

  it('ignores empty ids', () => {
    recordRecentTool('')
    expect(localStorage.getItem('netknife:recents')).toBeNull()
  })
})

describe('toggleFavoriteTool', () => {
  it('adds then removes a favorite, returning the new state', () => {
    expect(toggleFavoriteTool('a')).toBe(true)
    expect(JSON.parse(localStorage.getItem('netknife:favorites')!)).toEqual(['a'])
    expect(toggleFavoriteTool('a')).toBe(false)
    expect(JSON.parse(localStorage.getItem('netknife:favorites')!)).toEqual([])
  })
})

describe('setSidebarExpandedCategories', () => {
  it('persists the provided categories', () => {
    setSidebarExpandedCategories(['Network Calculators', 'DNS & Domain'] as never)
    expect(JSON.parse(localStorage.getItem('netknife:sidebar-expanded')!)).toEqual([
      'Network Calculators',
      'DNS & Domain',
    ])
  })
})
