import { PageHeader } from '@/components/page-header'
import { StudentsListPage } from '@/components/students/students-list-page'

export default function StudentsPage() {
  return (
    <section>
      <PageHeader
        title="Students"
        description="Search quickly, open full profiles, and keep class flow moving."
      />
      <StudentsListPage />
    </section>
  )
}
