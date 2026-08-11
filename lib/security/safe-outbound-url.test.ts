import { describe, expect, it, vi } from 'vitest'
import {
  assertSafeOutboundHttpUrl,
  fetchSafeOutboundUrl,
  isBlockedIpAddress,
  isBlockedOutboundHostname,
} from '@/lib/security/safe-outbound-url'

describe('isBlockedIpAddress', () => {
  it('blocks loopback, private, link-local, and metadata ranges', () => {
    expect(isBlockedIpAddress('127.0.0.1')).toBe(true)
    expect(isBlockedIpAddress('10.0.0.5')).toBe(true)
    expect(isBlockedIpAddress('192.168.1.10')).toBe(true)
    expect(isBlockedIpAddress('172.16.0.1')).toBe(true)
    expect(isBlockedIpAddress('169.254.169.254')).toBe(true)
    expect(isBlockedIpAddress('0.0.0.0')).toBe(true)
    expect(isBlockedIpAddress('100.64.1.1')).toBe(true)
    expect(isBlockedIpAddress('::1')).toBe(true)
    expect(isBlockedIpAddress('::ffff:127.0.0.1')).toBe(true)
    expect(isBlockedIpAddress('::ffff:7f00:1')).toBe(true)
  })

  it('allows public addresses', () => {
    expect(isBlockedIpAddress('8.8.8.8')).toBe(false)
    expect(isBlockedIpAddress('1.1.1.1')).toBe(false)
    expect(isBlockedIpAddress('2001:4860:4860::8888')).toBe(false)
  })
})

describe('isBlockedOutboundHostname', () => {
  it('blocks localhost-style names', () => {
    expect(isBlockedOutboundHostname('localhost')).toBe(true)
    expect(isBlockedOutboundHostname('foo.localhost')).toBe(true)
    expect(isBlockedOutboundHostname('printer.local')).toBe(true)
  })
})

describe('assertSafeOutboundHttpUrl', () => {
  it('rejects private IP literals before fetch', async () => {
    await expect(assertSafeOutboundHttpUrl('http://127.0.0.1/secret')).rejects.toThrow(/blocked/i)
    await expect(assertSafeOutboundHttpUrl('http://192.168.0.2/x')).rejects.toThrow(/blocked/i)
    await expect(assertSafeOutboundHttpUrl('http://[::1]/')).rejects.toThrow(/blocked/i)
    await expect(assertSafeOutboundHttpUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      /blocked/i,
    )
  })

  it('rejects non-http protocols and credential URLs', async () => {
    await expect(assertSafeOutboundHttpUrl('file:///etc/passwd')).rejects.toThrow(/http/i)
    await expect(assertSafeOutboundHttpUrl('http://user:pass@example.com/x')).rejects.toThrow(/credentials/i)
  })

  it('accepts a public https URL', async () => {
    const url = await assertSafeOutboundHttpUrl('https://example.com/doc.pdf')
    expect(url.hostname).toBe('example.com')
  })
})

describe('fetchSafeOutboundUrl', () => {
  it('refuses redirects that land on a private address', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: 'http://127.0.0.1:3000/api/local-data/students' },
        }),
      )

    await expect(fetchSafeOutboundUrl('https://example.com/go')).rejects.toThrow(/blocked/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockRestore()
  })
})
