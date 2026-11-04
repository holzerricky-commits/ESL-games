import 'server-only'

import { readFile, stat, writeFile } from 'node:fs/promises'
import type { OcrWordBox } from '@/lib/books/searchable-pdf-text-layer'
import {
  searchableOcrBoxesAbsolutePath,
  searchableOcrResultAbsolutePath,
} from '@/lib/books/searchable-pdf-path'
import {
  buildSearchableOcrBoxesFile,
  parseSearchableOcrBoxesFile,
  type SearchableOcrBoxesFile,
} from '@/lib/books/searchable-ocr-boxes'
import {
  parseSearchableOcrResultFile,
  type SearchableOcrResultFile,
} from '@/lib/books/searchable-ocr-result'

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

export async function writeSearchableOcrResult(
  originalAbsPath: string,
  result: SearchableOcrResultFile,
): Promise<string> {
  const absPath = searchableOcrResultAbsolutePath(originalAbsPath, result.pdfPage)
  await writeFile(absPath, `${JSON.stringify(result)}\n`, 'utf8')
  return absPath
}

export async function readSearchableOcrResult(
  originalAbsPath: string,
  pdfPage: number,
): Promise<SearchableOcrResultFile | null> {
  const absPath = searchableOcrResultAbsolutePath(originalAbsPath, pdfPage)
  try {
    const raw = JSON.parse(await readFile(absPath, 'utf8')) as unknown
    return parseSearchableOcrResultFile(raw)
  } catch {
    return null
  }
}

/** Last-modified time in ms, or null when the file is missing. */
export async function fileMtimeMs(absPath: string): Promise<number | null> {
  try {
    return (await stat(absPath)).mtimeMs
  } catch {
    return null
  }
}
