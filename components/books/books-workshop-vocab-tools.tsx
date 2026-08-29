'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClassPrepVocabEditor } from '@/components/students/class-prep-vocab-editor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { BooksWorkshopOpenRequest } from '@/lib/books/books-workshop'
import { cn } from '@/lib/utils'

const WORKSHOP_DIALOG_Z = 'z-[90]'

export type BooksWorkshopVocabToolsStatus = {
  wordsReady: boolean
  loading: boolean
}

interface BooksWorkshopVocabToolsProps {
  request: BooksWorkshopOpenRequest
  wordsOpen: boolean
  onWordsOpenChange: (open: boolean) => void
  onStatusChange?: (status: BooksWorkshopVocabToolsStatus) => void
}

/**
 * Workshop vocab host — place-bar Words dialog above the book (z-90).
 * Reuses the same editor as the part desk.
 */
export function BooksWorkshopVocabTools({
  request,
  wordsOpen,
  onWordsOpenChange,
  onStatusChange,
}: BooksWorkshopVocabToolsProps) {
  const lessonId = request.lessonId?.trim() ?? ''
  const partId = request.partId?.trim() ?? ''
  const [wordsReady, setWordsReady] = useState(false)

  const sectionPath = useMemo(() => {
    const bits = [
      request.bookTitle,
      request.unitTitle,
      request.lessonTitle,
      request.partTitle,
    ]
      .map((s) => s?.trim())
      .filter(Boolean)
    return bits.join(' / ') || 'Workshop vocab'
  }, [request.bookTitle, request.unitTitle, request.lessonTitle, request.partTitle])

  const startHint =
    typeof request.startPageHint === 'number' && Number.isFinite(request.startPageHint)
      ? Math.floor(request.startPageHint)
      : undefined
  const endHint =
    typeof request.endPageHint === 'number' && Number.isFinite(request.endPageHint)
      ? Math.floor(request.endPageHint)
      : undefined

  useEffect(() => {
    if (!lessonId || !partId) {
      setWordsReady(false)
      onStatusChange?.({ wordsReady: false, loading: false })
      return
    }
    let cancelled = false
    onStatusChange?.({ wordsReady: false, loading: true })
    void (async () => {
      try {
        const qs = new URLSearchParams({
          bookId: request.bookId,
          unitId: request.unitId,
          lessonId,
          partId,
        })
        const res = await fetch(`/api/context/get?${qs.toString()}`)
        const data = (await res.json()) as {
          ok?: boolean
          context?: { interactiveVocabulary?: Array<{ word?: string; definition?: string }> } | null
        }
        if (cancelled) return
        const list = data.ok ? data.context?.interactiveVocabulary : undefined
        const ready =
          Array.isArray(list) &&
          list.some((w) => Boolean(w.word?.trim()) && Boolean(w.definition?.trim()))
        setWordsReady(ready)
        onStatusChange?.({ wordsReady: ready, loading: false })
      } catch {
        if (!cancelled) {
          setWordsReady(false)
          onStatusChange?.({ wordsReady: false, loading: false })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [request.bookId, request.unitId, lessonId, partId, onStatusChange])

  const onReadyChange = useCallback(
    (ready: boolean) => {
      setWordsReady(ready)
      onStatusChange?.({ wordsReady: ready, loading: false })
    },
    [onStatusChange],
  )

  if (!lessonId || !partId) return null

  const title = request.partTitle?.trim() || request.typeLabel?.trim() || 'Vocabulary'

  return (
    <Dialog open={wordsOpen} onOpenChange={onWordsOpenChange}>
      <DialogContent
        className={cn(
          WORKSHOP_DIALOG_Z,
          'flex max-h-[min(92vh,720px)] w-[min(96vw,36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl',
        )}
        overlayClassName={WORKSHOP_DIALOG_Z}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-[var(--border)] px-5 py-4 text-left">
          <DialogTitle className="text-[17px] font-semibold tracking-tight">{title}</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            Scan or edit words for the reader. The book stays open behind this.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ClassPrepVocabEditor
            bookId={request.bookId}
            unitId={request.unitId}
            lessonId={lessonId}
            partId={partId}
            sectionPath={sectionPath}
            partTitle={title}
            startPageHint={startHint}
            endPageHint={endHint}
            scanButtonLabel="Scan text"
            scanHelpLead="Scan text"
            chrome="plain"
            hidePagePreview
            onReadyChange={onReadyChange}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
