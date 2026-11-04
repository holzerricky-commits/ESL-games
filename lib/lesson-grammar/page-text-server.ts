import 'server-only'

import { stat } from 'node:fs/promises'
import { withCachedPdfDocument } from '@/lib/books/generate-book-cover-server'
import { runsToPlainText } from '@/lib/books/pdf-page-text-geometry'
import { pdfTextItemsHaveSelectableText } from '@/lib/books/pdf-page-text-probe'
import { searchableOcrBoxesToRuns } from '@/lib/books/searchable-ocr-boxes'
import { readSearchableOcrBoxes } from '@/lib/books/searchable-ocr-boxes-io'
import { searchablePdfAbsolutePath } from '@/lib/books/searchable-pdf-path'
import { mergePdfTextItemsToLines, type PdfTextItem } from '@/lib/books/toc-import'
import { resolveUnitPdfAbsolutePath } from '@/lib/context/resolve-unit-pdf-path'

export type LessonPageText = { pdfPage: number; text: string }

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

/**
 * Readable text of unit PDF pages: the searchable (OCR) copy when it exists, else the original,
 * then saved OCR word boxes for pages that still have no text layer. Pages without text get ''.
 */
export async function readUnitPagesText(
  bookId: string,
  unitId: string,
  pdfPages: readonly number[],
): Promise<LessonPageText[] | null> {
  const originalPath = await resolveUnitPdfAbsolutePath(bookId, unitId)
  if (!originalPath) return null
  const sidecar = searchablePdfAbsolutePath(originalPath)
  const pdfPath = (await fileExists(sidecar)) ? sidecar : originalPath

  const fromPdf = await withCachedPdfDocument(pdfPath, async (doc) => {
    const out: LessonPageText[] = []
    for (const pdfPage of pdfPages) {
      if (pdfPage < 1 || pdfPage > doc.numPages) {
        out.push({ pdfPage, text: '' })
        continue
      }
      const page = await doc.getPage(pdfPage)
      const content = await page.getTextContent()
      const items: PdfTextItem[] = []
      for (const raw of content.items) {
        if (!raw || typeof raw !== 'object') continue
        const src = raw as { str?: unknown; transform?: unknown; width?: unknown; height?: unknown }
        if (typeof src.str !== 'string' || !src.str.trim() || !Array.isArray(src.transform)) continue
        items.push({
          str: src.str,
          transform: src.transform as number[],
          width: typeof src.width === 'number' ? src.width : undefined,
          height: typeof src.height === 'number' ? src.height : undefined,
        })
      }
      const text = pdfTextItemsHaveSelectableText(items) ? mergePdfTextItemsToLines(items).filter(Boolean).join('\n') : ''
      out.push({ pdfPage, text })
    }
    return out
  })

  return Promise.all(
    fromPdf.map(async (page) => {
      if (page.text) return page
      const boxes = await readSearchableOcrBoxes(originalPath, page.pdfPage)
      return { pdfPage: page.pdfPage, text: boxes ? runsToPlainText(searchableOcrBoxesToRuns(boxes)) : '' }
    }),
  )
}
