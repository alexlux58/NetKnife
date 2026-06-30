import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ActivityLogIcon,
  FileTextIcon,
  GearIcon,
  MoonIcon,
  SunIcon,
  DesktopIcon,
} from '@radix-ui/react-icons'
import { logout, isDevMode } from '../../lib/auth'
import { useTheme, type Theme } from '../../lib/ThemeContext'

interface UserMenuProps {
  displayName: string
  avatarUrl?: string | null
}

const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <SunIcon className="w-4 h-4" /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon className="w-4 h-4" /> },
  { value: 'system', label: 'System', icon: <DesktopIcon className="w-4 h-4" /> },
]

export default function UserMenu({ displayName, avatarUrl }: UserMenuProps) {
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = useTheme()
  const devMode = isDevMode()

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setThemeOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setThemeOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    setThemeOpen(false)
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        id={`${menuId}-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${menuId}-menu`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[var(--color-bg-tertiary)] min-h-[44px] touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-blue)]"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
        ) : (
          <span
            className="w-8 h-8 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center flex-shrink-0 text-[var(--color-text-muted)] text-xs"
            aria-hidden
          >
            ?
          </span>
        )}
        <span className="hidden md:inline truncate max-w-[120px] text-sm text-[var(--color-text-primary)]">
          {displayName}
        </span>
      </button>

      {open && (
        <div
          id={`${menuId}-menu`}
          role="menu"
          aria-labelledby={`${menuId}-trigger`}
          className="absolute right-0 mt-1 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-lg py-1 z-50 animate-scale-in"
        >
          <div className="px-3 py-2 border-b border-[var(--color-border)]">
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{displayName}</p>
            {devMode && (
              <span className="inline-flex mt-1 text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded">
                Dev mode
              </span>
            )}
          </div>

          <Link to="/settings" role="menuitem" onClick={close} className="menu-item">
            <GearIcon className="w-4 h-4" />
            Settings
          </Link>
          <Link to="/pricing" role="menuitem" onClick={close} className="menu-item">
            <ActivityLogIcon className="w-4 h-4" />
            Pricing
          </Link>
          <Link to="/tools/report-builder" role="menuitem" onClick={close} className="menu-item">
            <FileTextIcon className="w-4 h-4" />
            Reports
          </Link>

          <div className="border-t border-[var(--color-border)] my-1" role="none" />

          <div className="relative">
            <button
              type="button"
              role="menuitem"
              aria-expanded={themeOpen}
              aria-haspopup="true"
              onClick={() => setThemeOpen((v) => !v)}
              className="menu-item w-full"
            >
              <SunIcon className="w-4 h-4" />
              Theme
              <span className="ml-auto text-xs text-[var(--color-text-muted)] capitalize">{theme}</span>
            </button>
            {themeOpen && (
              <div className="px-2 pb-1" role="group" aria-label="Theme options">
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={theme === opt.value}
                    onClick={() => {
                      setTheme(opt.value)
                      close()
                    }}
                    className={`menu-item w-full text-sm ${
                      theme === opt.value ? 'text-[var(--color-accent-blue)]' : ''
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--color-border)] my-1" role="none" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close()
              logout()
            }}
            className="menu-item w-full text-[var(--color-accent-red)]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
