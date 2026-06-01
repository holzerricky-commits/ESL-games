import { describe, expect, it } from 'vitest'
import { isSpreadDrawableReady, shouldShowSpreadLoadingHold } from '@/lib/books/spread-drawable-ready'

describe('isSpreadDrawableReady', () => {
  it('requires layout before any reveal', () => {
    expect(
      isSpreadDrawableReady({
        spreadLayoutStable: false,
        spreadSlotsPixelsReady: true,
        userPresented: true,
        spreadCachePrimed: true,
      }),
    ).toBe(false)
  })

  it('reveals when slots report pixels', () => {
    expect(
      isSpreadDrawableReady({
        spreadLayoutStable: true,
        spreadSlotsPixelsReady: true,
        userPresented: false,
        spreadCachePrimed: false,
      }),
    ).toBe(true)
  })

  it('after present, cache primed satisfies without slot callback', () => {
    expect(
      isSpreadDrawableReady({
        spreadLayoutStable: true,
        spreadSlotsPixelsReady: false,
        userPresented: true,
        spreadCachePrimed: true,
      }),
    ).toBe(true)
  })

  it('silent warm before present does not use cache fast-path', () => {
    expect(
      isSpreadDrawableReady({
        spreadLayoutStable: true,
        spreadSlotsPixelsReady: false,
        userPresented: false,
        spreadCachePrimed: true,
      }),
    ).toBe(false)
  })

  it('phase 5 scale hold keeps drawable while resizing', () => {
    expect(
      isSpreadDrawableReady({
        spreadLayoutStable: true,
        spreadSlotsPixelsReady: true,
        userPresented: true,
        spreadCachePrimed: false,
        spreadResizeScaleHold: true,
      }),
    ).toBe(true)
  })

  it('timeout and bypass unblock', () => {
    expect(
      isSpreadDrawableReady({
        spreadLayoutStable: false,
        spreadSlotsPixelsReady: false,
        userPresented: false,
        spreadCachePrimed: false,
        spreadDrawableTimedOut: true,
      }),
    ).toBe(true)
    expect(
      isSpreadDrawableReady({
        spreadLayoutStable: false,
        spreadSlotsPixelsReady: false,
        userPresented: false,
        spreadCachePrimed: false,
        bypassGate: true,
      }),
    ).toBe(true)
  })
})

describe('shouldShowSpreadLoadingHold', () => {
  const base = {
    userPresented: true,
    open: true,
    overlayVisible: true,
    readerPresentationReady: true,
    hasCurriculumOrHistory: true,
    hasResolvedUnit: true,
    error: null as string | null,
    spreadDrawableReady: false,
  }

  it('shows hold only when presented and not drawable', () => {
    expect(shouldShowSpreadLoadingHold(base)).toBe(true)
    expect(shouldShowSpreadLoadingHold({ ...base, spreadDrawableReady: true })).toBe(false)
    expect(shouldShowSpreadLoadingHold({ ...base, userPresented: false })).toBe(false)
    expect(shouldShowSpreadLoadingHold({ ...base, error: 'fail' })).toBe(false)
  })

  it('shows hold while library or PDF is still loading', () => {
    expect(
      shouldShowSpreadLoadingHold({
        ...base,
        readerPresentationReady: false,
        hasResolvedUnit: false,
      }),
    ).toBe(true)
  })

  it('never shows hold after first drawable spread (R3.4 routine turns)', () => {
    expect(shouldShowSpreadLoadingHold({ ...base, spreadHasBeenDrawable: true })).toBe(false)
  })
})
