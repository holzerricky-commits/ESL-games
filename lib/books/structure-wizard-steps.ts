export const STRUCTURE_WIZARD_STEPS = ['align', 'toc', 'extract', 'review'] as const

export type StructureWizardStep = (typeof STRUCTURE_WIZARD_STEPS)[number]

export const STRUCTURE_WIZARD_STEP_META: Record<
  StructureWizardStep,
  { index: number; label: string; short: string }
> = {
  align: { index: 0, label: 'Align pages', short: 'Align' },
  toc: { index: 1, label: 'Contents', short: 'Contents' },
  extract: { index: 2, label: 'Extract', short: 'Extract' },
  review: { index: 3, label: 'Review', short: 'Review' },
}

/** Initial step when opening the wizard for a book. */
export function initialStructureWizardStep(hasOutlineMapping: boolean): StructureWizardStep {
  return hasOutlineMapping ? 'review' : 'align'
}

export function structureWizardStepIndex(step: StructureWizardStep): number {
  return STRUCTURE_WIZARD_STEP_META[step].index
}

export function isStructureWizardStepReachable(
  target: StructureWizardStep,
  furthest: StructureWizardStep,
): boolean {
  return structureWizardStepIndex(target) <= structureWizardStepIndex(furthest)
}

/** Advance furthest unlocked step when the user completes a gate. */
export function advanceFurthestStructureWizardStep(
  furthest: StructureWizardStep,
  completed: StructureWizardStep,
): StructureWizardStep {
  const nextIndex = Math.min(
    STRUCTURE_WIZARD_STEPS.length - 1,
    structureWizardStepIndex(completed) + 1,
  )
  const candidate = STRUCTURE_WIZARD_STEPS[nextIndex]!
  return structureWizardStepIndex(candidate) > structureWizardStepIndex(furthest)
    ? candidate
    : furthest
}

export function canContinueFromToc(tocRangeValid: boolean): boolean {
  return tocRangeValid
}

export function canContinueFromAlign(): boolean {
  return true
}

export function canEnterReview(hasDrafts: boolean): boolean {
  return hasDrafts
}
