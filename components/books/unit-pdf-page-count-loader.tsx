'use client'

import dynamic from 'next/dynamic'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false })
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const

/**
 * Invisible PDF load so Books always knows page count for printed→PDF mapping
 * (Stories / Outline / alignment), without requiring the Outline preview pane.
 */
export function UnitPdfPageCountLoader({
  fileUrl,
  pdfReady,
  enabled,
  onNumPages,
}: {
  fileUrl: string | null
  pdfReady: boolean
  enabled: boolean
  onNumPages: (numPages: number) => void
}) {
  if (!enabled || !pdfReady || !fileUrl) return null
  return (
    <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
      <PdfDocument
        file={fileUrl}
        options={PDF_DOCUMENT_OPTIONS}
        loading={null}
        onLoadSuccess={(meta) => onNumPages(meta.numPages)}
      >
        {null}
      </PdfDocument>
    </div>
  )
}
