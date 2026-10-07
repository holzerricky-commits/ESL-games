'use client'

import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  extractPdfPageTextRuns,
  type PdfPageTextRun,
} from '@/lib/books/pdf-page-text-geometry'

export function makeOcrBoxesUrl(unitFilePath: string, pageNumber: number, epoch = 0): string {
  const params = new URLSearchParams({
    path: unitFilePath,
    page: String(pageNumber),
  })
  if (epoch > 0) params.set('v', String(epoch))
  return `/api/book-ocr-boxes?${params.toString()}`
}

async function fetchOcrSelectRuns(
  unitFilePath: string,
  pageNumber: number,
  epoch: number,
  signal: AbortSignal,
): Promise<PdfPageTextRun[] | null> {
  try {
    const res = await fetch(makeOcrBoxesUrl(unitFilePath, pageNumber, epoch), {
      signal,
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { ok?: boolean; runs?: PdfPageTextRun[] }
    if (!data.ok || !Array.isArray(data.runs) || data.runs.length === 0) return null
    return data.runs.map((run, index) => ({
      index: typeof run.index === 'number' ? run.index : index,
      text: String(run.text ?? ''),
      x: Number(run.x),
      y: Number(run.y),
      w: Number(run.w),
      h: Number(run.h),
    }))
  } catch {
    return null
  }
}

/**
 * Prefer OCR printed boxes when present (accurate Select).
 * Fall back to pdf.js text items for native-text PDFs.
 */
export function usePdfPageTextGeometry(
  pdf: PDFDocumentProxy | null,
  pageNumber: number,
  enabled: boolean,
  options?: {
    unitFilePath?: string | null
    boxesEpoch?: number
  },
) {
  const [runs, setRuns] = useState<PdfPageTextRun[]>([])
  const [ready, setReady] = useState(false)
  const loadIdRef = useRef(0)
  const unitFilePath = options?.unitFilePath ?? null
  const boxesEpoch = options?.boxesEpoch ?? 0

  useEffect(() => {
    if (!enabled || pageNumber < 1) {
      setRuns([])
      setReady(false)
      return
    }

    const loadId = loadIdRef.current + 1
    loadIdRef.current = loadId
    setReady(false)
    const ac = new AbortController()

    void (async () => {
      if (unitFilePath) {
        const ocrRuns = await fetchOcrSelectRuns(unitFilePath, pageNumber, boxesEpoch, ac.signal)
        if (loadIdRef.current !== loadId) return
        if (ocrRuns && ocrRuns.length > 0) {
          setRuns(ocrRuns)
          setReady(true)
          return
        }
      }

      if (!pdf) {
        if (loadIdRef.current !== loadId) return
        setRuns([])
        setReady(true)
        return
      }

      const result = await extractPdfPageTextRuns(pdf, pageNumber)
      if (loadIdRef.current !== loadId) return
      setRuns(result?.runs ?? [])
      setReady(true)
    })()

    return () => {
      ac.abort()
    }
  }, [pdf, pageNumber, enabled, unitFilePath, boxesEpoch])

  return { runs, ready }
}
