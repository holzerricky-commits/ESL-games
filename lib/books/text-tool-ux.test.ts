import { describe, expect, it } from 'vitest'
import {
  shouldBookAnnotationLabelCapturePointer,
  shouldShowBookAnnotationTextarea,
} from './text-tool-ux'

describe('shouldBookAnnotationLabelCapturePointer', () => {
  it('captures pointer for committed plain text while the text tool is active', () => {
    expect(
      shouldBookAnnotationLabelCapturePointer({
        isSticky: false,
        showTextarea: false,
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
