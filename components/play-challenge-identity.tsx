'use client'

import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { KnownStudentSummary } from '@/lib/types'
import { getKnownStudentSummaries } from '@/lib/storage'

function studentInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase()
  }
  const single = parts[0] || '?'
  return single.slice(0, Math.min(2, single.length)).toUpperCase()
}

interface PlayChallengeIdentityProps {
  quizName: string
  onContinue: (studentName: string) => void
  onBack: () => void
}

export function PlayChallengeIdentity({ quizName, onContinue, onBack }: PlayChallengeIdentityProps) {
  const [studentName, setStudentName] = useState('')
  const [knownStudents, setKnownStudents] = useState<KnownStudentSummary[]>([])

  useEffect(() => {
    setKnownStudents(getKnownStudentSummaries())
  }, [])

  const canContinue = studentName.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface-1)]">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-blue)] shadow-[0_0_16px_rgba(59,130,246,0.35)]">
            <Zap size={20} className="text-white" fill="currentColor" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-foreground">Who is playing?</h1>
            <p className="truncate text-xs text-muted-foreground">{quizName}</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={onBack} className="border-[var(--border)] shrink-0">
          Back
        </Button>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8">
        <p className="mb-6 text-center text-sm text-muted-foreground">
          We use your name to save challenge progress and unlock harder difficulties in order.
        </p>

        {knownStudents.length > 0 ? (
          <>
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pick a student
            </p>
            <div className="mb-6 flex flex-wrap justify-center gap-3">
              {knownStudents.map((s) => {
                const selected = studentName === s.name
                return (
                  <button
                    key={s.name}
                    type="button"
                    title={s.name}
                    aria-label={`Select ${s.name}`}
                    aria-pressed={selected}
                    onClick={() => setStudentName(s.name)}
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold tracking-tight transition-all duration-200 ${
                      selected
                        ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/25 text-foreground shadow-[0_0_20px_rgba(59,130,246,0.35)] scale-105'
                        : 'border-[var(--border)] bg-[var(--surface-3)] text-foreground hover:border-[var(--brand-blue)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    {studentInitials(s.name)}
                  </button>
                )
              })}
            </div>
          </>
        ) : null}

        <label className="mb-2 block text-xs font-semibold text-muted-foreground">Or type a name</label>
        <Input
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          placeholder="Your name"
          className="h-12 border-[var(--border)] bg-[var(--surface-2)] text-base"
          autoComplete="name"
        />

        <Button
          type="button"
          disabled={!canContinue}
          onClick={() => onContinue(studentName.trim())}
          className="mt-8 w-full bg-[var(--brand-blue)] py-6 text-base font-bold text-white hover:bg-[var(--brand-blue-bright)] disabled:opacity-50"
        >
          Continue to difficulty
        </Button>
      </div>
    </div>
  )
}
