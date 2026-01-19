/**
 * ==============================================================================
 * NETKNIFE - TOOL STATE PERSISTENCE (sessionStorage)
 * ==============================================================================
 *
 * Persists tool inputs (and optionally results) across navigation. When you
 * switch to another tool and back, your inputs and last result are restored.
 *
 * - Storage: sessionStorage (cleared when the tab closes)
 * - Key: netknife:tool:{toolId}
 * - Exclude: keys like "loading", "error", "result" to avoid storing UI or huge data
 * - Debounced writes (400ms) to avoid excessive writes while typing
 * - Max size: 500KB by default; skip write if over
 * ==============================================================================
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_PREFIX = 'netknife:tool:'
const DEFAULT_MAX_BYTES = 500_000
const DEBOUNCE_MS = 400
const ALWAYS_EXCLUDE = ['loading', 'error']

export interface UseToolStateOptions {
  /** Extra keys to never persist (e.g. "result" for huge API responses). "loading" and "error" are always excluded. */
  exclude?: string[]
  /** Max serialized size in bytes; skip write if over. Default 500_000. */
  maxBytes?: number
}

function omit<T extends Record<string, unknown>>(obj: T, keys: Set<string>): Record<string, unknown> {
  const out = { ...obj }
  keys.forEach((k) => delete out[k])
  return out
}

/**
 * useState-like hook that persists state to sessionStorage per tool.
 * On mount: hydrates from sessionStorage (merged with defaultState).
 * On change: debounced write; excluded keys are not stored.
 *
 * @example
 * const [state, setState] = useToolState('ssl-labs',
 *   { host: 'example.com', loading: false, result: null, error: '' },
 *   { exclude: ['result', 'loading', 'error'] }
 * )
 * setState({ host: 'example.com' })
 */
export function useToolState<T extends Record<string, unknown>>(
  toolId: string,
  defaultState: T,
  options?: UseToolStateOptions
): [T, (patch: Partial<T> | ((prev: T) => Partial<T>)) => void] {
  const key = `${STORAGE_PREFIX}${toolId}`
  const excludeSet = new Set([...ALWAYS_EXCLUDE, ...(options?.exclude ?? [])])
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES

  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultState
    try {
      const raw = sessionStorage.getItem(key)
      if (!raw) return defaultState
      const parsed = JSON.parse(raw) as Record<string, unknown>
      excludeSet.forEach((k) => delete parsed[k])
      return { ...defaultState, ...parsed } as T
    } catch {
      return defaultState
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = setTimeout(() => {
      const toStore = omit(state, excludeSet)
      const s = JSON.stringify(toStore)
      if (s.length > maxBytes) return
      try {
        sessionStorage.setItem(key, s)
      } catch (_) {
        // quota or disabled
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [state, key, maxBytes])

  const update = useCallback((patch: Partial<T> | ((prev: T) => Partial<T>)) => {
    setState((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : patch
      return { ...prev, ...next } as T
    })
  }, [])

  return [state, update]
}
