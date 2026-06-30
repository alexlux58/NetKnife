import { describe, expect, it } from 'vitest'
import { checkIpAgainstCidrs, isIPv4InRange, isIPv6InRange } from './cidrRangeLogic'

describe('cidrRangeLogic', () => {
  it('matches IPv4 inside CIDR', () => {
    expect(isIPv4InRange('192.168.1.50', '192.168.1.0/24')).toBe(true)
    expect(isIPv4InRange('192.168.2.1', '192.168.1.0/24')).toBe(false)
  })

  it('matches IPv6 inside CIDR', () => {
    expect(isIPv6InRange('2001:db8::1', '2001:db8::/32')).toBe(true)
    expect(isIPv6InRange('2001:db9::1', '2001:db8::/32')).toBe(false)
  })

  it('reports version mismatch in bulk checks', () => {
    const results = checkIpAgainstCidrs(['192.168.1.1'], ['2001:db8::/32'])
    expect(results[0]).toMatchObject({
      isInRange: null,
      error: 'IP and CIDR version mismatch',
    })
  })

  it('rejects invalid IP format', () => {
    const results = checkIpAgainstCidrs(['999.999.1.1'], ['192.168.1.0/24'])
    expect(results[0].error).toBe('Invalid IP format')
  })
})
