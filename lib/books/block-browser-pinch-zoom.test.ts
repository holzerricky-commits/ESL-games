import { describe, expect, it } from 'vitest'
import { shouldBlockBrowserPinchWheelEvent } from '@/lib/books/block-browser-pinch-zoom'

describe('shouldBlockBrowserPinchWheelEvent', () => {
  it('blocks wheel when ctrlKey is set (trackpad pinch)', () => {
    expect(shouldBlockBrowserPinchWheelEvent({ ctrlKey: true })).toBe(true)
  })

  it('allows plain wheel scroll', () => {
    expect(shouldBlockBrowserPinchWheelEvent({ ctrlKey: false })).toBe(false)
  })
})
