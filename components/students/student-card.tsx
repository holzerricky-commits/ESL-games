'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { BookOpen, Calendar, Play } from 'lucide-react'
import type { BookLibraryPayload } from '@/lib/books/types'
import { getStudentDefaultBookUnitForReader } from '@/lib/students/selectors'
import { Button } from '@/components/ui/button'
import { StudentCardLessonPreview } from '@/components/students/student-card-lesson-preview'
import type { StudentListItemView } from '@/lib/students/types'

interface StudentCardProps {
  student: StudentListItemView
  library?: BookLibraryPayload | null
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function StudentCard({ student, library = null }: StudentCardProps) {
  const studentHref = `/students/${student.id}`
  const teacherHref = `/students/${student.id}/plan`
  const playHref = `/students/${student.id}/map`
  const booksHref = useMemo(() => {
    const base = `/books?student=${encodeURIComponent(student.id)}`
    const pick = library ? getStudentDefaultBookUnitForReader(student.id, library) : null
    if (!pick) return base
    return `${base}&book=${encodeURIComponent(pick.bookId)}&unit=${encodeURIComponent(pick.unitId)}`
  }, [student.id, library])
  const avatarSrc = student.avatarUrl?.trim()

  const thumbLabel =
    student.curriculumThumbPage != null
      ? `${student.curriculumUnitLabel} · page ${student.curriculumThumbPage}`
      : 'Lesson preview'

  return (
    <article className="flex h-full min-h-[248px] flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-[border-color,box-shadow] hover:border-[var(--brand-blue)]/45 hover:shadow-md">
      <div className="flex items-start gap-3">
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc}
            alt={`${student.name} avatar`}
            className="h-11 w-11 shrink-0 rounded-full border border-[var(--border)] object-cover"
          />
        ) : (
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-sm font-bold text-muted-foreground"
            aria-label={`${student.name} placeholder avatar`}
          >
            {initialsFromName(student.name)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-foreground">{student.name}</h2>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar size={14} aria-hidden />
            <p className="truncate">{student.nextClassLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-1 gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Current lesson</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{student.curriculumBookLabel}</p>
          <p className="truncate text-sm text-muted-foreground">{student.curriculumUnitLabel}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Page <span className="font-medium text-foreground">{student.curriculumPageLabel}</span>
          </p>
        </div>

        <div className="flex w-[72px] shrink-0 items-start justify-end">
          {student.curriculumThumbFilePath &&
          student.curriculumThumbUnitId &&
          student.curriculumThumbPage != null ? (
            <StudentCardLessonPreview
              filePath={student.curriculumThumbFilePath}
              unitId={student.curriculumThumbUnitId}
              page={student.curriculumThumbPage}
              label={thumbLabel}
              className="rounded-md"
            />
          ) : (
            <div
              className="flex aspect-[1/1.414] w-[72px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-2)]/50 text-muted-foreground"
              aria-hidden
            >
              <BookOpen size={16} strokeWidth={1.75} className="opacity-55" />
              <span className="px-1 text-center text-[10px] leading-tight">No preview</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Link href={booksHref} aria-label={`Open library reader for ${student.name}`}>
            <BookOpen size={13} className="mr-1" />
            Book
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Link href={playHref} aria-label={`Open fullscreen map play for ${student.name}`}>
            <Play size={13} className="mr-1" />
            Play
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 border-[var(--border)] text-foreground hover:border-[var(--brand-blue)]"
        >
          <Link href={studentHref} aria-label={`Open student view for ${student.name}`}>
            Student
          </Link>
        </Button>
        <Button asChild size="sm" className="h-8 bg-[var(--brand-blue)] px-3 text-white hover:bg-[var(--brand-blue-bright)]">
          <Link href={teacherHref} aria-label={`Open teacher plan view for ${student.name}`}>
            Teacher
          </Link>
        </Button>
      </div>
    </article>
  )
}
