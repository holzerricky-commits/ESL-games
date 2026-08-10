import { describe, expect, it } from 'vitest'
import {
  advanceFurthestStructureWizardStep,
  canContinueFromToc,
  canEnterReview,
  initialStructureWizardStep,
  isStructureWizardStepReachable,
} from '@/lib/books/structure-wizard-steps'

describe('structure-wizard-steps', () => {
  it('opens Review when an outline already exists', () => {
    expect(initialStructureWizardStep(true)).toBe('review')
    expect(initialStructureWizardStep(false)).toBe('toc')
  })

  it('only allows clicking up to furthest unlocked step', () => {
    expect(isStructureWizardStepReachable('toc', 'align')).toBe(true)
    expect(isStructureWizardStepReachable('align', 'align')).toBe(true)
    expect(isStructureWizardStepReachable('extract', 'align')).toBe(false)
    expect(isStructureWizardStepReachable('review', 'extract')).toBe(false)
  })

  it('advances furthest after completing a step', () => {
    expect(advanceFurthestStructureWizardStep('toc', 'toc')).toBe('align')
    expect(advanceFurthestStructureWizardStep('align', 'align')).toBe('extract')
    expect(advanceFurthestStructureWizardStep('extract', 'extract')).toBe('review')
    expect(advanceFurthestStructureWizardStep('review', 'extract')).toBe('review')
  })

  it('gates continue / review', () => {
    expect(canContinueFromToc(false)).toBe(false)
    expect(canContinueFromToc(true)).toBe(true)
    expect(canEnterReview(false)).toBe(false)
    expect(canEnterReview(true)).toBe(true)
  })
})
