interface StudentsEmptyStateProps {
  hasSearch: boolean
}

export function StudentsEmptyState({ hasSearch }: StudentsEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-8 text-center">
      <h2 className="text-xl font-bold text-foreground">{hasSearch ? 'No students match your search' : 'No students yet'}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {hasSearch ? 'Try a different name and keep class flow moving.' : 'Add students to begin tracking profile progress.'}
      </p>
    </div>
  )
}
