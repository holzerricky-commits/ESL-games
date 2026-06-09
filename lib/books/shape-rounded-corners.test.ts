import { describe, expect, it } from 'vitest'
import {
  roundedCornersFieldForCommit,
  shapeCornerRadiusPx,
  shapeRoundedCornersEnabled,
} from '@/lib/books/shape-rounded-corners'

describe('shape-rounded-corners', () => {
  it('defaults rounded corners to on', () => {
    expect(shapeRoundedCornersEnabled(undefined)).toBe(true)
    expect(shapeRoundedCornersEnabled(true)).toBe(true)
    expect(shapeRoundedCornersEnabled(false)).toBe(false)
  })

  it('omits field when committing rounded shapes', () => {
    expect(roundedCornersFieldForCommit(true)).toEqual({})
    expect(roundedCornersFieldForCommit(false)).toEqual({ roundedCorners: false })
  })

  it('scales corner radius with box size', () => {
    expect(shapeCornerRadiusPx(200, 100)).toBeGreaterThan(4)
    expect(shapeCornerRadiusPx(200, 100)).toBeLessThanOrEqual(28)
  })
})
