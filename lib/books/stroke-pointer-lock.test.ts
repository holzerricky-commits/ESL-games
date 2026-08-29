import { describe, expect, it } from 'vitest'
import {
  createStrokePointerLock,
  isStrokePointerLockedTo,
  shouldAcceptStrokePointerDown,
  shouldStealStrokePointerLock,
} from '@/lib/books/stroke-pointer-lock'

describe('stroke-pointer-lock', () => {
  it('accepts the first pointer', () => {
    expect(shouldAcceptStrokePointerDown(null, { pointerId: 1, pointerType: 'pen' })).toBe(true)
    expect(shouldAcceptStrokePointerDown(null, { pointerId: 2, pointerType: 'touch' })).toBe(true)
  })

  it('rejects a second finger while pen is drawing', () => {
    const lock = createStrokePointerLock({ pointerId: 7, pointerType: 'pen' })
    expect(shouldAcceptStrokePointerDown(lock, { pointerId: 9, pointerType: 'touch' })).toBe(false)
    expect(shouldAcceptStrokePointerDown(lock, { pointerId: 10, pointerType: 'mouse' })).toBe(false)
    expect(shouldAcceptStrokePointerDown(lock, { pointerId: 7, pointerType: 'pen' })).toBe(true)
  })

  it('rejects a second touch while a finger stroke is active', () => {
    const lock = createStrokePointerLock({ pointerId: 2, pointerType: 'touch' })
    expect(shouldAcceptStrokePointerDown(lock, { pointerId: 3, pointerType: 'touch' })).toBe(false)
  })

  it('lets pen steal an in-progress touch stroke', () => {
    const lock = createStrokePointerLock({ pointerId: 2, pointerType: 'touch' })
    const pen = { pointerId: 8, pointerType: 'pen' }
    expect(shouldAcceptStrokePointerDown(lock, pen)).toBe(true)
    expect(shouldStealStrokePointerLock(lock, pen)).toBe(true)
    expect(shouldStealStrokePointerLock(lock, { pointerId: 3, pointerType: 'touch' })).toBe(false)
  })

  it('isStrokePointerLockedTo matches owner only', () => {
    const lock = createStrokePointerLock({ pointerId: 5, pointerType: 'pen' })
    expect(isStrokePointerLockedTo(lock, 5)).toBe(true)
    expect(isStrokePointerLockedTo(lock, 6)).toBe(false)
    expect(isStrokePointerLockedTo(null, 5)).toBe(false)
  })
})
