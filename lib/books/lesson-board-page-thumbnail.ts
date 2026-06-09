import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { replayCanvasSlice } from '@/lib/books/annotation-draw'
import { LESSON_BOARD_STANDARD_ASPECT } from '@/lib/books/lesson-board-types'

/** Width of lesson-board TOC previews in the left rail (px). */
export const LESSON_BOARD_THUMB_WIDTH_PX = 120

const CANVAS_INK_KINDS = new Set<AnnotationCommand['kind']>([
  'stroke',
  'line',
  'rect',
  'ellipse',
  'triangle',
  'arrow',
  'stamp',
  'callout',
])

export function lessonBoardThumbHeightPx(
  widthPx: number,
  aspect = LESSON_BOARD_STANDARD_ASPECT,
): number {
  return Math.max(1, Math.round(widthPx / aspect))
}

export function lessonBoardPageHasCanvasInk(commands: readonly AnnotationCommand[]): boolean {
  return commands.some((c) => CANVAS_INK_KINDS.has(c.kind))
}

export function paintLessonBoardPageThumbnail(
  inkCanvas: HTMLCanvasElement,
  markerCanvas: HTMLCanvasElement,
  commands: readonly AnnotationCommand[],
  widthPx: number,
  heightPx: number,
): void {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  for (const canvas of [inkCanvas, markerCanvas]) {
    canvas.width = Math.round(widthPx * dpr)
    canvas.height = Math.round(heightPx * dpr)
    canvas.style.width = `${widthPx}px`
    canvas.style.height = `${heightPx}px`
  }
  const inkCtx = inkCanvas.getContext('2d')
  const markerCtx = markerCanvas.getContext('2d')
  if (!inkCtx || !markerCtx) return
  const indices = commands.map((_, i) => i)
  replayCanvasSlice(inkCtx, markerCtx, commands, indices, widthPx, heightPx)
}
