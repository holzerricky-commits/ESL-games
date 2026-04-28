'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StudentsSearchBar } from '@/components/students/students-search-bar'
import { StudentCard } from '@/components/students/student-card'
import { StudentsEmptyState } from '@/components/students/students-empty-state'
import type { BookLibraryPayload } from '@/lib/books/types'
import { addStudentRecord, getStudentsListView } from '@/lib/students/selectors'
import { DEFAULT_PLAY_TIER, DIFFICULTY_TIER_LABELS, DIFFICULTY_TIERS } from '@/lib/quiz-difficulty'
import type { StudentListItemView } from '@/lib/students/types'
import type { DifficultyTier } from '@/lib/types'

export function StudentsListPage() {
  const [isHydrated, setIsHydrated] = useState(false)
  const [query, setQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [studentName, setStudentName] = useState('')
  const [className, setClassName] = useState('')
  const [note, setNote] = useState('')
  const [defaultDifficultyTier, setDefaultDifficultyTier] = useState<DifficultyTier>(DEFAULT_PLAY_TIER)
  const [formError, setFormError] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const [bookLibrary, setBookLibrary] = useState<BookLibraryPayload | null>(null)
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/books')
      .then(async (res) => {
        const payload = (await res.json()) as BookLibraryPayload | { error?: string }
        if (!res.ok || !payload || !Array.isArray((payload as BookLibraryPayload).books)) {
          return { books: [] } as BookLibraryPayload
        }
        return payload as BookLibraryPayload
      })
      .then((lib) => {
        if (!cancelled) setBookLibrary(lib)
      })
      .catch(() => {
        if (!cancelled) setBookLibrary({ books: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const students: StudentListItemView[] = useMemo(
    () => (isHydrated ? getStudentsListView(bookLibrary ?? undefined) : []),
    [isHydrated, reloadTick, bookLibrary],
  )

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return students
    return students.filter((student) => student.name.toLowerCase().includes(normalized))
  }, [students, query])

  const resetForm = () => {
    setStudentName('')
    setClassName('')
    setNote('')
    setDefaultDifficultyTier(DEFAULT_PLAY_TIER)
    setFormError('')
  }

  const handleAddStudent = () => {
    const result = addStudentRecord({
      name: studentName,
      className,
      note,
      defaultDifficultyTier,
    })
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    setShowAddDialog(false)
    resetForm()
    setReloadTick((tick) => tick + 1)
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <Button
          className="bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-bright)]"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus size={16} />
          Add Student
        </Button>
      </div>

      <StudentsSearchBar value={query} onChange={setQuery} count={filteredStudents.length} />

      {filteredStudents.length === 0 ? (
        <StudentsEmptyState hasSearch={query.trim().length > 0} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(18.5rem,1fr))]">
          {filteredStudents.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))}
        </div>
      )}

      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>Create a student profile for quick classroom access.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Name *</p>
              <Input
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                placeholder="Student name"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Class (optional)</p>
              <Input
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                placeholder="Class name"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Note (optional)</p>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Any quick note"
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Default quiz difficulty</p>
              <p className="text-xs text-muted-foreground">
                Preselects Easy / Mid / Hard when this student starts a Timed Challenge (they can change it each time).
              </p>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTY_TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setDefaultDifficultyTier(tier)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      defaultDifficultyTier === tier
                        ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/15 text-foreground'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-muted-foreground hover:border-[var(--brand-blue)]/40'
                    }`}
                  >
                    {DIFFICULTY_TIER_LABELS[tier]}
                  </button>
                ))}
              </div>
            </div>
            {formError && <p className="text-sm text-[var(--brand-red)]">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-bright)]" onClick={handleAddStudent}>
              Save Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
