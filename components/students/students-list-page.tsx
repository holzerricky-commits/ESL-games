'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { teacherFocusRingClass, teacherPrimaryBtnClass } from '@/components/teacher-chrome'
import { AddStudentDialog } from '@/components/students/add-student-dialog'
import { StudentCard } from '@/components/students/student-card'
import { StudentGridCard } from '@/components/students/student-grid-card'
import { StudentsEmptyState } from '@/components/students/students-empty-state'
import { StudentsRosterToolbar } from '@/components/students/students-roster-toolbar'
import { fetchBooksLibraryCached, getBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import type { BookLibraryPayload } from '@/lib/books/types'
import {
  ensureStudentRecordsHydrated,
  STUDENT_RECORDS_HYDRATED_EVENT,
} from '@/lib/local-data/student-records-client'
import {
  getStudentsListView,
  restoreStudentFromBreak,
  STUDENT_LOCAL_DATA_CHANGED_EVENT,
} from '@/lib/students/selectors'
import {
  DEFAULT_STUDENTS_ROSTER_PREFS,
  hasStoredStudentsRosterPrefs,
  persistStudentsRosterPrefs,
  readStudentsRosterPrefs,
  type StudentsRosterPrefs,
  type StudentsRosterSort,
  type StudentsRosterStatusFilter,
  type StudentsRosterViewMode,
} from '@/lib/students/students-roster-prefs'
import {
  filterStudentsByRosterStatus,
  sortStudentsForRoster,
} from '@/lib/students/students-roster-view'
import type { StudentListItemView } from '@/lib/students/types'
import { useToast } from '@/hooks/use-toast'

export function StudentsListPage({
  initialPrefs = DEFAULT_STUDENTS_ROSTER_PREFS,
}: {
  initialPrefs?: StudentsRosterPrefs
}) {
  const { toast } = useToast()
  const [recordsReady, setRecordsReady] = useState(false)
  const [query, setQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  const [bookLibrary, setBookLibrary] = useState<BookLibraryPayload | null>(() => getBooksLibraryCached())
  const [prefs, setPrefs] = useState<StudentsRosterPrefs>(initialPrefs)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  const handleStudentsAdded = () => {
    setReloadTick((tick) => tick + 1)
  }

  useEffect(() => {
    if (!hasStoredStudentsRosterPrefs()) return
    setPrefs(readStudentsRosterPrefs())
  }, [])

  useEffect(() => {
    let cancelled = false
    void ensureStudentRecordsHydrated().then(() => {
      if (!cancelled) setRecordsReady(true)
    })
    const bump = () => setReloadTick((tick) => tick + 1)
    window.addEventListener(STUDENT_RECORDS_HYDRATED_EVENT, bump)
    window.addEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, bump)
    return () => {
      cancelled = true
      window.removeEventListener(STUDENT_RECORDS_HYDRATED_EVENT, bump)
      window.removeEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, bump)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (getBooksLibraryCached()) {
      setBookLibrary(getBooksLibraryCached())
      return
    }
    void fetchBooksLibraryCached()
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

  const allStudents: StudentListItemView[] = useMemo(
    () => (recordsReady ? getStudentsListView(bookLibrary ?? undefined, { includeOnBreak: true }) : []),
    [recordsReady, reloadTick, bookLibrary],
  )

  const activeStudents = useMemo(() => allStudents.filter((s) => !s.isOnBreak), [allStudents])
  const onBreakStudents = useMemo(() => allStudents.filter((s) => s.isOnBreak), [allStudents])
  const needsSetupCount = useMemo(
    () => activeStudents.filter((s) => s.needsSetup).length,
    [activeStudents],
  )

  const displayedStudents = useMemo(() => {
    const byStatus = filterStudentsByRosterStatus(allStudents, prefs.statusFilter)
    const normalized = query.trim().toLowerCase()
    const bySearch = normalized
      ? byStatus.filter((student) => student.name.toLowerCase().includes(normalized))
      : byStatus
    return sortStudentsForRoster(bySearch, prefs.sort)
  }, [allStudents, prefs.statusFilter, prefs.sort, query])

  const handleRestore = (student: StudentListItemView) => {
    const result = restoreStudentFromBreak(student.id)
    if (!result.ok) {
      toast({ variant: 'destructive', title: 'Could not restore', description: result.error })
      return
    }
    setReloadTick((tick) => tick + 1)
    toast({
      title: `${student.name} is active again`,
      description: 'They are back on your student list. Set a weekly time when you are ready.',
    })
  }

  const updatePrefs = (patch: Partial<StudentsRosterPrefs>) => {
    const next = { ...prefsRef.current, ...patch }
    prefsRef.current = next
    persistStudentsRosterPrefs(next)
    setPrefs(next)
  }

  const headerCounts = (() => {
    const parts: string[] = [`${activeStudents.length} active`]
    if (needsSetupCount > 0) parts.push(`${needsSetupCount} need setup`)
    if (onBreakStudents.length > 0) parts.push(`${onBreakStudents.length} on break`)
    return parts.join(' · ')
  })()

  const showingOnBreak = prefs.statusFilter === 'onBreak'

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Students"
        titleClassName="text-3xl sm:text-4xl"
        description={recordsReady ? headerCounts : undefined}
        showDivider={false}
        actions={
          <Button
            type="button"
            className={`${teacherPrimaryBtnClass} ${teacherFocusRingClass}`}
            onClick={() => setShowAddDialog(true)}
          >
            <Plus size={16} strokeWidth={1.75} />
            Add student
          </Button>
        }
      />

      <StudentsRosterToolbar
        query={query}
        onQueryChange={setQuery}
        statusFilter={prefs.statusFilter}
        onStatusFilterChange={(statusFilter: StudentsRosterStatusFilter) => updatePrefs({ statusFilter })}
        sort={prefs.sort}
        onSortChange={(sort: StudentsRosterSort) => updatePrefs({ sort })}
        viewMode={prefs.viewMode}
        onViewModeChange={(viewMode: StudentsRosterViewMode) => updatePrefs({ viewMode })}
        onBreakCount={onBreakStudents.length}
        needsSetupCount={needsSetupCount}
      />

      {!recordsReady ? (
        <p className="text-[13px] text-muted-foreground">Loading…</p>
      ) : displayedStudents.length === 0 ? (
        <StudentsEmptyState
          hasSearch={query.trim().length > 0}
          rosterEmpty={allStudents.length === 0}
          statusFilter={prefs.statusFilter}
        />
      ) : (
        <div
          key={prefs.viewMode}
          className="animate-in fade-in duration-200 motion-reduce:animate-none"
        >
          {prefs.viewMode === 'grid' ? (
            <ul
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              aria-label={showingOnBreak ? 'Students on break' : 'Students'}
            >
              {displayedStudents.map((student) => (
                <li key={student.id}>
                  <StudentGridCard
                    student={student}
                    onBreak={student.isOnBreak}
                    onRestore={student.isOnBreak ? () => handleRestore(student) : undefined}
                    onRemoved={() => setReloadTick((tick) => tick + 1)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-0.5" aria-label={showingOnBreak ? 'Students on break' : 'Students'}>
              {displayedStudents.map((student) => (
                <li key={student.id}>
                  <StudentCard
                    student={student}
                    onBreak={student.isOnBreak}
                    onRestore={student.isOnBreak ? () => handleRestore(student) : undefined}
                    onRemoved={() => setReloadTick((tick) => tick + 1)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <AddStudentDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onStudentsAdded={handleStudentsAdded}
      />
    </div>
  )
}
