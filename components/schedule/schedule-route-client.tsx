'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { WeekScheduleView } from '@/components/schedule/week-schedule-view'
import { parseScheduleStudentId } from '@/lib/schedule/schedule-student-link'

function SchedulePageContent() {
  const searchParams = useSearchParams()
  const highlightStudentId = parseScheduleStudentId(searchParams.get('student'))

  return (
    <>
      <PageHeader
        title="Schedule"
        description="Your week or month at a glance — see classes, add times, and jump into planning."
      />
      <div className="mx-auto w-full max-w-7xl">
        <WeekScheduleView highlightStudentId={highlightStudentId} />
      </div>
    </>
  )
}

export function ScheduleRouteClient() {
  return (
    <section>
      <Suspense
        fallback={
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
            <p className="text-sm text-muted-foreground">Loading schedule…</p>
          </div>
        }
      >
        <SchedulePageContent />
      </Suspense>
    </section>
  )
}
