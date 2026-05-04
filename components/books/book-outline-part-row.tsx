'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  BookMarked,
  BookOpen,
  Brain,
  Languages,
  Link2,
  PenLine,
  Pointer,
} from 'lucide-react'
import type { BookLessonPartRecord } from '@/lib/books/types'
import { getPartPrimaryLabel } from '@/lib/books/part-section-display'
import { resolvePartStructureTag } from '@/lib/books/part-structure-tag'
import {
  partVisualKindFromStructureTag,
  storySubtitleForVisualKind,
  type BookPartVisualKind,
} from '@/lib/books/book-part-visual-kind'
import { cn } from '@/lib/utils'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false })
const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), { ssr: false })
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const

/** Page range pill (wizard + books sidebar). */
export const BOOK_OUTLINE_PAGE_BADGE_CLASS =
  'shrink-0 rounded-full border border-border/50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground'

export function bookOutlinePartStoryShellClass(isStory: boolean): string {
  return isStory
    ? 'rounded-md border-l-2 border-primary/45 bg-primary/[0.04] py-1.5 pr-1.5'
    : ''
}

function partIconForKind(kind: BookPartVisualKind) {
  switch (kind) {
    case 'vocabulary':
      return Languages
    case 'comprehension':
      return Brain
    case 'yourTurn':
      return Pointer
    case 'makingConnections':
      return Link2
    case 'grammarWrite':
      return PenLine
    case 'longStory':
      return BookMarked
    case 'shortStory':
      return BookOpen
    default:
      return BookOpen
  }
}

export interface BookOutlinePartRowProps {
  part: BookLessonPartRecord
  partIndex: number
  /** Preformatted label (e.g. mapped `p12-14` or wizard `(18-20)`). */
  pageRangeLabel: string
  isActive: boolean
  onSelect: () => void
  fileUrl: string | null
  pdfReady: boolean
  /** PDF page number for optional story thumbnail (e.g. start + 1). */
  storyThumbPdfPage: number | null
  totalPdfPages: number | null
}

export function BookOutlinePartRow({
  part,
  partIndex,
  pageRangeLabel,
  isActive,
  onSelect,
  fileUrl,
  pdfReady,
  storyThumbPdfPage,
  totalPdfPages,
}: BookOutlinePartRowProps) {
  const kind = partVisualKindFromStructureTag(part, part.title, partIndex)
  const isStory = kind === 'longStory' || kind === 'shortStory'
  const PartIcon = partIconForKind(kind)
  const tag = resolvePartStructureTag(part, partIndex)
  const primaryLabel = getPartPrimaryLabel(tag, part.title)
  const storySubtitle = isStory ? storySubtitleForVisualKind(kind) : null

  const thumbPage = useMemo(() => {
    if (!isStory || storyThumbPdfPage == null) return null
    if (totalPdfPages != null && Number.isFinite(totalPdfPages)) {
      return Math.min(Math.max(1, Math.floor(storyThumbPdfPage)), Math.floor(totalPdfPages))
    }
    return Math.max(1, Math.floor(storyThumbPdfPage))
  }, [isStory, storyThumbPdfPage, totalPdfPages])

  const showThumb = Boolean(isStory && thumbPage != null && fileUrl && pdfReady)

  return (
    <div className={cn(bookOutlinePartStoryShellClass(isStory), !isStory && 'py-0.5')}>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm leading-snug transition-colors',
          isActive
            ? 'bg-[var(--brand-blue)]/20 font-medium text-foreground'
            : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
        )}
      >
        {showThumb ? (
          <span className="overflow-hidden rounded border border-[var(--border)]/70">
            <PdfDocument
              file={fileUrl!}
              options={PDF_DOCUMENT_OPTIONS}
              loading={<span className="block h-[44px] w-[34px] bg-muted/40" />}
            >
              <PdfPage pageNumber={thumbPage!} width={34} renderTextLayer={false} renderAnnotationLayer={false} />
            </PdfDocument>
          </span>
        ) : (
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted/40 text-muted-foreground">
            <PartIcon size={13} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          {isStory ? (
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] font-semibold leading-tight text-foreground">{primaryLabel}</span>
              <span className="text-[11px] italic text-muted-foreground">{storySubtitle}</span>
            </span>
          ) : (
            <span className="truncate">{primaryLabel}</span>
          )}
        </span>
        <span className={BOOK_OUTLINE_PAGE_BADGE_CLASS}>{pageRangeLabel}</span>
      </button>
    </div>
  )
}
