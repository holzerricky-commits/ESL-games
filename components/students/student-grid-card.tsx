'use client'

import Link from 'next/link'
import { useState } from 'react'
import { MoreHorizontal, Trash2, Undo2 } from 'lucide-react'
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

interface StudentGridCardProps {
  student: StudentListItemView
  onRemoved?: () => void
  onBreak?: boolean
  onRestore?: () => void
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
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

export function StudentGridCard({
  student,
  onRemoved,
  onBreak = false,
  onRestore,
}: StudentGridCardProps) {
  const [removeOpen, setRemoveOpen] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const openHref = openHrefForStudent(student)
  const openLabel = student.needsSetup ? `Finish setup for ${student.name}` : `Open ${student.name}`
  const avatarSrc = resolveStudentAvatarUrl(student.id, student.avatarUrl)
  const bookPageLabel = bookPageLabelForStudent(student)
  const metaLine = onBreak
    ? 'History kept · weekly times freed'
    : [student.nextClassLabel, bookPageLabel].filter(Boolean).join(' · ')

  return (
    <>
      <article
        className={cn(
          'group relative flex flex-col rounded-[18px] bg-[var(--surface-2)] p-4 chrome-motion',
          !onBreak && 'cursor-pointer hover:bg-[var(--chrome-pill-hover)]',
          student.needsSetup && !onBreak && 'bg-[color-mix(in_srgb,var(--brand-blue)_6%,var(--surface-2))]',
          onBreak && 'opacity-90',
        )}
      >
        {!onBreak ? (
          <Link href={openHref} className="absolute inset-0 z-0 rounded-[18px]" aria-label={openLabel} />
        ) : null}

        <div className="relative z-[1] flex items-start justify-between gap-2">
          <div className="pointer-events-none flex min-w-0 flex-1 flex-col items-start gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-full bg-[var(--surface-3)]">
              {!imageFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="chrome-avatar h-full w-full text-sm" aria-hidden>
                  {initialsFromName(student.name)}
                </div>
              )}
            </div>
            <div className="min-w-0 w-full">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="min-w-0 truncate text-[17px] font-semibold tracking-tight text-foreground">
                  {student.name}
                </h2>
                {onBreak ? (
                  <StatusPill label="On break" tone="break" />
                ) : student.needsSetup ? (
                  <StatusPill label="Set up" tone="setup" />
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{metaLine}</p>
            </div>
          </div>

          <div className="relative z-[1] shrink-0">
            {onBreak ? (
              <div className="flex flex-col items-end gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  className={cn(teacherQuietBtnClass, teacherFocusRingClass, 'gap-1.5')}
                  onClick={onRestore}
                >
                  <Undo2 size={14} strokeWidth={1.75} aria-hidden />
                  Restore
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn('chrome-icon-btn h-8 w-8', teacherFocusRingClass)}
                      aria-label={`More options for ${student.name}`}
                    >
                      <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={teacherMenuContentClass}>
                    <DropdownMenuItem variant="destructive" onClick={() => setRemoveOpen(true)}>
                      <Trash2 size={14} aria-hidden />
                      Delete forever
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn('chrome-icon-btn h-8 w-8', teacherFocusRingClass)}
                    aria-label={`More options for ${student.name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={teacherMenuContentClass}>
                  <DropdownMenuItem variant="destructive" onClick={() => setRemoveOpen(true)}>
                    <Trash2 size={14} aria-hidden />
                    Remove…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
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
