/**
 * Billing API: usage, Stripe Checkout, Customer Portal.
 * Uses apiPost; 402 is handled by api.ts (UpgradeModal).
 */

import { apiPost } from './api'

export interface BillingUsage {
  plan: string
  usage: { remoteCalls: number; advisorMessages: number; reportSaves: number }
  limits: { remote: number; advisor: number; report_save: number }
  isGrandfathered?: boolean
}

export async function billingUsage(): Promise<BillingUsage> {
  return apiPost<BillingUsage>('/billing', { action: 'usage' })
}

export async function createCheckout(email: string): Promise<{ url: string }> {
  return apiPost<{ url: string }>('/billing', { action: 'create-checkout', email })
}

export async function customerPortal(): Promise<{ url: string }> {
  return apiPost<{ url: string }>('/billing', { action: 'portal' })
}

/** One-time donation. amountCents e.g. 500 = $5. Min $1, max $1000. */
export async function createDonation(amountCents: number, email?: string): Promise<{ url: string }> {
  return apiPost<{ url: string }>('/billing', { action: 'create-donation', amount: amountCents, email: email || undefined })
}
