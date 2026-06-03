import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRafCoalescer } from '@/lib/books/raf-coalesce'

describe('createRafCoalescer', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs at most once per frame when scheduled repeatedly', () => {
    let rafId = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafId += 1
      return rafId
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const runs: number[] = []
    const coalescer = createRafCoalescer(() => runs.push(runs.length))

    coalescer.schedule()
    coalescer.schedule()
    coalescer.schedule()
    expect(runs).toHaveLength(0)

    coalescer.flush()
    expect(runs).toHaveLength(1)
  })

  it('flush runs immediately and clears pending frame', () => {
    let scheduled: FrameRequestCallback | null = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      scheduled = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      scheduled = null
    })

    const runs: number[] = []
    const coalescer = createRafCoalescer(() => runs.push(1))

    coalescer.schedule()
    expect(scheduled).not.toBeNull()
    coalescer.flush()
    expect(runs).toHaveLength(1)
    expect(scheduled).toBeNull()
  })
})
