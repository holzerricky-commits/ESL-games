import { describe, expect, it } from 'vitest'
import { isPointerOnAnnotationTextarea, shouldDismissBookOverlayAnnotationEditOnPointerDown } from './book-overlay-typing-dismiss'

function mockOverlay(containsTarget: boolean): HTMLElement {
  return {
    contains: () => containsTarget,
  } as unknown as HTMLElement
}

function mockTarget(opts: {
  activeTextarea?: boolean
  annotationLabel?: boolean
  popover?: boolean
  writingAssist?: boolean
}): HTMLElement {
  return {
    closest(selector: string) {
      if (opts.activeTextarea && selector.includes('textarea[data-annotation-id')) return {}
      if (opts.annotationLabel && selector.includes('data-annotation-label')) return {}
      if (opts.popover && selector.includes('popover-content')) return {}
      if (opts.writingAssist && selector.includes('writing-assist-ui')) return {}
      return null
    },
  } as unknown as HTMLElement
}

describe('shouldDismissBookOverlayAnnotationEditOnPointerDown', () => {
  it('dismisses clicks on empty spread area inside the overlay root', () => {
    const target = mockTarget({})
    expect(
      shouldDismissBookOverlayAnnotationEditOnPointerDown(target, {
        overlayRoot: mockOverlay(true),
        editingId: 't1',
      }),
    ).toBe(true)
  })

  it('ignores clicks on the active annotation textarea', () => {
    expect(
      shouldDismissBookOverlayAnnotationEditOnPointerDown(mockTarget({ activeTextarea: true }), {
        overlayRoot: mockOverlay(false),
        editingId: 't1',
      }),
    ).toBe(false)
  })

  it('ignores clicks on the active annotation label shell', () => {
    expect(
      shouldDismissBookOverlayAnnotationEditOnPointerDown(mockTarget({ annotationLabel: true }), {
        overlayRoot: mockOverlay(false),
        editingId: 't1',
      }),
    ).toBe(false)
  })

  it('ignores portaled annotation popovers', () => {
    expect(
      shouldDismissBookOverlayAnnotationEditOnPointerDown(mockTarget({ popover: true }), {
        overlayRoot: mockOverlay(false),
        editingId: 't1',
      }),
    ).toBe(false)
  })

  it('ignores portaled writing-assist UI', () => {
    expect(
      shouldDismissBookOverlayAnnotationEditOnPointerDown(mockTarget({ writingAssist: true }), {
        overlayRoot: mockOverlay(false),
        editingId: 't1',
      }),
    ).toBe(false)
  })

  it('dismisses clicks on outside UI', () => {
    expect(
      shouldDismissBookOverlayAnnotationEditOnPointerDown(mockTarget({}), {
        overlayRoot: mockOverlay(false),
        editingId: 't1',
      }),
    ).toBe(true)
  })
})
