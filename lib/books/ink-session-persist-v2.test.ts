import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  INK_SESSION_AUTOSAVE_MS_DRAWING,
  INK_SESSION_DRAWING_HOT_MS,
} from '@/lib/books/ink-session-persist-config'

vi.mock('@/lib/books/feature-flags', () => ({
  inkSessionPersistV2Enabled: true,
}))

import {
  __resetInkSessionPersistV2ForTests,
  __setInkSessionPersistV2NowForTests,
  createInkSessionPersistV2Writer,
  isInkSessionDrawingHot,
  markInkSessionDrawingHot,
  resolveInkSessionAutosaveMs,
} from '@/lib/books/ink-session-persist-v2'

describe('ink-session-persist-v2', () => {
  beforeEach(() => {
    __resetInkSessionPersistV2ForTests(() => 0)
  })

  afterEach(() => {
    vi.useRealTimers()
    __resetInkSessionPersistV2ForTests()
  })

  it('uses longer autosave delay while drawing is hot', () => {
    markInkSessionDrawingHot()
    expect(isInkSessionDrawingHot()).toBe(true)
    expect(resolveInkSessionAutosaveMs(3000)).toBe(INK_SESSION_AUTOSAVE_MS_DRAWING)
  })

  it('falls back to idle autosave after drawing hot window', () => {
    markInkSessionDrawingHot()
    __setInkSessionPersistV2NowForTests(() => INK_SESSION_DRAWING_HOT_MS + 1)
    expect(isInkSessionDrawingHot()).toBe(false)
    expect(resolveInkSessionAutosaveMs(3000)).toBe(3000)
  })

  it('queues autosave checkpoint for idle and coalesces to latest write', () => {
    vi.useFakeTimers()
    const runs: number[] = []
    const writer = createInkSessionPersistV2Writer()

    writer.queueAutosaveCheckpoint(() => runs.push(1))
    writer.queueAutosaveCheckpoint(() => runs.push(2))

    expect(runs).toHaveLength(0)
    vi.advanceTimersByTime(0)
    expect(runs).toEqual([2])
  })

  it('flushSync runs checkpoint immediately and clears queued idle work', () => {
    vi.useFakeTimers()
    const runs: number[] = []
    const writer = createInkSessionPersistV2Writer()

    writer.queueAutosaveCheckpoint(() => runs.push(1))
    writer.flushSync(() => runs.push(99))

    vi.advanceTimersByTime(10)
    expect(runs).toEqual([99])
  })
})
