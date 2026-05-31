'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LessonCoachSession, LessonCoachSessionPatch } from '@/lib/lesson-coach/types'
import { isCoachOverlayPollingPaused } from '@/lib/lesson-coach/overlay-busy'

const POLL_MS = 1500

type CreateSessionSeed = {
  studentId?: string
  studentName?: string
  bookId?: string
  bookTitle?: string
  unitId?: string
  unitTitle?: string
  lessonId?: string
  lessonTitle?: string
  partId?: string
  partTitle?: string
  pacingNotes?: string
}

export function useLessonCoachSession(sessionId: string | null, role: 'overlay' | 'coach') {
  const [session, setSession] = useState<LessonCoachSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const roleRef = useRef(role)
  roleRef.current = role

  const fetchSession = useCallback(async (id: string) => {
    const res = await fetch(`/api/lesson-coach/session/${encodeURIComponent(id)}`)
    const data = (await res.json()) as { ok: boolean; session?: LessonCoachSession; error?: string }
    if (!res.ok || !data.ok || !data.session) {
      throw new Error(data.error ?? 'Session not found')
    }
    return data.session
  }, [])

  const patch = useCallback(
    async (id: string, body: LessonCoachSessionPatch) => {
      const res = await fetch(`/api/lesson-coach/session/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { ok: boolean; session?: LessonCoachSession; error?: string }
      if (!res.ok || !data.ok || !data.session) {
        throw new Error(data.error ?? 'Patch failed')
      }
      setSession(data.session)
      return data.session
    },
    [],
  )

  const ping = useCallback(
    async (id: string) => {
      const field = roleRef.current === 'overlay' ? 'overlayLastSeenAt' : 'coachLastSeenAt'
      await patch(id, { [field]: Date.now() } as LessonCoachSessionPatch)
    },
    [patch],
  )

  const createSession = useCallback(async (seed?: CreateSessionSeed) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/lesson-coach/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seed ?? {}),
      })
      const data = (await res.json()) as {
        ok: boolean
        id?: string
        coachUrl?: string
        session?: LessonCoachSession
        error?: string
      }
      if (!res.ok || !data.ok || !data.id || !data.coachUrl || !data.session) {
        throw new Error(data.error ?? 'Could not create session')
      }
      setSession(data.session)
      return { id: data.id, coachUrl: data.coachUrl, session: data.session }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Create failed'
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setError(null)
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        const s = await fetchSession(sessionId)
        if (!cancelled) {
          setSession(s)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Load failed')
          setSession(null)
        }
      }
    }

    void load()
    const interval = setInterval(() => {
      if (roleRef.current === 'overlay' && isCoachOverlayPollingPaused()) return
      void load()
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [sessionId, fetchSession])

  useEffect(() => {
    if (!sessionId) return
    void ping(sessionId)
    const interval = setInterval(() => {
      if (roleRef.current === 'overlay' && isCoachOverlayPollingPaused()) return
      void ping(sessionId).catch(() => {})
    }, POLL_MS * 2)
    return () => clearInterval(interval)
  }, [sessionId, ping])

  const connectionStatus = (() => {
    if (!session) return 'disconnected' as const
    const peerSeen =
      role === 'overlay' ? session.coachLastSeenAt : session.overlayLastSeenAt
    if (!peerSeen) return 'waiting' as const
    if (Date.now() - peerSeen < POLL_MS * 4) return 'connected' as const
    return 'stale' as const
  })()

  return {
    session,
    error,
    loading,
    connectionStatus,
    createSession,
    patch: sessionId ? (body: LessonCoachSessionPatch) => patch(sessionId, body) : null,
    refresh: sessionId ? () => fetchSession(sessionId).then(setSession) : null,
  }
}
