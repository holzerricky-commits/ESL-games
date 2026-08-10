interface StudentsEmptyStateProps {
  hasSearch: boolean
  /** True when the teacher has no students at all (active or on break). */
  rosterEmpty?: boolean
  /** When set and not searching, explain an empty status filter. */
  statusFilter?: 'active' | 'needsSetup' | 'onBreak'
}

export function StudentsEmptyState({ hasSearch, rosterEmpty, statusFilter }: StudentsEmptyStateProps) {
  let title = 'No students yet'
  let body = 'Use Add student above to create your first profile and start planning classes.'

  if (hasSearch) {
    title = 'No students match your search'
    body = 'Try a different name and keep class flow moving.'
  } else if (rosterEmpty) {
    title = 'No students yet'
    body = 'Use Add student above to create your first profile and start planning classes.'
  } else if (statusFilter === 'needsSetup') {
    title = 'No one needs setup'
    body = 'Everyone on the active roster has a book and a class time.'
  } else if (statusFilter === 'onBreak') {
    title = 'No one on break'
    body = 'Students you put on break will show up here until you restore them.'
  } else if (statusFilter === 'active') {
    title = 'No active students'
    body = 'Add a student, or check the On break filter if someone is hidden.'
  }

  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-8 text-center">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  )
}
