'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { buildBooksPageHref } from '@/lib/books/book-setup-copy'
import type { ReadingCheckPack } from '@/lib/books/reading-check-pack'
import type { ReadingStoryMap } from '@/lib/books/reading-story-map'
import {
  pickReadingStoryForPrepareGlance,
  resolveReadingCheckPrepareGlance,
  type ReadingCheckPrepareGlanceKind,
} from '@/lib/books/reading-check-prepare-glance'
import { buildReadingChecksPrepHref } from '@/lib/students/selectors'
import { cn } from '@/lib/utils'

export interface ReadingCheckPrepareGlanceLinkProps {
  bookId?: string | null
  unitId?: string | null
  lessonId?: string | null
  partId?: string | null
  studentId?: string | null
  /** When set with studentId, tap opens Prep with the checks panel (not Books desk). */
  classSessionId?: string | null
  className?: string
}

function toneClass(kind: ReadingCheckPrepareGlanceKind): string {
  if (kind === 'approved') return 'text-emerald-800 hover:text-emerald-950'
  if (kind === 'needs_review') return 'text-amber-800 hover:text-amber-950'
  return 'text-muted-foreground hover:text-foreground'
}

/**
 * Short Prepare / next-class status for reading checks.
 * With a class session: opens Prep checks panel. Otherwise: Books → Stories.
 */
export function ReadingCheckPrepareGlanceLink({
  bookId,
  unitId,
  lessonId,
  partId,
  studentId,
  classSessionId,
  className,
}: ReadingCheckPrepareGlanceLinkProps) {
  const [label, setLabel] = useState<string | null>(null)
  const [kind, setKind] = useState<ReadingCheckPrepareGlanceKind>('none')
  const [href, setHref] = useState<string | null>(null)

  useEffect(() => {
    const bid = bookId?.trim() ?? ''
    const uid = unitId?.trim() ?? ''
    const sid = studentId?.trim() ?? ''
    const sessionId = classSessionId?.trim() ?? ''
    if (!bid || !uid) {
      setLabel(null)
      setHref(null)
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const [storiesRes, packsRes] = await Promise.all([
          fetch(`/api/reading-stories?bookId=${encodeURIComponent(bid)}`),
          fetch(`/api/reading-stories/checks?bookId=${encodeURIComponent(bid)}`),
        ])
        const storiesData = (await storiesRes.json()) as {
          ok?: boolean
          stories?: ReadingStoryMap[]
        }
        const packsData = (await packsRes.json()) as {
          ok?: boolean
          packs?: ReadingCheckPack[]
        }
        if (cancelled || !storiesData.ok) return

        const story = pickReadingStoryForPrepareGlance({
          stories: storiesData.stories ?? [],
          bookId: bid,
          unitId: uid,
          lessonId,
          partId,
        })

        const pack =
          story && packsData.ok
            ? (packsData.packs ?? []).find((p) => p.storyId === story.id) ?? null
            : null

        const glance = resolveReadingCheckPrepareGlance(pack)
        if (cancelled) return

        setKind(glance.kind)
        setLabel(glance.label)
        if (sid && sessionId) {
          setHref(buildReadingChecksPrepHref(sid, sessionId))
        } else {
          setHref(
            buildBooksPageHref({
              book: bid,
              unit: story?.unitId ?? uid,
              tab: 'stories',
              student: studentId,
              story: story?.id ?? null,
            }),
          )
        }
      } catch {
        if (!cancelled) {
          setLabel(null)
          setHref(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [bookId, unitId, lessonId, partId, studentId, classSessionId])

  if (!label || !href) return null

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex text-xs underline-offset-2 hover:underline',
        toneClass(kind),
        className,
      )}
      title={
        classSessionId
          ? 'Open reading checks in Prep'
          : 'Open Stories desk for this reading'
      }
    >
      {label}
    </Link>
  )
}
