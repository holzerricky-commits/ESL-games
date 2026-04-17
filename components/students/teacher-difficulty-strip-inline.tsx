'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DIFFICULTY_TIER_LABELS, DIFFICULTY_TIERS } from '@/lib/quiz-difficulty'
import { updateStudentDefaultDifficultyTier } from '@/lib/students/selectors'
import type { StudentProfileView } from '@/lib/students/types'
import type { DifficultyTier } from '@/lib/types'

interface TeacherDifficultyStripInlineProps {
  student: StudentProfileView
  studentId: string
  onUpdated: () => void
}

/** Compact row for the profile header strip (teacher plan only). */
export function TeacherDifficultyStripInline({ student, studentId, onUpdated }: TeacherDifficultyStripInlineProps) {
  const [tier, setTier] = useState<DifficultyTier>(student.defaultDifficultyTier)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    setTier(student.defaultDifficultyTier)
    setStatus('idle')
  }, [student.defaultDifficultyTier])

  const dirty = tier !== student.defaultDifficultyTier

  const handleSave = () => {
    setSaving(true)
    setStatus('idle')
    const result = updateStudentDefaultDifficultyTier(studentId, tier)
    setSaving(false)
    if (result.ok) {
      setStatus('saved')
      onUpdated()
    } else {
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Student&apos;s level:
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {DIFFICULTY_TIERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTier(t)
              setStatus('idle')
            }}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
              tier === t
                ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/15 text-foreground'
                : 'border-[var(--border)] bg-[var(--surface-3)] text-muted-foreground hover:border-[var(--brand-blue)]/40'
            }`}
          >
            {DIFFICULTY_TIER_LABELS[t]}
          </button>
        ))}
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!dirty || saving}
          variant="outline"
          className="h-8 border-[var(--border)] px-3 text-xs font-semibold"
        >
          {saving ? '…' : 'Save'}
        </Button>
        {status === 'saved' && (
          <span className="text-xs font-medium text-[var(--brand-green)]" aria-live="polite">
            Saved
          </span>
        )}
        {status === 'error' && (
          <span className="text-xs font-medium text-[var(--brand-red)]" aria-live="polite">
            Error
          </span>
        )}
      </div>
    </div>
  )
}
