import { describe, expect, it } from 'vitest'
import {
  isBookAnnotationTextCommitShortcut,
  shouldBookAnnotationLabelCapturePointer,
  shouldShowBookAnnotationTextarea,
  TEXT_TOOL_RAIL_HINT,
} from './text-tool-ux'

describe('TEXT_TOOL_RAIL_HINT', () => {
  it('tells teachers to drag existing text and double-click to type', () => {
    expect(TEXT_TOOL_RAIL_HINT).toMatch(/drag to move/i)
    expect(TEXT_TOOL_RAIL_HINT).toMatch(/double-click to edit/i)
  })
})

describe('shouldBookAnnotationLabelCapturePointer', () => {
  it('lets committed plain text click through while the text tool is active', () => {
    expect(
      shouldBookAnnotationLabelCapturePointer({
        isSticky: false,
        showTextarea: false,
        textToolActive: true,
        selectMode: false,
      }),
    ).toBe(false)
  })

  it('captures pointer while the text edit session is open', () => {
    expect(
      shouldBookAnnotationLabelCapturePointer({
        isSticky: false,
        showTextarea: true,
        textToolActive: true,
        selectMode: false,
      }),
    ).toBe(true)
  })

  it('stays click-through in select mode', () => {
    expect(
      shouldBookAnnotationLabelCapturePointer({
        isSticky: false,
        showTextarea: false,
        textToolActive: true,
        selectMode: true,
      }),
    ).toBe(false)
  })
})

describe('isBookAnnotationTextCommitShortcut', () => {
  it('commits on Ctrl+Enter or Cmd+Enter only', () => {
    expect(
      isBookAnnotationTextCommitShortcut({
        key: 'Enter',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(true)
    expect(
      isBookAnnotationTextCommitShortcut({
        key: 'Enter',
        ctrlKey: false,
        metaKey: true,
        altKey: false,
      }),
    ).toBe(true)
    expect(
      isBookAnnotationTextCommitShortcut({
        key: 'Enter',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(false)
    expect(
      isBookAnnotationTextCommitShortcut({
        key: 'Enter',
        ctrlKey: true,
        metaKey: false,
        altKey: true,
      }),
    ).toBe(false)
  })
})

describe('shouldShowBookAnnotationTextarea', () => {
  const base = {
    textInputEnabled: true,
    isEditing: true,
    autoFocus: false,
    isFieldFocused: false,
    acquiringFocus: false,
  }

  it('hides textarea for committed labels (edit session closed)', () => {
    expect(
      shouldShowBookAnnotationTextarea({
        ...base,
        isEditing: false,
        autoFocus: false,
      }),
    ).toBe(false)
  })

  it('shows textarea while the field has focus', () => {
    expect(
      shouldShowBookAnnotationTextarea({
        ...base,
        isFieldFocused: true,
      }),
    ).toBe(true)
  })

  it('shows textarea for the full edit session while isEditing', () => {
    expect(
      shouldShowBookAnnotationTextarea({
        ...base,
        isEditing: true,
        isFieldFocused: false,
        acquiringFocus: false,
      }),
    ).toBe(true)
  })

  it('shows textarea only briefly while acquiring focus before editingId lands', () => {
    expect(
      shouldShowBookAnnotationTextarea({
        ...base,
        acquiringFocus: true,
      }),
    ).toBe(true)
  })

  it('hides textarea when edit id is stale and focus was never acquired', () => {
    expect(
      shouldShowBookAnnotationTextarea({
        ...base,
        isEditing: false,
        autoFocus: false,
        isFieldFocused: false,
        acquiringFocus: false,
      }),
    ).toBe(false)
  })

  it('respects textInputEnabled gate', () => {
    expect(
      shouldShowBookAnnotationTextarea({
        ...base,
        textInputEnabled: false,
        isFieldFocused: true,
      }),
    ).toBe(false)
  })

  it('allows autoFocus acquisition before editingId lands', () => {
    expect(
      shouldShowBookAnnotationTextarea({
        ...base,
        isEditing: false,
        autoFocus: true,
        acquiringFocus: true,
      }),
    ).toBe(true)
    expect(
      shouldShowBookAnnotationTextarea({
        ...base,
        isEditing: false,
        autoFocus: true,
        acquiringFocus: false,
      }),
    ).toBe(true)
  })
})
