'use client'

import { BookOpen } from 'lucide-react'
import { usePdfPageThumbnail } from '@/components/students/use-pdf-page-thumbnail'
import type { PdfPageThumbnailPhase } from '@/components/students/use-pdf-page-thumbnail'

export interface BookCoverMockupArtProps {
  fileUrl: string
  unitId: string
  pageNumber?: number
  width: number
  pdfReady: boolean
  label: string
  eager?: boolean
}

function MockupArtBody({
  phase,
  dataUrl,
  label,
  pdfReady,
}: {
  phase: PdfPageThumbnailPhase
  dataUrl: string | null
  label: string
  pdfReady: boolean
}) {
  if (phase === 'error') {
    return (
      <div className="book-cover-mockup__fallback">
        <BookOpen className="h-8 w-8 opacity-60" aria-hidden />
        <span className="book-cover-mockup__fallback-label">{label}</span>
      </div>
    )
  }

  if (dataUrl && phase === 'ready') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URL from pdf.js canvas
      <img src={dataUrl} alt="" className="book-cover-mockup__art" draggable={false} />
    )
  }

  if (!pdfReady) {
    return <div className="book-cover-mockup__placeholder" aria-hidden />
  }

  return <div className="book-cover-mockup__placeholder book-cover-mockup__placeholder--pulse" aria-hidden />
}

export function BookCoverMockupArt({
  fileUrl,
  unitId,
  pageNumber = 1,
  width,
  pdfReady,
  label,
  eager = true,
}: BookCoverMockupArtProps) {
  const { containerRef, phase, dataUrl } = usePdfPageThumbnail({
    fileUrl,
    unitId,
    pageNumber,
    width,
    pdfReady,
    eager,
  })

  return (
    <div ref={containerRef} className="h-full w-full">
      <MockupArtBody phase={phase} dataUrl={dataUrl} label={label} pdfReady={pdfReady} />
    </div>
  )
}
