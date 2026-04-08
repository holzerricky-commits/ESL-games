import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DashboardOverview } from '@/components/dashboard-overview'
import { PageHeader } from '@/components/page-header'

export default function DashboardPage() {
  return (
    <section>
      <PageHeader
        title="Dashboard"
        description="Fast class overview and one-click actions before you start."
        actions={
          <Button asChild className="bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-bright)] text-white">
            <Link href="/games/timed-challenge">Open Timed Challenge</Link>
          </Button>
        }
      />
      <DashboardOverview />
    </section>
  )
}
