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
        titleClassName="text-3xl sm:text-4xl"
        showDivider={false}
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
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Schedule
            </h1>
            <p className="mt-4 text-[13px] text-muted-foreground">Loading…</p>
          </div>
        }
      >
        <SchedulePageContent />
      </Suspense>
    </section>
  )
}
