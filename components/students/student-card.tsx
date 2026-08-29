'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronRight, MoreHorizontal, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RemoveStudentDialog } from '@/components/students/remove-student-dialog'
import {
  teacherFocusRingClass,
  teacherMenuContentClass,
  teacherQuietBtnClass,
} from '@/components/teacher-chrome'
import { resolveStudentAvatarUrl } from '@/lib/students/student-avatar-url'
import {
  bookPageLabelForStudent,
  openHrefForStudent,
} from '@/lib/students/students-roster-view'
import type { StudentListItemView } from '@/lib/students/types'
import { cn } from '@/lib/utils'

interface StudentCardProps {
  student: StudentListItemView
  onRemoved?: () => void
  /** When true, show restore instead of the usual open action. */
  onBreak?: boolean
  onRestore?: () => void
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
}: {
  studentId: string
  name: string
  avatarUrl?: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const avatarSrc = resolveStudentAvatarUrl(studentId, avatarUrl)
  const showImage = !imageFailed

  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--surface-3)]">
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
          className="chrome-avatar h-full w-full text-[11px]"
          aria-hidden
        >
          {initialsFromName(name)}
        </div>
      )}
      <span className="sr-only">{name} avatar</span>
    </div>
  )
}

function StatusPill({ label, tone }: { label: string; tone: 'setup' | 'break' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight',
        tone === 'break'
          ? 'bg-[var(--surface-3)] text-muted-foreground'
          : 'bg-[color-mix(in_srgb,var(--brand-blue)_12%,white)] text-[var(--brand-blue)]',
      )}
    >
      {label}
    </span>
  )
}

function RowMoreMenu({
  studentName,
  deleteOnly,
  onRemove,
}: {
  studentName: string
  deleteOnly?: boolean
  onRemove: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn('chrome-icon-btn h-8 w-8', teacherFocusRingClass)}
          aria-label={`More options for ${studentName}`}
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={teacherMenuContentClass}>
        <DropdownMenuItem variant="destructive" onClick={onRemove}>
          <Trash2 size={14} aria-hidden />
          {deleteOnly ? 'Delete forever' : 'Remove…'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function StudentCard({ student, onRemoved, onBreak = false, onRestore }: StudentCardProps) {
  const [removeOpen, setRemoveOpen] = useState(false)
  const openHref = openHrefForStudent(student)
  const bookPageLabel = bookPageLabelForStudent(student)
  const openLabel = student.needsSetup ? `Finish setup for ${student.name}` : `Open ${student.name}`

  const metaLine = onBreak
    ? 'History kept · weekly times freed'
    : [student.nextClassLabel, bookPageLabel].filter(Boolean).join(' · ')

  return (
    <>
      <article
        className={cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 chrome-motion',
          !onBreak && 'cursor-pointer hover:bg-[var(--chrome-pill-hover)]',
          student.needsSetup && !onBreak && 'bg-[color-mix(in_srgb,var(--brand-blue)_6%,transparent)]',
          onBreak && 'opacity-90',
        )}
      >
        {!onBreak ? (
          <Link href={openHref} className="absolute inset-0 z-0 rounded-xl" aria-label={openLabel} />
        ) : null}

        <div className="pointer-events-none relative z-[1] flex min-w-0 flex-1 items-center gap-3">
          <StudentCardAvatar studentId={student.id} name={student.name} avatarUrl={student.avatarUrl} />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-foreground">
                {student.name}
              </h2>
              {onBreak ? (
                <StatusPill label="On break" tone="break" />
              ) : student.needsSetup ? (
                <StatusPill label="Set up" tone="setup" />
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{metaLine}</p>
          </div>
        </div>

        <div className="relative z-[1] flex shrink-0 items-center gap-1">
          {onBreak ? (
            <>
              <Button
                type="button"
                variant="secondary"
                className={cn(teacherQuietBtnClass, teacherFocusRingClass, 'gap-1.5')}
                onClick={onRestore}
              >
                <Undo2 size={14} strokeWidth={1.75} aria-hidden />
                Restore
              </Button>
              <RowMoreMenu
                studentName={student.name}
                deleteOnly
                onRemove={() => setRemoveOpen(true)}
              />
            </>
          ) : (
            <div className="relative h-8 w-8">
              <ChevronRight
                size={16}
                strokeWidth={1.75}
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-0 m-auto text-muted-foreground/70 transition-opacity',
                  'opacity-0 [@media(hover:hover)]:opacity-100',
                  '[@media(hover:hover)]:group-hover:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-0',
                )}
              />
              <div
                className={cn(
                  'absolute inset-0 transition-opacity',
                  'opacity-100 [@media(hover:hover)]:opacity-0',
                  '[@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100',
                )}
              >
                <RowMoreMenu studentName={student.name} onRemove={() => setRemoveOpen(true)} />
              </div>
            </div>
          )}
        </div>
      </article>

      <RemoveStudentDialog
        studentId={student.id}
        studentName={student.name}
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        onRemoved={onRemoved}
        deleteOnly={onBreak}
      />
    </>
  )
}
