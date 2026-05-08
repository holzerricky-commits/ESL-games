import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'

/** 1-based inclusive PDF page indices; copies those pages into a new PDF. */
export async function slicePdfToTwoPageBytes(
  absPdfPath: string,
  pdfPageStart: number,
  pdfPageEnd: number,
): Promise<Uint8Array | null> {
  const bytes = await readFile(absPdfPath)
  const src = await PDFDocument.load(bytes)
  const n = src.getPageCount()
  const s = Math.max(1, Math.floor(pdfPageStart))
  const e = Math.max(s, Math.floor(pdfPageEnd))
  const indices: number[] = []
  for (let p = s; p <= e; p++) {
    const idx = p - 1
    if (idx >= 0 && idx < n) indices.push(idx)
  }
  if (!indices.length) return null
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, indices)
  for (const page of copied) out.addPage(page)
  return out.save()
}
