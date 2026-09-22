import { describe, expect, it } from 'vitest'
import { createLatestWinsPersistQueue } from '@/lib/local-data/latest-wins-persist-queue'

describe('createLatestWinsPersistQueue', () => {
  it('coalesces rapid submits so an older write cannot finish after a newer one', async () => {
    const wrote: Array<{ value: number; keepalive: boolean }> = []
    let releaseFirst: (() => void) | null = null
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let calls = 0

    const queue = createLatestWinsPersistQueue<number>(async (value, meta) => {
      calls += 1
      if (calls === 1) await firstGate
      wrote.push({ value, keepalive: meta.keepalive })
    })

    queue.submit(1)
    queue.submit(2)
    queue.submit(3, { keepalive: true })

    // First persist still holds value 1; 2 and 3 coalesced into latest=3 + keepalive.
    expect(wrote).toEqual([])
    releaseFirst?.()
    await queue.whenIdle()

    expect(wrote).toEqual([
      { value: 1, keepalive: false },
      { value: 3, keepalive: true },
    ])
  })

  it('serializes overlapping persists so the last submitted value is durable', async () => {
    const order: number[] = []
    const queue = createLatestWinsPersistQueue<number>(async (value) => {
      await new Promise((r) => setTimeout(r, 5))
      order.push(value)
    })

    queue.submit(10)
    await Promise.resolve()
    queue.submit(20)
    queue.submit(30)
    await queue.whenIdle()

    expect(order[order.length - 1]).toBe(30)
    expect(order).not.toContain(20)
  })

  it('propagates keepalive only when requested on a coalesced submit', async () => {
    const metas: boolean[] = []
    const queue = createLatestWinsPersistQueue<string>(async (_value, meta) => {
      metas.push(meta.keepalive)
    })

    queue.submit('a')
    await queue.whenIdle()
    queue.submit('b', { keepalive: true })
    await queue.whenIdle()

    expect(metas).toEqual([false, true])
  })

  it('continues draining after a persist failure', async () => {
    const wrote: number[] = []
    const queue = createLatestWinsPersistQueue<number>(async (value) => {
      if (value === 1) throw new Error('boom')
      wrote.push(value)
    })

    queue.submit(1)
    await queue.whenIdle()
    queue.submit(2)
    await queue.whenIdle()

    expect(wrote).toEqual([2])
  })
})
