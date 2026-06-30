import { describe, expect, it } from 'vitest'
import { analyzeIpv6, detectAddressType, parseIPv6 } from './ipv6AnalyzerLogic'

describe('ipv6AnalyzerLogic', () => {
  it('parses global unicast addresses', () => {
    const parsed = parseIPv6('2001:db8::1')
    expect(parsed?.groups[0]).toBe('2001')
    expect(parsed?.groups[1]).toBe('0db8')
  })

  it('detects loopback type', () => {
    const parsed = parseIPv6('::1')
    expect(parsed).not.toBeNull()
    const type = detectAddressType(parsed!.address, parsed!.groups)
    expect(type.type).toBe('Loopback')
  })

  it('analyzes compressed global address', () => {
    const result = analyzeIpv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')
    expect(result).toMatchObject({
      valid: true,
      address_type: 'Global unicast',
      scope: 'Global',
    })
    if ('compressed' in result) {
      expect(result.compressed).toContain('2001:db8')
    }
  })

  it('returns error for invalid address', () => {
    expect(analyzeIpv6('not-ipv6')).toEqual({ error: 'Invalid IPv6 address' })
  })
})
