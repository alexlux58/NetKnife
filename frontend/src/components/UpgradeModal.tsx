/**
 * Upgrade modal shown when the user hits a usage limit (402).
 * Listens for netknife:show-upgrade and can also be controlled via props.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type Detail = { message?: string; error?: string; code?: string; upgradeUrl?: string }

interface UpgradeModalProps {
  /** When true, show the modal (controlled) */
  open?: boolean
  /** Optional override for the message */
  message?: string
  /** Optional CTA URL (default /tools/report-builder as upgrade entry) */
  ctaUrl?: string
  /** Called when the user closes the modal */
  onClose?: () => void
}

export default function UpgradeModal({
  open: controlledOpen,
  message: controlledMessage,
  ctaUrl: controlledCtaUrl,
  onClose,
}: UpgradeModalProps) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [ctaUrl, setCtaUrl] = useState('/tools/report-builder')

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : open
  const displayMessage = controlledMessage ?? message
  const displayCtaUrl = controlledCtaUrl ?? ctaUrl

  useEffect(() => {
    const handler = (e: CustomEvent<Detail>) => {
      const d = e.detail || {}
      setMessage(d.message || d.error || "You've reached a usage limit. Upgrade for more.")
      setCtaUrl(d.upgradeUrl || '/tools/report-builder')
      setOpen(true)
    }
    window.addEventListener('netknife:show-upgrade', handler as EventListener)
    return () => window.removeEventListener('netknife:show-upgrade', handler as EventListener)
  }, [])

  const close = () => {
    if (!isControlled) setOpen(false)
    onClose?.()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="card w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 id="upgrade-modal-title" className="text-xl font-semibold">
            Upgrade to get more
          </h2>
        </div>
        <p className="text-gray-400 mb-6">{displayMessage}</p>
        <div className="flex gap-3">
          <Link to={displayCtaUrl} className="btn-primary flex-1" onClick={close}>
            View plans
          </Link>
          <button type="button" onClick={close} className="btn-secondary">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
