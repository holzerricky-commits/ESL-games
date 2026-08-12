/**
 * Serial "latest wins" write queue.
 * Concurrent submit() calls coalesce to the newest payload so an older in-flight
 * write cannot overwrite a newer one after it completes.
 */
export type LatestWinsPersistMeta = {
  /** Prefer fetch keepalive / unload-safe transport when true. */
  keepalive: boolean
}

export type LatestWinsPersistQueue<T> = {
  submit: (value: T, meta?: Partial<LatestWinsPersistMeta>) => void
  /** True when nothing is queued or currently writing. */
  isIdle: () => boolean
  /** Awaits until the queue has drained (for tests). */
  whenIdle: () => Promise<void>
}

export function createLatestWinsPersistQueue<T>(
  persist: (value: T, meta: LatestWinsPersistMeta) => Promise<void>,
): LatestWinsPersistQueue<T> {
  let queued: T | null = null
  let queuedKeepalive = false
  let running = false
  let chain: Promise<void> = Promise.resolve()
  const idleWaiters = new Set<() => void>()

  const notifyIdle = () => {
    if (running || queued !== null) return
    for (const wake of idleWaiters) wake()
    idleWaiters.clear()
  }

  const drain = () => {
    if (running) return
    running = true
    chain = (async () => {
      try {
        while (queued !== null) {
          const value = queued
          const keepalive = queuedKeepalive
          queued = null
          queuedKeepalive = false
          try {
            await persist(value, { keepalive })
          } catch {
            /* persist() is expected to handle/report errors itself */
          }
        }
      } finally {
        running = false
        if (queued !== null) {
          drain()
          return
        }
        notifyIdle()
      }
    })()
  }

  return {
    submit(value, meta) {
      queued = value
      if (meta?.keepalive) queuedKeepalive = true
      drain()
    },
    isIdle() {
      return !running && queued === null
    },
    whenIdle() {
      if (!running && queued === null) return chain
      return new Promise<void>((resolve) => {
        idleWaiters.add(resolve)
      })
    },
  }
}
