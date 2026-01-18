/**
 * Theme context: light, dark, system. Persists to profile API and localStorage.
 * Applies data-theme to html for CSS overrides.
 */

import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { getProfile, updateProfile, type UserProfile } from './profile'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'netknife-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as Theme || 'dark'
  )
  const [systemDark, setSystemDark] = useState<boolean | null>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : null
  )

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark === null ? getSystemTheme() : systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    getProfile()
      .then((p: UserProfile) => {
        if (p?.theme && ['light', 'dark', 'system'].includes(p.theme)) setThemeState(p.theme)
      })
      .catch(() => {
        const s = localStorage.getItem(STORAGE_KEY) as Theme | null
        if (s && ['light', 'dark', 'system'].includes(s)) setThemeState(s)
      })
  }, [])

  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(m.matches)
    const f = () => setSystemDark(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])

  useEffect(() => {
    const r = theme === 'system' ? getSystemTheme() : theme
    document.documentElement.dataset.theme = r
  }, [theme, systemDark])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, t)
    updateProfile({ theme: t }).catch(() => {})
  }

  const value = useMemo(() => ({ theme, setTheme, resolvedTheme }), [theme, resolvedTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const c = useContext(ThemeContext)
  if (!c) return { theme: 'dark' as Theme, setTheme: () => {}, resolvedTheme: 'dark' as const }
  return c
}
