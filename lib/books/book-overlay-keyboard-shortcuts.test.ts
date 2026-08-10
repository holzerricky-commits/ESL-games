import { describe, expect, it } from 'vitest'
import {
  BOOK_OVERLAY_SHAPE_MODES,
  BOOK_OVERLAY_SHORTCUT_TAP_MAX_MS,
  cycleBookOverlayShapeMode,
  INITIAL_SHORTCUT_TAP_STATE,
  resolveQuickStampShortcut,
  resolveShortcutTapIndex,
  type BookOverlayShapeMode,
} from './book-overlay-keyboard-shortcuts'

describe('book-overlay-keyboard-shortcuts', () => {
  it('cycleBookOverlayShapeMode walks all shape modes in order', () => {
    let mode: BookOverlayShapeMode = BOOK_OVERLAY_SHAPE_MODES[0]!
    const seen = new Set<string>()
    for (let i = 0; i < BOOK_OVERLAY_SHAPE_MODES.length; i++) {
      seen.add(mode)
      mode = cycleBookOverlayShapeMode(mode)
    }
    expect(seen.size).toBe(BOOK_OVERLAY_SHAPE_MODES.length)
    expect(mode).toBe(BOOK_OVERLAY_SHAPE_MODES[0])
  })

  it('resolveShortcutTapIndex: first tap uses currentIndex', () => {
    const { index, nextState } = resolveShortcutTapIndex(INITIAL_SHORTCUT_TAP_STATE, 1000, 5, 2)
    expect(index).toBe(2)
    expect(nextState.lastIndex).toBe(2)
  })

  it('resolveShortcutTapIndex: second tap within window advances', () => {
    const first = resolveShortcutTapIndex(INITIAL_SHORTCUT_TAP_STATE, 1000, 5, 2)
    const second = resolveShortcutTapIndex(first.nextState, 1000 + 200, 5, 2)
    expect(second.index).toBe(3)
    expect(second.nextState.lastIndex).toBe(3)
  })

  it('resolveShortcutTapIndex: tap after window resets to currentIndex', () => {
    const first = resolveShortcutTapIndex(INITIAL_SHORTCUT_TAP_STATE, 1000, 5, 2)
    const afterGap = resolveShortcutTapIndex(
      first.nextState,
      1000 + BOOK_OVERLAY_SHORTCUT_TAP_MAX_MS + 1,
      5,
      3,
    )
    expect(afterGap.index).toBe(3)
    expect(afterGap.nextState.lastIndex).toBe(3)
  })

  it('resolveShortcutTapIndex: burst wraps from last variant', () => {
    const first = resolveShortcutTapIndex(INITIAL_SHORTCUT_TAP_STATE, 5000, 4, 3)
    expect(first.index).toBe(3)
    const second = resolveShortcutTapIndex(first.nextState, 5000 + 100, 4, 3)
    expect(second.index).toBe(0)
  })

  it('resolveQuickStampShortcut: cold start always picks tick (index 0)', () => {
    const staleBurst = { lastAt: 900, lastIndex: 2 }
    const { index, nextState } = resolveQuickStampShortcut(5, false, staleBurst, 1000, 1)
    expect(index).toBe(0)
    expect(nextState).toEqual({ lastAt: 1000, lastIndex: 0 })
  })

  it('resolveQuickStampShortcut: warm double-tap cycles tick then cross', () => {
    const first = resolveQuickStampShortcut(5, true, INITIAL_SHORTCUT_TAP_STATE, 2000, 0)
    expect(first.index).toBe(0)
    const second = resolveQuickStampShortcut(5, true, first.nextState, 2000 + 200, 0)
    expect(second.index).toBe(1)
  })

  it('resolveQuickStampShortcut: warm slow tap keeps current variant', () => {
    const first = resolveQuickStampShortcut(5, true, INITIAL_SHORTCUT_TAP_STATE, 3000, 1)
    expect(first.index).toBe(1)
    const afterGap = resolveQuickStampShortcut(
      5,
      true,
      first.nextState,
      3000 + BOOK_OVERLAY_SHORTCUT_TAP_MAX_MS + 1,
      1,
    )
    expect(afterGap.index).toBe(1)
  })
})
