import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type StructureWizardStepPanelProps = {
  stepNumber: number
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  /** Keep early steps narrow so fields don’t stretch across the tall preview column. */
  compact?: boolean
}

/**
 * Compact wizard module shell — soft Apple-like band (not nested Salt cards).
 */
export function StructureWizardStepPanel({
  stepNumber,
  title,
  description,
  children,
  footer,
  className,
  compact = true,
}: StructureWizardStepPanelProps) {
  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl bg-[var(--surface-3)]',
        compact && 'max-w-xl',
        className,
      )}
    >
      <header className="shrink-0 px-3.5 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Step {stepNumber} of 4
        </p>
        <h3 className="mt-0.5 text-[14px] font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-0.5 max-w-prose text-[11px] leading-snug text-muted-foreground">{description}</p>
      </header>
      <div className="space-y-2.5 px-3.5 pb-3">{children}</div>
      {footer ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--border)]/60 px-3.5 py-2">
          {footer}
        </div>
      ) : null}
    </section>
  )
}

type FieldRowProps = {
  children: ReactNode
  className?: string
}

/** Horizontal field group that does not stretch to fill the column. */
export function StructureWizardFieldRow({ children, className }: FieldRowProps) {
  return <div className={cn('flex flex-wrap items-end gap-2', className)}>{children}</div>
}

type FieldProps = {
  label: string
  htmlFor?: string
  hint?: string
  children: ReactNode
  className?: string
  widthClassName?: string
}

export function StructureWizardField({
  label,
  htmlFor,
  hint,
  children,
  className,
  widthClassName = 'w-[5.75rem]',
}: FieldProps) {
  return (
    <div className={cn('grid gap-1', widthClassName, className)}>
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-medium leading-none text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-[10px] leading-snug text-muted-foreground/90">{hint}</p> : null}
    </div>
  )
}
