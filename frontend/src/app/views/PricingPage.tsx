/**
 * Pricing: Free (browser-only), API Access $5/mo, and one-time donations.
 * User alex.lux sees "Grandfathered" and has no paywall.
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getUser } from '../../lib/auth'
import { billingUsage, createCheckout, createDonation, customerPortal, type BillingUsage } from '../../lib/billing'

const DONATION_PRESETS = [3, 5, 10, 20] // dollars

export default function PricingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [usage, setUsage] = useState<BillingUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [donateLoading, setDonateLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [customDonation, setCustomDonation] = useState('')
  const [showDonatedThankYou, setShowDonatedThankYou] = useState(false)
  const donated = searchParams.get('donated') === '1'

  useEffect(() => {
    let done = false
    ;(async () => {
      try {
        const u = await billingUsage()
        if (!done) setUsage(u)
      } catch (e: unknown) {
        if (!done) setError((e as { body?: { error?: string } })?.body?.error || 'Failed to load usage')
      } finally {
        if (!done) setLoading(false)
      }
    })()
    return () => { done = true }
  }, [])

  useEffect(() => {
    getUser().then((u) => {
      const e = (u?.profile as { email?: string })?.email
      if (e) setEmail(e)
    })
  }, [])

  useEffect(() => {
    if (donated) {
      setShowDonatedThankYou(true)
      setSearchParams((p) => { p.delete('donated'); return p }, { replace: true })
    }
  }, [donated, setSearchParams])

  const onSubscribe = async () => {
    const e = email.trim()
    if (!e) {
      setError('Email is required for checkout')
      return
    }
    setCheckoutLoading(true)
    setError(null)
    try {
      const { url } = await createCheckout(e)
      if (url) window.location.href = url
    } catch (e: unknown) {
      const b = (e as { body?: { error?: string } })?.body
      setError(b?.error || 'Checkout failed')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const onDonate = async (amountDollars: number) => {
    const cents = Math.round(amountDollars * 100)
    if (cents < 100) { setError('Minimum donation is $1'); return }
    if (cents > 100000) { setError('Maximum donation is $1000'); return }
    setDonateLoading(true)
    setError(null)
    try {
      const { url } = await createDonation(cents, email.trim() || undefined)
      if (url) window.location.href = url
    } catch (e: unknown) {
      const b = (e as { body?: { error?: string } })?.body
      setError(b?.error || 'Donation failed')
    } finally {
      setDonateLoading(false)
    }
  }

  const onManage = async () => {
    setPortalLoading(true)
    setError(null)
    try {
      const { url } = await customerPortal()
      if (url) window.location.href = url
    } catch (e: unknown) {
      const b = (e as { body?: { error?: string } })?.body
      setError(b?.error || 'Could not open billing portal')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Plans & Billing</h1>
      <p className="text-gray-400 mb-6">
        Browser-based tools are free. API &amp; remote tools require a $5/month subscription.
      </p>

      {showDonatedThankYou && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          Thank you for your donation.
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {usage?.isGrandfathered && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          You have full access (grandfathered). Billing is not enabled for your account.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Free – browser-only */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-1">Free</h2>
          <p className="text-3xl font-bold mb-4">$0<span className="text-sm font-normal text-gray-400">/mo</span></p>
          <ul className="space-y-2 text-sm text-gray-400 mb-6">
            <li>• All browser-based tools (no API)</li>
            <li>• 0 API / remote tool calls</li>
            <li>• 0 Security Advisor messages</li>
            <li>• {usage?.limits?.report_save ?? 3} saved reports / month</li>
          </ul>
          <p className="text-xs text-gray-500">Your usage this month:</p>
          <div className="mt-2 space-y-1 text-sm">
            <div>Remote: {usage?.usage?.remoteCalls ?? 0} / {usage?.limits?.remote ?? 0}</div>
            <div>Advisor: {usage?.usage?.advisorMessages ?? 0} / {usage?.limits?.advisor ?? 0}</div>
            <div>Reports: {usage?.usage?.reportSaves ?? 0} / {usage?.limits?.report_save ?? 3}</div>
          </div>
        </div>

        {/* API Access – $5/mo */}
        <div className="card p-6 border-2 border-blue-500/50">
          <h2 className="text-lg font-semibold mb-1">API Access</h2>
          <p className="text-3xl font-bold mb-4">$5<span className="text-sm font-normal text-gray-400">/mo</span></p>
          <ul className="space-y-2 text-sm text-gray-400 mb-6">
            <li>• 500 API / remote tool calls / month</li>
            <li>• 100 Security Advisor messages / month</li>
            <li>• 50 saved reports / month</li>
          </ul>
          {usage?.plan === 'pro' ? (
            <button
              onClick={onManage}
              disabled={portalLoading}
              className="w-full btn-primary py-2"
            >
              {portalLoading ? 'Opening…' : 'Manage subscription'}
            </button>
          ) : usage?.isGrandfathered ? (
            <p className="text-sm text-gray-500">You already have full access.</p>
          ) : (
            <>
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input w-full mb-3"
              />
              <button
                onClick={onSubscribe}
                disabled={checkoutLoading || !email.trim()}
                className="w-full btn-primary py-2"
              >
                {checkoutLoading ? 'Redirecting…' : 'Subscribe — $5/mo'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Donate */}
      <div className="card p-6 mt-6">
        <h2 className="text-lg font-semibold mb-1">Support NetKnife</h2>
        <p className="text-sm text-gray-400 mb-4">One-time donation. No subscription.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {DONATION_PRESETS.map((d) => (
            <button
              key={d}
              onClick={() => onDonate(d)}
              disabled={donateLoading}
              className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm"
            >
              ${d}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-gray-400 text-sm">Custom:</span>
          <input
            type="number"
            min={1}
            max={1000}
            step={1}
            placeholder="0"
            value={customDonation}
            onChange={(e) => setCustomDonation(e.target.value)}
            className="input w-24 py-1.5 text-sm"
          />
          <span className="text-gray-500 text-sm">USD (min $1, max $1000)</span>
          <button
            onClick={() => onDonate(parseFloat(customDonation) || 0)}
            disabled={donateLoading || !customDonation}
            className="btn-secondary py-1.5 text-sm"
          >
            {donateLoading ? 'Redirecting…' : 'Donate'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-6">
        Payments powered by Stripe. Browser-only tools always free.
      </p>
    </div>
  )
}
