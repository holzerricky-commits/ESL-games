'use client'

import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ListChecks, Puzzle } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  BookPageLinkChip,
  BOOK_PAGE_LINK_GLYPH_CLASS,
  BOOK_PAGE_LINK_GLYPH_FILL_OPACITY,
  BOOK_PAGE_LINK_GLYPH_STROKE,
} from '@/components/students/fullscreen-book-overlay/sections/BookPageLinkChip'
import {
  bookExerciseContentSummary,
  bookExerciseKindLabel,
  clampBookExercisePinCenter,
  isBookExerciseLiveEligible,
  isBookExerciseMultipleChoice,
  resolveBookExercisePinCenter,
  type BookExerciseTask,
} from '@/lib/books/book-exercises'
import { clientToSpreadNorm } from '@/lib/books/spread-canvas-coords'
import { cn } from '@/lib/utils'

const DRAG_THRESHOLD_PX = 4

type PageSlot = {
  pdfPage: number
  leftPx: number
  widthPx: number
  heightPx: number
}

type DragState = {
  taskId: string
  startX: number
  startY: number
  moved: boolean
  center: [number, number]
}

function normInVisualRect(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): [number, number] | null {
  if (!(rect.width > 0) || !(rect.height > 0)) return null
  const nx = (clientX - rect.left) / rect.width
  const ny = (clientY - rect.top) / rect.height
  if (nx < -0.05 || nx > 1.05 || ny < -0.05 || ny > 1.05) return null
  return clampBookExercisePinCenter([nx, ny])
}

export type BookExerciseTaskMarkersProps = {
  pageNumber: number
  spreadRightPage: number | null
  showSpreadRightPage: boolean
  spreadOverlayWidthPx: number
  spreadPageWidthPx: number
  pageCanvasHeightPx: number
  leftPageCaptureRef: RefObject<HTMLDivElement | null>
  rightPageCaptureRef: RefObject<HTMLDivElement | null>
  tasks: readonly BookExerciseTask[]
  selectedTaskId?: string | null
  markersInteractive: boolean
  onSelectTask?: (task: BookExerciseTask) => void
  onRemoveTask?: (task: BookExerciseTask) => void
  onMoveTask?: (task: BookExerciseTask, center: [number, number]) => void
}

export function BookExerciseTaskMarkers({
  pageNumber,
  spreadRightPage,
  showSpreadRightPage,
  spreadOverlayWidthPx,
  spreadPageWidthPx,
  pageCanvasHeightPx,
  leftPageCaptureRef,
  rightPageCaptureRef,
  tasks,
  selectedTaskId: _selectedTaskId = null,
  markersInteractive,
  onSelectTask,
  onRemoveTask,
  onMoveTask,
}: BookExerciseTaskMarkersProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const slots: PageSlot[] = useMemo(() => {
    const next: PageSlot[] = [
      { pdfPage: pageNumber, leftPx: 0, widthPx: spreadPageWidthPx, heightPx: pageCanvasHeightPx },
    ]
    if (showSpreadRightPage && spreadRightPage != null) {
      next.push({
        pdfPage: spreadRightPage,
        leftPx: spreadPageWidthPx,
        widthPx: spreadPageWidthPx,
        heightPx: pageCanvasHeightPx,
      })
    }
    return next
  }, [pageNumber, pageCanvasHeightPx, showSpreadRightPage, spreadPageWidthPx, spreadRightPage])

  const pickCenterOnPage = useCallback(
    (clientX: number, clientY: number, pdfPage: number): [number, number] | null => {
      const leftEl = leftPageCaptureRef.current
      const rightEl = rightPageCaptureRef.current
      if (pdfPage === pageNumber && leftEl) {
        const fromPage = normInVisualRect(clientX, clientY, leftEl.getBoundingClientRect())
        if (fromPage) return fromPage
      }
      if (showSpreadRightPage && spreadRightPage != null && pdfPage === spreadRightPage && rightEl) {
        const fromPage = normInVisualRect(clientX, clientY, rightEl.getBoundingClientRect())
        if (fromPage) return fromPage
      }
      const slot = slots.find((item) => item.pdfPage === pdfPage)
      const root = rootRef.current
      if (!slot || !root || !(slot.widthPx > 0) || !(slot.heightPx > 0)) return null
      if (!(spreadOverlayWidthPx > 0) || !(pageCanvasHeightPx > 0)) return null
      const overlayRect = root.getBoundingClientRect()
      const [sx, sy] = clientToSpreadNorm(overlayRect, clientX, clientY)
      const layoutX = sx * spreadOverlayWidthPx
      const layoutY = sy * pageCanvasHeightPx
      return clampBookExercisePinCenter([
        (layoutX - slot.leftPx) / slot.widthPx,
        layoutY / slot.heightPx,
      ])
    },
    [
      leftPageCaptureRef,
      pageCanvasHeightPx,
      pageNumber,
      rightPageCaptureRef,
      showSpreadRightPage,
      slots,
      spreadOverlayWidthPx,
      spreadRightPage,
    ],
  )

  const beginPinDrag = useCallback(
    (task: BookExerciseTask, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!markersInteractive || event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()

      const next: DragState = {
        taskId: task.id,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        center: resolveBookExercisePinCenter(task),
      }
      dragRef.current = next
      setDrag(next)

      const onMove = (moveEvent: PointerEvent) => {
        const current = dragRef.current
        if (!current) return
        const dx = moveEvent.clientX - current.startX
        const dy = moveEvent.clientY - current.startY
        const moved = current.moved || Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX
        const center = pickCenterOnPage(moveEvent.clientX, moveEvent.clientY, task.pdfPage)
        const updated: DragState = {
          ...current,
          moved,
          center: center ?? current.center,
        }
        dragRef.current = updated
        setDrag(updated)
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        const current = dragRef.current
        dragRef.current = null
        setDrag(null)
        if (!current) return
        if (current.moved) {
          onMoveTask?.(task, current.center)
        } else {
          onSelectTask?.(task)
        }
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [markersInteractive, onMoveTask, onSelectTask, pickCenterOnPage],
  )

  const visible = tasks.filter((task) => slots.some((slot) => slot.pdfPage === task.pdfPage))
  if (!visible.length) return null

  return (
    <div
      ref={rootRef}
      className={cn(
        'absolute inset-0',
        markersInteractive ? 'pointer-events-none z-[42]' : 'pointer-events-none z-[34]',
      )}
      style={{ width: spreadOverlayWidthPx, height: pageCanvasHeightPx }}
    >
      {visible.map((task) => {
        const slot = slots.find((item) => item.pdfPage === task.pdfPage)
        if (!slot || !(slot.widthPx > 0) || !(slot.heightPx > 0)) return null
        const live = isBookExerciseLiveEligible(task)
        const dragging = drag?.taskId === task.id
        const [pinX, pinY] =
          dragging && drag ? drag.center : resolveBookExercisePinCenter(task)
        const KindIcon = isBookExerciseMultipleChoice(task) ? ListChecks : Puzzle
        const kindLabel = bookExerciseKindLabel(task.kind)
        return (
          <div
            key={task.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: slot.leftPx + pinX * slot.widthPx,
              top: pinY * slot.heightPx,
              zIndex: dragging ? 60 : undefined,
            }}
          >
            <ContextMenu>
              <ContextMenuTrigger asChild disabled={!markersInteractive}>
                <BookPageLinkChip
                  tone="exercise"
                  interactive={markersInteractive}
                  className={cn(
                    'cursor-grab touch-none active:cursor-grabbing',
                    dragging && 'scale-110 brightness-110',
                  )}
                  title={
                    live
                      ? `${task.label} — ${kindLabel} · drag to move · tap to open · right-click to remove`
                      : `${task.label} — ${kindLabel} · ${bookExerciseContentSummary(task)} · drag to move · tap to edit · right-click to remove`
                  }
                  aria-label={`${task.label} (${kindLabel})`}
                  onPointerDown={(event) => beginPinDrag(task, event)}
                >
                  <KindIcon
                    className={BOOK_PAGE_LINK_GLYPH_CLASS}
                    strokeWidth={BOOK_PAGE_LINK_GLYPH_STROKE}
                    fill="currentColor"
                    fillOpacity={BOOK_PAGE_LINK_GLYPH_FILL_OPACITY}
                    aria-hidden
                  />
                </BookPageLinkChip>
              </ContextMenuTrigger>
              {onRemoveTask ? (
                <ContextMenuContent className="min-w-[10rem]">
                  <ContextMenuItem variant="destructive" onSelect={() => onRemoveTask(task)}>
                    Remove from book
                  </ContextMenuItem>
                </ContextMenuContent>
              ) : null}
            </ContextMenu>
          </div>
        )
      })}
    </div>
  )
}
