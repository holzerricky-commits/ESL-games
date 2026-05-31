'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { LessonCoachCockpit } from '@/components/lesson-coach/lesson-coach-cockpit'
import { useLessonCoachSession } from '@/lib/lesson-coach/use-lesson-coach-session'
import { cn } from '@/lib/utils'

function ConnectionBadge({ status }: { status: 'connected' | 'waiting' | 'stale' | 'disconnected' }) {
  const label =
    status === 'connected'
      ? 'Connected to lesson'
      : status === 'waiting'
        ? 'Waiting for lesson on PC…'
        : status === 'stale'
          ? 'Lesson PC idle'
          : 'Not connected'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
        status === 'connected' && 'bg-emerald-500/20 text-emerald-100',
        status === 'waiting' && 'bg-amber-500/20 text-amber-100',
        status === 'stale' && 'bg-orange-500/20 text-orange-100',
        status === 'disconnected' && 'bg-zinc-500/20 text-zinc-300',
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          status === 'connected' && 'bg-emerald-400',
          status === 'waiting' && 'bg-amber-400 animate-pulse',
          status === 'stale' && 'bg-orange-400',
          status === 'disconnected' && 'bg-zinc-400',
        )}
      />
      {label}
    </span>
  )
}

function LessonCoachPageInner() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')?.trim() ?? null
  const { session, error, connectionStatus, patch } = useLessonCoachSession(sessionId, 'coach')

  if (!sessionId) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col gap-4 bg-zinc-950 px-4 py-8 text-zinc-100">
        <h1 className="text-xl font-semibold">Teacher coach</h1>
        <p className="text-sm text-zinc-400">
          Open this page from the book overlay on your PC — use <strong>Coach on phone</strong> to
          get a QR code and link.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 px-4 py-4 backdrop-blur-sm">
        <h1 className="text-xl font-semibold tracking-tight">Teacher coach</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ConnectionBadge status={connectionStatus} />
        </div>
        {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      </header>

      <div className="flex-1 px-4 py-5">
        {session && patch ? (
          <LessonCoachCockpit session={session} patch={patch} />
        ) : (
          <p className="text-sm text-zinc-500">Loading session…</p>
        )}
      </div>
    </main>
  )
}

export default function LessonCoachPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] bg-zinc-950 px-4 py-8 text-zinc-400">Loading…</main>
      }
    >
      <LessonCoachPageInner />
    </Suspense>
  )
}
