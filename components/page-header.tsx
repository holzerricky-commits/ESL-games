import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description: string
  actions?: ReactNode
  showDivider?: boolean
}

export function PageHeader({ title, description, actions, showDivider = true }: PageHeaderProps) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 ${
        showDivider ? 'mb-6 border-b border-[var(--border)] pb-4' : 'mb-2 pb-0'
      }`}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
