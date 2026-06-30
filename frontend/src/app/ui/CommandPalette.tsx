import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { tools } from '../../tools/registry'
import { listGuides } from '../../guides/registry'
import { fuzzyScore } from '../../lib/toolNavigation'
import ToolKindBadge from '../../components/ToolKindBadge'

export interface CommandPaletteItem {
  id: string
  label: string
  description?: string
  path: string
  group: string
  kind?: 'offline' | 'remote'
}

const staticPages: CommandPaletteItem[] = [
  { id: 'home', label: 'Home', description: 'Dashboard', path: '/', group: 'Pages' },
  { id: 'settings', label: 'Settings', description: 'Account & preferences', path: '/settings', group: 'Pages' },
  { id: 'pricing', label: 'Pricing', description: 'Plans & billing', path: '/pricing', group: 'Pages' },
  { id: 'board', label: 'Message board', path: '/board', group: 'Pages' },
  { id: 'activity', label: 'Activity', path: '/activity', group: 'Pages' },
  { id: 'alarms', label: 'Alarms', path: '/alarms', group: 'Pages' },
  { id: 'guides', label: 'Guides', path: '/guides', group: 'Pages' },
  { id: 'coverage-map', label: 'Coverage map', path: '/guides/coverage-map', group: 'Pages' },
]

function buildItems(): CommandPaletteItem[] {
  const toolItems: CommandPaletteItem[] = tools.map((t) => ({
    id: t.id,
    label: t.name,
    description: t.description ?? t.category,
    path: t.path,
    group: 'Tools',
    kind: t.kind,
  }))

  const guideItems: CommandPaletteItem[] = listGuides().map((g) => ({
    id: `guide-${g.id}`,
    label: g.name,
    description: g.description,
    path: `/guides/${g.id}`,
    group: 'Guides',
  }))

  return [...staticPages, ...toolItems, ...guideItems]
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const allItems = useMemo(() => buildItems(), [])

  const results = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 12)
    return allItems
      .map((item) => ({
        item,
        score: fuzzyScore(query, item.label, item.description, item.group),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(({ item }) => item)
  }, [allItems, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const select = (item: CommandPaletteItem) => {
    navigate(item.path)
    onClose()
  }

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      select(results[activeIndex])
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] bg-black/60 animate-fade-in"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="card w-full max-w-xl shadow-2xl animate-scale-in"
      >
        <div className="flex items-center gap-2 px-3 border-b border-[var(--color-border)]">
          <MagnifyingGlassIcon className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search tools, guides, pages…"
            className="flex-1 py-3 bg-transparent border-0 focus:ring-0 focus:outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            aria-controls="command-palette-results"
            aria-activedescendant={results[activeIndex] ? `cmd-${results[activeIndex].id}` : undefined}
          />
          <kbd className="hidden sm:inline text-xs text-[var(--color-text-muted)] border border-[var(--color-border)] rounded px-1.5 py-0.5">
            esc
          </kbd>
        </div>

        <div
          id="command-palette-results"
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          className="max-h-[min(60vh,420px)] overflow-y-auto scrollbar-thin py-1"
        >
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-[var(--color-text-muted)] text-sm">No matches</p>
          ) : (
            results.map((item, index) => (
              <button
                key={item.id}
                id={`cmd-${item.id}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(item)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm min-h-[44px] touch-manipulation ${
                  index === activeIndex
                    ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/60'
                }`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium">{item.label}</span>
                  {item.description && (
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">{item.description}</span>
                  )}
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  {item.kind && <ToolKindBadge kind={item.kind} />}
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                    {item.group}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] flex gap-3">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
