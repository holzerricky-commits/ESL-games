import 'server-only'

import { readFile, writeFile } from 'node:fs/promises'
import type { OcrWordBox } from '@/lib/books/searchable-pdf-text-layer'
import { searchableOcrBoxesAbsolutePath } from '@/lib/books/searchable-pdf-path'
import {
  buildSearchableOcrBoxesFile,
  parseSearchableOcrBoxesFile,
  type SearchableOcrBoxesFile,
} from '@/lib/books/searchable-ocr-boxes'

export async function writeSearchableOcrBoxes(args: {
  originalAbsPath: string
  pdfPage: number
  words: readonly OcrWordBox[]
  imageWidth: number
  imageHeight: number
}): Promise<string> {
  const absPath = searchableOcrBoxesAbsolutePath(args.originalAbsPath, args.pdfPage)
  const payload = buildSearchableOcrBoxesFile(
    args.pdfPage,
    args.words,
    args.imageWidth,
    args.imageHeight,
  )
  await writeFile(absPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return absPath
}

export async function readSearchableOcrBoxes(
  originalAbsPath: string,
  pdfPage: number,
): Promise<SearchableOcrBoxesFile | null> {
  const absPath = searchableOcrBoxesAbsolutePath(originalAbsPath, pdfPage)
  try {
    const raw = JSON.parse(await readFile(absPath, 'utf8')) as unknown
    return parseSearchableOcrBoxesFile(raw)
  } catch {
    return null
  }
}
