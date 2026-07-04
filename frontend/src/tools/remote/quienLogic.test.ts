import { describe, expect, it } from 'vitest'
import { isDomainQuery, parseRdapToQuien, relativeTime, formatDate } from './quienLogic'

describe('quienLogic', () => {
  it('detects domain vs IP queries', () => {
    expect(isDomainQuery('alexflux.com')).toBe(true)
    expect(isDomainQuery('8.8.8.8')).toBe(false)
    expect(isDomainQuery('2001:db8::1')).toBe(false)
  })

  it('parses domain RDAP', () => {
    const data = {
      objectClassName: 'domain',
      ldhName: 'ALEXFLUX.COM',
      status: ['client transfer prohibited'],
      events: [
        { eventAction: 'registration', eventDate: '2021-10-18T01:28:21Z' },
        { eventAction: 'expiration', eventDate: '2026-10-18T01:28:21Z' },
        { eventAction: 'last changed', eventDate: '2025-09-21T01:33:29Z' },
      ],
      entities: [{
        roles: ['registrar'],
        vcardArray: ['vcard', [['fn', {}, 'text', 'HOSTINGER operations, UAB']]],
      }],
      nameservers: [{ ldhName: 'NS1.EXAMPLE.COM' }],
    }
    const result = parseRdapToQuien('alexflux.com', data)
    expect(result?.kind).toBe('domain')
    if (result?.kind !== 'domain') return
    expect(result.registrar).toBe('HOSTINGER operations, UAB')
    expect(result.nameservers[0]).toBe('NS1.EXAMPLE.COM')
  })

  it('formats relative time', () => {
    const past = new Date()
    past.setFullYear(past.getFullYear() - 2)
    expect(relativeTime(past.toISOString())).toMatch(/ago/)
    expect(formatDate('2021-10-18T01:28:21Z')).toBe('2021-10-18')
  })
})
