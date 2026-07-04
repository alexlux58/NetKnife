import { describe, expect, it } from 'vitest'
import { estimateNetKnifePricing, minLabPackCost } from './netknifePricingLogic'

describe('minLabPackCost', () => {
  it('returns zero for no lab time', () => {
    expect(minLabPackCost(0).totalUsd).toBe(0)
  })

  it('picks starter for 2 hours', () => {
    const r = minLabPackCost(120)
    expect(r.totalUsd).toBe(2)
    expect(r.packs[0]?.name).toBe('Starter')
  })

  it('combines packs for odd durations', () => {
    const r = minLabPackCost(500)
    expect(r.totalUsd).toBeGreaterThan(0)
    const minutes = r.packs.reduce((sum, p) => {
      const pack = p.name === 'Starter' ? 120 : p.name === 'Standard' ? 360 : 960
      return sum + pack * p.count
    }, 0)
    expect(minutes).toBeGreaterThanOrEqual(500)
  })
})

describe('estimateNetKnifePricing', () => {
  it('recommends free for local-only usage', () => {
    const r = estimateNetKnifePricing({ remoteCalls: 0, advisorMessages: 0, reportSaves: 2, labHoursPerMonth: 0 })
    expect(r.recommendedPlan).toBe('free')
    expect(r.totalMonthlyUsd).toBe(0)
  })

  it('recommends pro when using remote tools', () => {
    const r = estimateNetKnifePricing({ remoteCalls: 10, advisorMessages: 0, reportSaves: 0, labHoursPerMonth: 0 })
    expect(r.needsPro).toBe(true)
    expect(r.subscriptionUsd).toBe(5)
  })

  it('includes lab credit packs', () => {
    const r = estimateNetKnifePricing({ remoteCalls: 0, advisorMessages: 0, reportSaves: 0, labHoursPerMonth: 4 })
    expect(r.needsPro).toBe(true)
    expect(r.labCreditsUsd).toBeGreaterThan(0)
  })
})
