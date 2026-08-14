import { describe, expect, it } from 'vitest'
import { isAllowedAppUrl, normalizeServerUrl } from '../src/url-policy.ts'

describe('normalizeServerUrl', () => {
  it('accepts full URLs, host:port forms, and bare ports', () => {
    expect(normalizeServerUrl('http://127.0.0.1:3080')).toEqual({ url: 'http://127.0.0.1:3080', port: 3080 })
    expect(normalizeServerUrl('127.0.0.1:3080')).toEqual({ url: 'http://127.0.0.1:3080', port: 3080 })
    expect(normalizeServerUrl('localhost:3080')).toEqual({ url: 'http://127.0.0.1:3080', port: 3080 })
    expect(normalizeServerUrl('3080')).toEqual({ url: 'http://127.0.0.1:3080', port: 3080 })
    expect(normalizeServerUrl('https://localhost:9443')).toEqual({ url: 'https://127.0.0.1:9443', port: 9443 })
  })
  it('rejects foreign hosts, bad ports, and garbage', () => {
    expect(normalizeServerUrl('http://example.com:3080')).toBeNull()
    expect(normalizeServerUrl('http://192.168.1.1:3080')).toBeNull()
    expect(normalizeServerUrl('99999')).toBeNull()
    expect(normalizeServerUrl('0')).toBeNull()
    expect(normalizeServerUrl('')).toBeNull()
    expect(normalizeServerUrl('not a url')).toBeNull()
  })
})

describe('isAllowedAppUrl', () => {
  it('allows only the configured localhost port', () => {
    expect(isAllowedAppUrl('http://127.0.0.1:3080/', 3080)).toBe(true)
    expect(isAllowedAppUrl('http://localhost:3080/some/path', 3080)).toBe(true)
    expect(isAllowedAppUrl('http://127.0.0.1:3090/', 3080)).toBe(false)
    expect(isAllowedAppUrl('http://127.0.0.1:80/', 3080)).toBe(false)
    expect(isAllowedAppUrl('https://evil.com/', 3080)).toBe(false)
    expect(isAllowedAppUrl('file:///etc/passwd', 3080)).toBe(false)
    expect(isAllowedAppUrl('javascript:alert(1)', 3080)).toBe(false)
  })
})
