'use client'

import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { probePdfPageHasSelectableText } from '@/lib/books/pdf-page-text-probe'

export type PdfPageTextCapability = boolean | 'pending'

function capabilityKey(fileUrl: string, pageNumber: number): string {
  return `${fileUrl}::${pageNumber}`
}

/**
 * Probes visible spread pages for extractable PDF text (background, non-blocking).
 */
export function usePdfPageTextCapability(
  pdf: PDFDocumentProxy | null,
  fileUrl: string | null,
  pageNumbers: readonly number[],
  enabled: boolean,
): ReadonlyMap<number, PdfPageTextCapability> {
  const [capabilityByPage, setCapabilityByPage] = useState<Map<number, PdfPageTextCapability>>(
    () => new Map(),
  )
  const probeGenerationRef = useRef(0)

  useEffect(() => {
    if (!enabled || !pdf || !fileUrl || pageNumbers.length === 0) {
      setCapabilityByPage(new Map())
      return
    }

    const generation = probeGenerationRef.current + 1
    probeGenerationRef.current = generation

    const uniquePages = [...new Set(pageNumbers.filter((p) => p >= 1))]
    setCapabilityByPage((prev) => {
      const next = new Map(prev)
      for (const pageNumber of uniquePages) {
        if (!next.has(pageNumber)) next.set(pageNumber, 'pending')
      }
      return next
    })

    let cancelled = false

    void (async () => {
      for (const pageNumber of uniquePages) {
        if (cancelled || probeGenerationRef.current !== generation) return
        const hasText = await probePdfPageHasSelectableText(pdf, pageNumber, fileUrl)
        if (cancelled || probeGenerationRef.current !== generation) return
        setCapabilityByPage((prev) => {
          const next = new Map(prev)
          next.set(pageNumber, hasText)
          return next
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, pdf, fileUrl, pageNumbers])

  return capabilityByPage
}

export function pageHasSelectablePdfText(
  capabilityByPage: ReadonlyMap<number, PdfPageTextCapability>,
  pageNumber: number,
): boolean {
  return capabilityByPage.get(pageNumber) === true
}

export function spreadHasSelectablePdfText(
  capabilityByPage: ReadonlyMap<number, PdfPageTextCapability>,
  leftPage: number,
  rightPage: number | null,
): boolean {
  if (pageHasSelectablePdfText(capabilityByPage, leftPage)) return true
  if (rightPage != null && pageHasSelectablePdfText(capabilityByPage, rightPage)) return true
  return false
}

export function spreadPdfTextCapabilityPending(
  capabilityByPage: ReadonlyMap<number, PdfPageTextCapability>,
  leftPage: number,
  rightPage: number | null,
): boolean {
  const pages = rightPage != null ? [leftPage, rightPage] : [leftPage]
  return pages.some((p) => capabilityByPage.get(p) === 'pending')
}
