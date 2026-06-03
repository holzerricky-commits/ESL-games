export type RafCoalescer = {
  schedule: () => void
  /** Cancel pending frame and run immediately. */
  flush: () => void
  cancel: () => void
}

/** Coalesce rapid calls (e.g. pointermove) to at most one run per animation frame. */
export function createRafCoalescer(run: () => void): RafCoalescer {
  let rafId: number | null = null

  const cancel = (): void => {
    if (rafId == null) return
    cancelAnimationFrame(rafId)
    rafId = null
  }

  return {
    schedule: () => {
      if (rafId != null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        run()
      })
    },
    flush: () => {
      cancel()
      run()
    },
    cancel,
  }
}
