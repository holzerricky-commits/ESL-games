'use client'

import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Vault } from 'lucide-react'
import { BOOK_PDF_TEXT_SELECT_LAYER_Z } from '@/components/students/book-page-annotation-layer/constants'
import { usePdfPageTextGeometry } from '@/components/students/fullscreen-book-overlay/hooks/usePdfPageTextGeometry'
import { SELECTION_CONTEXT_BAR_SURFACE } from '@/components/students/selection-context-bar/selection-context-bar-styles'
import {
  clientPointToNorm,
  hitTestNormPoint,
  runsToPlainText,
  selectRunsBetween,
  type NormRect,
  type PdfPageTextRun,
} from '@/lib/books/pdf-page-text-geometry'
import { pickSelectedRuns, pickWordAtPoint, type PdfPageWordPick } from '@/lib/books/pdf-page-word-pick'
import { cn } from '@/lib/utils'

export type BookTextVaultSaveInput = {
  pdfPage: number
  word: string
  sentence: string
}

type ClientRect = { left: number; top: number; width: number; height: number }

const SAVE_BAR_GAP_PX = 8
const SAVE_BAR_MIN_TOP_PX = 56

function normRectsToClient(rects: readonly NormRect[], pageRect: DOMRectReadOnly): ClientRect[] {
  return rects.map((r) => ({
    left: pageRect.left + r.x * pageRect.width,
    top: pageRect.top + r.y * pageRect.height,
    width: r.w * pageRect.width,
    height: r.h * pageRect.height,
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
}: PagePanelProps) {
  const { runs, ready } = usePdfPageTextGeometry(pdf, pageNumber, active, {
    unitFilePath,
    boxesEpoch,
  })
  const [highlightNorm, setHighlightNorm] = useState<NormRect[]>([])
  const [highlightRects, setHighlightRects] = useState<ClientRect[]>([])
  const [pick, setPick] = useState<PdfPageWordPick | null>(null)
  const selectedTextRef = useRef('')
  const selectionRef = useRef<PdfPageTextRun[]>([])
  const anchorIndexRef = useRef<number | null>(null)
  const focusIndexRef = useRef<number | null>(null)
  const downNxRef = useRef(0)
  const lastNxRef = useRef(0)
  const draggingRef = useRef(false)
  const layerRef = useRef<HTMLDivElement | null>(null)

  const showRects = useCallback(
    (rects: NormRect[], text: string) => {
      setHighlightNorm(rects)
      selectedTextRef.current = text
      const root = pageRootRef.current
      setHighlightRects(root && rects.length ? normRectsToClient(rects, root.getBoundingClientRect()) : [])
    },
    [pageRootRef],
  )

  const clearSelection = useCallback(() => {
    selectionRef.current = []
    anchorIndexRef.current = null
    focusIndexRef.current = null
    draggingRef.current = false
    setPick(null)
    showRects([], '')
  }, [showRects])

  useEffect(() => {
    clearSelection()
  }, [active, pageNumber, clearSelection])

  useEffect(() => {
    if (selectionOwnerPage !== pageNumber && highlightNorm.length > 0) clearSelection()
  }, [selectionOwnerPage, pageNumber, highlightNorm.length, clearSelection])

  useEffect(() => {
    if (!active || highlightNorm.length === 0) return
    const onResize = () => showRects(highlightNorm, selectedTextRef.current)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active, highlightNorm, showRects])

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
    (clientX: number, clientY: number): { index: number; nx: number } | null => {
      const root = pageRootRef.current
      if (!root || !ready || runs.length === 0) return null
      const norm = clientPointToNorm(clientX, clientY, root.getBoundingClientRect())
      if (!norm) return null
      const index = hitTestNormPoint(runs, norm.nx, norm.ny)
      return index == null ? null : { index, nx: norm.nx }
    },
    [pageRootRef, ready, runs],
  )

  /** Same run → whole words between the two x positions; across runs → whole runs. */
  const previewSelection = useCallback(
    (anchor: number, focus: number) => {
      if (anchor === focus) {
        const wordPick = pickWordAtPoint(runs, anchor, downNxRef.current, lastNxRef.current)
        selectionRef.current = []
        if (wordPick) showRects(wordPick.rects, wordPick.word)
        return
      }
      const selection = selectRunsBetween(runs, anchor, focus)
      selectionRef.current = selection
      showRects(
        selection.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
        runsToPlainText(selection),
      )
    },
    [runs, showRects],
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
      layer.style.cursor = resolveHit(clientX, clientY) != null ? 'text' : 'default'
    },
    [resolveHit],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!active || !ready || e.button !== 0) return
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
    [active, ready, resolveHit, clearSelection, onPassThroughPointerDown, onSelectionStart, pageNumber, previewSelection],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const anchor = anchorIndexRef.current
      if (draggingRef.current && anchor != null) {
        const hit = resolveHit(e.clientX, e.clientY)
        const focus = hit?.index ?? focusIndexRef.current ?? anchor
        if (hit && hit.index === anchor) lastNxRef.current = hit.nx
        focusIndexRef.current = focus
        previewSelection(anchor, focus)
        if (layerRef.current) layerRef.current.style.cursor = 'text'
        return
      }
      syncHoverCursor(e.clientX, e.clientY)
    },
    [resolveHit, previewSelection, syncHoverCursor],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (draggingRef.current) {
        draggingRef.current = false
        const anchor = anchorIndexRef.current
        const focus = focusIndexRef.current
        anchorIndexRef.current = null
        if (anchor != null && focus != null) {
          setPick(
            anchor === focus
              ? pickWordAtPoint(runs, anchor, downNxRef.current, lastNxRef.current)
              : pickSelectedRuns(runs, selectionRef.current),
          )
        }
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      }
      syncHoverCursor(e.clientX, e.clientY)
    },
    [runs, syncHoverCursor],
  )

  const onPointerLeave = useCallback(() => {
    if (draggingRef.current) return
    if (layerRef.current) layerRef.current.style.cursor = 'default'
  }, [])

  const saveCurrentPick = useCallback(() => {
    if (!pick || !onSaveToVault) return
    onSaveToVault({ pdfPage: pageNumber, word: pick.word, sentence: pick.sentence })
    clearSelection()
  }, [pick, onSaveToVault, pageNumber, clearSelection])

  if (!active) return null

  const firstRect = highlightRects[0]
  const lastRect = highlightRects[highlightRects.length - 1]
  const saveBarStyle =
    pick && onSaveToVault && firstRect && lastRect
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
      {highlightRects.length > 0 ? (
        <div className="pointer-events-none fixed inset-0" style={{ zIndex: BOOK_PDF_TEXT_SELECT_LAYER_Z + 1 }} aria-hidden>
          {highlightRects.map((rect, index) => (
            <div
              key={`${rect.left}-${rect.top}-${rect.width}-${rect.height}-${index}`}
              className="absolute bg-[rgba(59,130,246,0.45)]"
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
      {saveBarStyle ? (
        <div
          role="toolbar"
          aria-label="Selected word"
          className={cn(SELECTION_CONTEXT_BAR_SURFACE, 'pointer-events-auto fixed flex h-10 items-center px-1.5')}
          style={{ ...saveBarStyle, zIndex: BOOK_PDF_TEXT_SELECT_LAYER_Z + 2 }}
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-[#f4f4f5] hover:bg-[#3f3f46]"
            onClick={saveCurrentPick}
          >
            <Vault className="h-4 w-4" aria-hidden />
            Save to vault
          </button>
        </div>
      ) : null}
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
          />
        </div>
      ) : null}
    </div>
  )
}
