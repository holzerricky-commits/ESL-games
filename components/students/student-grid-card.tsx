'use client'

import Link from 'next/link'
import { useState } from 'react'
import { MoreHorizontal, Trash2, Undo2 } from 'lucide-react'
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
          'group relative flex flex-col rounded-xl border border-border bg-card p-4 transition-colors',
          !onBreak && 'cursor-pointer hover:bg-muted/40',
          student.needsSetup && !onBreak && 'bg-accent/20',
          onBreak && 'opacity-90',
        )}
      >
        {!onBreak ? (
          <Link href={openHref} className="absolute inset-0 z-0 rounded-xl" aria-label={openLabel} />
        ) : null}

        <div className="relative z-[1] flex items-start justify-between gap-2">
          <div className="pointer-events-none flex min-w-0 flex-1 flex-col items-start gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-full bg-muted ring-1 ring-border/60">
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
            <div className="min-w-0 w-full">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
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
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{metaLine}</p>
            </div>
          </div>

          <div className="relative z-[1] shrink-0">
            {onBreak ? (
              <div className="flex flex-col items-end gap-1">
                <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={onRestore}>
                  <Undo2 size={14} aria-hidden />
                  Restore
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ui-icon-btn h-8 w-8 text-muted-foreground"
                      aria-label={`More options for ${student.name}`}
                    >
                      <MoreHorizontal size={16} aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ui-icon-btn h-8 w-8 text-muted-foreground"
                    aria-label={`More options for ${student.name}`}
                  >
                    <MoreHorizontal size={16} aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
