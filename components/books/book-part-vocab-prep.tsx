'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookA } from 'lucide-react'
import { BookPartOutlineSpreadPreview } from '@/components/books/book-part-outline-spread-preview'
import { BookPartPrepVocabStatusChip } from '@/components/books/book-part-prep-status-chips'
import { ClassPrepVocabEditor } from '@/components/students/class-prep-vocab-editor'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'

const VOCAB_DESK_BREAKPOINT_PX = 900
const VOCAB_BOOK_MAX_WIDTH = 'max-w-7xl'

function useMinWidth(px: number) {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [px])
  return matches
}

interface BookPartVocabPrepProps {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  part: BookLessonPartRecord
  partTypeLabel?: string | null
  partTitle: string
  pageRangeLabel: string
  pdfReady: boolean
  totalPdfPages: number | null
  startPageHint?: number | null
  endPageHint?: number | null
  onPdfNumPages?: (numPages: number) => void
  onOpenWorkshop?: () => void
}

function scrollToWordsSection() {
  const el = document.getElementById('part-prep-vocab-words')
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function BookPartVocabPrep({
  book,
  unit,
  lesson,
  part,
  partTypeLabel,
  partTitle,
  pageRangeLabel,
  pdfReady,
  totalPdfPages,
  startPageHint,
  endPageHint,
  onPdfNumPages,
  onOpenWorkshop,
}: BookPartVocabPrepProps) {
  const deskSideBySide = useMinWidth(VOCAB_DESK_BREAKPOINT_PX)
  const fileUrl = unit.filePath ? makeUnitFileUrl(unit.filePath) : null
  const [wordsReady, setWordsReady] = useState(false)

  const sectionPath = useMemo(() => {
    const bits = [book.title, unit.title, lesson.title, part.title].map((s) => s?.trim()).filter(Boolean)
    return bits.join(' / ')
  }, [book.title, unit.title, lesson.title, part.title])

  const startHint = typeof startPageHint === 'number' ? startPageHint : undefined
  const endHint = typeof endPageHint === 'number' ? endPageHint : undefined

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const qs = new URLSearchParams({
          bookId: book.id,
          unitId: unit.id,
          lessonId: lesson.id,
          partId: part.id,
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
      } catch {
        // Badge stays in default todo state.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [book.id, unit.id, lesson.id, part.id])

  const handleReadyChange = useCallback((ready: boolean) => {
    setWordsReady(ready)
  }, [])

  const previewMeta = (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--brand-blue)_72%,white),var(--brand-blue))] text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.35)]"
          aria-hidden
        >
          <BookA className="h-5 w-5 stroke-[1.75]" />
        </span>
        <div className="min-w-0 space-y-1 pt-0.5">
          {partTypeLabel ? (
            <p className="text-[13px] font-medium text-muted-foreground">{partTypeLabel}</p>
          ) : null}
          <h3 className="text-[24px] font-semibold leading-snug tracking-tight text-foreground md:text-[28px]">
            {partTitle}
          </h3>
          <p className="text-[14px] text-muted-foreground">
            Pages{' '}
            <span className="font-semibold tabular-nums text-foreground">{pageRangeLabel}</span>
            {' · '}
            Scan, edit, and save words for the reader
          </p>
        </div>
      </div>
      <BookPartPrepVocabStatusChip
        wordsState={wordsReady ? 'ready' : 'todo'}
        onWordsClick={scrollToWordsSection}
        className="shrink-0 self-center sm:self-start"
      />
    </div>
  )

  const previewBlock = fileUrl ? (
    <BookPartOutlineSpreadPreview
      fileUrl={fileUrl}
      unitId={`${book.id}-${unit.id}-${part.id}-vocab-work`}
      book={book}
      unit={unit}
      pdfReady={pdfReady}
      totalPdfPages={totalPdfPages}
      printedStart={startPageHint ?? null}
      printedEnd={endPageHint ?? null}
      fillWidth
      size="lg"
      onPdfNumPages={onPdfNumPages}
      openBookAction={
        onOpenWorkshop
          ? { label: 'Open book at these pages', onClick: onOpenWorkshop }
          : undefined
      }
    />
  ) : (
    <div className="flex min-h-[280px] items-center justify-center rounded-2xl bg-[var(--surface-3)] p-6 text-sm text-muted-foreground">
      No PDF
    </div>
  )

  const wordsBlock = (
    <ClassPrepVocabEditor
      bookId={book.id}
      unitId={unit.id}
      lessonId={lesson.id}
      partId={part.id}
      sectionPath={sectionPath}
      partTitle={part.title}
      startPageHint={startHint}
      endPageHint={endHint}
      scanButtonLabel="Scan text"
      scanHelpLead="Scan text"
      chrome="plain"
      hidePagePreview
      onReadyChange={handleReadyChange}
    />
  )

  const bookPanelClass = `w-full ${VOCAB_BOOK_MAX_WIDTH} shrink-0 rounded-[28px] bg-[var(--surface-2)] p-6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)] sm:p-8 lg:p-10`
  const wordsPanelClass =
    'w-full shrink-0 rounded-[28px] bg-[var(--surface-2)] p-4 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)] sm:p-5 min-[900px]:w-96'

  return (
    <>
      <div id="part-prep-vocab" className="scroll-mt-6 flex w-full justify-center px-0">
        {deskSideBySide ? (
          <div className="flex w-full max-w-[calc(80rem+2.5rem+24rem)] flex-col items-center min-[900px]:flex-row min-[900px]:items-start min-[900px]:justify-center min-[900px]:gap-10">
            <div className={`relative space-y-8 ${bookPanelClass}`}>
              {previewMeta}
              {previewBlock}
            </div>

            <div id="part-prep-vocab-words" className={wordsPanelClass}>
              {wordsBlock}
            </div>
          </div>
        ) : (
          <div className={`space-y-8 ${bookPanelClass}`}>
            {previewMeta}
            {previewBlock}
            <div id="part-prep-vocab-words" className="min-w-0 border-t border-[var(--border)]/40 pt-8">
              {wordsBlock}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
