import { describe, expect, it } from 'vitest'
import {
  ANNOTATION_TEXT_FONTS_FOR_PICKER,
  DEFAULT_ANNOTATION_TEXT_FONT_ID,
  DEFAULT_ANNOTATION_TEXT_FONT_WEIGHT,
  annotationTextCssWeight,
  isAnnotationTextFontWeight,
  resolvePickerAnnotationTextFontId,
} from '@/lib/books/annotation-text-fonts'

describe('annotation text fonts', () => {
  it('shows the new teaching fonts in the picker', () => {
    expect(ANNOTATION_TEXT_FONTS_FOR_PICKER.map((font) => font.id)).toEqual([
      'lexend',
      'nunito',
      'fredoka',
      'comic-neue',
      'kalam',
      'caveat',
    ])
    expect(DEFAULT_ANNOTATION_TEXT_FONT_ID).toBe('lexend')
    expect(DEFAULT_ANNOTATION_TEXT_FONT_WEIGHT).toBe('regular')
  })

  it('keeps leftover handwriting out of the picker and maps prefs to Lexend', () => {
    expect(resolvePickerAnnotationTextFontId('sweetkiss-light')).toBe('lexend')
    expect(resolvePickerAnnotationTextFontId('lexend')).toBe('lexend')
    expect(resolvePickerAnnotationTextFontId('unknown')).toBe('lexend')
  })

  it('applies bold only when the face has a real bold', () => {
    expect(annotationTextCssWeight('lexend', 'regular')).toBe(400)
    expect(annotationTextCssWeight('lexend', 'bold')).toBe(700)
    expect(annotationTextCssWeight('sweetkiss-light', 'bold')).toBe(400)
    expect(annotationTextCssWeight('ui-sans', 'bold')).toBe(600)
    expect(isAnnotationTextFontWeight('bold')).toBe(true)
    expect(isAnnotationTextFontWeight('medium')).toBe(false)
  })
})
