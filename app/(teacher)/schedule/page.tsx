import { PageHeader } from '@/components/page-header'
import { WeeklyScheduleGrid } from '@/components/schedule/weekly-schedule-grid'

export default function SchedulePage() {
  return (
    <section>
      <PageHeader
        title="Schedule"
        description="Set your weekly teaching calendar, assign slots to students, and auto-generate upcoming classes."
      />
      <div className="mx-auto w-full max-w-7xl">
        <WeeklyScheduleGrid />
      </div>
    </section>
  )
}
