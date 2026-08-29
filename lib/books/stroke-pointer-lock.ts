/**
 * One ink gesture = one pointer. Palm / second finger must not feed the same stroke.
 * Prefer stylus: while pen is drawing, ignore touch; pen can take over a touch stroke.
 */

export type StrokePointerLock = {
  pointerId: number
  pointerType: string
} | null

export type StrokePointerSample = {
  pointerId: number
  pointerType: string
}

/** True when this pointer owns the in-progress stroke / shape drag. */
export function isStrokePointerLockedTo(
  lock: StrokePointerLock,
  pointerId: number,
): boolean {
  return lock != null && lock.pointerId === pointerId
}

/**
 * Whether pointerdown may start or continue an ink gesture.
 * Rejects second fingers / palm while a stroke is already locked.
 */
export function shouldAcceptStrokePointerDown(
  lock: StrokePointerLock,
  e: StrokePointerSample,
): boolean {
  if (!lock) return true
  if (lock.pointerId === e.pointerId) return true
  // Pen takes over an accidental touch stroke (palm then stylus tip).
  if (e.pointerType === 'pen' && lock.pointerType !== 'pen') return true
  return false
}

/** Caller should drop the touch draft and start a pen stroke. */
export function shouldStealStrokePointerLock(
  lock: StrokePointerLock,
  e: StrokePointerSample,
): boolean {
  if (!lock) return false
  if (lock.pointerId === e.pointerId) return false
  return e.pointerType === 'pen' && lock.pointerType !== 'pen'
}

export function createStrokePointerLock(e: StrokePointerSample): NonNullable<StrokePointerLock> {
  return { pointerId: e.pointerId, pointerType: e.pointerType }
}
