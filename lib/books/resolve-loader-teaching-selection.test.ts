import { describe, expect, it } from 'vitest'
import { resolveLoaderTeachingUnitAndPage } from './resolve-loader-teaching-selection'

const savedPlace = { unitId: 'vol-1', pdfPage: 3 }

describe('resolveLoaderTeachingUnitAndPage', () => {
  it('keeps this visit’s unit and page when the saved place is a different unit', () => {
    const picked = resolveLoaderTeachingUnitAndPage({
      preferredUnitId: 'vol-2',
      preferResumePage: 20,
      lockPreferredUnit: true,
      openTarget: savedPlace,
      pageForUnit: () => 3,
    })
    expect(picked).toEqual({ unitId: 'vol-2', resumePage: 20 })
  })

  it('keeps an explicit open page on the requested unit', () => {
    const picked = resolveLoaderTeachingUnitAndPage({
      preferredUnitId: 'vol-2',
      preferResumePage: 8,
      lockPreferredUnit: true,
      openTarget: savedPlace,
      pageForUnit: () => 1,
    })
    expect(picked).toEqual({ unitId: 'vol-2', resumePage: 8 })
  })

  it('opens the saved place instead of copying the chip page onto that unit', () => {
    const picked = resolveLoaderTeachingUnitAndPage({
      preferredUnitId: 'vol-2',
      preferResumePage: 20,
      lockPreferredUnit: false,
      openTarget: savedPlace,
      pageForUnit: () => 20,
    })
    expect(picked).toEqual({ unitId: 'vol-1', resumePage: 3 })
  })

  it('uses the chip when there is no saved place', () => {
    const picked = resolveLoaderTeachingUnitAndPage({
      preferredUnitId: 'vol-2',
      preferResumePage: 12,
      lockPreferredUnit: false,
      openTarget: null,
      pageForUnit: () => 4,
    })
    expect(picked).toEqual({ unitId: 'vol-2', resumePage: 12 })
  })

  it('falls back to the saved place when a lock has no unit', () => {
    const picked = resolveLoaderTeachingUnitAndPage({
      preferredUnitId: '  ',
      preferResumePage: 20,
      lockPreferredUnit: true,
      openTarget: savedPlace,
      pageForUnit: () => null,
    })
    expect(picked).toEqual({ unitId: 'vol-1', resumePage: 3 })
  })
})
