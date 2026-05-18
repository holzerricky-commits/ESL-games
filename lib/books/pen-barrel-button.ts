import type { StrokeTool } from '@/lib/books/annotation-command-types'
import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import { strokeToolForToolbarMode } from '@/lib/books/annotation-stroke-utils'

/** Pointer Events eraser / barrel button index. */
export const PEN_POINTER_ERASER_BUTTON = 5

/** `buttons` mask: secondary (barrel on some pens). */
export const PEN_BUTTONS_SECONDARY = 0x2

/** `buttons` mask: eraser / barrel on some pens (combined with tip bit on others). */
export const PEN_BUTTONS_ERASER = 0x20

/** @deprecated use PEN_BUTTONS_SECONDARY | PEN_BUTTONS_ERASER */
export const PEN_BUTTONS_BARREL_MASK = PEN_BUTTONS_SECONDARY | PEN_BUTTONS_ERASER

/** Samsung Galaxy pens often report tip contact as `buttons === 32` without bit 1. */
export const PEN_BUTTONS_SAMSUNG_TIP = 0x20

type PenPointerSample = Pick<PointerEvent, 'pointerType' | 'button' | 'buttons' | 'pointerId'>

let penBarrelHeld = false
let trackerInstalled = false
/**
 * Pointers in an active Samsung side-button (`button === 5`) stroke.
 * Cleared on side-button release even when the tip stays down (`buttons === 32`).
 */
const eraserButtonPointerIds = new Set<number>()

function isPenSideButtonIndex(button: number): boolean {
  return button === 1 || button === 2 || button === PEN_POINTER_ERASER_BUTTON
}

function isPenSideButtonPointerDown(e: PointerEvent): boolean {
  if (e.pointerType !== 'pen') return false
  if (isPenSideButtonIndex(e.button)) return true
  return (e.buttons & PEN_BUTTONS_SECONDARY) !== 0 && !isPenTipContactActive(e)
}

function isPenSideButtonPointerUp(e: PointerEvent): boolean {
  if (e.pointerType !== 'pen') return false
  return isPenSideButtonIndex(e.button)
}

/** Barrel / side button is physically held according to the current `buttons` mask. */
export function isPenBarrelButtonsActive(
  e: Pick<PointerEvent, 'pointerType' | 'buttons'>,
): boolean {
  if (e.pointerType !== 'pen') return false
  const b = e.buttons
  if ((b & PEN_BUTTONS_SECONDARY) !== 0) return true
  if ((b & 1) !== 0 && (b & PEN_BUTTONS_ERASER) !== 0) return true
  return false
}

function releaseBarrelEraserForPointer(pointerId: number, clearGlobalBarrel = false): void {
  eraserButtonPointerIds.delete(pointerId)
  if (clearGlobalBarrel || eraserButtonPointerIds.size === 0) {
    penBarrelHeld = false
  }
}

function syncPenBarrelHeldFromButtons(e: PointerEvent): void {
  if (e.pointerType !== 'pen') return
  if (isPenBarrelButtonsActive(e)) {
    penBarrelHeld = true
    return
  }
  if (eraserButtonPointerIds.has(e.pointerId)) {
    return
  }
  penBarrelHeld = false
}

function onGlobalPointerDown(e: PointerEvent): void {
  if (e.pointerType === 'pen' && e.button === PEN_POINTER_ERASER_BUTTON) {
    eraserButtonPointerIds.add(e.pointerId)
    penBarrelHeld = true
    return
  }
  if (isPenSideButtonPointerDown(e)) {
    penBarrelHeld = true
    return
  }
  syncPenBarrelHeldFromButtons(e)
}

function onGlobalPointerUp(e: PointerEvent): void {
  if (e.pointerType !== 'pen') return

  if (e.button === PEN_POINTER_ERASER_BUTTON) {
    releaseBarrelEraserForPointer(e.pointerId, true)
    return
  }
  if (isPenSideButtonPointerUp(e)) {
    releaseBarrelEraserForPointer(e.pointerId, true)
    return
  }

  // Side-button release sometimes reports as tip `button: 0` while tip stays down (Samsung).
  if (
    eraserButtonPointerIds.has(e.pointerId) &&
    e.button === 0 &&
    e.buttons !== 0 &&
    !isPenBarrelButtonsActive(e)
  ) {
    releaseBarrelEraserForPointer(e.pointerId, true)
    return
  }

  if (e.buttons === 0) {
    releaseBarrelEraserForPointer(e.pointerId, true)
  }
}

/** Install once; tracks side-button hold even when the OS uses separate pointer button events. */
export function ensurePenBarrelButtonTracker(): void {
  if (typeof window === 'undefined' || trackerInstalled) return
  trackerInstalled = true
  window.addEventListener('pointerdown', onGlobalPointerDown, true)
  window.addEventListener('pointerup', onGlobalPointerUp, true)
  window.addEventListener('pointercancel', onGlobalPointerUp, true)
  window.addEventListener('pointermove', syncPenBarrelHeldFromButtons, true)
}

export function isPenBarrelHeld(): boolean {
  return penBarrelHeld
}

/** Test-only reset. */
export function resetPenBarrelButtonTrackerForTests(): void {
  penBarrelHeld = false
  trackerInstalled = false
  eraserButtonPointerIds.clear()
}

export function modesSupportingPenBarrelEraser(mode: BookAnnotationInteractionMode): boolean {
  return mode === 'pen' || mode === 'marker' || mode === 'laser'
}

/** Pen tip is touching the surface (incl. Samsung `buttons === 32` encoding). */
export function isPenTipContactActive(
  e: Pick<PointerEvent, 'pointerType' | 'buttons'>,
): boolean {
  if (e.pointerType !== 'pen') return false
  const b = e.buttons
  return (b & 1) !== 0 || b === PEN_BUTTONS_SAMSUNG_TIP
}

export function isPenBarrelEraserActive(e: PenPointerSample): boolean {
  ensurePenBarrelButtonTracker()
  if (e.pointerType !== 'pen') return false
  if (isPenBarrelButtonsActive(e)) return true
  if (e.button === PEN_POINTER_ERASER_BUTTON) return true
  if (eraserButtonPointerIds.has(e.pointerId)) return true
  if (isPenBarrelHeld()) return true
  return false
}

/**
 * Accept pen tip (`button: 0`) or Samsung side-button stroke (`button: 5`, `buttons: 32`).
 */
export function isAnnotationPointerDownAccepted(e: PenPointerSample): boolean {
  if (e.pointerType === 'pen') {
    if (e.button === PEN_POINTER_ERASER_BUTTON) return true
    return isPenTipContactActive(e) && e.button === 0
  }
  return e.button === 0
}

/**
 * Stroke tool for this pointer sample. When the pen barrel is held over pen/marker/laser,
 * temporarily use stroke eraser (`eraser-line`) without changing toolbar mode.
 */
export function effectiveStrokeToolForPointer(
  mode: BookAnnotationInteractionMode,
  e: PenPointerSample,
): StrokeTool | null {
  if (modesSupportingPenBarrelEraser(mode) && isPenBarrelEraserActive(e)) {
    return 'eraser-line'
  }
  return strokeToolForToolbarMode(mode)
}
