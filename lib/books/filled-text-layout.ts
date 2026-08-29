import { plainTextMaxWidthPx } from '@/lib/books/text-label-measure'
import {
  FILLED_TEXT_MEASURE_PAD_PX,
  FILLED_TEXT_PAD_Y_PX,
  PLAIN_TEXT_MEASURE_PAD_PX,
  annotationTextFieldNoScrollCSS,
  filledPillRowMinPx,
  textLabelFieldPaddingCSS,
  textLabelHorizontalPadFromComputedStyle,
  textLabelLineHeightPx,
  TEXT_LABEL_WIDTH_FIT_SLACK_PX,
  type TextLabelFieldVariant,
} from '@/lib/books/text-label-layout'

/** Vertical gap between filled pill row backgrounds (and between textarea line boxes). */
export const FILLED_LINE_GAP_PX = 4

/** Per-line stride for filled ink — pill row height plus inter-row gap. */
export function filledTextLineStridePx(fontSizePx: number): number {
  return filledPillRowMinPx(fontSizePx) + FILLED_LINE_GAP_PX
}

/** Pin trailing whitespace so DOM width measurement matches visible ink. */
const INK_WIDTH_PIN = '\u200b'

let textMeasureMirror: HTMLSpanElement | null = null
let filledTextMeasureTextarea: HTMLTextAreaElement | null = null

function parseLineHeightPx(lineHeight: string, fontSizePx: number): number {
  if (lineHeight.endsWith('px')) return parseFloat(lineHeight) || fontSizePx
  if (lineHeight === 'normal') return Math.ceil(fontSizePx * 1.3)
  const mult = parseFloat(lineHeight)
  return Number.isFinite(mult) ? Math.ceil(fontSizePx * mult) : Math.ceil(fontSizePx * 1.3)
}

function getFilledTextMeasureTextarea(prototype: HTMLTextAreaElement): HTMLTextAreaElement {
  if (!filledTextMeasureTextarea && typeof document !== 'undefined') {
    filledTextMeasureTextarea = document.createElement('textarea')
    filledTextMeasureTextarea.setAttribute('aria-hidden', 'true')
    filledTextMeasureTextarea.setAttribute('rows', '1')
    Object.assign(filledTextMeasureTextarea.style, {
      position: 'absolute',
      left: '-9999px',
      top: '0',
      visibility: 'hidden',
      overflow: 'hidden',
      resize: 'none',
    })
    document.body.appendChild(filledTextMeasureTextarea)
  }
  const measureTa = filledTextMeasureTextarea!
  const cs = getComputedStyle(prototype)
  measureTa.style.width = prototype.style.width || `${prototype.clientWidth}px`
  measureTa.style.boxSizing = cs.boxSizing
  measureTa.style.font = cs.font
  measureTa.style.fontSize = cs.fontSize
  measureTa.style.fontFamily = cs.fontFamily
  measureTa.style.lineHeight = cs.lineHeight
  measureTa.style.letterSpacing = cs.letterSpacing
  measureTa.style.padding = cs.padding
  measureTa.style.border = cs.border
  measureTa.style.whiteSpace = 'pre-wrap'
  measureTa.style.wordBreak = cs.wordBreak
  measureTa.style.overflowWrap = cs.overflowWrap
  return measureTa
}

function filledTextareaVisualLineCount(measureTa: HTMLTextAreaElement, text: string): number {
  measureTa.value = text.length > 0 ? text : ' '
  const cs = getComputedStyle(measureTa)
  const lineHeightPx = parseLineHeightPx(cs.lineHeight, parseFloat(cs.fontSize) || 16)
  measureTa.value = '\u00a0'
  const singleLineScroll = measureTa.scrollHeight
  measureTa.value = text.length > 0 ? text : ' '
  const scroll = measureTa.scrollHeight
  if (scroll <= singleLineScroll + 1) return 1
  return Math.max(1, Math.round(scroll / lineHeightPx))
}

/** Split one paragraph using a hidden textarea — matches browser soft-wrap exactly. */
export function splitParagraphIntoVisualLines(
  paragraph: string,
  cs: CSSStyleDeclaration,
  contentWidthPx: number,
  measurePrototype?: HTMLTextAreaElement,
): string[] {
  if (!paragraph) return ['']
  if (typeof document === 'undefined') {
    return wrapParagraphIntoSegments(paragraph, cs, contentWidthPx)
  }
  if (measurePrototype) {
    const maxPx = contentWidthPx + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
    const measureTa = getFilledTextMeasureTextarea(measurePrototype)
    measureTa.style.width = `${Math.max(8, maxPx)}px`
    return splitParagraphWithTextareaMeasure(measureTa, paragraph)
  }
  return wrapParagraphIntoSegments(paragraph, cs, contentWidthPx)
}

function splitParagraphWithTextareaMeasure(
  measureTa: HTMLTextAreaElement,
  paragraph: string,
): string[] {
  if (!paragraph) return ['']
  const lines: string[] = []
  let start = 0
  while (start < paragraph.length) {
    let lo = start + 1
    let hi = paragraph.length
    let best = start + 1
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      const slice = paragraph.slice(start, mid)
      if (filledTextareaVisualLineCount(measureTa, slice) <= 1) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    lines.push(paragraph.slice(start, best))
    start = best
  }
  return lines.length > 0 ? lines : ['']
}

/** Visual rows for pill backgrounds — matches textarea line breaks at fieldWidthPx. */
export function computeFilledVisualLineSegments(
  text: string,
  cs: CSSStyleDeclaration,
  fieldWidthPx: number,
  measurePrototype?: HTMLTextAreaElement,
): string[] {
  const padL = parseFloat(cs.paddingLeft) || 0
  const padR = parseFloat(cs.paddingRight) || 0
  const contentWidthPx = Math.max(1, fieldWidthPx - padL - padR)
  const paragraphs = text.split('\n')
  const segments: string[] = []
  for (const para of paragraphs) {
    segments.push(
      ...splitParagraphIntoVisualLines(para, cs, contentWidthPx, measurePrototype),
    )
  }
  return segments.length > 0 ? segments : ['']
}

/** While typing before page-max wrap: one row per explicit \\n only (stable pill rows). */
export function computeFilledExplicitLineSegments(text: string): string[] {
  if (!text) return ['']
  return text.split('\n')
}

/**
 * Ink width for one visual line — trailing spaces are included (span measure collapses them).
 */
export function measureInkLineWidthPx(lineText: string, cs: CSSStyleDeclaration): number {
  const sample = lineText.length > 0 ? lineText : ' '
  const collapsed = measureRawLineWidth(sample, cs)
  if (!/\s$/.test(sample)) return collapsed
  const pinned = measureRawLineWidth(sample + INK_WIDTH_PIN, cs)
  const pin = measureRawLineWidth(INK_WIDTH_PIN, cs)
  return Math.max(collapsed, pinned - pin)
}

/** Word-aware visual rows while typing at page max — stable breaks, no mid-word jumps. */
export function computeFilledWordWrapSegments(
  text: string,
  cs: CSSStyleDeclaration,
  fieldWidthPx: number,
): string[] {
  const contentMax = filledContentWidthPx(fieldWidthPx, cs)
  const segments: string[] = []
  for (const para of text.split('\n')) {
    segments.push(...wrapParagraphIntoSegments(para, cs, contentMax))
  }
  return segments.length > 0 ? segments : ['']
}

/** Editing segments — explicit lines until latched to page width, then soft-wrap rows. */
export function computeFilledEditingLineSegments(
  text: string,
  cs: CSSStyleDeclaration,
  fieldWidthPx: number,
  latched: boolean,
  measurePrototype?: HTMLTextAreaElement,
  opts?: { growOnly?: boolean },
): string[] {
  if (!latched) return computeFilledExplicitLineSegments(text)
  if (opts?.growOnly) {
    return computeFilledWordWrapSegments(text, cs, fieldWidthPx)
  }
  return computeFilledVisualLineSegments(text, cs, fieldWidthPx, measurePrototype)
}

/** Content width inside a filled textarea (px available for wrapped text). */
export function filledTextareaContentWidthPx(
  ta: HTMLTextAreaElement,
  cs: CSSStyleDeclaration,
): number {
  const padL = parseFloat(cs.paddingLeft) || 0
  const padR = parseFloat(cs.paddingRight) || 0
  return Math.max(1, ta.clientWidth - padL - padR)
}

export function filledTextNeedsMaxWidth(
  text: string,
  cs: CSSStyleDeclaration,
  innerMax: number,
): boolean {
  if (!text) return false
  for (const para of text.split('\n')) {
    if (para.length > 0 && measureInkLineWidthPx(para, cs) > innerMax) return true
  }
  return false
}

/** Shared latch check — plain and filled use the same ink-vs-inner-max rule. */
export const textLabelNeedsPageMaxWidth = filledTextNeedsMaxWidth

export type TextLabelFieldLayout = {
  segments: string[]
  widths: number[]
  fieldWidthPx: number
  /** True while editing at page-max width with soft-wrapped visual rows. */
  latchedWhileEditing?: boolean
}

/** @deprecated Use {@link TextLabelFieldLayout} */
export type FilledTextFieldLayout = TextLabelFieldLayout

export type TextLabelFieldLayoutOpts = {
  variant?: TextLabelFieldVariant
  maxWidthNorm?: number
  emptyPlaceholder?: string
  latchedMaxWidth?: boolean
  /** While typing: explicit \\n rows only, unwrapped line width (capped at page max). */
  growOnly?: boolean
  /** Width source for latch/grow (e.g. typed text + ghost assist suffix). */
  measureTextForWidth?: string
  fontWeight?: string | number
}

/** @deprecated Use {@link TextLabelFieldLayoutOpts} */
export type FilledTextFieldLayoutOpts = TextLabelFieldLayoutOpts

function pageMaxWidthPx(
  anchorXNorm: number,
  overlayWidthPx: number,
  maxWidthNorm?: number,
): number {
  return plainTextMaxWidthPx(anchorXNorm, maxWidthNorm, overlayWidthPx)
}

function innerMaxWidthPx(
  anchorXNorm: number,
  overlayWidthPx: number,
  maxWidthNorm: number | undefined,
  variant: TextLabelFieldVariant,
): number {
  const pad = variant === 'filled' ? FILLED_TEXT_MEASURE_PAD_PX : PLAIN_TEXT_MEASURE_PAD_PX
  return pageMaxWidthPx(anchorXNorm, overlayWidthPx, maxWidthNorm) - pad
}

/** Resolve outer field width — latched max prevents shrink-back when lines split. */
export function resolveFilledFieldWidthPx(
  text: string,
  cs: CSSStyleDeclaration,
  anchorXNorm: number,
  overlayWidthPx: number,
  segments: string[],
  opts?: {
    latchedMaxWidth?: boolean
    emptyPlaceholder?: string
    maxWidthNorm?: number
    variant?: TextLabelFieldVariant
  },
): number {
  const variant = opts?.variant ?? 'filled'
  const maxPx = pageMaxWidthPx(anchorXNorm, overlayWidthPx, opts?.maxWidthNorm)
  const innerMax = innerMaxWidthPx(anchorXNorm, overlayWidthPx, opts?.maxWidthNorm, variant)
  const measureSource = text || opts?.emptyPlaceholder || ''

  if (!measureSource) return 8

  const needsMax =
    Boolean(opts?.latchedMaxWidth) ||
    filledTextNeedsMaxWidth(text, cs, innerMax) ||
    (Boolean(opts?.emptyPlaceholder && !text) &&
      filledTextNeedsMaxWidth(opts.emptyPlaceholder!, cs, innerMax))

  if (needsMax) return maxPx

  let contentW = 8
  for (const seg of segments) {
    contentW = Math.max(contentW, measureFilledLineTextWidth(seg.length > 0 ? seg : ' ', cs))
  }
  if (contentW <= 8 && text) {
    contentW = measureFilledLineTextWidth(text, cs)
  } else if (contentW <= 8 && opts?.emptyPlaceholder) {
    contentW = measureFilledLineTextWidth(opts.emptyPlaceholder, cs)
  }
  return Math.min(Math.max(contentW, 8), maxPx)
}

function filledSegmentWidths(
  segments: string[],
  cs: CSSStyleDeclaration,
  fieldWidthPx: number,
  emptyPlaceholder?: string,
): number[] {
  return measureFilledSegmentWidths(segments, cs, fieldWidthPx, emptyPlaceholder)
}

/** Ink width available inside a filled field after horizontal padding. */
export function filledContentWidthPx(fieldWidthPx: number, cs: CSSStyleDeclaration): number {
  const pad = textLabelHorizontalPadFromComputedStyle(cs)
  return Math.max(1, fieldWidthPx - pad)
}

/** Off-screen span for live DOM text width measurement (plain + filled). */
export function getTextMeasureMirror(): HTMLSpanElement {
  if (!textMeasureMirror && typeof document !== 'undefined') {
    textMeasureMirror = document.createElement('span')
    textMeasureMirror.setAttribute('aria-hidden', 'true')
    Object.assign(textMeasureMirror.style, {
      position: 'absolute',
      left: '-9999px',
      top: '0',
      visibility: 'hidden',
      whiteSpace: 'pre',
      pointerEvents: 'none',
    })
    document.body.appendChild(textMeasureMirror)
  }
  return textMeasureMirror!
}

export function filledMaxWidthPx(
  anchorXNorm: number,
  overlayWidthPx: number,
  maxWidthNorm?: number,
): number {
  return pageMaxWidthPx(anchorXNorm, overlayWidthPx, maxWidthNorm)
}

export function filledInnerMaxPx(
  anchorXNorm: number,
  overlayWidthPx: number,
  maxWidthNorm?: number,
  variant: TextLabelFieldVariant = 'filled',
): number {
  return innerMaxWidthPx(anchorXNorm, overlayWidthPx, maxWidthNorm, variant)
}

export function measureRawLineWidth(lineText: string, cs: CSSStyleDeclaration): number {
  const mirror = getTextMeasureMirror()
  const fontSize = cs.fontSize || '16px'
  const fontFamily = cs.fontFamily || 'sans-serif'
  const fontWeight = cs.fontWeight || '400'
  const font =
    cs.font && cs.font !== 'normal' && !/^\d+px$/.test(cs.font.trim())
      ? cs.font
      : `${fontWeight} ${fontSize} ${fontFamily}`
  mirror.style.font = font
  mirror.style.fontFamily = fontFamily
  mirror.style.fontSize = fontSize
  mirror.style.fontWeight = fontWeight
  mirror.style.letterSpacing = cs.letterSpacing
  const sample = lineText.length > 0 ? lineText : '\u00a0'
  mirror.textContent = sample
  const measured = mirror.offsetWidth
  if (measured > 0) return measured
  const fontSizePx = parseFloat(fontSize) || 16
  return sample.length * fontSizePx * 0.48
}

/** One line's total box width (mirror text + horizontal padding + fit slack). */
export function measureFilledLineTextWidth(lineText: string, cs: CSSStyleDeclaration): number {
  return (
    measureInkLineWidthPx(lineText, cs) +
    textLabelHorizontalPadFromComputedStyle(cs) +
    TEXT_LABEL_WIDTH_FIT_SLACK_PX
  )
}

/** Vertical stack height for filled pill backgrounds (matches textarea content box). */
export function filledPillStackHeightPx(
  segmentCount: number,
  rowMinPx: number,
  hasContent: boolean,
): number {
  if (segmentCount <= 0) return rowMinPx + FILLED_TEXT_PAD_Y_PX * 2
  if (!hasContent) return rowMinPx + FILLED_TEXT_PAD_Y_PX * 2
  const n = segmentCount
  // n gaps in line-height (incl. below last line) — matches textarea stride, not flex gap count.
  return FILLED_TEXT_PAD_Y_PX * 2 + n * rowMinPx + n * FILLED_LINE_GAP_PX
}

/** Row min-height for pills including descender slack — pass font size in px. */
export { filledPillRowMinPx }

/** Break one paragraph (no \\n) into visual rows that fit within max width. */
export function wrapParagraphIntoSegments(
  paragraph: string,
  cs: CSSStyleDeclaration,
  innerMax: number,
): string[] {
  if (!paragraph) return ['']
  const segments: string[] = []
  let remaining = paragraph
  while (remaining.length > 0) {
    if (measureInkLineWidthPx(remaining, cs) <= innerMax) {
      segments.push(remaining)
      break
    }
    let fitEnd = 0
    for (let i = 1; i <= remaining.length; i++) {
      if (measureInkLineWidthPx(remaining.slice(0, i), cs) <= innerMax) fitEnd = i
      else break
    }
    if (fitEnd <= 0) fitEnd = 1

    let headEnd = fitEnd
    const lastSpace = remaining.slice(0, fitEnd).lastIndexOf(' ')
    if (lastSpace > 0) headEnd = lastSpace

    let head = remaining.slice(0, headEnd).trimEnd()
    let tail = remaining.slice(headEnd).trimStart()

    if (!head && tail) {
      headEnd = fitEnd
      head = remaining.slice(0, headEnd)
      tail = remaining.slice(headEnd)
    }

    segments.push(head)
    remaining = tail
  }
  return segments.length > 0 ? segments : ['']
}

/** Visual rows for highlight pills only — does not mutate stored text. */
export function computeVisualLineSegments(
  text: string,
  cs: CSSStyleDeclaration,
  anchorXNorm: number,
  overlayWidthPx: number,
): string[] {
  const fieldWidthPx = filledMaxWidthPx(anchorXNorm, overlayWidthPx)
  return computeFilledVisualLineSegments(text, cs, fieldWidthPx)
}

export function fitFilledTextareaSize(
  ta: HTMLTextAreaElement,
  fieldWidthPx: number,
  opts?: { allowWrap?: boolean },
): void {
  ta.style.whiteSpace = opts?.allowWrap === false ? 'pre' : 'pre-wrap'
  ta.style.width = `${Math.max(8, fieldWidthPx)}px`
}

/**
 * Field width from explicit \\n lines only — never narrowed by soft-wrap segments.
 * Prevents width shrink → re-wrap oscillation while typing.
 */
export function measureFilledUnwrappedFieldWidthPx(
  text: string,
  cs: CSSStyleDeclaration,
  anchorXNorm: number,
  overlayWidthPx: number,
  opts?: {
    emptyPlaceholder?: string
    latchedMaxWidth?: boolean
    maxWidthNorm?: number
    variant?: TextLabelFieldVariant
    /** While typing: one unwrapped line per paragraph, no page-max cap or latch. */
    growOnly?: boolean
  },
): number {
  const variant = opts?.variant ?? 'filled'
  const maxPx = pageMaxWidthPx(anchorXNorm, overlayWidthPx, opts?.maxWidthNorm)
  const innerMax = innerMaxWidthPx(anchorXNorm, overlayWidthPx, opts?.maxWidthNorm, variant)
  const measureSource = text || opts?.emptyPlaceholder || ''
  if (!measureSource) return 8

  if (opts?.growOnly) {
    let contentW = 8
    for (const para of measureSource.split('\n')) {
      contentW = Math.max(
        contentW,
        measureFilledLineTextWidth(para.length > 0 ? para : ' ', cs),
      )
    }
    return Math.min(Math.max(contentW, 8), maxPx)
  }

  const needsMax =
    Boolean(opts?.latchedMaxWidth) ||
    filledTextNeedsMaxWidth(text, cs, innerMax) ||
    (Boolean(opts?.emptyPlaceholder && !text) &&
      filledTextNeedsMaxWidth(opts.emptyPlaceholder!, cs, innerMax))

  if (needsMax) return maxPx

  let contentW = 8
  for (const para of measureSource.split('\n')) {
    contentW = Math.max(
      contentW,
      measureFilledLineTextWidth(para.length > 0 ? para : ' ', cs),
    )
  }
  return Math.min(Math.max(contentW, 8), maxPx)
}

/** Growing: explicit \\n rows + unwrapped width. Latched: page-max width + soft-wrap visual rows. */
function layoutTextLabelFieldWhileEditing(
  ta: HTMLTextAreaElement,
  text: string,
  cs: CSSStyleDeclaration,
  anchorXNorm: number,
  overlayWidthPx: number,
  opts: TextLabelFieldLayoutOpts,
): TextLabelFieldLayout {
  const variant = opts.variant ?? 'filled'
  const maxPx = pageMaxWidthPx(anchorXNorm, overlayWidthPx, opts?.maxWidthNorm)
  const innerMax = innerMaxWidthPx(anchorXNorm, overlayWidthPx, opts?.maxWidthNorm, variant)
  const widthSource = opts.measureTextForWidth ?? text
  const measureForLatch = widthSource || opts.emptyPlaceholder || ''
  const latched =
    Boolean(opts.latchedMaxWidth) ||
    (measureForLatch.length > 0 && textLabelNeedsPageMaxWidth(measureForLatch, cs, innerMax))

  const emptyPlaceholder =
    opts.emptyPlaceholder && !text.length ? opts.emptyPlaceholder : undefined

  if (latched) {
    fitFilledTextareaSize(ta, maxPx)
    const segments = computeFilledVisualLineSegments(text, cs, maxPx, ta)
    const widths =
      variant === 'filled'
        ? filledSegmentWidths(segments, cs, maxPx, emptyPlaceholder)
        : []
    return { segments, widths, fieldWidthPx: maxPx, latchedWhileEditing: true }
  }

  const fieldWidthPx = measureFilledUnwrappedFieldWidthPx(
    widthSource || opts.emptyPlaceholder || '',
    cs,
    anchorXNorm,
    overlayWidthPx,
    {
      emptyPlaceholder: !text.length ? opts.emptyPlaceholder : undefined,
      maxWidthNorm: opts.maxWidthNorm,
      variant,
      growOnly: true,
    },
  )

  fitFilledTextareaSize(ta, fieldWidthPx, { allowWrap: false })

  const segments = computeFilledExplicitLineSegments(text)
  const widths =
    variant === 'filled'
      ? filledSegmentWidths(segments, cs, fieldWidthPx, emptyPlaceholder)
      : []

  return { segments, widths, fieldWidthPx, latchedWhileEditing: false }
}

/** Set textarea width, then compute visual rows (and pill widths when filled). */
export function layoutTextLabelField(
  ta: HTMLTextAreaElement,
  text: string,
  cs: CSSStyleDeclaration,
  anchorXNorm: number,
  overlayWidthPx: number,
  opts?: TextLabelFieldLayoutOpts,
): TextLabelFieldLayout {
  if (opts?.growOnly) {
    return layoutTextLabelFieldWhileEditing(ta, text, cs, anchorXNorm, overlayWidthPx, opts)
  }

  const variant = opts?.variant ?? 'filled'
  const maxPx = pageMaxWidthPx(anchorXNorm, overlayWidthPx, opts?.maxWidthNorm)
  const innerMax = innerMaxWidthPx(anchorXNorm, overlayWidthPx, opts?.maxWidthNorm, variant)
  const widthSource = opts?.measureTextForWidth ?? text
  const latched =
    Boolean(opts?.latchedMaxWidth) ||
    textLabelNeedsPageMaxWidth(widthSource, cs, innerMax)
  const emptyPlaceholder =
    opts?.emptyPlaceholder && !text.length ? opts.emptyPlaceholder : undefined
  const segmentSource = text

  if (variant === 'filled') {
    const fieldWidthPx = latched
      ? maxPx
      : measureFilledUnwrappedFieldWidthPx(
          text || emptyPlaceholder || '',
          cs,
          anchorXNorm,
          overlayWidthPx,
          {
            emptyPlaceholder,
            maxWidthNorm: opts?.maxWidthNorm,
            variant,
            latchedMaxWidth: opts?.latchedMaxWidth,
          },
        )

    fitFilledTextareaSize(ta, fieldWidthPx)
    // Short labels: keep one row per explicit \\n (matches editing). Soft-wrap only at page max.
    const segments = latched
      ? computeFilledVisualLineSegments(segmentSource, cs, fieldWidthPx, ta)
      : computeFilledExplicitLineSegments(segmentSource)
    const widths = filledSegmentWidths(segments, cs, fieldWidthPx, emptyPlaceholder)
    return { segments, widths, fieldWidthPx }
  }

  const provisionalWidth = latched
    ? maxPx
    : resolveFilledFieldWidthPx(text, cs, anchorXNorm, overlayWidthPx, [segmentSource], {
        ...opts,
        variant,
      })

  fitFilledTextareaSize(ta, provisionalWidth)

  let fieldWidthPx = resolveFilledFieldWidthPx(
    text,
    cs,
    anchorXNorm,
    overlayWidthPx,
    computeFilledVisualLineSegments(segmentSource, cs, provisionalWidth, ta),
    { ...opts, variant },
  )

  fitFilledTextareaSize(ta, fieldWidthPx)

  const segments = computeFilledVisualLineSegments(segmentSource, cs, fieldWidthPx, ta)
  fieldWidthPx = resolveFilledFieldWidthPx(text, cs, anchorXNorm, overlayWidthPx, segments, {
    ...opts,
    variant,
    latchedMaxWidth: latched,
  })
  fitFilledTextareaSize(ta, fieldWidthPx)

  const finalSegments = computeFilledVisualLineSegments(segmentSource, cs, fieldWidthPx, ta)
  return { segments: finalSegments, widths: [], fieldWidthPx }
}

/** @deprecated Use {@link layoutTextLabelField} with `variant: 'filled'`. */
export function layoutFilledTextField(
  ta: HTMLTextAreaElement,
  text: string,
  cs: CSSStyleDeclaration,
  anchorXNorm: number,
  overlayWidthPx: number,
  opts?: TextLabelFieldLayoutOpts,
): TextLabelFieldLayout {
  return layoutTextLabelField(ta, text, cs, anchorXNorm, overlayWidthPx, {
    ...opts,
    variant: 'filled',
  })
}

/** Hidden textarea with the same typography + padding as an on-page label field. */
export function createTextLabelLayoutProbe(
  fontFamily: string,
  fontSizePx: number,
  variant: TextLabelFieldVariant = 'filled',
  fontWeight?: string | number,
): HTMLTextAreaElement {
  const probe = document.createElement('textarea')
  probe.setAttribute('aria-hidden', 'true')
  probe.setAttribute('rows', '1')
  const pad = textLabelFieldPaddingCSS(variant)
  const lineHeightPx =
    variant === 'filled' ? filledTextLineStridePx(fontSizePx) : textLabelLineHeightPx(fontSizePx)
  Object.assign(probe.style, {
    position: 'absolute',
    left: '-9999px',
    top: '0',
    visibility: 'hidden',
    resize: 'none',
    border: '0',
    boxSizing: 'border-box',
    fontFamily,
    fontSize: `${fontSizePx}px`,
    ...(fontWeight != null ? { fontWeight: String(fontWeight) } : {}),
    lineHeight: `${lineHeightPx}px`,
    paddingTop: pad.paddingTop,
    paddingBottom: pad.paddingBottom,
    paddingLeft: pad.paddingLeft,
    paddingRight: pad.paddingRight,
    whiteSpace: 'pre-wrap',
    wordBreak: 'normal',
    overflowWrap: 'break-word',
    ...annotationTextFieldNoScrollCSS(),
  })
  return probe
}

/** @deprecated Use {@link createTextLabelLayoutProbe} with `variant: 'filled'`. */
export function createFilledTextLayoutProbe(
  fontFamily: string,
  fontSizePx: number,
): HTMLTextAreaElement {
  return createTextLabelLayoutProbe(fontFamily, fontSizePx, 'filled')
}

export function computeFilledPillLayout(
  text: string,
  fontFamily: string,
  fontSizePx: number,
  anchorXNorm: number,
  overlayWidthPx: number,
  measureText?: string,
  layoutOpts?: TextLabelFieldLayoutOpts,
): TextLabelFieldLayout {
  return resolveTextLabelFieldLayout(text, fontFamily, fontSizePx, anchorXNorm, overlayWidthPx, {
    variant: 'filled',
    emptyPlaceholder: measureText && !text.length ? measureText : undefined,
    ...layoutOpts,
  })
}

/**
 * Single layout entry for text labels — DOM editor, committed display, and selection chrome.
 */
export function resolveTextLabelFieldLayout(
  text: string,
  fontFamily: string,
  fontSizePx: number,
  anchorXNorm: number,
  overlayWidthPx: number,
  opts?: TextLabelFieldLayoutOpts,
): TextLabelFieldLayout {
  if (typeof document === 'undefined') {
    return { segments: [''], widths: [], fieldWidthPx: 8 }
  }
  const variant = opts?.variant ?? 'filled'
  const probe = createTextLabelLayoutProbe(fontFamily, fontSizePx, variant, opts?.fontWeight)
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const sourceText = opts?.emptyPlaceholder && !text.length ? '' : text
  const layout = layoutTextLabelField(probe, sourceText, cs, anchorXNorm, overlayWidthPx, {
    emptyPlaceholder: opts?.emptyPlaceholder && !text.length ? opts.emptyPlaceholder : undefined,
    latchedMaxWidth: opts?.latchedMaxWidth,
    growOnly: opts?.growOnly,
    maxWidthNorm: opts?.maxWidthNorm,
    variant,
    measureTextForWidth: opts?.measureTextForWidth,
  })
  document.body.removeChild(probe)
  return layout
}

/** @deprecated Use {@link resolveTextLabelFieldLayout} with `variant: 'filled'`. */
export function resolveFilledTextFieldLayout(
  text: string,
  fontFamily: string,
  fontSizePx: number,
  anchorXNorm: number,
  overlayWidthPx: number,
  opts?: TextLabelFieldLayoutOpts,
): TextLabelFieldLayout {
  return resolveTextLabelFieldLayout(text, fontFamily, fontSizePx, anchorXNorm, overlayWidthPx, {
    ...opts,
    variant: 'filled',
  })
}

export function measureFilledSegmentWidths(
  segments: string[],
  cs: CSSStyleDeclaration,
  fieldWidthPx: number,
  emptyPlaceholder?: string,
): number[] {
  const pad = FILLED_TEXT_MEASURE_PAD_PX
  return segments.map((seg, i) => {
    if (seg.length > 0) {
      const ink = measureInkLineWidthPx(seg, cs)
      return Math.min(Math.max(ink + pad, 1), fieldWidthPx)
    }
    if (emptyPlaceholder && i === 0) {
      const ink = measureInkLineWidthPx(emptyPlaceholder, cs)
      return Math.min(Math.max(ink + pad, 1), fieldWidthPx)
    }
    // Explicit empty row (e.g. after Enter) — no phantom space ink.
    return 1
  })
}
