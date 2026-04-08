import { PageHeader } from '@/components/page-header'
import { SettingsOverview } from '@/components/settings-overview'

export default function SettingsPage() {
  return (
    <section>
      <PageHeader
        title="Settings"
        description="Classroom preferences and app configuration scaffolding."
      />
      <SettingsOverview />
    </section>
  )
}
