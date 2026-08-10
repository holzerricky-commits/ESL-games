import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DashboardOverview } from '@/components/dashboard-overview'
import { PageHeader } from '@/components/page-header'

export default function DashboardPage() {
  return (
    <section>
      <PageHeader
        title="Dashboard"
        showDivider={false}
        actions={
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/games/timed-challenge">Timed Challenge</Link>
          </Button>
        }
      />
      <DashboardOverview />
    </section>
  )
}
