'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { resolveStudentAvatarUrl } from '@/lib/students/student-avatar-url'
import { ensureStudentRecordsHydrated } from '@/lib/local-data/student-records-client'
import type { BookLibraryPayload } from '@/lib/books/types'
import {
  classEntryActionLabel,
  formatClassCountdown,
  resolveClassEntryAction,
} from '@/lib/students/class-schedule-lifecycle'
import { clearMapBookOverlayOpenSession } from '@/lib/students/map-book-overlay-session'
import {
  buildPrepareLessonMapHref,
  buildStudentMapReaderHref,
  getStudentDefaultBookUnitForReader,
  startStudentClassSession,
} from '@/lib/students/selectors'
import type { StudentClassSessionView, StudentProfileView } from '@/lib/students/types'

interface StudentHomeHeaderProps {
  student: StudentProfileView
  bookLibrary?: BookLibraryPayload | null
  sections?: React.ReactNode
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function resolveSpotlightSession(student: StudentProfileView): StudentClassSessionView | null {
  const sessions = student.scheduledClasses ?? []
  const live = sessions.find((session) => session.status === 'in_progress')
  if (live) return live
  return (
    [...sessions]
      .filter((session) => session.status === 'planned' || session.status === 'prepared')
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0] ?? null
  )
}

function bookPlaceLabel(student: StudentProfileView): string {
  if (student.curriculumPageLabel && student.curriculumPageLabel !== '—') {
    return `${student.curriculumBookLabel} · p. ${student.curriculumPageLabel}`
  }
  return student.curriculumBookLabel || 'No book assigned'
}

export function StudentHomeHeader({ student, bookLibrary = null, sections }: StudentHomeHeaderProps) {
  const router = useRouter()
  const [imageFailed, setImageFailed] = useState(false)
  const [startBusy, setStartBusy] = useState(false)
  const avatarSrc = resolveStudentAvatarUrl(student.id, student.avatarUrl)
  const spotlight = useMemo(() => resolveSpotlightSession(student), [student])
  const defaultBook = useMemo(
    () => getStudentDefaultBookUnitForReader(student.id, bookLibrary),
    [student.id, bookLibrary],
  )
  const nowMs = Date.now()
  const entry = spotlight ? resolveClassEntryAction(spotlight, nowMs) : 'none'
  const canEnter =
    spotlight != null &&
    spotlight.status !== 'completed' &&
    spotlight.status !== 'cancelled' &&
    (entry === 'enter' || entry === 'continue')
  const canOpenBook = defaultBook != null
  const countdown = spotlight ? formatClassCountdown(spotlight.scheduledFor, nowMs) : null
  const enterLabel = entry === 'continue' || entry === 'enter' ? classEntryActionLabel(entry) : 'Enter'

  async function handleEnterClass() {
    if (!spotlight || !canEnter) {
      toast.error('No upcoming class to enter. Book one on the calendar first.')
      return
    }
    setStartBusy(true)
    try {
      await ensureStudentRecordsHydrated()
      if (spotlight.status !== 'in_progress') {
        const started = startStudentClassSession(student.id, spotlight.id)
        if (!started.ok) {
          toast.error(started.error)
          return
        }
      }
      clearMapBookOverlayOpenSession(student.id)
      router.push(buildPrepareLessonMapHref(student.id, spotlight.id, bookLibrary))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not enter class.')
    } finally {
      setStartBusy(false)
    }
  }

  function handleOpenBook() {
    if (!defaultBook) {
      toast.error('Assign a book on the Books tab first.')
      return
    }
    clearMapBookOverlayOpenSession(student.id)
    router.push(
      buildStudentMapReaderHref({
        studentId: student.id,
        bookId: defaultBook.bookId,
        unitId: defaultBook.unitId,
        openBook: true,
      }),
    )
  }

  return (
    <div className="mb-6 border-b border-border pb-4">
      <div className="mb-4">
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Students
        </Link>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border/60">
          {!imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarSrc}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-sm font-medium text-muted-foreground"
              aria-hidden
            >
              {initialsFromName(student.name)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{student.name}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">Next:</span>{' '}
            {student.nextClassLabel || 'No upcoming class'}
            {countdown ? ` · ${countdown}` : ''}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">Book:</span> {bookPlaceLabel(student)}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="ml-auto shrink-0"
          disabled={!canOpenBook}
          onClick={handleOpenBook}
          title={canOpenBook ? 'Open book at last stop' : 'Assign a book on the Books tab first'}
          aria-label={canOpenBook ? 'Open book at last stop' : 'Open book unavailable — assign a book first'}
        >
          <BookOpen className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {canEnter ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={startBusy}
            onClick={() => void handleEnterClass()}
            title={enterLabel}
          >
            <Play className="h-4 w-4" aria-hidden />
            {startBusy ? '…' : enterLabel}
          </Button>
        </div>
      ) : null}

      {sections ? <div className="mt-4">{sections}</div> : null}
    </div>
  )
}
