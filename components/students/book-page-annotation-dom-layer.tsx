'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from 'react'
import { X } from 'lucide-react'
import type {
  AnnotationCommand,
  FlashcardAnnotationCommand,
  ImageAnnotationCommand,
  StickyAnnotationCommand,
  TextAnnotationCommand,
  WritableStickerVariant,
} from '@/lib/books/annotation-command-types'
import {
  DEFAULT_STICKY_FILL_COLOR,
  DEFAULT_TEXT_FILL_COLOR,
} from '@/lib/books/annotation-palettes'
import { isCenteredWritableStickerVariant, stickyWritableVariant } from '@/lib/books/sticker-tool'
import {
  BUBBLE_BODY_PAD_PX,
  SPEECH_BUBBLE_EXTRA_BOTTOM_PAD_PX,
  isBubbleWritableVariant,
} from '@/components/students/bubble-sticker-shape'
import {
  writableStickerLayoutMetrics,
  writableStickerChrome,
} from '@/lib/books/writable-sticker-visuals'
import { WritableStickerShell } from '@/components/students/writable-sticker-shell'
import { FLASHCARD_IMAGE_AREA_HEIGHT_RATIO } from '@/lib/lesson-board/lesson-board-flashcard-layout'
import { resolveTextTopAnchorOnMultiline } from '@/lib/books/annotation-geometry'
import {
  commitBookOverlayTypingTarget,
  endBookOverlayAnnotationEditingFocus,
  focusBookOverlayAnnotationField,
  getBookOverlayAnnotationFocusGeneration,
  isAnnotationTextFieldFocused,
} from '@/lib/books/book-overlay-keyboard-guards'
import { cn } from '@/lib/utils'
import { CoachDictationSentenceChrome } from '@/components/lesson-coach/coach-dictation-sentence-chrome'
import {
  CoachSentenceGrammarPanel,
  shouldShowGrammarPanel,
} from '@/components/lesson-coach/coach-sentence-grammar-rail'
import { getSharedScreenHighlightIssues } from '@/lib/lesson-coach/issue-reveal'
import { useCoachTextFieldAssist } from '@/lib/lesson-coach/use-coach-text-field-assist'
import { useLessonCoachSyncData } from '@/lib/lesson-coach/lesson-coach-sync-context'
import { WritingAssistGhostUi } from '@/components/writing-assist/writing-assist-ghost-hint'
import { WritingAssistSpellMirror } from '@/components/writing-assist/writing-assist-spell-mirror'
import { useSpellMarkerSpans } from '@/lib/writing-assist/use-spell-marker-spans'
import { GHOST_MIN_PARTIAL_LENGTH } from '@/lib/writing-assist/ghost-complete'
import {
  annotationTextFontFamily,
  annotationTextCssWeight,
  type AnnotationTextFontId,
} from '@/lib/books/annotation-text-fonts'
import { isTranslationChipText, TRANSLATION_CHIP_PREVIEW_CLASS } from '@/lib/translate/place-translation-chip'
import {
  computeFilledPillLayout,
  layoutTextLabelField,
  filledPillStackHeightPx,
  filledTextLineStridePx,
  filledPillRowMinPx,
  measureInkLineWidthPx,
  resolveTextLabelFieldLayout,
} from '@/lib/books/filled-text-layout'
import {
  textLabelPageMaxWidthPx,
} from '@/lib/books/text-label-field-layout'
import {
  annotationTextFieldNoScrollCSS,
  filledTextPillStackPaddingCSS,
  filledTextEmptyTrayColor,
  textLabelFieldPaddingCSS,
  textLabelLineHeightPx,
  textLabelEditableFieldChromeCSS,
  textLabelPlaceholderMirrorStyle,
  writableStickyBodyMirrorStyle,
  writableStickyFieldMinHeightPx,
  FILLED_EDIT_CHROME_INSET_PX,
  textLabelAlignOrDefault,
  textLabelCenterGrowLeft,
  textLabelBlockHeightNorm,
  type TextLabelFieldVariant,
} from '@/lib/books/text-label-layout'
import { FilledTextPillLayer } from '@/components/students/filled-text-pill-layer'
import { TextGlossSpans, TextGlossEditOverlay } from '@/components/students/text-gloss-spans'
import {
  commitTextGlossesForLabel,
  commitTextGlossesForSticky,
} from '@/lib/books/text-gloss'
import {
  resolveTextGlossChrome,
  TEXT_GLOSS_PAGE_SURFACE,
} from '@/lib/books/text-gloss-chrome'
import {
  BOOK_ANNOTATION_FOCUS_ACQUIRE_MS,
  WRITABLE_STICKY_PLACEHOLDER,
  isBookAnnotationTextCommitShortcut,
  shouldBookAnnotationLabelCapturePointer,
  shouldShowBookAnnotationTextarea,
} from '@/lib/books/text-tool-ux'

function pasteRevealClassName(pasteRevealIds: ReadonlySet<string> | undefined, id: string): string {
  return pasteRevealIds?.has(id) ? 'animate-board-paste-pop' : ''
}

/** Mirror/field styles hide overflow for textareas; glosses must paint above the line. */
const COMMITTED_GLOSS_OVERFLOW_CSS: CSSProperties = {
  overflow: 'visible',
  overflowX: 'visible',
  overflowY: 'visible',
}

function useDictationChromeForField(coachField: 'label' | 'whiteboard', localText: string) {
  const { activeField, session } = useLessonCoachSyncData()
  const sessionId = session?.id ?? null
  const sessionOwnsField =
    session?.activeField === coachField ||
    activeField === coachField ||
    activeField == null
  const text =
    session?.sharedText?.trim() && sessionOwnsField ? session.sharedText : localText
  const issues = session?.issues ?? []
  const showMirror =
    sessionOwnsField && getSharedScreenHighlightIssues(issues).length > 0
  const grammarUiVisible =
    shouldShowGrammarPanel(
      coachField,
      localText,
      sessionId,
      activeField,
      session?.activeField,
    )
  return { text, issues, showMirror, grammarUiVisible }
}

type TextSticky = TextAnnotationCommand | StickyAnnotationCommand

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Center-anchored labels grow upward on Enter/wrap; pin the first line and grow downward. */
function applyTextTopAnchorOnMultiline(
  cmd: TextAnnotationCommand,
  opts: {
    heightPx: number
    previousText: string
    nextText: string
    forceMultiline?: boolean
    onPatch: (partial: Partial<TextAnnotationCommand>) => void
    overrideRef: MutableRefObject<{ y: number } | null>
    labelEl?: HTMLElement | null
  },
): boolean {
  const patch = resolveTextTopAnchorOnMultiline(cmd, opts)
  if (!patch) return false
  opts.overrideRef.current = { y: patch.y }
  opts.onPatch(patch)
  if (opts.labelEl) {
    opts.labelEl.style.transform = 'none'
    opts.labelEl.style.top = `${patch.y * 100}%`
  }
  return true
}

/** Compose vertical anchor transform for label placement (horizontal align is in-box only). */
function textLabelAnchorTransform(cmd: TextAnnotationCommand): string | undefined {
  if (cmd.yAnchor === 'center') return 'translateY(-50%)'
  return undefined
}

/** `x`/`y` are the bbox top-left; vertical `yAnchor` may apply a transform. */
function textBlockPositionStyle(
  cmd: TextAnnotationCommand,
  leftPct: number,
  topPct: number,
  extra?: CSSProperties,
): CSSProperties {
  const transform = textLabelAnchorTransform(cmd)
  return {
    left: `${leftPct}%`,
    top: `${topPct}%`,
    ...(transform ? { transform } : {}),
    ...extra,
  }
}

/** Grow textarea height to fit all lines; no inner scrollbar. */
function applyAnnotationTextFieldNoScroll(el: HTMLTextAreaElement): void {
  const noScroll = annotationTextFieldNoScrollCSS()
  el.style.overflowX = noScroll.overflowX ?? 'hidden'
  el.style.overflowY = noScroll.overflowY ?? 'hidden'
  el.style.scrollbarWidth = noScroll.scrollbarWidth ?? 'none'
}

function fitTextareaHeight(el: HTMLTextAreaElement | null): void {
  if (!el) return
  applyAnnotationTextFieldNoScroll(el)
  el.style.height = `${el.scrollHeight}px`
}

/** Sticky body: size to content; reset first so deleting lines can shrink the field. */
function fitStickyTextareaHeight(el: HTMLTextAreaElement | null, minPx: number): void {
  if (!el) return
  applyAnnotationTextFieldNoScroll(el)
  el.style.height = '0px'
  el.style.height = `${Math.max(minPx, el.scrollHeight)}px`
}

/** Body height for speech/thought bubbles while typing (textarea + shell padding). */
function measureBubbleLiveBodyPx(
  ta: HTMLTextAreaElement | null,
  bodyMinPx: number,
  variant: WritableStickerVariant,
): number {
  if (!ta) return bodyMinPx
  const bottomPad =
    variant === 'speech'
      ? BUBBLE_BODY_PAD_PX + SPEECH_BUBBLE_EXTRA_BOTTOM_PAD_PX
      : BUBBLE_BODY_PAD_PX
  return Math.max(bodyMinPx, ta.scrollHeight + BUBBLE_BODY_PAD_PX + bottomPad)
}

function textLabelFieldWhiteSpace(text: string): CSSProperties['whiteSpace'] {
  return text.includes('\n') ? 'pre-wrap' : 'pre'
}

function textLabelMirrorStyle(
  fontFamily: string,
  fontSize: number,
  color: string,
  text: string,
  variant: TextLabelFieldVariant = 'plain',
  opts?: {
    omitFieldPadding?: boolean
    whiteSpace?: CSSProperties['whiteSpace']
    textAlign?: TextAnnotationCommand['textAlign']
    fontWeight?: CSSProperties['fontWeight']
  },
): CSSProperties {
  const lineHeightPx =
    variant === 'filled' ? filledTextLineStridePx(fontSize) : textLabelLineHeightPx(fontSize)
  return {
    fontFamily,
    fontSize,
    color,
    ...(opts?.fontWeight != null ? { fontWeight: opts.fontWeight } : {}),
    textAlign: textLabelAlignOrDefault(opts?.textAlign),
    ...(opts?.omitFieldPadding ? {} : textLabelFieldPaddingCSS(variant)),
    ...annotationTextFieldNoScrollCSS(),
    lineHeight: `${lineHeightPx}px`,
    minHeight: lineHeightPx,
    wordBreak: 'normal',
    overflowWrap: 'break-word',
    whiteSpace: opts?.whiteSpace ?? 'pre-wrap',
  }
}

const filledTextFieldPaddingCSS = textLabelFieldPaddingCSS('filled')
const filledTextPillStackPadding = filledTextPillStackPaddingCSS()

function textLabelPlaceholderMirrorTypography(
  fontFamily: string,
  fontSize: number,
  color: string,
  variant: TextLabelFieldVariant = 'plain',
  opts?: { omitFieldPadding?: boolean; fontWeight?: CSSProperties['fontWeight'] },
): CSSProperties {
  return textLabelMirrorStyle(fontFamily, fontSize, color, '', variant, {
    ...opts,
    whiteSpace: 'nowrap',
  })
}

/** Ghost placeholder â€” one path for plain, filled, and sticky editors (no native `placeholder` attr). */
function TextLabelPlaceholderGhost({
  text,
  mirrorStyle,
  className,
  absoluteStyle,
}: {
  text: string
  mirrorStyle: CSSProperties
  className?: string
  absoluteStyle?: CSSProperties
}) {
  return (
    <span
      className={cn(
        'pointer-events-none absolute z-[2] box-border max-w-none select-none',
        className,
      )}
      style={{
        ...absoluteStyle,
        ...textLabelPlaceholderMirrorStyle(mirrorStyle),
        whiteSpace: 'nowrap',
      }}
      aria-hidden
    >
      {text}
    </span>
  )
}

type TextFieldLayout = {
  segments: string[]
  widths: number[]
  fieldWidthPx: number
  latchedWhileEditing?: boolean
}

function estimatePlaceholderWidthPx(text: string, cs: CSSStyleDeclaration): number {
  const measured = Math.ceil(measureInkLineWidthPx(text, cs))
  const fontSize = parseFloat(cs.fontSize) || 16
  const estimated = Math.ceil(text.length * fontSize * 0.58)
  return Math.max(measured, estimated)
}

function fitTextLabelFieldSize(
  cmd: TextAnnotationCommand,
  ta: HTMLTextAreaElement | null,
  overlayWidthPx: number,
  shell: HTMLElement | null,
  local: string,
  opts: {
    editing?: boolean
    editingLatched?: boolean
    showFieldPlaceholder?: boolean
    placeholderText?: string | null
    ghostSuffix?: string
    onCenterGrowPatch?: (nextX: number) => void
    prevVisualWidthPxRef?: MutableRefObject<number | null>
  },
): TextFieldLayout {
  const variant: TextLabelFieldVariant = cmd.visualStyle === 'filled' ? 'filled' : 'plain'
  const pageMaxPx = textLabelPageMaxWidthPx(cmd.x, overlayWidthPx, cmd.maxWidthNorm)
  if (!ta) {
    return { segments: [''], widths: [], fieldWidthPx: 8, latchedWhileEditing: false }
  }
  applyAnnotationTextFieldNoScroll(ta)
  if (shell && variant === 'plain') {
    shell.style.overflowX = 'hidden'
    shell.style.overflowY = 'hidden'
  }
  const cs = getComputedStyle(ta)
  const measureTextForWidth = opts.showFieldPlaceholder
    ? opts.placeholderText ?? undefined
    : opts.ghostSuffix && opts.editing
      ? local + opts.ghostSuffix
      : undefined
  let layout = layoutTextLabelField(ta, local, cs, cmd.x, overlayWidthPx, {
    variant,
    maxWidthNorm: cmd.maxWidthNorm,
    emptyPlaceholder:
      opts.showFieldPlaceholder && !local.trim().length ? opts.placeholderText ?? undefined : undefined,
    growOnly: Boolean(opts.editing),
    latchedMaxWidth: opts.editingLatched,
    measureTextForWidth,
  })
  let fieldWidthPx = layout.fieldWidthPx
  if (opts.showFieldPlaceholder && opts.placeholderText) {
    const placeholderWidthPx = Math.ceil(estimatePlaceholderWidthPx(opts.placeholderText, cs))
    fieldWidthPx = Math.max(fieldWidthPx, placeholderWidthPx)
    if (variant === 'filled') {
      layout = {
        segments: [''],
        fieldWidthPx,
        widths: [fieldWidthPx],
      }
    } else {
      layout = { ...layout, fieldWidthPx }
    }
  } else if (fieldWidthPx !== layout.fieldWidthPx) {
    layout = { ...layout, fieldWidthPx }
  }
  ta.style.width = `${fieldWidthPx}px`
  ta.style.maxWidth = `${pageMaxPx}px`
  fitTextareaHeight(ta)
  if (shell && variant === 'plain') {
    shell.style.width = `${fieldWidthPx}px`
    shell.style.maxWidth = `${pageMaxPx}px`
  }

  const visualWidthPx =
    variant === 'filled' ? fieldWidthPx + FILLED_EDIT_CHROME_INSET_PX * 2 : fieldWidthPx
  if (
    opts.editing &&
    textLabelAlignOrDefault(cmd.textAlign) === 'center' &&
    opts.onCenterGrowPatch &&
    opts.prevVisualWidthPxRef &&
    overlayWidthPx > 0
  ) {
    const prevPx = opts.prevVisualWidthPxRef.current
    if (prevPx != null && prevPx !== visualWidthPx) {
      const prevNorm = prevPx / overlayWidthPx
      const nextNorm = visualWidthPx / overlayWidthPx
      const nextX = textLabelCenterGrowLeft(cmd.x, prevNorm, nextNorm)
      if (Math.abs(nextX - cmd.x) > 1e-9) {
        opts.onCenterGrowPatch(nextX)
      }
    }
    opts.prevVisualWidthPxRef.current = visualWidthPx
  } else if (opts.editing && opts.prevVisualWidthPxRef) {
    opts.prevVisualWidthPxRef.current = visualWidthPx
  }

  return layout
}


function EditableBlock({
  cmd,
  heightPx,
  overlayWidthPx,
  defaultTextFontId,
  autoFocus,
  onAutoFocusConsumedRef,
  onPatch,
  onDeleteSticky,
  onDeleteText,
  selectMode,
  textToolActive,
  textInputEnabled = false,
  isEditing,
  editingZIndex,
  onEndEdit,
  onRequestEdit,
  onEditingTextDraftChange,
  coachField = 'label',
  pasteRevealIds,
}: {
  cmd: TextSticky
  heightPx: number
  overlayWidthPx: number
  defaultTextFontId: AnnotationTextFontId
  autoFocus: boolean
  onAutoFocusConsumedRef: MutableRefObject<(() => void) | undefined>
  onPatch: (partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => void
  onDeleteSticky?: () => void
  onDeleteText?: () => void
  selectMode?: boolean
  /** True when the text or sticky tool is active â€” enables typing and click-to-edit on labels/notes. */
  textToolActive?: boolean
  /** When false on move/select, hide the textarea even if editingId is stale. */
  textInputEnabled?: boolean
  isEditing?: boolean
  editingZIndex?: number
  onEndEdit?: () => void
  onRequestEdit?: () => void
  onEditingTextDraftChange?: (text: string | null) => void
  coachField?: 'label' | 'whiteboard'
  pasteRevealIds?: ReadonlySet<string>
}) {
  const [local, setLocal] = useState(cmd.text)
  const hasGlosses = (cmd.glosses?.length ?? 0) > 0
  const [isFieldFocused, setIsFieldFocused] = useState(false)
  const [textSelectionActive, setTextSelectionActive] = useState(false)
  const [awaitingEditFocus, setAwaitingEditFocus] = useState(false)
  const prevIsEditingRef = useRef(isEditing)
  const pendingProgrammaticFocusRef = useRef(false)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const labelRootRef = useRef<HTMLDivElement | null>(null)
  const topAnchorOverrideRef = useRef<{ y: number } | null>(null)
  const [textareaMountTick, setTextareaMountTick] = useState(0)
  const assignTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    taRef.current = el
    if (el) setTextareaMountTick((tick) => tick + 1)
  }, [])
  const textShellRef = useRef<HTMLDivElement | null>(null)
  const stickyShellRef = useRef<HTMLDivElement | null>(null)
  const editWidthLatchedRef = useRef(false)
  const editCenterVisualWidthRef = useRef<number | null>(null)
  const [textFieldLayout, setTextFieldLayout] = useState<TextFieldLayout>({
    segments: [''],
    widths: [],
    fieldWidthPx: 8,
    latchedWhileEditing: false,
  })
  const [liveBubbleBodyPx, setLiveBubbleBodyPx] = useState<number | undefined>(undefined)

  const stickyWritableVariantValue =
    cmd.kind === 'sticky' ? stickyWritableVariant(cmd) : null
  const isBubbleSticky =
    stickyWritableVariantValue != null &&
    isBubbleWritableVariant(stickyWritableVariantValue)

  const syncBubbleLiveBody = useCallback(
    (ta: HTMLTextAreaElement | null, bodyMinPx: number) => {
      if (!isBubbleSticky || stickyWritableVariantValue == null) return
      setLiveBubbleBodyPx(
        measureBubbleLiveBodyPx(ta, bodyMinPx, stickyWritableVariantValue),
      )
    },
    [isBubbleSticky, stickyWritableVariantValue],
  )

  useEffect(() => {
    if (isFieldFocused) return
    setLocal(cmd.text)
  }, [cmd.id, cmd.text, isFieldFocused])

  const stickyH = cmd.kind === 'sticky' ? cmd.h : null
  const textFilled = cmd.kind === 'text' && cmd.visualStyle === 'filled'
  const editSessionActive = (isEditing === true || autoFocus) && textInputEnabled
  const showTextarea = shouldShowBookAnnotationTextarea({
    textInputEnabled,
    isEditing: isEditing === true,
    autoFocus,
    isFieldFocused,
    acquiringFocus: awaitingEditFocus,
  })
  const placeholderText = cmd.kind === 'sticky' ? WRITABLE_STICKY_PLACEHOLDER : null
  const showFieldPlaceholder = editSessionActive && local.trim().length === 0 && placeholderText != null

  useEffect(() => {
    if (!showTextarea || !isBubbleSticky) {
      setLiveBubbleBodyPx(undefined)
    }
  }, [showTextarea, isBubbleSticky, cmd.id])

  const textLayoutKey =
    cmd.kind === 'text'
      ? `${cmd.x}|${cmd.maxWidthNorm ?? ''}|${cmd.visualStyle ?? 'plain'}|${cmd.fontSizeNorm}|${cmd.textAlign ?? 'left'}`
      : ''

  useEffect(() => {
    if (!showTextarea || !editSessionActive) {
      editWidthLatchedRef.current = false
      editCenterVisualWidthRef.current = null
      setTextFieldLayout({ segments: [''], widths: [], fieldWidthPx: 8, latchedWhileEditing: false })
    }
  }, [showTextarea, editSessionActive, cmd.id])

  /** Writable while the edit session is open â€” focus gates caret visibility, not input handlers. */
  const canEdit =
    showTextarea &&
    editSessionActive &&
    ((textToolActive && !selectMode) || (selectMode && isEditing === true))

  const isSticky = cmd.kind === 'sticky'
  const labelCapturePointer = shouldBookAnnotationLabelCapturePointer({
    isSticky,
    showTextarea,
    textToolActive: Boolean(textToolActive),
    selectMode: Boolean(selectMode),
  })
  const blockPointerEvents = labelCapturePointer ? 'pointer-events-auto' : 'pointer-events-none'
  const blockStackZ = editSessionActive && editingZIndex != null ? editingZIndex : undefined
  /** Text/sticky tool uses overlay chrome for hover + edit rings â€” keep DOM labels visually idle. */
  const textToolEditHint = false
  const textToolPeerHoverHint = false

  const openLabelEdit = useCallback(() => {
    if (selectMode) return
    if (textToolActive && isEditing !== true) {
      onRequestEdit?.()
    }
  }, [isEditing, onRequestEdit, selectMode, textToolActive])

  const onLabelClickToEdit = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (selectMode) return
      if (textToolActive && isEditing !== true) {
        e.stopPropagation()
        openLabelEdit()
      }
    },
    [isEditing, openLabelEdit, selectMode, textToolActive],
  )

  const onLabelPointerUpToEdit = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (selectMode || e.button !== 0) return
      if (textToolActive && isEditing !== true) {
        openLabelEdit()
      }
    },
    [isEditing, openLabelEdit, selectMode, textToolActive],
  )

  const onLabelPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // While typing, keep drags on the field (word select) — do not bubble to Move.
      if (canEdit) {
        e.stopPropagation()
        taRef.current?.focus({ preventScroll: true })
        return
      }
      if (selectMode) return
    },
    [canEdit, selectMode],
  )

  /** Only true while acquiring focus â€” not for the whole edit session (avoids stray caret). */
  useLayoutEffect(() => {
    const enteredEdit = Boolean(isEditing && !prevIsEditingRef.current)
    prevIsEditingRef.current = Boolean(isEditing)
    if (!isEditing && !autoFocus) {
      setAwaitingEditFocus(false)
      return
    }
    if (enteredEdit || autoFocus) {
      setAwaitingEditFocus(true)
    }
  }, [autoFocus, cmd.id, isEditing])

  const clearAwaitingEditFocus = useCallback(() => {
    setAwaitingEditFocus(false)
    pendingProgrammaticFocusRef.current = false
  }, [])

  useEffect(() => {
    if (!awaitingEditFocus) return
    const timer = window.setTimeout(() => {
      clearAwaitingEditFocus()
      // Only abandon never-mounted new-label autoFocus â€” not click-to-edit on committed text.
      if (!isEditing && autoFocus && !isAnnotationTextFieldFocused(cmd.id)) {
        onEndEdit?.()
      }
    }, BOOK_ANNOTATION_FOCUS_ACQUIRE_MS)
    return () => window.clearTimeout(timer)
  }, [autoFocus, awaitingEditFocus, clearAwaitingEditFocus, cmd.id, isEditing, onEndEdit])

  useEffect(() => {
    if (!showTextarea) return
    const ta = taRef.current
    if (!ta) return
    const syncFocusState = () => {
      queueMicrotask(() => {
        if (isAnnotationTextFieldFocused(cmd.id)) {
          setIsFieldFocused(true)
          clearAwaitingEditFocus()
          return
        }
        const active = document.activeElement
        if (
          active instanceof HTMLElement &&
          (active.closest('[data-writing-assist-ui]') ||
            active.closest('[data-slot="popover-content"]'))
        ) {
          return
        }
        setIsFieldFocused(false)
      })
    }
    ta.addEventListener('focusin', syncFocusState)
    ta.addEventListener('focusout', syncFocusState)
    return () => {
      ta.removeEventListener('focusin', syncFocusState)
      ta.removeEventListener('focusout', syncFocusState)
    }
  }, [clearAwaitingEditFocus, cmd.id, showTextarea])

  useEffect(() => {
    if (isEditing || autoFocus) {
      pendingProgrammaticFocusRef.current = true
    } else {
      pendingProgrammaticFocusRef.current = false
    }
  }, [isEditing, autoFocus, cmd.id])

  useEffect(() => {
    const ta = taRef.current
    if (ta && !canEdit && document.activeElement === ta) {
      ta.blur()
    }
  }, [canEdit])

  useEffect(() => {
    if (!showTextarea) {
      pendingProgrammaticFocusRef.current = false
      taRef.current?.blur()
      setIsFieldFocused(false)
      setAwaitingEditFocus(false)
      return
    }

    const ta = taRef.current
    const onWindowBlur = () => ta?.blur()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') ta?.blur()
    }

    window.addEventListener('blur', onWindowBlur)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('blur', onWindowBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [showTextarea])

  if (cmd.kind === 'text' && cmd.yAnchor === 'top') {
    topAnchorOverrideRef.current = null
  }

  const positionCmd: TextSticky =
    cmd.kind === 'text' && topAnchorOverrideRef.current != null
      ? { ...cmd, yAnchor: 'top', y: topAnchorOverrideRef.current.y }
      : cmd

  const leftPct = positionCmd.x * 100
  const topPct = positionCmd.y * 100
  const fs = Math.max(10, Math.round(cmd.fontSizeNorm * heightPx))
  const fontFamily = annotationTextFontFamily(cmd.fontId ?? defaultTextFontId)
  const fontWeight = annotationTextCssWeight(cmd.fontId ?? defaultTextFontId, cmd.fontWeight)
  const translationChip = cmd.kind === 'text' && isTranslationChipText(cmd)
  const glossFontSizePx = Math.max(10, Math.round(fs * 0.58))
  const showGlosses = hasGlosses
  const glossSurfaceBg =
    cmd.kind === 'sticky'
      ? (cmd.fillColor ?? DEFAULT_STICKY_FILL_COLOR)
      : cmd.kind === 'text' && cmd.visualStyle === 'filled'
        ? typeof cmd.fillColor === 'string' && /^#[0-9A-Fa-f]{6}$/i.test(cmd.fillColor)
          ? cmd.fillColor
          : DEFAULT_TEXT_FILL_COLOR
        : TEXT_GLOSS_PAGE_SURFACE
  const glossChrome = resolveTextGlossChrome(glossSurfaceBg)

  const blurText = useCallback(() => {
    const trimmed = local.trim()
    if (trimmed.length === 0) {
      onDeleteText?.()
      onEndEdit?.()
      return
    }
    const glosses = commitTextGlossesForLabel(local, trimmed, cmd.glosses)
    onPatch({
      text: trimmed,
      glosses,
    })
    queueMicrotask(() => {
      if (cmd.kind === 'text') {
        fitTextLabelFieldSize(cmd, taRef.current, overlayWidthPx, textShellRef.current, trimmed, {})
      } else {
        fitTextareaHeight(taRef.current)
      }
    })
    onEndEdit?.()
  }, [local, onPatch, onDeleteText, onEndEdit, cmd, overlayWidthPx])

  const blurSticky = useCallback(() => {
    if (cmd.kind !== 'sticky') return
    const trimmed = local.trim()
    // Empty writables are discarded (same as empty text labels).
    if (trimmed.length === 0) {
      if (onDeleteSticky) {
        onDeleteSticky()
      } else {
        onEndEdit?.()
      }
      return
    }
    const variant = stickyWritableVariant(cmd)
    const nextText = local.trimEnd()
    const glosses = commitTextGlossesForSticky(local, nextText, cmd.glosses)

    const { bodyMinPx } = writableStickerLayoutMetrics(variant, cmd.h, heightPx)
    const fsPx = Math.max(10, Math.round(cmd.fontSizeNorm * heightPx))
    fitStickyTextareaHeight(
      taRef.current,
      writableStickyFieldMinHeightPx(variant, fsPx, bodyMinPx),
    )
    const shell = stickyShellRef.current
    const { tailReservePx } = writableStickerLayoutMetrics(variant, cmd.h, heightPx)
    const measuredBodyPx = shell
      ? Math.max(0, shell.getBoundingClientRect().height - tailReservePx)
      : bodyMinPx
    const hNorm = shell
      ? clamp01(Math.max(cmd.h, measuredBodyPx / heightPx))
      : cmd.h
    onPatch({
      text: nextText,
      h: hNorm,
      glosses,
    })
    onEndEdit?.()
  }, [local, onPatch, onDeleteSticky, cmd, heightPx, onEndEdit])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const commitEdit = () => {
        if (cmd.kind === 'text') {
          blurText()
        } else {
          blurSticky()
        }
        ;(e.target as HTMLTextAreaElement).blur()
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        commitEdit()
        return
      }

      if (isBookAnnotationTextCommitShortcut(e)) {
        e.preventDefault()
        commitEdit()
      }
    },
    [cmd.kind, blurText, blurSticky],
  )

  const {
    assist,
    ghost,
    ghostPartial,
    ghostCandidates,
    ghostIndex,
    spellMirrorEnabled,
    onFieldFocus,
    onFieldBlur,
  } = useCoachTextFieldAssist({
    value: local,
    setValue: setLocal,
    coachField,
    onAfterChange: () => {
      const ta = taRef.current
      if (!ta) return
      if (cmd.kind === 'sticky') {
        const variant = stickyWritableVariant(cmd)
        const { bodyMinPx } = writableStickerLayoutMetrics(variant, cmd.h, heightPx)
        const fsPx = Math.max(10, Math.round(cmd.fontSizeNorm * heightPx))
        fitStickyTextareaHeight(ta, writableStickyFieldMinHeightPx(variant, fsPx, bodyMinPx))
        syncBubbleLiveBody(ta, bodyMinPx)
      } else {
        fitTextareaHeight(ta)
      }
    },
    onChange: (e) => {
      if (!canEdit) return
      const value = e.target.value
      if (cmd.kind === 'text') {
        applyTextTopAnchorOnMultiline(cmd, {
          heightPx,
          previousText: local,
          nextText: value,
          onPatch,
          overrideRef: topAnchorOverrideRef,
          labelEl: labelRootRef.current,
        })
      }
      setLocal(value)
      if (cmd.kind === 'sticky') {
        const variant = stickyWritableVariant(cmd)
        const { bodyMinPx } = writableStickerLayoutMetrics(variant, cmd.h, heightPx)
        const fsPx = Math.max(10, Math.round(cmd.fontSizeNorm * heightPx))
        queueMicrotask(() => {
          fitStickyTextareaHeight(
            e.target,
            writableStickyFieldMinHeightPx(variant, fsPx, bodyMinPx),
          )
          syncBubbleLiveBody(e.target, bodyMinPx)
        })
      } else {
        queueMicrotask(() => fitTextareaHeight(e.target))
      }
    },
    onKeyDown: onKeyDown as (e: React.KeyboardEvent<HTMLTextAreaElement>) => void,
  })

  useLayoutEffect(() => {
    const ta = taRef.current
    if (!showTextarea) return
    if (cmd.kind === 'text') {
      if (!ta) return
      const variant: TextLabelFieldVariant = cmd.visualStyle === 'filled' ? 'filled' : 'plain'
      const stillCenter =
        cmd.yAnchor === 'center' && topAnchorOverrideRef.current == null
      if (stillCenter) {
        let forceMultiline = local.includes('\n')
        if (!forceMultiline) {
          const prevHeight = ta.style.height
          ta.style.height = '0px'
          const scrollH = ta.scrollHeight
          ta.style.height = prevHeight
          const oneLinePx = textLabelBlockHeightNorm(cmd.fontSizeNorm, 1, heightPx, variant) * heightPx
          if (scrollH > oneLinePx + 2) forceMultiline = true
        }
        if (forceMultiline) {
          applyTextTopAnchorOnMultiline(cmd, {
            heightPx,
            previousText: local,
            nextText: local,
            forceMultiline: true,
            onPatch,
            overrideRef: topAnchorOverrideRef,
            labelEl: labelRootRef.current,
          })
        }
      }
      const ghostSuffix =
        !showFieldPlaceholder &&
        local.length >= GHOST_MIN_PARTIAL_LENGTH &&
        cmd.visualStyle !== 'filled' &&
        ghost?.suffix
          ? ghost.suffix
          : undefined
      const layout = fitTextLabelFieldSize(cmd, ta, overlayWidthPx, textShellRef.current, local, {
        editing: true,
        editingLatched: editWidthLatchedRef.current,
        showFieldPlaceholder,
        placeholderText,
        ghostSuffix,
        prevVisualWidthPxRef: editCenterVisualWidthRef,
        onCenterGrowPatch: (nextX) => onPatch({ x: nextX }),
      })
      if (layout.latchedWhileEditing) {
        editWidthLatchedRef.current = true
      }
      if (variant === 'filled' && textShellRef.current) {
        const rowMinPx = filledPillRowMinPx(fs)
        const stackPx = filledPillStackHeightPx(
          Math.max(1, layout.segments.length),
          rowMinPx,
          local.trim().length > 0 || showFieldPlaceholder,
        )
        const outerW = layout.fieldWidthPx + FILLED_EDIT_CHROME_INSET_PX * 2
        const outerH = stackPx + FILLED_EDIT_CHROME_INSET_PX * 2
        const pageMaxPx = textLabelPageMaxWidthPx(cmd.x, overlayWidthPx, cmd.maxWidthNorm)
        const shell = textShellRef.current
        shell.style.width = `${outerW}px`
        shell.style.minWidth = `${outerW}px`
        shell.style.maxWidth = `${pageMaxPx + FILLED_EDIT_CHROME_INSET_PX * 2}px`
        shell.style.minHeight = `${outerH}px`
        const inner = shell.firstElementChild
        if (inner instanceof HTMLElement) {
          inner.style.minHeight = `${stackPx}px`
        }
      }
      setTextFieldLayout(layout)
      return
    }
    if (cmd.kind === 'sticky') {
      const variant = stickyWritableVariant(cmd)
      const { bodyMinPx } = writableStickerLayoutMetrics(variant, cmd.h, heightPx)
      const fsPx = Math.max(10, Math.round(cmd.fontSizeNorm * heightPx))
      fitStickyTextareaHeight(ta, writableStickyFieldMinHeightPx(variant, fsPx, bodyMinPx))
      syncBubbleLiveBody(ta, bodyMinPx)
      return
    }
    fitTextareaHeight(ta)
  }, [
    local,
    cmd.id,
    cmd.kind,
    textLayoutKey,
    stickyH,
    textFilled,
    overlayWidthPx,
    heightPx,
    isFieldFocused,
    showFieldPlaceholder,
    placeholderText,
    editSessionActive,
    showTextarea,
    ghost?.suffix,
    textareaMountTick,
    syncBubbleLiveBody,
  ])

  useEffect(() => {
    if (!onEditingTextDraftChange) return
    if (isEditing && textToolActive && cmd.kind === 'text') {
      const ghostSuffix =
        !showFieldPlaceholder &&
        local.length >= GHOST_MIN_PARTIAL_LENGTH &&
        cmd.visualStyle !== 'filled' &&
        ghost?.suffix
          ? ghost.suffix
          : ''
      onEditingTextDraftChange(local + ghostSuffix)
    }
  }, [
    local,
    ghost?.suffix,
    isEditing,
    textToolActive,
    cmd,
    showFieldPlaceholder,
    onEditingTextDraftChange,
  ])

  useLayoutEffect(() => {
    const wantsFocus =
      (autoFocus || awaitingEditFocus) &&
      showTextarea &&
      !isFieldFocused
    if (!wantsFocus) return

    let cancelled = false
    let attempts = 0
    const focusGeneration = getBookOverlayAnnotationFocusGeneration()

    const tryFocus = () => {
      if (cancelled) return
      if (focusGeneration !== getBookOverlayAnnotationFocusGeneration()) return
      attempts += 1
      const el = taRef.current
      if (el) {
        el.focus({ preventScroll: true })
      }
      const focused =
        (el != null && document.activeElement === el) ||
        focusBookOverlayAnnotationField(cmd.id, focusGeneration)

      if (focused) {
        pendingProgrammaticFocusRef.current = false
        setAwaitingEditFocus(false)
        setIsFieldFocused(true)
        if (el) onFieldFocus(el)
        if (autoFocus) {
          if (el) {
            const len = el.value.length
            el.setSelectionRange(len, len)
          }
          onAutoFocusConsumedRef.current?.()
        }
        return
      }
      if (attempts < 12) {
        requestAnimationFrame(tryFocus)
      } else {
        clearAwaitingEditFocus()
      }
    }

    tryFocus()
    return () => {
      cancelled = true
    }
  }, [
    autoFocus,
    awaitingEditFocus,
    cmd.id,
    showTextarea,
    isFieldFocused,
    onAutoFocusConsumedRef,
    onFieldFocus,
    clearAwaitingEditFocus,
  ])

  const chrome = useDictationChromeForField(coachField, local)
  const spellSpans = useSpellMarkerSpans(local, spellMirrorEnabled && canEdit)
  const grammarMirrorShowsInk = chrome.showMirror && canEdit && !textSelectionActive

  const syncTextSelectionFromField = useCallback((el: HTMLTextAreaElement) => {
    setTextSelectionActive(el.selectionStart !== el.selectionEnd)
  }, [])

  const onFieldTextSelect = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      syncTextSelectionFromField(e.currentTarget)
    },
    [syncTextSelectionFromField],
  )

  if (cmd.kind === 'text') {
    const filled = cmd.visualStyle === 'filled'
    const fillHex =
      filled && typeof cmd.fillColor === 'string' && /^#[0-9A-Fa-f]{6}$/i.test(cmd.fillColor)
        ? cmd.fillColor
        : filled
          ? DEFAULT_TEXT_FILL_COLOR
          : null
    const textVariant: TextLabelFieldVariant = filled && fillHex ? 'filled' : 'plain'
    const rowMinPx = filled ? filledPillRowMinPx(fs) : textLabelLineHeightPx(fs)
    const displayText = showTextarea ? local : cmd.text
    const pageMaxWidthPx = textLabelPageMaxWidthPx(cmd.x, overlayWidthPx, cmd.maxWidthNorm)
    const placeholderMinWidthCh =
      showFieldPlaceholder && placeholderText ? `${placeholderText.length}ch` : undefined
    const showPlaceholderGhost =
      showFieldPlaceholder &&
      placeholderText != null &&
      textFieldLayout.fieldWidthPx > 24
    const editingLatched = showTextarea && Boolean(textFieldLayout.latchedWhileEditing)
    const editingFieldWhiteSpace: CSSProperties['whiteSpace'] = showTextarea
      ? editingLatched || displayText.includes('\n')
        ? 'pre-wrap'
        : textVariant === 'filled'
          ? 'pre'
          : textLabelFieldWhiteSpace(displayText)
      : 'pre-wrap'
    const mirrorTypographyOpts = {
      whiteSpace: editingFieldWhiteSpace,
      textAlign: cmd.textAlign,
      ...(fontWeight != null ? { fontWeight } : {}),
    }
    const mirrorForLabel = textLabelMirrorStyle(
      fontFamily,
      fs,
      cmd.color,
      displayText,
      textVariant,
      mirrorTypographyOpts,
    )
    const filledEditingInkMirror = textLabelMirrorStyle(
      fontFamily,
      fs,
      cmd.color,
      displayText,
      'filled',
      mirrorTypographyOpts,
    )
    const editableChromeOpts = {
      hideCaret: !canEdit,
      hideInk: grammarMirrorShowsInk,
    }
    const filledInkLayerStyle: CSSProperties = {
      ...filledEditingInkMirror,
      position: 'relative',
      boxSizing: 'border-box',
    }
    const committedFilledLayout =
      textVariant === 'filled' && !showTextarea
        ? computeFilledPillLayout(cmd.text, fontFamily, fs, cmd.x, overlayWidthPx, undefined, {
            maxWidthNorm: cmd.maxWidthNorm,
            fontWeight,
          })
        : null
    const committedPlainLayout =
      textVariant === 'plain' && !showTextarea
        ? resolveTextLabelFieldLayout(cmd.text, fontFamily, fs, cmd.x, overlayWidthPx, {
            variant: 'plain',
            maxWidthNorm: cmd.maxWidthNorm,
            fontWeight,
          })
        : null
    const liveFieldLayout = textFieldLayout
    const pillSegments =
      textVariant === 'filled'
        ? showTextarea
          ? liveFieldLayout.segments
          : (committedFilledLayout?.segments ?? [''])
        : []
    const pillWidths =
      textVariant === 'filled'
        ? showTextarea
          ? liveFieldLayout.widths
          : (committedFilledLayout?.widths ?? [8])
        : []
    const filledFieldWidthPx =
      textVariant === 'filled'
        ? showTextarea
          ? liveFieldLayout.fieldWidthPx
          : (committedFilledLayout?.fieldWidthPx ?? textFieldLayout.fieldWidthPx)
        : undefined
    const plainFieldWidthPx =
      textVariant === 'plain'
        ? showTextarea
          ? liveFieldLayout.fieldWidthPx
          : (committedPlainLayout?.fieldWidthPx ?? textFieldLayout.fieldWidthPx)
        : undefined
    const filledStackHeightPx =
      textVariant === 'filled'
        ? filledPillStackHeightPx(
            Math.max(1, pillSegments.length),
            rowMinPx,
            local.length > 0 || showFieldPlaceholder,
          )
        : 0
    const coachMirrorStyle: CSSProperties =
      textVariant === 'filled' && showTextarea && filledFieldWidthPx != null
        ? { ...mirrorForLabel, width: filledFieldWidthPx, maxWidth: pageMaxWidthPx }
        : mirrorForLabel
    const filledSpellMirrorStyle: CSSProperties =
      textVariant === 'filled' && showTextarea && filledFieldWidthPx != null
        ? {
            ...filledInkLayerStyle,
            position: 'absolute',
            left: 0,
            top: 0,
            width: filledFieldWidthPx,
            maxWidth: pageMaxWidthPx,
          }
        : filledInkLayerStyle

    return (
      <div
        ref={labelRootRef}
        data-annotation-label={cmd.id}
        className={cn(
          'absolute inline-block min-w-0',
          showGlosses && 'overflow-visible',
          blockPointerEvents,
          pasteRevealClassName(pasteRevealIds, cmd.id),
        )}
        style={{
          ...textBlockPositionStyle(
            positionCmd.kind === 'text' ? positionCmd : cmd,
            leftPct,
            topPct,
          ),
          ...(blockStackZ != null ? { zIndex: blockStackZ } : {}),
        }}
        onClick={onLabelClickToEdit}
        onPointerUp={onLabelPointerUpToEdit}
        onPointerDown={(e) => {
          const onTextarea =
            e.target instanceof Element &&
            e.target.closest(`textarea[data-annotation-id="${cmd.id}"]`)
          if (onTextarea && canEdit) {
            e.stopPropagation()
            return
          }
          onLabelPointerDown(e)
        }}
      >
        <div
          className={cn(
            'inline-flex w-auto flex-col items-start',
            showGlosses && 'overflow-visible',
          )}
        >
          <CoachDictationSentenceChrome
            variant="overlay"
            className="w-auto"
            text={chrome.text}
            issues={chrome.issues}
            mirrorHighlight={chrome.showMirror && !textSelectionActive}
            mirrorStyle={coachMirrorStyle}
          >
            <div
              ref={textShellRef}
              className={cn(
                'relative inline-block max-w-none',
                textToolEditHint && 'cursor-text',
                textToolPeerHoverHint &&
                  'hover:outline hover:outline-1 hover:outline-dashed hover:outline-slate-400/40',
              )}
              style={
                translationChip && !showTextarea
                  ? undefined
                  : filledFieldWidthPx != null
                    ? {
                        width: filledFieldWidthPx + FILLED_EDIT_CHROME_INSET_PX * 2,
                        minWidth: placeholderMinWidthCh
                          ? `max(${placeholderMinWidthCh}, ${filledFieldWidthPx + FILLED_EDIT_CHROME_INSET_PX * 2}px)`
                          : filledFieldWidthPx + FILLED_EDIT_CHROME_INSET_PX * 2,
                        maxWidth: pageMaxWidthPx + FILLED_EDIT_CHROME_INSET_PX * 2,
                        minHeight: filledStackHeightPx + FILLED_EDIT_CHROME_INSET_PX * 2,
                        padding: FILLED_EDIT_CHROME_INSET_PX,
                        boxSizing: 'border-box',
                        overflow: showGlosses ? 'visible' : 'hidden',
                      }
                    : plainFieldWidthPx != null
                      ? {
                          width: plainFieldWidthPx,
                          minWidth: placeholderMinWidthCh
                            ? `max(${placeholderMinWidthCh}, ${plainFieldWidthPx}px)`
                            : undefined,
                          maxWidth: pageMaxWidthPx,
                          boxSizing: 'border-box',
                          overflow: showGlosses ? 'visible' : 'hidden',
                        }
                      : undefined
              }
            >
              {translationChip && !showTextarea ? (
                <span className={TRANSLATION_CHIP_PREVIEW_CLASS}>{cmd.text}</span>
              ) : textVariant === 'filled' && fillHex ? (
                <div
                  className={cn(
                    'relative box-border w-full',
                    showGlosses && 'overflow-visible',
                    showTextarea && local.trim().length === 0 && 'rounded-sm',
                  )}
                  style={{
                    minHeight: filledStackHeightPx,
                    ...(showTextarea && local.trim().length === 0
                      ? { backgroundColor: filledTextEmptyTrayColor(fillHex) }
                      : {}),
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 box-border"
                    style={filledTextPillStackPadding}
                    aria-hidden
                  >
                    <FilledTextPillLayer
                      segments={pillSegments}
                      widths={pillWidths}
                      fillHex={fillHex}
                      rowMinPx={rowMinPx}
                      textAlign={cmd.textAlign}
                      roundedClassName={translationChip ? 'rounded-lg' : 'rounded-sm'}
                      boxShadow={
                        translationChip ? '0 4px 16px rgba(0,0,0,0.35)' : undefined
                      }
                    />
                  </div>
                  {canEdit ? (
                    <WritingAssistSpellMirror
                      text={local}
                      spans={spellSpans}
                      style={filledSpellMirrorStyle}
                    />
                  ) : null}
                  {showTextarea ? (
                    <div className={cn('relative', showGlosses && 'overflow-visible')}>
                      <textarea
                        ref={assignTextareaRef}
                        value={local}
                        readOnly={!canEdit}
                        tabIndex={-1}
                        onInput={canEdit ? assist.onInput : undefined}
                        onFocus={(e) => {
                          clearAwaitingEditFocus()
                          onFieldFocus(e.currentTarget)
                          setIsFieldFocused(true)
                        }}
                        onBlur={() => {
                          clearAwaitingEditFocus()
                          onFieldBlur()
                          setIsFieldFocused(false)
                          setTextSelectionActive(false)
                          if (!editSessionActive && !showTextarea) return
                          blurText()
                        }}
                        onSelect={onFieldTextSelect}
                        onMouseUp={onFieldTextSelect}
                        onKeyUp={onFieldTextSelect}
                        onKeyDown={canEdit ? assist.onKeyDown : onKeyDown}
                        spellCheck={assist.spellCheck}
                        autoCorrect={assist.autoCorrect}
                        autoCapitalize={assist.autoCapitalize}
                        data-writing-assist={assist['data-writing-assist']}
                        data-annotation-id={cmd.id}
                        rows={1}
                        className={cn(
                          'box-border z-[1] cursor-text resize-none overflow-x-hidden overflow-y-hidden border-0 bg-transparent shadow-none outline-none focus:outline-none focus-visible:outline-none rounded-none [scrollbar-width:none]',
                          textToolEditHint && 'cursor-text',
                        )}
                        style={{
                          ...filledInkLayerStyle,
                          width: filledFieldWidthPx,
                          maxWidth: pageMaxWidthPx,
                          ...textLabelEditableFieldChromeCSS(cmd.color, editableChromeOpts),
                        }}
                        aria-label={
                          showFieldPlaceholder ? placeholderText ?? 'Annotation text' : 'Annotation text'
                        }
                      />
                      {showGlosses ? (
                        <TextGlossEditOverlay
                          text={local}
                          glosses={cmd.glosses}
                          annotationId={cmd.id}
                          glossFontSizePx={glossFontSizePx}
                          glossChrome={glossChrome}
                          inkStyle={{
                            ...filledInkLayerStyle,
                            width: filledFieldWidthPx,
                            maxWidth: pageMaxWidthPx,
                            whiteSpace: local.includes('\n') ? 'pre-wrap' : 'pre',
                          }}
                          block
                        />
                      ) : null}
                    </div>
                  ) : (
                    <span
                      style={{
                        ...filledInkLayerStyle,
                        ...(showGlosses ? COMMITTED_GLOSS_OVERFLOW_CSS : {}),
                        display: 'block',
                        width: filledFieldWidthPx,
                        maxWidth: pageMaxWidthPx,
                        whiteSpace: cmd.text.includes('\n') ? 'pre-wrap' : 'pre',
                      }}
                      className={cn('z-[1] box-border', showGlosses && 'overflow-visible')}
                    >
                      <TextGlossSpans
                        text={cmd.text}
                        glosses={cmd.glosses}
                        annotationId={cmd.id}
                        glossFontSizePx={glossFontSizePx}
                        glossChrome={glossChrome}
                      />
                    </span>
                  )}
                  {showTextarea && showPlaceholderGhost ? (
                    <TextLabelPlaceholderGhost
                      text={placeholderText}
                      mirrorStyle={textLabelPlaceholderMirrorTypography(
                        fontFamily,
                        fs,
                        cmd.color,
                        'filled',
                        { omitFieldPadding: true, fontWeight },
                      )}
                      className="inset-0"
                      absoluteStyle={filledTextFieldPaddingCSS}
                    />
                  ) : null}
                  {canEdit && !showFieldPlaceholder && textVariant === 'filled' ? (
                    <WritingAssistGhostUi
                      text={local}
                      ghost={ghost}
                      partial={ghostPartial}
                      candidates={ghostCandidates}
                      candidateIndex={ghostIndex}
                      showInlineGhost={false}
                      minCandidatesForStrip={1}
                      mirrorStyle={filledInkLayerStyle}
                    />
                  ) : null}
                </div>
              ) : (
                <>
                  {canEdit ? (
                    <WritingAssistSpellMirror
                      text={local}
                      spans={spellSpans}
                      style={mirrorForLabel}
                    />
                  ) : null}
                  {showTextarea ? (
                    <div
                      className={cn(
                        'relative inline-block',
                        showGlosses && 'overflow-visible',
                      )}
                    >
                      <textarea
                        ref={assignTextareaRef}
                        value={local}
                        readOnly={!canEdit}
                        tabIndex={-1}
                        onInput={canEdit ? assist.onInput : undefined}
                        onFocus={(e) => {
                          clearAwaitingEditFocus()
                          onFieldFocus(e.currentTarget)
                          setIsFieldFocused(true)
                        }}
                        onBlur={() => {
                          clearAwaitingEditFocus()
                          onFieldBlur()
                          setIsFieldFocused(false)
                          setTextSelectionActive(false)
                          if (!editSessionActive && !showTextarea) return
                          blurText()
                        }}
                        onSelect={onFieldTextSelect}
                        onMouseUp={onFieldTextSelect}
                        onKeyUp={onFieldTextSelect}
                        onKeyDown={canEdit ? assist.onKeyDown : onKeyDown}
                        spellCheck={assist.spellCheck}
                        autoCorrect={assist.autoCorrect}
                        autoCapitalize={assist.autoCapitalize}
                        data-writing-assist={assist['data-writing-assist']}
                        data-annotation-id={cmd.id}
                        rows={1}
                        className={cn(
                          'box-border resize-none overflow-x-hidden overflow-y-hidden border-0 bg-transparent shadow-none outline-none focus:outline-none focus-visible:outline-none rounded-none [scrollbar-width:none]',
                          'relative z-[1] inline-block align-top',
                          textToolEditHint && 'cursor-text',
                        )}
                        style={{
                          ...mirrorForLabel,
                          width: plainFieldWidthPx,
                          maxWidth: pageMaxWidthPx,
                          ...textLabelEditableFieldChromeCSS(cmd.color, editableChromeOpts),
                        }}
                        aria-label={
                          showFieldPlaceholder ? placeholderText ?? 'Annotation text' : 'Annotation text'
                        }
                      />
                      {showGlosses ? (
                        <TextGlossEditOverlay
                          text={local}
                          glosses={cmd.glosses}
                          annotationId={cmd.id}
                          glossFontSizePx={glossFontSizePx}
                          glossChrome={glossChrome}
                          inkStyle={{
                            ...mirrorForLabel,
                            width: plainFieldWidthPx,
                            maxWidth: pageMaxWidthPx,
                          }}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <span
                      style={{
                        ...mirrorForLabel,
                        ...(showGlosses ? COMMITTED_GLOSS_OVERFLOW_CSS : {}),
                        width: plainFieldWidthPx,
                        maxWidth: pageMaxWidthPx,
                      }}
                      className={cn(
                        'relative z-[1] box-border inline-block whitespace-pre-wrap',
                        showGlosses && 'overflow-visible',
                      )}
                    >
                      <TextGlossSpans
                        text={cmd.text}
                        glosses={cmd.glosses}
                        annotationId={cmd.id}
                        glossFontSizePx={glossFontSizePx}
                        glossChrome={glossChrome}
                      />
                    </span>
                  )}
                  {showTextarea && showPlaceholderGhost ? (
                    <TextLabelPlaceholderGhost
                      text={placeholderText}
                      mirrorStyle={textLabelPlaceholderMirrorTypography(
                        fontFamily,
                        fs,
                        cmd.color,
                        textVariant,
                        { fontWeight },
                      )}
                      absoluteStyle={{ top: 0, left: 0 }}
                    />
                  ) : null}
                  {canEdit && !showFieldPlaceholder && textVariant === 'plain' ? (
                    <WritingAssistGhostUi
                      text={local}
                      ghost={ghost}
                      partial={ghostPartial}
                      candidates={ghostCandidates}
                      candidateIndex={ghostIndex}
                      mirrorStyle={mirrorForLabel}
                    />
                  ) : null}
                </>
              )}
            </div>
          </CoachDictationSentenceChrome>
          {chrome.grammarUiVisible ? (
            <CoachSentenceGrammarPanel text={local} coachField={coachField} variant="overlay" />
          ) : null}
        </div>
      </div>
    )
  }

  const wPct = cmd.w * 100
  const writableVariant = stickyWritableVariant(cmd)
  const stickyFill = cmd.fillColor ?? DEFAULT_STICKY_FILL_COLOR
  const stickyChrome = writableStickerChrome(writableVariant, stickyFill)
  const { shellMinPx, bodyMinPx } = writableStickerLayoutMetrics(
    writableVariant,
    cmd.h,
    heightPx,
  )
  const stickyBodyMirrorStyle = writableStickyBodyMirrorStyle(
    fontFamily,
    fs,
    stickyChrome.textColor,
    writableVariant,
    bodyMinPx,
    fontWeight,
  )
  const showStickyEditChrome = Boolean(canEdit && !textToolActive)
  const centeredSticky = isCenteredWritableStickerVariant(writableVariant)
  const stickyTextAlignClass = centeredSticky ? 'text-center' : undefined
  const stickyAriaLabel =
    writableVariant === 'caption'
      ? 'Caption'
      : writableVariant === 'speech'
        ? 'Speech bubble'
        : writableVariant === 'thought'
          ? 'Thinking bubble'
          : 'Sticky note'

  const deleteButton = onDeleteSticky ? (
    <button
      type="button"
      className={cn(
        'pointer-events-auto flex h-5 w-5 items-center justify-center rounded-md p-0',
        'text-stone-700/75 opacity-0 transition-all duration-150',
        'hover:bg-black/10 hover:text-stone-900',
        'group-hover/sticky:opacity-100 focus:opacity-100',
        showStickyEditChrome && 'opacity-100',
        writableVariant !== 'note' && 'bg-white/80 shadow-sm backdrop-blur-[1px]',
      )}
      aria-label="Delete sticker"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onDeleteSticky()
      }}
    >
      <X className="h-3.5 w-3.5" strokeWidth={2.25} />
    </button>
  ) : null

  return (
    <WritableStickerShell
      variant={writableVariant}
      fillColor={stickyFill}
      leftPct={leftPct}
      topPct={topPct}
      widthPct={wPct}
      shellMinPx={shellMinPx}
      bodyMinPx={bodyMinPx}
      liveBodyMinPx={isBubbleSticky ? liveBubbleBodyPx : undefined}
      shellRef={stickyShellRef}
      annotationLabelId={cmd.id}
      showEditChrome={showStickyEditChrome}
      blockPointerEvents={blockPointerEvents}
      stackZ={blockStackZ}
      deleteButton={deleteButton}
      onShellPointerDown={onLabelPointerDown}
      onShellPointerUp={onLabelPointerUpToEdit}
      onShellClick={onLabelClickToEdit}
      allowContentOverflow={showGlosses}
      shellClassName={pasteRevealClassName(pasteRevealIds, cmd.id)}
    >
      {isBubbleSticky ? (
        <>
          {canEdit ? (
            <WritingAssistSpellMirror
              text={local}
              spans={spellSpans}
              style={stickyBodyMirrorStyle}
            />
          ) : null}
          {showTextarea ? (
            <>
              <textarea
                ref={assignTextareaRef}
                value={local}
                readOnly={!canEdit}
                tabIndex={-1}
                onInput={canEdit ? assist.onInput : undefined}
                onFocus={(e) => {
                  clearAwaitingEditFocus()
                  onFieldFocus(e.currentTarget)
                  setIsFieldFocused(true)
                }}
                onBlur={() => {
                  clearAwaitingEditFocus()
                  onFieldBlur()
                  setIsFieldFocused(false)
                  setTextSelectionActive(false)
                  if (!editSessionActive && !showTextarea) return
                  blurSticky()
                }}
                onSelect={onFieldTextSelect}
                onMouseUp={onFieldTextSelect}
                onKeyUp={onFieldTextSelect}
                onKeyDown={canEdit ? assist.onKeyDown : onKeyDown}
                spellCheck={assist.spellCheck}
                autoCorrect={assist.autoCorrect}
                autoCapitalize={assist.autoCapitalize}
                data-writing-assist={assist['data-writing-assist']}
                data-annotation-id={cmd.id}
                rows={1}
                className={cn(
                  'relative z-[1] box-border w-full max-w-full resize-none overflow-hidden bg-transparent text-center outline-none focus:outline-none focus-visible:outline-none break-words',
                )}
                style={{
                  ...stickyBodyMirrorStyle,
                  ...textLabelEditableFieldChromeCSS(stickyChrome.textColor, {
                    hideCaret: !isFieldFocused || !canEdit,
                  }),
                }}
                aria-label={
                  showFieldPlaceholder && placeholderText
                    ? placeholderText
                    : stickyAriaLabel
                }
              />
              {showGlosses ? (
                <TextGlossEditOverlay
                  text={local}
                  glosses={cmd.glosses}
                  annotationId={cmd.id}
                  glossFontSizePx={glossFontSizePx}
                  glossChrome={glossChrome}
                  inkStyle={stickyBodyMirrorStyle}
                  block
                />
              ) : null}
            </>
          ) : (
            <span
              className={cn(
                'relative z-[1] block w-full max-w-full overflow-hidden break-words text-center',
                showGlosses && 'overflow-visible',
              )}
              style={{
                ...stickyBodyMirrorStyle,
                ...(showGlosses ? COMMITTED_GLOSS_OVERFLOW_CSS : {}),
              }}
            >
              <TextGlossSpans
                text={cmd.text}
                glosses={cmd.glosses}
                annotationId={cmd.id}
                glossFontSizePx={glossFontSizePx}
                glossChrome={glossChrome}
              />
            </span>
          )}
          {showTextarea && showFieldPlaceholder && placeholderText ? (
            <TextLabelPlaceholderGhost
              text={placeholderText}
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-center"
              mirrorStyle={{
                ...stickyBodyMirrorStyle,
                whiteSpace: 'nowrap',
              }}
            />
          ) : null}
          {canEdit && !showFieldPlaceholder ? (
            <WritingAssistGhostUi
              text={local}
              ghost={ghost}
              partial={ghostPartial}
              candidates={ghostCandidates}
              candidateIndex={ghostIndex}
              mirrorStyle={stickyBodyMirrorStyle}
              stripClassName="-top-7"
            />
          ) : null}
        </>
      ) : (
      <div
        className={cn(
          'relative w-full min-h-0 flex-1',
          showGlosses && 'overflow-visible',
        )}
      >
        {canEdit ? (
          <WritingAssistSpellMirror
            text={local}
            spans={spellSpans}
            style={stickyBodyMirrorStyle}
          />
        ) : null}
      {showTextarea ? (
        <div className={cn('relative w-full', showGlosses && 'overflow-visible')}>
          <textarea
            ref={assignTextareaRef}
            value={local}
            readOnly={!canEdit}
            tabIndex={-1}
            onInput={canEdit ? assist.onInput : undefined}
            onFocus={(e) => {
              clearAwaitingEditFocus()
              onFieldFocus(e.currentTarget)
              setIsFieldFocused(true)
            }}
            onBlur={() => {
              clearAwaitingEditFocus()
              onFieldBlur()
              setIsFieldFocused(false)
              setTextSelectionActive(false)
              if (!editSessionActive && !showTextarea) return
              blurSticky()
            }}
            onSelect={onFieldTextSelect}
            onMouseUp={onFieldTextSelect}
            onKeyUp={onFieldTextSelect}
            onKeyDown={canEdit ? assist.onKeyDown : onKeyDown}
            spellCheck={assist.spellCheck}
            autoCorrect={assist.autoCorrect}
            autoCapitalize={assist.autoCapitalize}
            data-writing-assist={assist['data-writing-assist']}
            data-annotation-id={cmd.id}
            rows={1}
            className={cn(
              'relative z-[1] box-border w-full resize-none overflow-hidden bg-transparent outline-none focus:outline-none focus-visible:outline-none',
              stickyTextAlignClass,
              writableVariant === 'caption' && 'font-medium tracking-wide',
            )}
            style={{
              ...stickyBodyMirrorStyle,
              ...textLabelEditableFieldChromeCSS(stickyChrome.textColor, {
                hideCaret: !isFieldFocused || !canEdit,
              }),
            }}
            aria-label={
              showFieldPlaceholder && placeholderText
                ? placeholderText
                : stickyAriaLabel
            }
          />
          {showGlosses ? (
            <TextGlossEditOverlay
              text={local}
              glosses={cmd.glosses}
              annotationId={cmd.id}
              glossFontSizePx={glossFontSizePx}
              glossChrome={glossChrome}
              inkStyle={stickyBodyMirrorStyle}
              block
            />
          ) : null}
        </div>
      ) : (
        <span
          className={cn(
            'relative z-[1] block w-full',
            showGlosses && 'overflow-visible',
            stickyTextAlignClass,
            writableVariant === 'caption' && 'font-medium tracking-wide',
          )}
          style={{
            ...stickyBodyMirrorStyle,
            ...(showGlosses ? COMMITTED_GLOSS_OVERFLOW_CSS : {}),
          }}
        >
          <TextGlossSpans
            text={cmd.text}
            glosses={cmd.glosses}
            annotationId={cmd.id}
            glossFontSizePx={glossFontSizePx}
            glossChrome={glossChrome}
          />
        </span>
      )}
        {showTextarea && showFieldPlaceholder && placeholderText ? (
          <TextLabelPlaceholderGhost
            text={placeholderText}
            className={
              writableVariant === 'caption'
                ? 'inset-0 flex items-center justify-center text-center'
                : undefined
            }
            absoluteStyle={writableVariant === 'caption' ? { inset: 0 } : undefined}
            mirrorStyle={{
              ...stickyBodyMirrorStyle,
              whiteSpace: 'nowrap',
            }}
          />
        ) : null}
      {canEdit && !showFieldPlaceholder ? (
        <WritingAssistGhostUi
          text={local}
          ghost={ghost}
          partial={ghostPartial}
          candidates={ghostCandidates}
          candidateIndex={ghostIndex}
          mirrorStyle={stickyBodyMirrorStyle}
          stripClassName="-top-7"
        />
      ) : null}
      </div>
      )}
    </WritableStickerShell>
  )
}

function ImageBlock({
  cmd,
  widthPx,
  heightPx,
  selectMode,
  pasteRevealIds,
}: {
  cmd: ImageAnnotationCommand
  widthPx: number
  heightPx: number
  selectMode: boolean
  pasteRevealIds?: ReadonlySet<string>
}) {
  const left = cmd.x * widthPx
  const top = cmd.y * heightPx
  const w = cmd.w * widthPx
  const h = cmd.h * heightPx
  const rotationDeg = cmd.rotationDeg ?? 0
  const showBorder = cmd.strokeVisible === true && Boolean(cmd.strokeColor)
  const borderPx = Math.max(1, 2.5 * (cmd.strokeWidthScale ?? 1))
  return (
    <div
      className={cn('absolute box-border', pasteRevealClassName(pasteRevealIds, cmd.id))}
      style={{
        left,
        top,
        width: w,
        height: h,
        transform: rotationDeg ? `rotate(${rotationDeg}deg)` : undefined,
        transformOrigin: 'center center',
        borderWidth: showBorder ? borderPx : 0,
        borderStyle: 'solid',
        borderColor: showBorder ? cmd.strokeColor : undefined,
        pointerEvents: selectMode ? 'auto' : 'none',
      }}
    >
      <img
        src={cmd.src}
        alt={cmd.alt ?? 'Pasted image'}
        draggable={false}
        className="h-full w-full select-none object-contain"
      />
    </div>
  )
}

function FlashcardBlock({
  cmd,
  widthPx,
  heightPx,
  selectMode,
  pasteRevealIds,
}: {
  cmd: FlashcardAnnotationCommand
  widthPx: number
  heightPx: number
  selectMode: boolean
  pasteRevealIds?: ReadonlySet<string>
}) {
  const left = cmd.x * widthPx
  const top = cmd.y * heightPx
  const w = cmd.w * widthPx
  const h = cmd.h * heightPx
  const imageHeightPct = `${FLASHCARD_IMAGE_AREA_HEIGHT_RATIO * 100}%`
  const englishSizePx = Math.max(11, Math.min(18, w * 0.075))
  const chineseSizePx = Math.max(10, Math.min(15, w * 0.06))

  return (
    <div
      className={cn(
        'absolute overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_4px_14px_rgba(15,23,42,0.12)]',
        pasteRevealClassName(pasteRevealIds, cmd.id),
      )}
      style={{
        left,
        top,
        width: w,
        height: h,
        pointerEvents: selectMode ? 'auto' : 'none',
      }}
    >
      <div
        className="flex items-center justify-center border-b border-[#EEF2F6] bg-[#F9FAFB] p-2"
        style={{ height: imageHeightPct }}
      >
        <img
          src={cmd.src}
          alt={cmd.alt ?? cmd.english}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
        />
      </div>
      <div
        className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-center"
        style={{ height: `${(1 - FLASHCARD_IMAGE_AREA_HEIGHT_RATIO) * 100}%` }}
      >
        <div
          className="w-full truncate font-semibold text-[#111827]"
          style={{ fontSize: englishSizePx }}
        >
          {cmd.english}
        </div>
        <div
          className="w-full truncate text-[#4B5563]"
          style={{ fontSize: chineseSizePx }}
        >
          {cmd.chinese}
        </div>
      </div>
    </div>
  )
}

export interface BookPageAnnotationDomLayerProps {
  widthPx: number
  heightPx: number
  defaultTextFontId: AnnotationTextFontId
  /** Stack order within the annotation layer (matches command paint index). */
  zIndex?: number
  /** Raised while a block is editable so it sits above the pointer overlay. */
  editingZIndex?: number
  commands: AnnotationCommand[]
  onUpdateCommand: (id: string, next: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => void
  onDeleteSticky?: (id: string) => void
  onDeleteText?: (id: string) => void
  focusNewId?: string | null
  onConsumedFocusNew?: () => void
  selectMode?: boolean
  /** True when the text or sticky tool is active â€” enables typing and click-to-edit on labels/notes. */
  textToolActive?: boolean
  /** When false on move/select, committed text is shown instead of a textarea. */
  textInputEnabled?: boolean
  editingId?: string | null
  onEditingIdChange?: (id: string | null) => void
  /** Live label text while editing â€” resizes text-tool chrome. */
  onEditingTextDraftChange?: (text: string | null) => void
  /** Sync target for coach session (book page vs whiteboard). */
  coachField?: 'label' | 'whiteboard'
  pasteRevealIds?: ReadonlySet<string>
}

export function BookPageAnnotationDomLayer({
  widthPx,
  heightPx,
  defaultTextFontId,
  zIndex = 5,
  editingZIndex,
  commands,
  onUpdateCommand,
  onDeleteSticky,
  onDeleteText,
  focusNewId,
  onConsumedFocusNew,
  selectMode = false,
  textToolActive = false,
  textInputEnabled = false,
  editingId = null,
  onEditingIdChange,
  onEditingTextDraftChange,
  coachField = 'label',
  pasteRevealIds,
}: BookPageAnnotationDomLayerProps) {
  const consumedRef = useRef(onConsumedFocusNew)
  consumedRef.current = onConsumedFocusNew

  const prevSelectModeRef = useRef(selectMode)
  const prevTextToolActiveRef = useRef(textToolActive)
  const prevEditingIdRef = useRef<string | null>(editingId)
  useEffect(() => {
    const switchedToSelect = selectMode && !prevSelectModeRef.current
    const leftTextTool = prevTextToolActiveRef.current && !textToolActive && !selectMode
    const leftTextAndSelect = !selectMode && !textToolActive
    if (switchedToSelect || leftTextTool || leftTextAndSelect) {
      endBookOverlayAnnotationEditingFocus()
      consumedRef.current?.()
      onEditingIdChange?.(null)
    }
    prevSelectModeRef.current = selectMode
    prevTextToolActiveRef.current = textToolActive
  }, [selectMode, textToolActive, onEditingIdChange])

  useEffect(() => {
    const prev = prevEditingIdRef.current
    prevEditingIdRef.current = editingId
    if (prev != null && editingId == null) {
      endBookOverlayAnnotationEditingFocus()
    }
  }, [editingId])

  useEffect(() => {
    if (!editingId) {
      return
    }

    const dismissIfNotFocused = () => {
      queueMicrotask(() => {
        if (isAnnotationTextFieldFocused(editingId)) return
        commitBookOverlayTypingTarget()
        consumedRef.current?.()
        onEditingIdChange?.(null)
      })
    }

    window.addEventListener('blur', dismissIfNotFocused)
    document.addEventListener('visibilitychange', dismissIfNotFocused)

    return () => {
      window.removeEventListener('blur', dismissIfNotFocused)
      document.removeEventListener('visibilitychange', dismissIfNotFocused)
    }
  }, [editingId, onEditingIdChange])

  if (widthPx <= 0 || heightPx <= 0) return null

  type DomBlock =
    | TextAnnotationCommand
    | StickyAnnotationCommand
    | ImageAnnotationCommand
    | FlashcardAnnotationCommand
  const domBlocks = commands.filter(
    (c): c is DomBlock =>
      c.kind === 'text' ||
      c.kind === 'sticky' ||
      c.kind === 'image' ||
      c.kind === 'flashcard',
  )

  const editBoostZ = editingZIndex ?? zIndex + 1000

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ width: `${widthPx}px`, height: `${heightPx}px`, zIndex }}
    >
      {domBlocks.map((cmd) =>
        cmd.kind === 'image' ? (
          <ImageBlock
            key={cmd.id}
            cmd={cmd}
            widthPx={widthPx}
            heightPx={heightPx}
            selectMode={selectMode}
            pasteRevealIds={pasteRevealIds}
          />
        ) : cmd.kind === 'flashcard' ? (
          <FlashcardBlock
            key={cmd.id}
            cmd={cmd}
            widthPx={widthPx}
            heightPx={heightPx}
            selectMode={selectMode}
            pasteRevealIds={pasteRevealIds}
          />
        ) : (
          <EditableBlock
            key={cmd.id}
            cmd={cmd}
            heightPx={heightPx}
            overlayWidthPx={widthPx}
            defaultTextFontId={defaultTextFontId}
            autoFocus={textToolActive && !selectMode && focusNewId != null && cmd.id === focusNewId}
            onAutoFocusConsumedRef={consumedRef}
            onPatch={(partial) => onUpdateCommand(cmd.id, partial)}
            onDeleteSticky={
              cmd.kind === 'sticky' && onDeleteSticky ? () => onDeleteSticky(cmd.id) : undefined
            }
            onDeleteText={
              cmd.kind === 'text' && onDeleteText ? () => onDeleteText(cmd.id) : undefined
            }
            selectMode={selectMode}
            textToolActive={textToolActive}
            textInputEnabled={textInputEnabled}
            isEditing={editingId === cmd.id}
            editingZIndex={editBoostZ}
            onEndEdit={() => {
              consumedRef.current?.()
              onEditingIdChange?.(null)
            }}
            onRequestEdit={() => onEditingIdChange?.(cmd.id)}
            onEditingTextDraftChange={
              editingId === cmd.id && textToolActive && cmd.kind === 'text'
                ? onEditingTextDraftChange
                : undefined
            }
            coachField={coachField}
            pasteRevealIds={pasteRevealIds}
          />
        ),
      )}
    </div>
  )
}
