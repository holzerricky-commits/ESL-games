'use client'

import { Wand2 } from 'lucide-react'
import { BookOutlinePdfPreview } from '@/components/books/book-outline-pdf-preview'
import { BookOutlineSummaryTree } from '@/components/books/book-outline-summary-tree'
import { BookSetupToolHelp } from '@/components/books/book-setup-tool-help'
import { Button } from '@/components/ui/button'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import { BOOK_SETUP_COPY } from '@/lib/books/book-setup-copy'
import type {
  BookLessonPartRecord,
  BookLessonRecord,
  BookRecord,
  BookUnitRecord,
} from '@/lib/books/types'

interface BookOutlineTabProps {
  book: BookRecord
  selectedUnitId: string | null
  readerLessonId: string | null
  readerPartId: string | null
  numPages: number | null
  pdfReady: boolean
  previewPage: number
  onPreviewPageChange: (page: number) => void
  onPdfNumPages: (numPages: number) => void
  onEditOutline: () => void
  onSelectUnit: (unitId: string) => void
  onSelectLesson: (unit: BookUnitRecord, lesson: BookLessonRecord) => void
  onSelectPart: (unit: BookUnitRecord, lesson: BookLessonRecord, part: BookLessonPartRecord) => void
}

export function BookOutlineTab({
  book,
  selectedUnitId,
  readerLessonId,
  readerPartId,
  numPages,
  pdfReady,
  previewPage,
  onPreviewPageChange,
  onPdfNumPages,
  onEditOutline,
  onSelectUnit,
  onSelectLesson,
  onSelectPart,
}: BookOutlineTabProps) {
  const copy = BOOK_SETUP_COPY.outline
  const selectedUnit = selectedUnitId ? book.units.find((u) => u.id === selectedUnitId) ?? null : null
  const fileUrl = selectedUnit?.filePath ? makeUnitFileUrl(selectedUnit.filePath) : null

  return (
    <div className="space-y-4">
      <BookSetupToolHelp title={copy.label} subtitle={copy.subtitle} detail={copy.detail}>
        <Button type="button" size="sm" onClick={onEditOutline}>
          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
          {copy.label}
        </Button>
      </BookSetupToolHelp>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Lesson outline</p>
        <p className="text-xs text-muted-foreground">
          Click a unit, lesson, or part to open it in the preview. Page numbers are printed pages from
          the outline — edit them in the structure wizard.
        </p>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]">
          <BookOutlineSummaryTree
            book={book}
            selectedUnitId={selectedUnitId}
            readerLessonId={readerLessonId}
            readerPartId={readerPartId}
            numPages={numPages}
            pdfReady={pdfReady}
            onSelectUnit={onSelectUnit}
            onSelectLesson={onSelectLesson}
            onSelectPart={onSelectPart}
          />
          <BookOutlinePdfPreview
            fileUrl={fileUrl}
            pdfReady={pdfReady}
            pageNumber={previewPage}
            totalPdfPages={numPages}
            onDocumentLoad={onPdfNumPages}
            onPageChange={onPreviewPageChange}
            className="lg:sticky lg:top-4 lg:self-start"
          />
        </div>
      </div>
    </div>
  )
}
