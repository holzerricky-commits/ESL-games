import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  titleClassName?: string
  actions?: ReactNode
  showDivider?: boolean
}

export function PageHeader({
  title,
  description,
  titleClassName,
  actions,
  showDivider = true,
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 ${
        showDivider ? 'mb-6 pb-2' : 'mb-2 pb-0'
      }`}
    >
      <div>
        <h1 className={cn('text-2xl font-semibold tracking-tight text-foreground', titleClassName)}>{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
