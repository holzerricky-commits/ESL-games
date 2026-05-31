'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import { BookOpen, Calendar, ChevronRight, Map, UserRound } from 'lucide-react'
import type { BookLibraryPayload } from '@/lib/books/types'
import { getStudentDefaultBookUnitForReader } from '@/lib/students/selectors'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { resolveStudentAvatarUrl } from '@/lib/students/student-avatar-url'
import type { StudentListItemView } from '@/lib/students/types'
import { cn } from '@/lib/utils'

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

function StudentCardAvatar({
  studentId,
  name,
  avatarUrl,
  className,
}: {
  studentId: string
  name: string
  avatarUrl?: string
  className?: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const avatarSrc = resolveStudentAvatarUrl(studentId, avatarUrl)
  const showImage = !imageFailed

  return (
    <div
      className={cn(
        'relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] shadow-sm',
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarSrc}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-[color-mix(in_oklab,var(--muted)_40%,var(--surface-2))] text-xl font-bold tracking-wide text-muted-foreground"
          aria-hidden
        >
          {initialsFromName(name)}
        </div>
      )}
      <span className="sr-only">{name} avatar</span>
    </div>
  )
}

function QuickActionButton({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="outline"
          size="icon-sm"
          className="size-8 shrink-0 border-[var(--border)] text-muted-foreground hover:border-[var(--brand-blue)]/50 hover:bg-[var(--surface-2)] hover:text-foreground"
        >
          <Link href={href} aria-label={label}>
            {icon}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
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

  return (
    <article className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-[border-color,box-shadow] hover:border-[var(--brand-blue)]/45 hover:shadow-md">
      <div className="flex gap-4">
        <StudentCardAvatar studentId={student.id} name={student.name} avatarUrl={student.avatarUrl} />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold leading-tight text-foreground">{student.name}</h2>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar size={14} className="shrink-0 opacity-70" aria-hidden />
              <p className="truncate">{student.nextClassLabel}</p>
            </div>
          </div>

          <div className="mt-3 min-w-0 rounded-xl border border-[var(--border)]/80 bg-[var(--surface-2)]/40 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Current lesson</p>
            <p className="mt-1 truncate text-sm font-medium text-foreground">{student.curriculumBookLabel}</p>
            <p className="truncate text-sm text-muted-foreground">{student.curriculumUnitLabel}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Page <span className="font-semibold tabular-nums text-foreground">{student.curriculumPageLabel}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
        <div className="flex items-center gap-1.5">
          <QuickActionButton
            href={booksHref}
            label={`Open library for ${student.name}`}
            icon={<BookOpen size={15} aria-hidden />}
          />
          <QuickActionButton
            href={playHref}
            label={`Open challenge map for ${student.name}`}
            icon={<Map size={15} aria-hidden />}
          />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 min-w-0 border-[var(--border)] px-3 text-foreground hover:border-[var(--brand-blue)]/50"
          >
            <Link href={studentHref} className="inline-flex items-center gap-1.5">
              <UserRound size={14} aria-hidden />
              <span className="truncate">Student</span>
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="h-8 shrink-0 bg-[var(--brand-blue)] px-3 text-white hover:bg-[var(--brand-blue-bright)]"
          >
            <Link href={teacherHref} className="inline-flex items-center gap-1">
              <span>Plan</span>
              <ChevronRight size={14} className="opacity-90" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  )
}
