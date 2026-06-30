/**
 * Favorites, recents, and sidebar expand state (localStorage).
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { ToolCategory } from '../tools/registry'

const FAVORITES_KEY = 'netknife:favorites'
const RECENTS_KEY = 'netknife:recents'
const SIDEBAR_EXPANDED_KEY = 'netknife:sidebar-expanded'
const MAX_RECENTS = 8
const NAV_EVENT = 'netknife:nav-storage'

function readJsonArray(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeJsonArray(key: string, value: string[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

function readStorageRaw(key: string): string {
  if (typeof window === 'undefined') return '[]'
  return localStorage.getItem(key) ?? '[]'
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function subscribe(listener: () => void) {
  const handler = () => listener()
  window.addEventListener(NAV_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(NAV_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

function emitNavChange() {
  window.dispatchEvent(new Event(NAV_EVENT))
}

export function recordRecentTool(toolId: string) {
  if (!toolId) return
  const recents = readJsonArray(RECENTS_KEY)
  if (recents[0] === toolId) return

  const next = [toolId, ...recents.filter((id) => id !== toolId)].slice(0, MAX_RECENTS)
  writeJsonArray(RECENTS_KEY, next)
  emitNavChange()
}

export function toggleFavoriteTool(toolId: string): boolean {
  const favorites = readJsonArray(FAVORITES_KEY)
  const next = favorites.includes(toolId)
    ? favorites.filter((id) => id !== toolId)
    : [...favorites, toolId]
  writeJsonArray(FAVORITES_KEY, next)
  emitNavChange()
  return next.includes(toolId)
}

export function setSidebarExpandedCategories(categories: ToolCategory[]) {
  const nextRaw = JSON.stringify(categories)
  if (readStorageRaw(SIDEBAR_EXPANDED_KEY) === nextRaw) return
  writeJsonArray(SIDEBAR_EXPANDED_KEY, categories)
  emitNavChange()
}

/** useSyncExternalStore requires stable snapshot values — use raw JSON strings, not new arrays. */
function useStorageJson(key: string): string {
  return useSyncExternalStore(subscribe, () => readStorageRaw(key), () => '[]')
}

export function useToolFavorites() {
  const raw = useStorageJson(FAVORITES_KEY)
  const favorites = useMemo(() => parseStringArray(raw), [raw])

  const toggleFavorite = useCallback((toolId: string) => {
    toggleFavoriteTool(toolId)
  }, [])

  const isFavorite = useCallback(
    (toolId: string) => favorites.includes(toolId),
    [favorites]
  )

  return { favorites, toggleFavorite, isFavorite }
}

export function useToolRecents() {
  const raw = useStorageJson(RECENTS_KEY)
  const recents = useMemo(() => parseStringArray(raw), [raw])
  return { recents }
}

export function useSidebarExpanded() {
  const raw = useStorageJson(SIDEBAR_EXPANDED_KEY)
  const expandedCategories = useMemo(
    () => parseStringArray(raw) as ToolCategory[],
    [raw]
  )

  const setExpandedCategories = useCallback((categories: ToolCategory[]) => {
    setSidebarExpandedCategories(categories)
  }, [])

  return { expandedCategories, setExpandedCategories }
}

/** Simple fuzzy score for command palette (higher = better). */
export function fuzzyScore(query: string, ...fields: (string | undefined)[]): number {
  const q = query.trim().toLowerCase()
  if (!q) return 1

  let best = 0
  for (const field of fields) {
    if (!field) continue
    const text = field.toLowerCase()
    if (text === q) best = Math.max(best, 100)
    else if (text.startsWith(q)) best = Math.max(best, 80)
    else if (text.split(/\s+/).some((w) => w.startsWith(q))) best = Math.max(best, 60)
    else if (text.includes(q)) best = Math.max(best, 40)
  }
  return best
}
