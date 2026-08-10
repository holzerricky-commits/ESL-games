'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getSavedWordsForStudent } from '@/lib/local-data/saved-words-disk-client'
import {
  applyWordReviewToNextClass,
  getStudentProfileView,
  getStudentWordReviewView,
  removeStudentWordReviewEntry,
  seedStudentWordReviewFromSignals,
  STUDENT_LOCAL_DATA_CHANGED_EVENT,
  upsertStudentWordReviewEntry,
} from '@/lib/students/selectors'
import type { StudentProfileView } from '@/lib/students/types'
import type { StudentWordReviewStrength } from '@/lib/types'

interface StudentWordsTabProps {
  student: StudentProfileView
  studentId: string
  onDataUpdated?: () => void
}

function sourceLabel(source: string): string {
  if (source === 'class_outcome') return 'From class history'
  if (source === 'saved_notebook') return 'Saved in book'
  if (source === 'ai_prep') return 'From last prep'
  if (source === 'seeded') return 'Imported'
  return 'Added by you'
}

function WordListSection({
  title,
  emptyLabel,
  rows,
  oppositeStrength,
  onMove,
  onRemove,
}: {
  title: string
  emptyLabel: string
  rows: Array<{ word: string; source: string }>
  oppositeStrength: StudentWordReviewStrength
  onMove: (word: string, strength: StudentWordReviewStrength) => void
  onRemove: (word: string) => void
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li
              key={row.word}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{row.word}</p>
                <p className="text-[11px] text-muted-foreground">{sourceLabel(row.source)}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => onMove(row.word, oppositeStrength)}>
                  Move
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(row.word)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function StudentWordsTab({ student, studentId, onDataUpdated }: StudentWordsTabProps) {
  const [newWord, setNewWord] = useState('')
  const [newStrength, setNewStrength] = useState<StudentWordReviewStrength>('needs_practice')
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)

  const liveStudent = useMemo(
    () => getStudentProfileView(studentId) ?? student,
    [student, studentId, version],
  )

  const reviewView = useMemo(() => {
    const result = getStudentWordReviewView(studentId, getSavedWordsForStudent(studentId))
    if ('error' in result) {
      return {
        needsPractice: [],
        goingWell: [],
        hasPersistedEntries: false,
        canImport: false,
      }
    }
    return result
  }, [studentId, version])

  function refresh() {
    setVersion((v) => v + 1)
    onDataUpdated?.()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(STUDENT_LOCAL_DATA_CHANGED_EVENT, { detail: { studentId } }))
    }
  }

  function handleAddWord() {
    setBusy(true)
    const result = upsertStudentWordReviewEntry(studentId, newWord, newStrength)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setNewWord('')
    toast.success('Word saved.')
    refresh()
  }

  function handleMove(word: string, strength: StudentWordReviewStrength) {
    setBusy(true)
    const result = upsertStudentWordReviewEntry(studentId, word, strength)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    refresh()
  }

  function handleRemove(word: string) {
    setBusy(true)
    const result = removeStudentWordReviewEntry(studentId, word)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    refresh()
  }

  function handleImport() {
    setBusy(true)
    const result = seedStudentWordReviewFromSignals(studentId, getSavedWordsForStudent(studentId))
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Imported ${result.count} word${result.count === 1 ? '' : 's'}.`)
    refresh()
  }

  function handleApplyToNextClass() {
    setBusy(true)
    const result = applyWordReviewToNextClass(studentId, getSavedWordsForStudent(studentId))
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Set ${result.wordCount} target word${result.wordCount === 1 ? '' : 's'} on the next class.`)
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <h2 className="text-base font-semibold text-foreground">Word review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Words here feed class prep and target vocabulary for {liveStudent.name}. Edit what needs practice before you
          generate an outline.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <Link href={`/students/${studentId}?tab=classes`} className="font-medium text-[var(--brand-blue)] hover:underline">
            Back to class prep
          </Link>
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="text-sm font-semibold text-foreground">Add a word</h3>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            placeholder="Type a word"
            disabled={busy}
          />
          <select
            className="rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
            value={newStrength}
            onChange={(e) => setNewStrength(e.target.value as StudentWordReviewStrength)}
            disabled={busy}
          >
            <option value="needs_practice">Needs practice</option>
            <option value="strong">Going well</option>
          </select>
          <Button type="button" onClick={handleAddWord} disabled={busy || !newWord.trim()}>
            Add
          </Button>
        </div>
      </div>

      {!reviewView.hasPersistedEntries && reviewView.canImport ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-muted-foreground">
            Import words gathered from class history, saved notebook entries, and recent prep.
          </p>
          <Button type="button" className="mt-3" variant="outline" onClick={handleImport} disabled={busy}>
            Import from class history
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <WordListSection
          title="Needs practice"
          emptyLabel="No words flagged for practice yet."
          rows={reviewView.needsPractice}
          oppositeStrength="strong"
          onMove={handleMove}
          onRemove={handleRemove}
        />
        <WordListSection
          title="Going well"
          emptyLabel="No strong words saved yet."
          rows={reviewView.goingWell}
          oppositeStrength="needs_practice"
          onMove={handleMove}
          onRemove={handleRemove}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleApplyToNextClass} disabled={busy || reviewView.needsPractice.length === 0}>
          Use for next class
        </Button>
      </div>
    </div>
  )
}
