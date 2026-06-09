import { afterEach, describe, expect, it } from 'vitest'
import {
  buildStudentAnnotationToolPrefsPatch,
  patchStudentAnnotationToolPrefs,
  readStudentAnnotationToolPrefs,
  removeStudentAnnotationToolPrefs,
  resolveAnnotationToolPrefsFromStorage,
  resolvePenAutoGroupConnectedFromStorage,
  resolveMarkerToolPrefsFromStorage,
  resolvePenToolPrefsFromStorage,
  resolveShapeToolPrefsFromStorage,
  resolveStickyToolPrefsFromStorage,
  resolveTextToolPrefsFromStorage,
  wouldDefaultPatchClobberStoredPrefs,
} from '@/lib/books/student-annotation-tool-prefs'

const storage = new Map<string, string>()

function mockLocalStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    },
  })
}

afterEach(() => {
  storage.clear()
  removeStudentAnnotationToolPrefs('stu-a')
  removeStudentAnnotationToolPrefs('stu-b')
})

describe('student-annotation-tool-prefs', () => {
  it('stores pen prefs per student', () => {
    mockLocalStorage()

    patchStudentAnnotationToolPrefs('stu-a', {
      penSwatchId: 'fx-rainbow',
      penThicknessStep: 5,
      penLineDashStyle: 'dashed',
    })
    patchStudentAnnotationToolPrefs('stu-b', { penSwatchId: 'fx-galaxy' })

    expect(readStudentAnnotationToolPrefs('stu-a')).toMatchObject({
      penSwatchId: 'fx-rainbow',
      penThicknessStep: 5,
      penLineDashStyle: 'dashed',
    })
    expect(readStudentAnnotationToolPrefs('stu-b').penSwatchId).toBe('fx-galaxy')

    const penA = resolvePenToolPrefsFromStorage('stu-a')
    expect(penA.penSwatchId).toBe('fx-rainbow')
    expect(penA.penColorSource).toBe('swatch')
    expect(penA.penThicknessStep).toBe(5)
    expect(penA.penLineDashStyle).toBe('dashed')
  })

  it('stores custom pen and marker colors', () => {
    mockLocalStorage()

    patchStudentAnnotationToolPrefs('stu-a', {
      penColorSource: 'custom',
      penCustomHex: '#aabbcc',
      markerColorSource: 'custom',
      markerCustomHex: '#112233',
    })

    const pen = resolvePenToolPrefsFromStorage('stu-a')
    expect(pen.penColorSource).toBe('custom')
    expect(pen.penCustomHex).toBe('#aabbcc')

    const marker = resolveMarkerToolPrefsFromStorage('stu-a')
    expect(marker.markerColorSource).toBe('custom')
    expect(marker.markerColor).toBe('#112233')
    expect(marker.markerCustomHex).toBe('#112233')
  })

  it('stores text color and sticky fill per student', () => {
    mockLocalStorage()

    patchStudentAnnotationToolPrefs('stu-a', {
      textColor: '#2563eb',
      stickyFillColor: '#fce7f3',
    })

    expect(readStudentAnnotationToolPrefs('stu-a')).toMatchObject({
      textColor: '#3b82f6',
      stickyFillColor: '#fce7f3',
    })
    expect(resolveTextToolPrefsFromStorage('stu-a').textColor).toBe('#3b82f6')
    expect(resolveStickyToolPrefsFromStorage('stu-a').stickyFillColor).toBe('#fce7f3')
  })

  it('migrates text color from legacy text swatch id', () => {
    mockLocalStorage()

    patchStudentAnnotationToolPrefs('stu-a', { textSwatchId: 'solid-blue' })
    expect(resolveTextToolPrefsFromStorage('stu-a').textColor).toBe('#3b82f6')
  })

  it('migrates text and shape stroke from pen when missing', () => {
    mockLocalStorage()

    patchStudentAnnotationToolPrefs('stu-a', { penSwatchId: 'solid-green' })
    expect(resolveTextToolPrefsFromStorage('stu-a').textColor).toBe('#22c55e')
    expect(resolveShapeToolPrefsFromStorage('stu-a').shapeStrokeSwatchId).toBe('solid-green')
  })

  it('ignores invalid swatch ids', () => {
    mockLocalStorage()

    patchStudentAnnotationToolPrefs('stu-a', { penSwatchId: 'not-a-real-swatch' })
    const pen = resolvePenToolPrefsFromStorage('stu-a')
    expect(pen.penSwatchId).toBe('solid-black')
  })

  it('stores per-tool thickness steps independently', () => {
    mockLocalStorage()

    patchStudentAnnotationToolPrefs('stu-a', {
      markerThicknessStep: 2,
      shapeThicknessStep: 5,
    })

    const prefs = resolveAnnotationToolPrefsFromStorage('stu-a')
    expect(prefs.markerThicknessStep).toBe(2)
    expect(prefs.shapeThicknessStep).toBe(5)
  })

  it('migrates legacy shared marker thickness to shape and sticky when dedicated step missing', () => {
    mockLocalStorage()

    patchStudentAnnotationToolPrefs('stu-a', { markerThicknessStep: 4 })

    const prefs = resolveAnnotationToolPrefsFromStorage('stu-a')
    expect(prefs.markerThicknessStep).toBe(4)
    expect(prefs.shapeThicknessStep).toBe(4)
    expect(prefs.stickyThicknessStep).toBe(4)
    expect(prefs.stampThicknessStep).toBe(4)
  })

  it('migrates legacy pen thickness to text when text step missing', () => {
    mockLocalStorage()

    patchStudentAnnotationToolPrefs('stu-a', { penThicknessStep: 6 })

    expect(resolveAnnotationToolPrefsFromStorage('stu-a').textThicknessStep).toBe(6)
  })

  it('round-trips all tool prefs via resolveAnnotationToolPrefsFromStorage', () => {
    mockLocalStorage()

    patchStudentAnnotationToolPrefs('stu-a', {
      annotationMode: 'marker',
      penSwatchId: 'fx-lava',
      penThicknessStep: 6,
      shapeThicknessStep: 2,
      eraserPixelThicknessStep: 1,
      eraserLineThicknessStep: 5,
      stampVariant: 'star',
      stampQuestionColor: '#1d4ed8',
      textVisualStyle: 'filled',
      textFillColor: '#fef9c3',
      shapeLineDashStyle: 'dotted',
      shapeStrokeEnabled: false,
      shapeFillMode: 'solid',
      shapeFillColor: '#ff9800',
    })

    const prefs = resolveAnnotationToolPrefsFromStorage('stu-a')
    expect(prefs.annotationMode).toBe('marker')
    expect(prefs.penSwatchId).toBe('fx-lava')
    expect(prefs.penThicknessStep).toBe(6)
    expect(prefs.shapeThicknessStep).toBe(2)
    expect(prefs.eraserPixelThicknessStep).toBe(1)
    expect(prefs.eraserLineThicknessStep).toBe(5)
    expect(prefs.stampVariant).toBe('star')
    expect(prefs.textVisualStyle).toBe('filled')
    expect(prefs.textFillColor).toBe('#fef08a')
    expect(prefs.shapeLineDashStyle).toBe('dotted')
    expect(prefs.shapeStrokeEnabled).toBe(false)
    expect(prefs.shapeFillMode).toBe('solid')
    expect(prefs.shapeFillColor).toBe('#ff9800')
  })

  it('detects when default toolbar state would clobber stored prefs', () => {
    mockLocalStorage()

    patchStudentAnnotationToolPrefs('stu-a', {
      penSwatchId: 'fx-rainbow',
      penThicknessStep: 5,
    })

    expect(
      wouldDefaultPatchClobberStoredPrefs('stu-a', {
        penSwatchId: 'solid-black',
        penThicknessStep: 3,
      }),
    ).toBe(true)

    expect(
      wouldDefaultPatchClobberStoredPrefs('stu-a', {
        penSwatchId: 'fx-rainbow',
        penThicknessStep: 5,
      }),
    ).toBe(false)
  })

  it('buildStudentAnnotationToolPrefsPatch normalizes live state', () => {
    const patch = buildStudentAnnotationToolPrefsPatch({
      annotationMode: 'pen',
      eyedropperVariant: 'smart',
      penSwatchId: 'fx-galaxy',
      penStrokeProfile: 'effects',
      penColorSource: 'swatch',
      penCustomHex: '#6366f1',
      penThicknessStep: 4,
      penLineDashStyle: 'solid',
      markerColor: '#ffeb3b',
      markerColorSource: 'swatch',
      markerCustomHex: '#ffeb3b',
      markerThicknessStep: 3,
      markerLineDashStyle: 'solid',
      markerStraightStroke: true,
      markerDecoratedEdge: false,
      penAutoGroupConnected: false,
      marqueeSelectRule: 'follow-drag',
      shapeThicknessStep: 2,
      textThicknessStep: 4,
      textFontId: 'sweetkiss-light',
      stickyThicknessStep: 1,
      stampThicknessStep: 5,
      eraserPixelThicknessStep: 3,
      eraserLineThicknessStep: 3,
      stampVariant: 'check',
      stampQuestionColor: '#1d4ed8',
      textColor: '#1e1b18',
      textVisualStyle: 'plain',
      textFillColor: '#fef9c3',
      shapeStrokeSwatchId: 'solid-black',
      shapeLineDashStyle: 'solid',
      shapeStrokeEnabled: true,
      shapeFillMode: 'none',
      shapeFillColor: '#ff9800',
      stickyFillColor: '#fef3c7',
    })
    expect(patch.penSwatchId).toBe('fx-galaxy')
    expect(patch.annotationMode).toBe('pen')
    expect(patch.eyedropperVariant).toBe('smart')
    expect(patch.penAutoGroupConnected).toBe(false)
  })

  it('penAutoGroupConnected defaults to true when omitted', () => {
    mockLocalStorage()
    expect(resolvePenAutoGroupConnectedFromStorage('stu-a')).toBe(true)
    expect(resolveAnnotationToolPrefsFromStorage('stu-a').penAutoGroupConnected).toBe(true)
  })

  it('migrates legacy connectStrokesOnSelect into penAutoGroupConnected', () => {
    mockLocalStorage()
    patchStudentAnnotationToolPrefs('stu-a', { connectStrokesOnSelect: false } as never)
    expect(resolvePenAutoGroupConnectedFromStorage('stu-a')).toBe(false)
    expect(readStudentAnnotationToolPrefs('stu-a').penAutoGroupConnected).toBe(false)
  })

  it('persists penAutoGroupConnected false', () => {
    mockLocalStorage()
    patchStudentAnnotationToolPrefs('stu-a', { penAutoGroupConnected: false })
    expect(resolvePenAutoGroupConnectedFromStorage('stu-a')).toBe(false)
    expect(readStudentAnnotationToolPrefs('stu-a').penAutoGroupConnected).toBe(false)
  })

  it('persists eyedropper variant', () => {
    mockLocalStorage()
    patchStudentAnnotationToolPrefs('stu-a', { eyedropperVariant: 'smart' })
    expect(resolveAnnotationToolPrefsFromStorage('stu-a').eyedropperVariant).toBe('smart')
    patchStudentAnnotationToolPrefs('stu-a', { eyedropperVariant: 'not-valid' as 'smart' })
    expect(resolveAnnotationToolPrefsFromStorage('stu-a').eyedropperVariant).toBe('smart')
  })

  it('simulates hydrate-then-save: stored rainbow pen survives default patch attempt', () => {
    mockLocalStorage()

    patchStudentAnnotationToolPrefs('stu-a', {
      penSwatchId: 'fx-rainbow',
      penThicknessStep: 5,
    })

    const defaults = buildStudentAnnotationToolPrefsPatch(
      resolveAnnotationToolPrefsFromStorage(''),
    )
    expect(defaults.penSwatchId).toBe('solid-black')

    if (wouldDefaultPatchClobberStoredPrefs('stu-a', defaults)) {
      /* controller skips save when prefsReady is false */
    } else {
      patchStudentAnnotationToolPrefs('stu-a', defaults)
    }

    expect(resolvePenToolPrefsFromStorage('stu-a').penSwatchId).toBe('fx-rainbow')
    expect(resolvePenToolPrefsFromStorage('stu-a').penThicknessStep).toBe(5)
  })
})
