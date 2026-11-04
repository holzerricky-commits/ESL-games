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
    expect(initialStructureWizardStep(false)).toBe('align')
  })

  it('only allows clicking up to furthest unlocked step', () => {
    expect(isStructureWizardStepReachable('align', 'align')).toBe(true)
    expect(isStructureWizardStepReachable('toc', 'align')).toBe(false)
    expect(isStructureWizardStepReachable('toc', 'toc')).toBe(true)
    expect(isStructureWizardStepReachable('extract', 'toc')).toBe(false)
    expect(isStructureWizardStepReachable('review', 'extract')).toBe(false)
  })

  it('advances furthest after completing a step', () => {
    expect(advanceFurthestStructureWizardStep('align', 'align')).toBe('toc')
    expect(advanceFurthestStructureWizardStep('toc', 'toc')).toBe('extract')
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
