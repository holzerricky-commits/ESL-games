import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/books/feature-flags', () => ({
  inkSessionPersistV2Enabled: true,
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import {
  ANNOTATION_STORAGE_KEY_V2,
  __activateBookAnnotationsDiskForTests,
  __resetBookAnnotationsDiskClientForTests,
  flushBookAnnotationsToDiskAsync,
  setAnnotationsRootOnDiskCache,
} from '@/lib/local-data/book-annotations-disk-client'
import { INK_SESSION_DISK_PERSIST_DEBOUNCE_MS } from '@/lib/books/ink-session-persist-config'

const storage = new Map<string, string>()

function mockBrowserStorage() {
  const ls = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storage.set(k, v)
    },
    removeItem: (k: string) => {
      storage.delete(k)
    },
    clear: () => storage.clear(),
  }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: ls,
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: ls, addEventListener: () => {}, dispatchEvent: () => false },
  })
}

describe('book-annotations-disk-client durability', () => {
  beforeEach(() => {
    storage.clear()
    mockBrowserStorage()
    __resetBookAnnotationsDiskClientForTests()
    vi.useFakeTimers()
  })

  afterEach(() => {
    __resetBookAnnotationsDiskClientForTests()
    storage.clear()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('mirrors page annotation roots to localStorage on cache update', () => {
    __activateBookAnnotationsDiskForTests()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    )

    setAnnotationsRootOnDiskCache({
      stu_1: {
        book_a: {
          unit_1: {
            '12': [{ kind: 'line', id: 'l1', a: [0.1, 0.1], b: [0.2, 0.2], color: '#111827' }],
          },
        },
      },
    })

    const raw = localStorage.getItem(ANNOTATION_STORAGE_KEY_V2)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as {
      stu_1: { book_a: { unit_1: { '12': unknown[] } } }
    }
    expect(parsed.stu_1.book_a.unit_1['12']).toHaveLength(1)
  })

  it('serializes disk PUTs so only the newest generation lands', async () => {
    __activateBookAnnotationsDiskForTests()

    const bodies: string[] = []
    let releaseFirst: (() => void) | null = null
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        call += 1
        const body = String(init?.body ?? '')
        if (call === 1) {
          await firstGate
        }
        bodies.push(body)
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }),
    )

    setAnnotationsRootOnDiskCache({
      stu_1: {
        book_a: {
          unit_1: {
            '1': [
              {
                kind: 'text',
                id: 'old',
                text: 'old',
                x: 0.1,
                y: 0.1,
                color: '#000',
                fontSizeNorm: 0.02,
              },
            ],
          },
        },
      },
    })
    await vi.advanceTimersByTimeAsync(INK_SESSION_DISK_PERSIST_DEBOUNCE_MS)

    setAnnotationsRootOnDiskCache({
      stu_1: {
        book_a: {
          unit_1: {
            '1': [
              {
                kind: 'text',
                id: 'new',
                text: 'new',
                x: 0.1,
                y: 0.1,
                color: '#000',
                fontSizeNorm: 0.02,
              },
            ],
          },
        },
      },
    })
    const flushPromise = flushBookAnnotationsToDiskAsync()

    releaseFirst?.()
    await flushPromise

    expect(bodies.length).toBeGreaterThanOrEqual(1)
    const last = bodies[bodies.length - 1]!
    expect(last).toContain('"id":"new"')
    expect(last).not.toContain('"id":"old"')
  })
})
