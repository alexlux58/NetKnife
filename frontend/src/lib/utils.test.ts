import { describe, expect, it, vi, afterEach } from 'vitest'
import { cn, debounce, formatJson, redactSecrets } from './utils'

describe('redactSecrets', () => {
  it('redacts bearer tokens and passwords', () => {
    const input = 'Authorization: Bearer secret-token-123\npassword=supersecret\n-c public'
    const out = redactSecrets(input)
    expect(out).toContain('Bearer ***REDACTED***')
    expect(out).toContain('password=***REDACTED***')
    expect(out).toContain('-c ***REDACTED***')
    expect(out).not.toContain('secret-token-123')
  })
})

describe('formatJson', () => {
  it('pretty-prints objects', () => {
    expect(formatJson({ a: 1 })).toBe('{\n  "a": 1\n}')
  })

  it('falls back to String for circular structures', () => {
    const obj: { self?: unknown } = {}
    obj.self = obj
    expect(formatJson(obj)).toContain('[object Object]')
  })
})

describe('cn', () => {
  it('joins truthy class names', () => {
    const includeB = false
    expect(cn('a', includeB && 'b', 'c')).toBe('a c')
  })
})

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays function execution', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced()
    debounced()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
