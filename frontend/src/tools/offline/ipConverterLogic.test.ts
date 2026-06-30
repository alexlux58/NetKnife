import { describe, expect, it } from 'vitest'
import { convertIpInput, parseIPv4, ipv4ToRepresentations } from './ipConverterLogic'

describe('ipConverterLogic', () => {
  it('parses dotted decimal IPv4', () => {
    expect(parseIPv4('192.168.1.1')).toBe(3232235777)
  })

  it('parses decimal and hex IPv4 forms', () => {
    expect(parseIPv4('3232235777')).toBe(3232235777)
    expect(parseIPv4('0xC0A80101')).toBe(3232235777)
  })

  it('builds IPv4 representations', () => {
    const reps = ipv4ToRepresentations(3232235777)
    expect(reps.dotted).toBe('192.168.1.1')
    expect(reps.decimal).toBe('3232235777')
    expect(reps.hex).toBe('0xC0A80101')
  })

  it('detects IPv6 input', () => {
    const converted = convertIpInput('2001:db8::1')
    expect(converted.type).toBe('ipv6')
    expect(converted.ipv6?.compressed).toContain('2001:db8')
  })

  it('returns null type for invalid input', () => {
    expect(convertIpInput('not-an-ip').type).toBeNull()
  })
})
