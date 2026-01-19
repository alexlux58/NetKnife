/**
 * Cookie consent banner and preferences modal.
 * Loads Google Analytics (G-2TX7V4D26R, G-QJ74ES61XQ) only when analytics consent is given.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const GA_IDS = ['G-2TX7V4D26R', 'G-QJ74ES61XQ'] as const

interface GtagWindow {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
}

function loadGoogleAnalytics() {
  if (typeof window === 'undefined') return
  const w = window as unknown as GtagWindow
  w.dataLayer = w.dataLayer || []
  function gtag(...args: unknown[]) {
    w.dataLayer!.push(args)
  }
  w.gtag = gtag
  gtag('js', new Date())

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-2TX7V4D26R'
  document.head.appendChild(script)

  GA_IDS.forEach((id) => {
    gtag('config', id, { anonymize_ip: true })
  })
}

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [analyticsConsent, setAnalyticsConsent] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const checkConsent = () => {
      try {
        const consent = localStorage.getItem('cookieConsent')
        if (!consent) {
          setTimeout(() => setShowBanner(true), 2000)
        } else {
          const data = JSON.parse(consent) as { analytics?: boolean }
          setAnalyticsConsent(!!data.analytics)
          if (data.analytics) setTimeout(() => loadGoogleAnalytics(), 300)
        }
      } catch {
        setShowBanner(true)
      }
    }
    if (window.requestIdleCallback) {
      window.requestIdleCallback(checkConsent, { timeout: 2000 })
    } else {
      setTimeout(checkConsent, 2000)
    }
  }, [])

  const acceptAll = () => {
    localStorage.setItem('cookieConsent', JSON.stringify({ analytics: true, timestamp: new Date().toISOString() }))
    setAnalyticsConsent(true)
    setShowBanner(false)
    loadGoogleAnalytics()
  }

  const acceptSelected = () => {
    localStorage.setItem('cookieConsent', JSON.stringify({ analytics: analyticsConsent, timestamp: new Date().toISOString() }))
    setShowBanner(false)
    if (analyticsConsent) loadGoogleAnalytics()
  }

  const rejectAll = () => {
    localStorage.setItem('cookieConsent', JSON.stringify({ analytics: false, timestamp: new Date().toISOString() }))
    setAnalyticsConsent(false)
    setShowBanner(false)
  }

  return (
    <>
      {showBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-[100] bg-[var(--color-bg-secondary)]/95 backdrop-blur-sm border-t border-[var(--color-border)] shadow-2xl animate-slide-up">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-[var(--color-text-primary)] font-bold text-lg mb-2">Cookie consent</h3>
                <p className="text-[var(--color-text-secondary)] text-sm sm:text-base">
                  We use cookies to improve your experience and analyze traffic. By choosing &quot;Accept all&quot; you consent to analytics. You can{' '}
                  <Link to="/privacy" className="text-blue-400 hover:underline" onClick={() => setShowBanner(false)}>
                    customize or learn more
                  </Link>
                  .
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                <button type="button" onClick={() => setShowSettings(true)} className="btn-secondary py-2">
                  Customize
                </button>
                <button type="button" onClick={rejectAll} className="btn-secondary py-2">
                  Reject all
                </button>
                <button type="button" onClick={acceptAll} className="btn-primary py-2">
                  Accept all
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div
          className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-settings-title"
          onClick={() => setShowSettings(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in"
          >
            <h2 id="cookie-settings-title" className="text-xl font-bold mb-4">
              Cookie preferences
            </h2>

            <div className="space-y-6 mb-6">
              <div className="border-b border-[var(--color-border)] pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1">Analytics cookies</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      These help us understand how visitors use the site (e.g. page views, interactions) via Google Analytics. Data is anonymized where possible.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={analyticsConsent}
                      onChange={(e) => setAnalyticsConsent(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-[var(--color-bg-tertiary)] rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>
              </div>

              <p className="text-sm text-[var(--color-text-secondary)]">
                <strong className="text-[var(--color-text-primary)]">Required cookies</strong> are essential and cannot be disabled. For details, see our{' '}
                <Link to="/privacy" className="text-blue-400 hover:underline" onClick={() => { setShowSettings(false) }}>
                  Privacy policy
                </Link>
                .
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button type="button" onClick={() => setShowSettings(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { acceptSelected(); setShowSettings(false) }}
                className="btn-primary"
              >
                Save preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
