import { inkSessionPersistV2Enabled } from '@/lib/books/feature-flags'
import {
  INK_SESSION_AUTOSAVE_MS_DRAWING,
  INK_SESSION_DRAWING_HOT_MS,
  INK_SESSION_IDLE_CHECKPOINT_TIMEOUT_MS,
} from '@/lib/books/ink-session-persist-config'

type NowFn = () => number

let nowFn: NowFn = () => Date.now()
let drawingHotUntil = 0

export function __setInkSessionPersistV2NowForTests(now: NowFn): void {
  nowFn = now
}

export function __resetInkSessionPersistV2ForTests(now: NowFn = () => Date.now()): void {
  nowFn = now
  drawingHotUntil = 0
  cancelIdleInkCheckpoint()
}

/** Extend the “actively drawing” window so autosave debounce stays long. */
export function markInkSessionDrawingHot(): void {
  if (!inkSessionPersistV2Enabled) return
  drawingHotUntil = nowFn() + INK_SESSION_DRAWING_HOT_MS
}

export function isInkSessionDrawingHot(): boolean {
  if (!inkSessionPersistV2Enabled) return false
  return nowFn() < drawingHotUntil
}

/** Idle debounce when hot; caller’s `idleMs` when not. */
export function resolveInkSessionAutosaveMs(idleMs: number): number {
  if (!inkSessionPersistV2Enabled) return idleMs
  return isInkSessionDrawingHot() ? INK_SESSION_AUTOSAVE_MS_DRAWING : idleMs
}

type IdleHandle = number | ReturnType<typeof setTimeout>

let idleHandle: IdleHandle | null = null

export function scheduleIdleInkCheckpoint(run: () => void): void {
  if (idleHandle !== null) return

  let finished = false
  const execute = () => {
    if (finished) return
    finished = true
    idleHandle = null
    run()
  }

  if (typeof requestIdleCallback !== 'undefined') {
    idleHandle = requestIdleCallback(execute, {
      timeout: INK_SESSION_IDLE_CHECKPOINT_TIMEOUT_MS,
    }) as IdleHandle
    if (finished) idleHandle = null
    return
  }

  idleHandle = setTimeout(execute, 0)
}

export function cancelIdleInkCheckpoint(): void {
  if (idleHandle === null) return
  if (typeof cancelIdleCallback !== 'undefined' && typeof idleHandle === 'number') {
    cancelIdleCallback(idleHandle)
  } else {
    clearTimeout(idleHandle as ReturnType<typeof setTimeout>)
  }
  idleHandle = null
}

export type InkSessionPersistV2Writer = {
  /** Queue checkpoint for idle (or run immediately when v2 off). */
  queueAutosaveCheckpoint: (write: () => void) => void
  /** Run any queued checkpoint immediately (page turn, visibility, destroy). */
  flushSync: (write: () => void) => void
  cancelPending: () => void
}

export function createInkSessionPersistV2Writer(): InkSessionPersistV2Writer {
  let queuedWrite: (() => void) | null = null
  let idleQueued = false

  const drainQueued = () => {
    idleQueued = false
    const job = queuedWrite
    queuedWrite = null
    job?.()
  }

  return {
    queueAutosaveCheckpoint(write) {
      if (!inkSessionPersistV2Enabled) {
        write()
        return
      }
      queuedWrite = write
      if (idleQueued) return
      idleQueued = true
      scheduleIdleInkCheckpoint(drainQueued)
    },
    flushSync(write) {
      cancelIdleInkCheckpoint()
      idleQueued = false
      queuedWrite = null
      write()
    },
    cancelPending() {
      cancelIdleInkCheckpoint()
      idleQueued = false
      queuedWrite = null
    },
  }
}
