import { describe, expect, it } from 'vitest'
import {
  BOOK_SPREAD_DESK_BOARD_AMBIENT_SHADOW,
  BOOK_SPREAD_DESK_LEFT_BOARD_AMBIENT_SHADOW,
  BOOK_SPREAD_DESK_LEFT_BOTTOM_CONTACT_SHADOW,
  BOOK_SPREAD_DESK_SHARP_BOTTOM_CONTACT_SHADOW,
  BOOK_SPREAD_DESK_SHADOW_BOTTOM_BLEED_PX,
  BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_X_PX,
  BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_Y_PX,
  BOOK_SPREAD_DESK_SPINE_BENT_DROP_SHADOW,
  bookCoverBoardAmbientDeskShadowStyle,
  bookCoverBoardContactDeskShadowStyle,
  bookCoverBoardDeskShadowStyle,
  bookSpineGutterAmbientDeskShadowStyle,
  bookSpineGutterBentDeskShadowStrokeWidthPx,
  bookSpineGutterContactDeskShadowStyle,
} from '@/lib/books/book-spread-desk-shadow'

describe('desk shadow viewport reserve', () => {
  it('reserves mostly bottom room for desk shadows under a centered spread', () => {
    expect(BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_Y_PX).toBe(
      BOOK_SPREAD_DESK_SHADOW_BOTTOM_BLEED_PX + 28,
    )
    expect(BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_X_PX).toBeGreaterThan(0)
  })
})

describe('bookSpineGutterBentDeskShadowStrokeWidthPx', () => {
  it('scales stroke for narrow spine strips', () => {
    expect(bookSpineGutterBentDeskShadowStrokeWidthPx(40)).toBe(2)
    expect(bookSpineGutterBentDeskShadowStrokeWidthPx(80)).toBe(4)
  })
})

describe('bookCoverBoardAmbientDeskShadowStyle', () => {
  it('applies only the ambient halo', () => {
    const style = bookCoverBoardAmbientDeskShadowStyle('right', 6)
    expect(style.boxShadow).toBe(BOOK_SPREAD_DESK_BOARD_AMBIENT_SHADOW)
    expect(style.boxShadow).not.toContain('0px 1px 0px rgba(0, 0, 0, 0.82)')
  })

  it('nudges the left board ambient outward', () => {
    const style = bookCoverBoardAmbientDeskShadowStyle('left', 6)
    expect(style.boxShadow).toBe(BOOK_SPREAD_DESK_LEFT_BOARD_AMBIENT_SHADOW)
    expect(style.boxShadow).toContain('-2px 8px 14px')
  })
})

describe('bookCoverBoardContactDeskShadowStyle', () => {
  it('applies offset left bottom + fore-edge contact', () => {
    const style = bookCoverBoardContactDeskShadowStyle('left', 6)
    expect(style.boxShadow).toContain(BOOK_SPREAD_DESK_LEFT_BOTTOM_CONTACT_SHADOW)
    expect(style.boxShadow).toContain('-2px 2px 7px')
    expect(style.boxShadow).not.toContain('0px 28px 48px')
    expect(style.borderTopLeftRadius).toBe(6)
  })

  it('keeps only bottom contact on the right board', () => {
    const style = bookCoverBoardContactDeskShadowStyle('right', 6)
    expect(style.boxShadow).toBe(BOOK_SPREAD_DESK_SHARP_BOTTOM_CONTACT_SHADOW)
    expect(style.boxShadow).not.toContain('3px 2px 8px')
    expect(style.borderTopRightRadius).toBe(6)
  })
})

describe('bookCoverBoardDeskShadowStyle', () => {
  it('combines contact and ambient for legacy callers', () => {
    const style = bookCoverBoardDeskShadowStyle('left', 6)
    expect(style.boxShadow).toContain(BOOK_SPREAD_DESK_LEFT_BOTTOM_CONTACT_SHADOW)
    expect(style.boxShadow).toContain(BOOK_SPREAD_DESK_LEFT_BOARD_AMBIENT_SHADOW)
  })
})

describe('bookSpineGutterAmbientDeskShadowStyle', () => {
  it('uses dispersing drop-shadow along the bent spine foot', () => {
    const style = bookSpineGutterAmbientDeskShadowStyle(40, 800)
    expect(style.filter).toBe(BOOK_SPREAD_DESK_SPINE_BENT_DROP_SHADOW)
    expect(style.filter).toContain('drop-shadow')
    expect(style).not.toHaveProperty('clipPath')
    expect(style).not.toHaveProperty('background')
    expect(style).not.toHaveProperty('mixBlendMode')
  })
})

describe('bookSpineGutterContactDeskShadowStyle', () => {
  it('is disabled — recessed gutter does not contact the mat', () => {
    expect(bookSpineGutterContactDeskShadowStyle(40, 800).display).toBe('none')
  })
})
