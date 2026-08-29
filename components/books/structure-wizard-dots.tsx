'use client'

import { cn } from '@/lib/utils'
import {
  STRUCTURE_WIZARD_STEPS,
  STRUCTURE_WIZARD_STEP_META,
  isStructureWizardStepReachable,
  type StructureWizardStep,
} from '@/lib/books/structure-wizard-steps'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type Props = {
  current: StructureWizardStep
  furthest: StructureWizardStep
  onSelect: (step: StructureWizardStep) => void
  className?: string
}

/**
 * Apple-style page control for the outline wizard — dots in the footer, labels on hover.
 */
export function StructureWizardDots({ current, furthest, onSelect, className }: Props) {
  const currentMeta = STRUCTURE_WIZARD_STEP_META[current]
  return (
    <nav
      aria-label="Structure mapping steps"
      className={cn('flex flex-col items-center gap-1', className)}
    >
      <ol className="flex items-center gap-2">
        {STRUCTURE_WIZARD_STEPS.map((step) => {
          const meta = STRUCTURE_WIZARD_STEP_META[step]
          const reachable = isStructureWizardStepReachable(step, furthest)
          const isCurrent = step === current
          return (
            <li key={step}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => onSelect(step)}
                    aria-label={meta.label}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={cn(
                      'block size-2 rounded-full transition',
                      isCurrent && 'scale-125 bg-[var(--brand-blue)]',
                      !isCurrent &&
                        reachable &&
                        'bg-[var(--border)] hover:bg-muted-foreground/50',
                      !reachable && 'cursor-not-allowed bg-[var(--border)]/40',
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent>{meta.short}</TooltipContent>
              </Tooltip>
            </li>
          )
        })}
      </ol>
      <p className="text-[11px] font-medium tabular-nums text-muted-foreground">
        {currentMeta.short}
        <span className="text-muted-foreground/70">
          {' '}
          · {currentMeta.index + 1} of {STRUCTURE_WIZARD_STEPS.length}
        </span>
      </p>
    </nav>
  )
}
