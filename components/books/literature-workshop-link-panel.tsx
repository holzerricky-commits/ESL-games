'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CHECKS_DIALOG_STYLE } from '@/components/books/checks-editor-theme'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ReadingStoryWorkshopLink } from '@/lib/books/reading-story-workshop-link'
import {
  findPeerWorkshopBooks,
  listWorkshopLessonsForPicker,
} from '@/lib/books/reading-story-workshop-peers'
import type { BookRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

export interface LiteratureWorkshopLinkFormProps {
  storyId: string
  literatureBook: BookRecord
  libraryBooks: BookRecord[]
  link: ReadingStoryWorkshopLink | null
  onLinkChange: (link: ReadingStoryWorkshopLink | null) => void
  className?: string
  /** Compact chrome for popovers */
  compact?: boolean
}

/**
 * Literature Stories: pick the matching Workshop week so Generate uses that skill frame.
 * Frame scan lives separately in the Stories fuel box.
 */
export function LiteratureWorkshopLinkForm({
  storyId,
  literatureBook,
  libraryBooks,
  link,
  onLinkChange,
  className,
  compact = false,
}: LiteratureWorkshopLinkFormProps) {
  const peers = useMemo(
    () => findPeerWorkshopBooks(libraryBooks, literatureBook),
    [libraryBooks, literatureBook],
  )

  const [busy, setBusy] = useState(false)
  const [bookId, setBookId] = useState(link?.workshopBookId ?? peers[0]?.id ?? '')
  const [unitId, setUnitId] = useState(link?.workshopUnitId ?? '')
  const [lessonId, setLessonId] = useState(link?.workshopLessonId ?? '')

  useEffect(() => {
    setBookId(link?.workshopBookId ?? peers[0]?.id ?? '')
    setUnitId(link?.workshopUnitId ?? '')
    setLessonId(link?.workshopLessonId ?? '')
  }, [link, peers])

  const workshopBook = peers.find((b) => b.id === bookId) ?? null
  const units = workshopBook?.units ?? []
  const unit = units.find((u) => u.id === unitId) ?? null
  const lessons = unit ? listWorkshopLessonsForPicker(unit) : []

  useEffect(() => {
    if (!bookId && peers[0]) setBookId(peers[0].id)
  }, [bookId, peers])

  useEffect(() => {
    if (unitId && units.some((u) => u.id === unitId)) return
    if (units[0]) setUnitId(units[0].id)
    else setUnitId('')
  }, [bookId, unitId, units])

  useEffect(() => {
    if (lessonId && lessons.some((l) => l.id === lessonId)) return
    if (lessons[0]) setLessonId(lessons[0].id)
    else setLessonId('')
  }, [unitId, lessonId, lessons])

  async function saveLink() {
    if (!bookId || !unitId || !lessonId) {
      toast.error('Pick a Workshop book, unit, and lesson.')
      return
    }
    setBusy(true)
    try {
      const lessonTitle = lessons.find((l) => l.id === lessonId)?.title
      const res = await fetch('/api/reading-stories/workshop-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          storyId,
          workshopBookId: bookId,
          workshopUnitId: unitId,
          workshopLessonId: lessonId,
          workshopLessonTitle: lessonTitle,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        link?: ReadingStoryWorkshopLink
        error?: string
      }
      if (!data.ok || !data.link) {
        toast.error(data.error ?? 'Could not save Workshop link.')
        return
      }
      onLinkChange(data.link)
      toast.success('Linked to Workshop lesson — scan that frame for smarter checks.')
    } catch {
      toast.error('Could not save Workshop link.')
    } finally {
      setBusy(false)
    }
  }

  async function clearLink() {
    setBusy(true)
    try {
      const res = await fetch('/api/reading-stories/workshop-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', storyId }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!data.ok) {
        toast.error(data.error ?? 'Could not clear link.')
        return
      }
      onLinkChange(null)
      toast.success('Workshop link cleared.')
    } catch {
      toast.error('Could not clear link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('space-y-3', className)} style={CHECKS_DIALOG_STYLE}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
            link
              ? 'bg-[var(--checks-ok-soft)] text-[var(--checks-ok)]'
              : 'bg-[var(--checks-warn-soft)] text-[var(--checks-ink)]',
          )}
        >
          {link ? 'Workshop linked' : 'Needs Workshop link'}
        </span>
        {link?.workshopLessonTitle ? (
          <span className="truncate text-[11px] text-[var(--checks-muted)]">
            {link.workshopLessonTitle}
          </span>
        ) : null}
      </div>

      {peers.length === 0 ? (
        <p className="text-sm text-[var(--checks-muted)]">
          No Workshop book found for this series/grade. Add a Workshop book in the library first.
        </p>
      ) : (
        <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-3')}>
          <div className="space-y-1">
            <Label className="text-[11px] text-[var(--checks-muted)]">Workshop book</Label>
            <Select value={bookId || undefined} onValueChange={setBookId}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Book" />
              </SelectTrigger>
              <SelectContent>
                {peers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-[var(--checks-muted)]">Unit</Label>
            <Select value={unitId || undefined} onValueChange={setUnitId}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-[var(--checks-muted)]">Lesson / week</Label>
            <Select value={lessonId || undefined} onValueChange={setLessonId}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Lesson" />
              </SelectTrigger>
              <SelectContent>
                {lessons.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8"
          disabled={busy || peers.length === 0 || !bookId || !unitId || !lessonId}
          onClick={() => void saveLink()}
        >
          {busy ? 'Saving…' : link ? 'Update link' : 'Save link'}
        </Button>
        {link ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-[var(--checks-muted)]"
            disabled={busy}
            onClick={() => void clearLink()}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** @deprecated Prefer LiteratureWorkshopLinkForm — kept for any external imports. */
export const LiteratureWorkshopLinkPanel = LiteratureWorkshopLinkForm
