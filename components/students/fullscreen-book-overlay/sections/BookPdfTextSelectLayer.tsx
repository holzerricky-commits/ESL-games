'use client'

import type { RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Puzzle, Vault } from 'lucide-react'
import { BOOK_PDF_TEXT_SELECT_LAYER_Z } from '@/components/students/book-page-annotation-layer/constants'
import { usePdfPageTextGeometry } from '@/components/students/fullscreen-book-overlay/hooks/usePdfPageTextGeometry'
import { SELECTION_CONTEXT_BAR_SURFACE } from '@/components/students/selection-context-bar/selection-context-bar-styles'
import { bookPdfTextLayerDebugEnabled } from '@/lib/books/feature-flags'
import {
  clientPointToNorm,
  hitTestNormPoint,
  nearestRunWithin,
  runsToPlainText,
  selectRunsBetween,
  type NormRect,
  type PdfPageTextRun,
} from '@/lib/books/pdf-page-text-geometry'
import { buildBlockLineBands, lineRectsForRuns, wordRectOnLine } from '@/lib/books/pdf-page-selection-rects'
import { buildTextBlocks } from '@/lib/books/pdf-page-text-blocks'
import { pickSelectedRuns, pickWordAtPoint, type PdfPageWordPick } from '@/lib/books/pdf-page-word-pick'
import { isOverVaultDropTarget, setVaultDrag } from '@/lib/lesson-vault/vault-drag'
import { cn } from '@/lib/utils'

export type BookTextVaultSaveInput = {
  pdfPage: number
  word: string
  sentence: string
  /** Screen point the saved word flies from (pill or drop point). */
  from?: { x: number; y: number }
}

/** Movement (screen px) before pressing a highlight or the pill turns into dragging the word. */
const WORD_DRAG_THRESHOLD_PX = 6

type WordDrag = { pointerId: number; startX: number; startY: number; active: boolean }

type ClientRect = { left: number; top: number; width: number; height: number }

const SAVE_BAR_GAP_PX = 8
const SAVE_BAR_MIN_TOP_PX = 56
/** Portaled to body, so it must clear the fullscreen book overlay (same tier as the translate popover). */
const SAVE_BAR_PORTAL_Z = 120
/** A click this close to a word (screen px) still picks it. */
const CLICK_SNAP_PX = 10
/** While dragging, the focus follows the nearest word from a bit farther away. */
const DRAG_SNAP_PX = 28
/** Larger than any page-normalized distance: a locked drag always finds a word in its block. */
const UNLIMITED_NORM_DISTANCE = 10

function normRectsToClient(rects: readonly NormRect[], pageRect: DOMRectReadOnly): ClientRect[] {
  return rects.map((r) => ({
    left: pageRect.left + r.x * pageRect.width,
    top: pageRect.top + r.y * pageRect.height,
    width: r.w * pageRect.width,
    height: r.h * pageRect.height,
  }))
}

/**
 * Page-normalized rects → unscaled px inside `layer`. The book stage is CSS-transformed
 * (fit scale, focus zoom), so screen px must be mapped back through the layer's own box.
 */
function normRectsToLayerLocal(
  rects: readonly NormRect[],
  pageRect: DOMRectReadOnly,
  layer: HTMLElement,
): ClientRect[] {
  const layerRect = layer.getBoundingClientRect()
  if (!(layerRect.width > 0) || !(layerRect.height > 0)) return []
  const sx = layer.offsetWidth / layerRect.width
  const sy = layer.offsetHeight / layerRect.height
  return normRectsToClient(rects, pageRect).map((r) => ({
    left: (r.left - layerRect.left) * sx,
    top: (r.top - layerRect.top) * sy,
    width: r.width * sx,
    height: r.height * sy,
  }))
}

type PagePanelProps = {
  pageNumber: number
  active: boolean
  pageRootRef: RefObject<HTMLDivElement | null>
  pdf: PDFDocumentProxy
  unitFilePath: string | null
  boxesEpoch: number
  onPassThroughPointerDown: (e: PointerEvent) => void
  /** Page that owns the current selection; other pages clear theirs. */
  selectionOwnerPage: number | null
  onSelectionStart: (pageNumber: number) => void
  onSaveToVault?: (input: BookTextVaultSaveInput) => void
  onSaveToGrammar?: (input: BookTextVaultSaveInput) => void
}

function PageTextSelectPanel({
  pageNumber,
  active,
  pageRootRef,
  pdf,
  unitFilePath,
  boxesEpoch,
  onPassThroughPointerDown,
  selectionOwnerPage,
  onSelectionStart,
  onSaveToVault,
  onSaveToGrammar,
}: PagePanelProps) {
  const { runs, ready } = usePdfPageTextGeometry(pdf, pageNumber, active, {
    unitFilePath,
    boxesEpoch,
  })
  const textBlocks = useMemo(() => buildTextBlocks(runs), [runs])
  const lineBands = useMemo(() => buildBlockLineBands(textBlocks.blocks), [textBlocks])
  /** Reading-ordered runs of the text block that holds `runIndex` (whole page if unknown). */
  const blockRunsOf = useCallback(
    (runIndex: number): readonly PdfPageTextRun[] => {
      const blockId = textBlocks.blockOfRun.get(runIndex)
      return blockId == null ? runs : (textBlocks.blocks[blockId]?.runs ?? runs)
    },
    [textBlocks, runs],
  )
  const [highlightNorm, setHighlightNorm] = useState<NormRect[]>([])
  const [, setLayoutTick] = useState(0)
  const [pick, setPick] = useState<PdfPageWordPick | null>(null)
  const selectedTextRef = useRef('')
  const selectionRef = useRef<PdfPageTextRun[]>([])
  const anchorIndexRef = useRef<number | null>(null)
  const focusIndexRef = useRef<number | null>(null)
  const downNxRef = useRef(0)
  const lastNxRef = useRef(0)
  const draggingRef = useRef(false)
  const layerRef = useRef<HTMLDivElement | null>(null)
  const wordDragRef = useRef<WordDrag | null>(null)
  const suppressPillClickRef = useRef(false)

  const showRects = useCallback(
    (rects: NormRect[], text: string) => {
      setHighlightNorm(rects)
      selectedTextRef.current = text
    },
    [],
  )

  const cancelWordDrag = useCallback(() => {
    if (!wordDragRef.current) return
    wordDragRef.current = null
    setVaultDrag(null)
  }, [])

  const clearSelection = useCallback(() => {
    selectionRef.current = []
    anchorIndexRef.current = null
    focusIndexRef.current = null
    draggingRef.current = false
    cancelWordDrag()
    setPick(null)
    showRects([], '')
  }, [showRects, cancelWordDrag])

  useEffect(() => cancelWordDrag, [cancelWordDrag])

  const startWordDrag = useCallback((e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    wordDragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, active: false }
    e.currentTarget.setPointerCapture(e.pointerId)
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !wordDragRef.current) return
      ev.preventDefault()
      ev.stopImmediatePropagation()
      if (wordDragRef.current.active) suppressPillClickRef.current = true
      wordDragRef.current = null
      setVaultDrag(null)
    }
    window.addEventListener('keydown', onKey, true)
    const off = () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerup', off, true)
      window.removeEventListener('pointercancel', off, true)
    }
    window.addEventListener('pointerup', off, true)
    window.addEventListener('pointercancel', off, true)
  }, [])

  /** True while this pointer is dragging (or may start dragging) the selected word. */
  const moveWordDrag = useCallback(
    (e: React.PointerEvent<HTMLElement>): boolean => {
      const drag = wordDragRef.current
      if (!drag || drag.pointerId !== e.pointerId || !pick) return drag != null
      if (!drag.active && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < WORD_DRAG_THRESHOLD_PX) {
        return true
      }
      drag.active = true
      setVaultDrag({ word: pick.word, x: e.clientX, y: e.clientY, overVault: isOverVaultDropTarget(e.clientX, e.clientY) })
      return true
    },
    [pick],
  )

  /** Returns false when no word drag was in progress for this pointer. */
  const endWordDrag = useCallback(
    (e: React.PointerEvent<HTMLElement>): boolean => {
      const drag = wordDragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return false
      wordDragRef.current = null
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      if (!drag.active) return true
      suppressPillClickRef.current = true
      setVaultDrag(null)
      if (e.type === 'pointerup' && pick && onSaveToVault && isOverVaultDropTarget(e.clientX, e.clientY)) {
        onSaveToVault({ pdfPage: pageNumber, word: pick.word, sentence: pick.sentence, from: { x: e.clientX, y: e.clientY } })
        clearSelection()
      }
      return true
    },
    [pick, onSaveToVault, pageNumber, clearSelection],
  )

  const pointInHighlight = useCallback(
    (clientX: number, clientY: number): boolean => {
      const root = pageRootRef.current
      if (!root || highlightNorm.length === 0) return false
      return normRectsToClient(highlightNorm, root.getBoundingClientRect()).some(
        (r) => clientX >= r.left && clientX <= r.left + r.width && clientY >= r.top && clientY <= r.top + r.height,
      )
    },
    [pageRootRef, highlightNorm],
  )

  useEffect(() => {
    clearSelection()
  }, [active, pageNumber, clearSelection])

  useEffect(() => {
    if (selectionOwnerPage !== pageNumber && highlightNorm.length > 0) clearSelection()
  }, [selectionOwnerPage, pageNumber, highlightNorm.length, clearSelection])

  useEffect(() => {
    // Debug boxes are measured from refs during render; re-render once the layer is mounted.
    if (active && ready && bookPdfTextLayerDebugEnabled) setLayoutTick((t) => t + 1)
  }, [active, ready, runs])

  useEffect(() => {
    if (!active || (highlightNorm.length === 0 && !bookPdfTextLayerDebugEnabled)) return
    const onResize = () => setLayoutTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active, highlightNorm.length])

  useEffect(() => {
    if (!active) return
    const onCopy = (e: ClipboardEvent) => {
      const text = selectedTextRef.current
      if (!text) return
      e.clipboardData?.setData('text/plain', text)
      e.preventDefault()
    }
    document.addEventListener('copy', onCopy)
    return () => document.removeEventListener('copy', onCopy)
  }, [active])

  const resolveHit = useCallback(
    (
      clientX: number,
      clientY: number,
      snapPx: number = CLICK_SNAP_PX,
      /** While dragging: only these runs, and always the nearest one when none is under the pointer. */
      lockedRuns?: readonly PdfPageTextRun[],
    ): { index: number; nx: number } | null => {
      const root = pageRootRef.current
      if (!root || !ready || runs.length === 0) return null
      const pageRect = root.getBoundingClientRect()
      const norm = clientPointToNorm(clientX, clientY, pageRect)
      if (!norm) return null
      const candidates = lockedRuns ?? runs
      const index =
        hitTestNormPoint(candidates, norm.nx, norm.ny) ??
        (lockedRuns
          ? nearestRunWithin(candidates, norm.nx, norm.ny, UNLIMITED_NORM_DISTANCE, UNLIMITED_NORM_DISTANCE)
          : nearestRunWithin(candidates, norm.nx, norm.ny, snapPx / pageRect.width, snapPx / pageRect.height))
      return index == null ? null : { index, nx: norm.nx }
    },
    [pageRootRef, ready, runs],
  )

  /** Same run → whole words between the two x positions; across runs → whole runs in the anchor's block. */
  const previewSelection = useCallback(
    (anchor: number, focus: number) => {
      const blockRuns = blockRunsOf(anchor)
      if (anchor === focus) {
        const wordPick = pickWordAtPoint(blockRuns, anchor, downNxRef.current, lastNxRef.current)
        selectionRef.current = []
        if (wordPick) {
          showRects(
            wordPick.rects.map((r) => wordRectOnLine(r, anchor, lineBands)),
            wordPick.word,
          )
        }
        return
      }
      const selection = selectRunsBetween(blockRuns, anchor, focus)
      selectionRef.current = selection
      showRects(lineRectsForRuns(selection, lineBands), runsToPlainText(selection))
    },
    [blockRunsOf, lineBands, showRects],
  )

  const syncHoverCursor = useCallback(
    (clientX: number, clientY: number) => {
      const layer = layerRef.current
      if (!layer) return
      // I-beam only over stamped text; empty page areas keep the normal Select arrow.
      if (draggingRef.current) {
        layer.style.cursor = 'text'
        return
      }
      if (pick && onSaveToVault && pointInHighlight(clientX, clientY)) {
        layer.style.cursor = wordDragRef.current ? 'grabbing' : 'grab'
        return
      }
      layer.style.cursor = resolveHit(clientX, clientY) != null ? 'text' : 'default'
    },
    [resolveHit, pick, onSaveToVault, pointInHighlight],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!active || !ready || e.button !== 0) return
      if (pick && onSaveToVault && pointInHighlight(e.clientX, e.clientY)) {
        startWordDrag(e)
        return
      }
      const hit = resolveHit(e.clientX, e.clientY)
      if (hit == null) {
        clearSelection()
        const layer = layerRef.current
        if (layer) {
          layer.style.cursor = 'default'
          layer.style.pointerEvents = 'none'
          onPassThroughPointerDown(e.nativeEvent)
          layer.style.pointerEvents = 'auto'
        }
        return
      }
      e.preventDefault()
      e.stopPropagation()
      onSelectionStart(pageNumber)
      setPick(null)
      anchorIndexRef.current = hit.index
      focusIndexRef.current = hit.index
      downNxRef.current = hit.nx
      lastNxRef.current = hit.nx
      draggingRef.current = true
      if (layerRef.current) layerRef.current.style.cursor = 'text'
      previewSelection(hit.index, hit.index)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [
      active,
      ready,
      pick,
      onSaveToVault,
      pointInHighlight,
      startWordDrag,
      resolveHit,
      clearSelection,
      onPassThroughPointerDown,
      onSelectionStart,
      pageNumber,
      previewSelection,
    ],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (moveWordDrag(e)) return
      const anchor = anchorIndexRef.current
      if (draggingRef.current && anchor != null) {
        const hit = resolveHit(e.clientX, e.clientY, DRAG_SNAP_PX, blockRunsOf(anchor))
        const focus = hit?.index ?? focusIndexRef.current ?? anchor
        if (hit && hit.index === anchor) lastNxRef.current = hit.nx
        focusIndexRef.current = focus
        previewSelection(anchor, focus)
        if (layerRef.current) layerRef.current.style.cursor = 'text'
        return
      }
      syncHoverCursor(e.clientX, e.clientY)
    },
    [moveWordDrag, resolveHit, blockRunsOf, previewSelection, syncHoverCursor],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (endWordDrag(e)) return
      if (draggingRef.current) {
        draggingRef.current = false
        const anchor = anchorIndexRef.current
        const focus = focusIndexRef.current
        anchorIndexRef.current = null
        if (anchor != null && focus != null) {
          const blockRuns = blockRunsOf(anchor)
          setPick(
            anchor === focus
              ? pickWordAtPoint(blockRuns, anchor, downNxRef.current, lastNxRef.current)
              : pickSelectedRuns(blockRuns, selectionRef.current),
          )
        }
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      }
      syncHoverCursor(e.clientX, e.clientY)
    },
    [endWordDrag, blockRunsOf, syncHoverCursor],
  )

  const onPointerLeave = useCallback(() => {
    if (draggingRef.current || wordDragRef.current) return
    if (layerRef.current) layerRef.current.style.cursor = 'default'
  }, [])

  const saveCurrentPick = useCallback(
    (from?: { x: number; y: number }) => {
      if (!pick || !onSaveToVault) return
      onSaveToVault({ pdfPage: pageNumber, word: pick.word, sentence: pick.sentence, from })
      clearSelection()
    },
    [pick, onSaveToVault, pageNumber, clearSelection],
  )

  const saveCurrentPickToGrammar = useCallback(() => {
    if (!pick || !onSaveToGrammar) return
    onSaveToGrammar({ pdfPage: pageNumber, word: pick.word, sentence: pick.sentence })
    clearSelection()
  }, [pick, onSaveToGrammar, pageNumber, clearSelection])

  if (!active) return null

  const pageRect = pageRootRef.current?.getBoundingClientRect() ?? null
  const layer = layerRef.current
  const highlightLocal =
    pageRect && layer && highlightNorm.length > 0 ? normRectsToLayerLocal(highlightNorm, pageRect, layer) : []
  const debugLocal =
    bookPdfTextLayerDebugEnabled && ready && pageRect && layer
      ? normRectsToLayerLocal(runs, pageRect, layer)
      : []
  const debugBlocksLocal =
    debugLocal.length > 0 && pageRect && layer
      ? normRectsToLayerLocal(
          textBlocks.blocks.map((block) => block.rect),
          pageRect,
          layer,
        )
      : []
  const highlightClient = pageRect && highlightNorm.length > 0 ? normRectsToClient(highlightNorm, pageRect) : []
  const firstRect = highlightClient[0]
  const lastRect = highlightClient[highlightClient.length - 1]
  const saveBarStyle =
    pick && (onSaveToVault || onSaveToGrammar) && firstRect && lastRect
      ? firstRect.top - SAVE_BAR_GAP_PX >= SAVE_BAR_MIN_TOP_PX
        ? {
            left: firstRect.left + firstRect.width / 2,
            top: firstRect.top - SAVE_BAR_GAP_PX,
            transform: 'translate(-50%, -100%)',
          }
        : {
            left: lastRect.left + lastRect.width / 2,
            top: lastRect.top + lastRect.height + SAVE_BAR_GAP_PX,
            transform: 'translate(-50%, 0)',
          }
      : null

  return (
    <>
      <div
        ref={layerRef}
        className="pointer-events-auto absolute inset-0 touch-none"
        style={{ zIndex: BOOK_PDF_TEXT_SELECT_LAYER_Z, cursor: 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
      />
      {debugLocal.length > 0 ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ zIndex: BOOK_PDF_TEXT_SELECT_LAYER_Z + 1 }}
          aria-hidden
        >
          {debugLocal.map((rect, i) => (
            <div
              key={runs[i]!.index}
              className="absolute overflow-hidden border border-[rgba(220,38,38,0.8)] bg-[rgba(250,204,21,0.15)] text-[9px] leading-none text-[rgb(185,28,28)]"
              style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
              title={runs[i]!.text}
            >
              {runs[i]!.text}
            </div>
          ))}
          {debugBlocksLocal.map((rect, i) => (
            <div
              key={`block-${textBlocks.blocks[i]!.id}`}
              className="absolute border-2 border-dashed border-[rgba(37,99,235,0.9)]"
              style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
            >
              <span className="absolute -left-0.5 -top-4 rounded-sm bg-[rgb(37,99,235)] px-1 text-[10px] font-semibold leading-4 text-white">
                {textBlocks.blocks[i]!.id}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {highlightLocal.length > 0 ? (
        <div className="pointer-events-none absolute inset-0" style={{ zIndex: BOOK_PDF_TEXT_SELECT_LAYER_Z + 1 }} aria-hidden>
          {highlightLocal.map((rect, index) => (
            <div
              key={`${rect.left}-${rect.top}-${rect.width}-${rect.height}-${index}`}
              className="absolute rounded-[2px] bg-[rgba(59,130,246,0.45)]"
              style={{
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              }}
            />
          ))}
        </div>
      ) : null}
      {saveBarStyle && typeof document !== 'undefined'
        ? createPortal(
        <div
          role="toolbar"
          aria-label="Selected text"
          className={cn(SELECTION_CONTEXT_BAR_SURFACE, 'pointer-events-auto fixed flex h-10 items-center gap-0.5 px-1.5')}
          style={{ ...saveBarStyle, zIndex: SAVE_BAR_PORTAL_Z }}
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {onSaveToVault ? (
            <button
              type="button"
              className="flex h-8 cursor-grab items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-[#f4f4f5] hover:bg-[#3f3f46] active:cursor-grabbing"
              title="Click to save, or drag onto the vault"
              onPointerDown={(e) => {
                if (e.button !== 0) return
                suppressPillClickRef.current = false
                startWordDrag(e)
              }}
              onPointerMove={(e) => {
                moveWordDrag(e)
              }}
              onPointerUp={(e) => {
                endWordDrag(e)
              }}
              onPointerCancel={(e) => {
                endWordDrag(e)
              }}
              onClick={(e) => {
                if (suppressPillClickRef.current) {
                  suppressPillClickRef.current = false
                  return
                }
                const r = e.currentTarget.getBoundingClientRect()
                saveCurrentPick({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
              }}
            >
              <Vault className="h-4 w-4" aria-hidden />
              Save to vault
            </button>
          ) : null}
          {onSaveToVault && onSaveToGrammar ? <span className="mx-0.5 h-5 w-px bg-white/15" aria-hidden /> : null}
          {onSaveToGrammar ? (
            <button
              type="button"
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-[#f4f4f5] hover:bg-[#3f3f46]"
              title="Save this sentence for grammar review; the selected words become the form to practise"
              onClick={saveCurrentPickToGrammar}
            >
              <Puzzle className="h-4 w-4" aria-hidden />
              Save to grammar
            </button>
          ) : null}
        </div>,
            document.body,
          )
        : null}
    </>
  )
}

export type BookPdfTextSelectLayerProps = {
  active: boolean
  pdf: PDFDocumentProxy
  unitFilePath: string | null
  boxesEpoch: number
  spreadOverlayWidthPx: number
  pageCanvasHeightPx: number
  spreadPageWidthPx: number
  pageNumber: number
  spreadRightPage: number | null
  showSpreadRightPage: boolean
  leftPageHasSelectableText: boolean
  rightPageHasSelectableText: boolean
  leftPageCaptureRef: RefObject<HTMLDivElement | null>
  rightPageCaptureRef: RefObject<HTMLDivElement | null>
  /** Shows Save to vault beside the selection when set. */
  onSaveToVault?: (input: BookTextVaultSaveInput) => void
  /** Shows Save to grammar beside the selection when set. */
  onSaveToGrammar?: (input: BookTextVaultSaveInput) => void
}

export function BookPdfTextSelectLayer({
  active,
  pdf,
  unitFilePath,
  boxesEpoch,
  spreadOverlayWidthPx,
  pageCanvasHeightPx,
  spreadPageWidthPx,
  pageNumber,
  spreadRightPage,
  showSpreadRightPage,
  leftPageHasSelectableText,
  rightPageHasSelectableText,
  leftPageCaptureRef,
  rightPageCaptureRef,
  onSaveToVault,
  onSaveToGrammar,
}: BookPdfTextSelectLayerProps) {
  const [selectionOwnerPage, setSelectionOwnerPage] = useState<number | null>(null)

  const passThroughPointerDown = useCallback((e: PointerEvent) => {
    const target = document.elementFromPoint(e.clientX, e.clientY)
    if (!target || target === e.target) return
    target.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: e.clientX,
        clientY: e.clientY,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        button: e.button,
        buttons: e.buttons,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      }),
    )
  }, [])

  if (!active) return null

  // Mount panels whenever Select is on. Empty geometry passes clicks through;
  // waiting on a probe used to hide the whole layer (no I-beam, looks broken).
  const leftActive = leftPageHasSelectableText || active
  const rightActive =
    showSpreadRightPage &&
    spreadRightPage != null &&
    (rightPageHasSelectableText || active)

  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: spreadOverlayWidthPx, height: pageCanvasHeightPx }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0"
        style={{ width: spreadPageWidthPx, height: pageCanvasHeightPx }}
      >
        <PageTextSelectPanel
          pageNumber={pageNumber}
          active={leftActive}
          pageRootRef={leftPageCaptureRef}
          pdf={pdf}
          unitFilePath={unitFilePath}
          boxesEpoch={boxesEpoch}
          onPassThroughPointerDown={passThroughPointerDown}
          selectionOwnerPage={selectionOwnerPage}
          onSelectionStart={setSelectionOwnerPage}
          onSaveToVault={onSaveToVault}
          onSaveToGrammar={onSaveToGrammar}
        />
      </div>
      {rightActive && spreadRightPage != null ? (
        <div
          className="pointer-events-none absolute top-0"
          style={{
            left: spreadPageWidthPx,
            width: spreadPageWidthPx,
            height: pageCanvasHeightPx,
          }}
        >
          <PageTextSelectPanel
            pageNumber={spreadRightPage}
            active={rightActive}
            pageRootRef={rightPageCaptureRef}
            pdf={pdf}
            unitFilePath={unitFilePath}
            boxesEpoch={boxesEpoch}
            onPassThroughPointerDown={passThroughPointerDown}
            selectionOwnerPage={selectionOwnerPage}
            onSelectionStart={setSelectionOwnerPage}
            onSaveToVault={onSaveToVault}
            onSaveToGrammar={onSaveToGrammar}
          />
        </div>
      ) : null}
    </div>
  )
}
