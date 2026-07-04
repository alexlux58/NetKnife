/** NetKnife plan limits — keep in sync with backend/functions/billing/index.js */

export const PLAN_LIMITS = {
  free: { remote: 0, advisor: 0, report_save: 3, monthlyUsd: 0 },
  pro: { remote: 500, advisor: 100, report_save: 50, monthlyUsd: 5 },
} as const

export const LAB_PACKS = [
  { id: 'starter', name: 'Starter', priceUsd: 2, minutes: 120 },
  { id: 'standard', name: 'Standard', priceUsd: 5, minutes: 360 },
  { id: 'power', name: 'Power', priceUsd: 12, minutes: 960 },
] as const

export const LAB_HOURLY_RETAIL_USD = 0.12

export interface NetKnifeUsageInput {
  remoteCalls: number
  advisorMessages: number
  reportSaves: number
  labHoursPerMonth: number
}

export interface UsageMeterStatus {
  used: number
  limit: number
  overFree: boolean
  overPro: boolean
}

export interface NetKnifePricingEstimate {
  recommendedPlan: 'free' | 'pro'
  needsPro: boolean
  proReasons: string[]
  meters: {
    remote: UsageMeterStatus
    advisor: UsageMeterStatus
    reports: UsageMeterStatus
  }
  subscriptionUsd: number
  labMinutesNeeded: number
  labPacks: { name: string; count: number; priceUsd: number }[]
  labCreditsUsd: number
  totalMonthlyUsd: number
  notes: string[]
}

export function minLabPackCost(minutesNeeded: number): {
  totalUsd: number
  packs: { name: string; count: number; priceUsd: number }[]
} {
  if (minutesNeeded <= 0) return { totalUsd: 0, packs: [] }

  const target = Math.ceil(minutesNeeded)
  const maxMinutes = target + 960
  const dp: Array<{ cost: number; packs: number[] } | null> = Array(maxMinutes + 1).fill(null)
  dp[0] = { cost: 0, packs: [] }

  for (let m = 0; m <= maxMinutes; m++) {
    const cur = dp[m]
    if (!cur) continue
    for (let i = 0; i < LAB_PACKS.length; i++) {
      const pack = LAB_PACKS[i]
      const next = m + pack.minutes
      if (next > maxMinutes) continue
      const nextCost = cur.cost + pack.priceUsd
      const existing = dp[next]
      if (!existing || nextCost < existing.cost) {
        const nextPacks = [...cur.packs]
        nextPacks[i] = (nextPacks[i] || 0) + 1
        dp[next] = { cost: nextCost, packs: nextPacks }
      }
    }
  }

  let best: { cost: number; packs: number[] } | null = null
  for (let m = target; m <= maxMinutes; m++) {
    const cur = dp[m]
    if (!cur) continue
    if (!best || cur.cost < best.cost) best = cur
  }

  if (!best) {
    const power = LAB_PACKS[2]
    const count = Math.ceil(target / power.minutes)
    return {
      totalUsd: count * power.priceUsd,
      packs: [{ name: power.name, count, priceUsd: power.priceUsd }],
    }
  }

  const packs = best.packs
    .map((count, i) => (count > 0 ? { name: LAB_PACKS[i].name, count, priceUsd: LAB_PACKS[i].priceUsd } : null))
    .filter(Boolean) as { name: string; count: number; priceUsd: number }[]

  return { totalUsd: best.cost, packs }
}

export function estimateNetKnifePricing(input: NetKnifeUsageInput): NetKnifePricingEstimate {
  const remoteCalls = Math.max(0, Math.floor(input.remoteCalls))
  const advisorMessages = Math.max(0, Math.floor(input.advisorMessages))
  const reportSaves = Math.max(0, Math.floor(input.reportSaves))
  const labHoursPerMonth = Math.max(0, input.labHoursPerMonth)
  const labMinutesNeeded = Math.ceil(labHoursPerMonth * 60)

  const meters = {
    remote: {
      used: remoteCalls,
      limit: PLAN_LIMITS.pro.remote,
      overFree: remoteCalls > PLAN_LIMITS.free.remote,
      overPro: remoteCalls > PLAN_LIMITS.pro.remote,
    },
    advisor: {
      used: advisorMessages,
      limit: PLAN_LIMITS.pro.advisor,
      overFree: advisorMessages > PLAN_LIMITS.free.advisor,
      overPro: advisorMessages > PLAN_LIMITS.pro.advisor,
    },
    reports: {
      used: reportSaves,
      limit: PLAN_LIMITS.pro.report_save,
      overFree: reportSaves > PLAN_LIMITS.free.report_save,
      overPro: reportSaves > PLAN_LIMITS.pro.report_save,
    },
  }

  const proReasons: string[] = []
  if (meters.remote.overFree) proReasons.push('Remote API tool usage')
  if (meters.advisor.overFree) proReasons.push('Security Advisor messages')
  if (meters.reports.overFree) proReasons.push('Saved reports beyond free tier')
  if (labMinutesNeeded > 0) proReasons.push('Kali Lab sessions (Pro required to launch)')

  const needsPro = proReasons.length > 0
  const subscriptionUsd = needsPro ? PLAN_LIMITS.pro.monthlyUsd : 0
  const labEstimate = minLabPackCost(labMinutesNeeded)
  const notes: string[] = []

  if (meters.remote.overPro) notes.push(`Remote calls exceed Pro limit (${PLAN_LIMITS.pro.remote}/mo). Contact support for higher tiers.`)
  if (meters.advisor.overPro) notes.push(`Advisor messages exceed Pro limit (${PLAN_LIMITS.pro.advisor}/mo).`)
  if (meters.reports.overPro) notes.push(`Report saves exceed Pro limit (${PLAN_LIMITS.pro.report_save}/mo).`)
  if (labMinutesNeeded > 0 && labEstimate.packs.length === 0) notes.push('Lab usage requires credit packs.')
  if (labMinutesNeeded > 0) {
    notes.push(`Lab retail rate: $${LAB_HOURLY_RETAIL_USD.toFixed(2)}/hr (~$${(labMinutesNeeded / 60 * LAB_HOURLY_RETAIL_USD).toFixed(2)} at usage).`)
  }

  return {
    recommendedPlan: needsPro ? 'pro' : 'free',
    needsPro,
    proReasons,
    meters,
    subscriptionUsd,
    labMinutesNeeded,
    labPacks: labEstimate.packs,
    labCreditsUsd: labEstimate.totalUsd,
    totalMonthlyUsd: subscriptionUsd + labEstimate.totalUsd,
    notes,
  }
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
