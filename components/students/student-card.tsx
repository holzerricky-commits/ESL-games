'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronRight, MoreHorizontal, Trash2, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RemoveStudentDialog } from '@/components/students/remove-student-dialog'
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
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border/60">
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
          className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground"
          aria-hidden
        >
          {initialsFromName(name)}
        </div>
      )}
      <span className="sr-only">{name} avatar</span>
    </div>
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ui-icon-btn h-8 w-8 text-muted-foreground"
          aria-label={`More options for ${studentName}`}
        >
          <MoreHorizontal size={16} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
  /** Phase 1: one door — still class prep / setup until Phase 2 shell. */
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
          'ui-row group relative items-center gap-3',
          !onBreak && 'cursor-pointer',
          student.needsSetup && !onBreak && 'bg-accent/30',
          onBreak && 'opacity-90',
        )}
      >
        {!onBreak ? (
          <Link href={openHref} className="absolute inset-0 z-0 rounded-lg" aria-label={openLabel} />
        ) : null}

        <div className="pointer-events-none relative z-[1] flex min-w-0 flex-1 items-center gap-3">
          <StudentCardAvatar studentId={student.id} name={student.name} avatarUrl={student.avatarUrl} />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2
                className={cn(
                  'min-w-0 truncate text-sm font-medium text-foreground',
                  !onBreak && 'group-hover:text-primary',
                )}
              >
                {student.name}
              </h2>
              {onBreak ? (
                <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                  On break
                </Badge>
              ) : student.needsSetup ? (
                <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                  Set up
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{metaLine}</p>
          </div>
        </div>

        <div className="relative z-[1] flex shrink-0 items-center gap-1">
          {onBreak ? (
            <>
              <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={onRestore}>
                <Undo2 size={14} aria-hidden />
                Restore
              </Button>
              <RowMoreMenu
                studentName={student.name}
                deleteOnly
                onRemove={() => setRemoveOpen(true)}
              />
            </>
          ) : (
            /*
              One trailing slot — never two icons side by side.
              Hover devices: chevron at rest, ⋯ on hover/focus.
              Touch: ⋯ only (no hover), so remove stays reachable.
            */
            <div className="relative h-8 w-8">
              <ChevronRight
                size={16}
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
