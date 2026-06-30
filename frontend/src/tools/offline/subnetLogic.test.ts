import { describe, expect, it } from 'vitest'
import { calculateSubnet, ipToInt, intToIp } from './subnetLogic'

describe('subnetLogic', () => {
  it('converts IPv4 integers', () => {
    expect(ipToInt('192.168.1.1')).toBe(3232235777)
    expect(intToIp(3232235777)).toBe('192.168.1.1')
  })

  it('calculates IPv4 /24 network details', () => {
    const result = calculateSubnet('192.168.1.0/24')
    expect(result).toMatchObject({
      version: 'ipv4',
      network: '192.168.1.0',
      broadcast: '192.168.1.255',
      netmask: '255.255.255.0',
      first_host: '192.168.1.1',
      last_host: '192.168.1.254',
      usable_hosts: 254,
    })
  })

  it('calculates IPv6 prefix network', () => {
    const result = calculateSubnet('2001:db8::/32')
    expect(result).toMatchObject({
      version: 'ipv6',
      network: '2001:db8::',
      prefix: 32,
    })
  })

  it('returns errors for invalid CIDR', () => {
    expect(calculateSubnet('not-an-ip')).toEqual({ error: 'Invalid CIDR notation (use IP/prefix)' })
    expect(calculateSubnet('192.168.1.0/33')).toEqual({ error: 'IPv4 prefix must be 0-32' })
  })
})
