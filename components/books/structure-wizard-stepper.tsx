'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  STRUCTURE_WIZARD_STEPS,
  STRUCTURE_WIZARD_STEP_META,
  isStructureWizardStepReachable,
  type StructureWizardStep,
} from '@/lib/books/structure-wizard-steps'

type Props = {
  current: StructureWizardStep
  furthest: StructureWizardStep
  onSelect: (step: StructureWizardStep) => void
}

export function StructureWizardStepper({ current, furthest, onSelect }: Props) {
  return (
    <nav aria-label="Structure mapping steps" className="w-full">
      <ol className="flex w-full items-center">
        {STRUCTURE_WIZARD_STEPS.map((step, i) => {
          const meta = STRUCTURE_WIZARD_STEP_META[step]
          const reachable = isStructureWizardStepReachable(step, furthest)
          const isCurrent = step === current
          const isDone = structureIsDone(step, current, furthest)
          return (
            <li key={step} className="flex min-w-0 flex-1 items-center">
              {i > 0 ? (
                <span
                  className={cn(
                    'mx-1 h-px min-w-[0.75rem] flex-1',
                    isDone || isCurrent ? 'bg-primary/45' : 'bg-border',
                  )}
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(step)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs font-medium transition-colors',
                  isCurrent && 'text-foreground',
                  !isCurrent && isDone && 'text-foreground hover:bg-muted/50',
                  !isCurrent &&
                    !isDone &&
                    reachable &&
                    'text-muted-foreground hover:bg-muted/40',
                  !reachable && 'cursor-not-allowed text-muted-foreground/40',
                )}
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ring-inset',
                    isCurrent && 'bg-primary text-primary-foreground ring-primary',
                    isDone && !isCurrent && 'bg-primary/15 text-primary ring-primary/25',
                    !isDone && !isCurrent && 'bg-background text-muted-foreground ring-border',
                    !reachable && 'ring-border/40',
                  )}
                >
                  {isDone && !isCurrent ? <Check className="size-3" aria-hidden /> : meta.index + 1}
                </span>
                <span className="hidden truncate sm:inline">{meta.short}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function structureIsDone(
  step: StructureWizardStep,
  current: StructureWizardStep,
  furthest: StructureWizardStep,
): boolean {
  const stepIdx = STRUCTURE_WIZARD_STEP_META[step].index
  const currentIdx = STRUCTURE_WIZARD_STEP_META[current].index
  const furthestIdx = STRUCTURE_WIZARD_STEP_META[furthest].index
  return stepIdx < currentIdx || (stepIdx < furthestIdx && stepIdx !== currentIdx)
}
