'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  flushAnnotationsForClassEnd,
  keepClassAnnotationChanges,
} from '@/lib/books/class-annotation-durability'
import { ensureStudentRecordsHydrated, STUDENT_RECORDS_HYDRATED_EVENT } from '@/lib/local-data/student-records-client'
import { reconcileClassScheduleCatchUp } from '@/lib/students/selectors'

const TICK_MS = 10_000
const TOASTED_STARTED_PREFIX = 'class-auto-start-toasted'
const TOASTED_BLOCKED_PREFIX = 'class-auto-start-blocked'
const TOASTED_AUTO_END_PREFIX = 'class-hard-auto-end-toasted'
const TOASTED_MISSED_PREFIX = 'class-missed-toasted'

function dayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function startedToastKey(sessionId: string): string {
  return `${TOASTED_STARTED_PREFIX}:${sessionId}:${dayKey()}`
}

function blockedToastKey(sessionId: string): string {
  return `${TOASTED_BLOCKED_PREFIX}:${sessionId}:${dayKey()}`
}

function autoEndToastKey(sessionId: string): string {
  return `${TOASTED_AUTO_END_PREFIX}:${sessionId}:${dayKey()}`
}

function missedToastKey(sessionId: string): string {
  return `${TOASTED_MISSED_PREFIX}:${sessionId}:${dayKey()}`
}

function wasToasted(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function markToasted(key: string): void {
  try {
    sessionStorage.setItem(key, '1')
  } catch {
    /* ignore quota */
  }
}

/**
 * Catch-up while the teacher app is open: auto-end overdue live, mark no-shows missed,
 * soft auto-start in-window. Does not force-navigate into the book on start.
 */
export function ClassAutoStartReconciler() {
  const router = useRouter()
  const runningRef = useRef(false)

  const run = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (runningRef.current) return
    if (document.visibilityState === 'hidden') return
    runningRef.current = true
    try {
      await ensureStudentRecordsHydrated()
      try {
        await flushAnnotationsForClassEnd()
      } catch {
        /* still attempt catch-up */
      }

      const result = reconcileClassScheduleCatchUp(Date.now())

      for (const row of result.autoEnded) {
        if (row.alreadyEnded) continue
        keepClassAnnotationChanges(row.sessionId)
        const key = autoEndToastKey(row.sessionId)
        if (wasToasted(key)) continue
        markToasted(key)
        toast.message(`${row.studentName}'s class ended (time's up)`, {
          description: 'You can add a note later from Past classes.',
        })
      }

      for (const row of result.missed) {
        const key = missedToastKey(row.sessionId)
        if (wasToasted(key)) continue
        markToasted(key)
        toast.message(`${row.studentName}'s class was missed`, {
          description: 'Reschedule or mark taught from Today or the schedule.',
        })
      }

      if (result.started.started) {
        const started = result.started.started
        const key = startedToastKey(started.session.id)
        if (!wasToasted(key)) {
          markToasted(key)
          const name = started.studentName
          const studentId = started.studentId
          const sessionId = started.session.id
          toast.message(`${name}'s class is live`, {
            description: 'Open when ready — nothing was forced open.',
            action: {
              label: 'Open',
              onClick: () => {
                router.push(
                  `/students/${encodeURIComponent(studentId)}/map?classSession=${encodeURIComponent(sessionId)}`,
                )
              },
            },
          })
        }
      }

      for (const row of result.started.blocked) {
        const key = blockedToastKey(row.session.id)
        if (wasToasted(key)) continue
        markToasted(key)
        toast.message(`${row.studentName}'s class should start`, {
          description: `End or move ${row.blockedByStudentName}'s live class first.`,
        })
      }
    } catch {
      /* ignore hydrate / storage errors for this tick */
    } finally {
      runningRef.current = false
    }
  }, [router])

  useEffect(() => {
    void run()
    const id = window.setInterval(() => {
      void run()
    }, TICK_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void run()
    }
    const onHydrated = () => {
      void run()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(STUDENT_RECORDS_HYDRATED_EVENT, onHydrated)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(STUDENT_RECORDS_HYDRATED_EVENT, onHydrated)
    }
  }, [run])

  return null
}
