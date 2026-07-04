import { describe, expect, it } from 'vitest'
import {
  buildTemplateServices,
  estimateAwsPricing,
  hoursPerMonth,
  serviceMonthlyCost,
} from './awsPricingLogic'

describe('serviceMonthlyCost', () => {
  it('computes hourly EC2 cost for a month', () => {
    const cost = serviceMonthlyCost(
      {
        id: 'ec2',
        label: 'EC2',
        quantity: 1,
        unit: 'inst',
        unitPriceUsd: 0.01,
        billing: 'hourly',
        enabled: true,
        category: 'Compute',
      },
      730,
    )
    expect(cost).toBeCloseTo(7.3, 2)
  })

  it('returns zero when disabled', () => {
    expect(
      serviceMonthlyCost(
        {
          id: 'x',
          label: 'X',
          quantity: 10,
          unit: 'u',
          unitPriceUsd: 1,
          billing: 'monthly',
          enabled: false,
          category: 'Other',
        },
        730,
      ),
    ).toBe(0)
  })
})

describe('estimateAwsPricing', () => {
  it('sums enabled line items', () => {
    const services = buildTemplateServices('minimal')
    const est = estimateAwsPricing({ template: 'minimal', hoursPerMonth: hoursPerMonth(), services })
    expect(est.totalMonthlyUsd).toBeGreaterThan(0)
    expect(est.lineItems.length).toBeGreaterThan(0)
  })

  it('groups by category', () => {
    const services = buildTemplateServices('ha-web')
    const est = estimateAwsPricing({ template: 'ha-web', hoursPerMonth: 730, services })
    expect(Object.keys(est.byCategory).length).toBeGreaterThan(0)
  })
})
