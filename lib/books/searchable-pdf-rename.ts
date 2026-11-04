import { access, readdir, rename } from 'node:fs/promises'
import path from 'node:path'
import {
  SEARCHABLE_PDF_DIR,
  searchableOcrBoxesAbsolutePath,
} from '@/lib/books/searchable-pdf-path'

/**
 * New file name for a searchable sidecar or page-box file when the unit PDF
 * is renamed. Returns null when `artifactFileName` belongs to a different PDF.
 */
export function renamedSearchableArtifactFileName(
  artifactFileName: string,
  fromPdfFileName: string,
  toPdfFileName: string,
): string | null {
  const fromBase = path.basename(fromPdfFileName)
  const toBase = path.basename(toPdfFileName)
  const artifactBase = path.basename(artifactFileName)
  if (!fromBase || !toBase || fromBase === toBase) return null
  if (artifactBase !== artifactFileName) return null
  if (artifactBase === fromBase) return toBase

  const fromStem = path.basename(fromBase, path.extname(fromBase))
  const suffix = '.boxes.json'
  const marker = `${fromStem}.p`
  if (!artifactBase.startsWith(marker) || !artifactBase.endsWith(suffix)) return null
  const pageRaw = artifactBase.slice(marker.length, artifactBase.length - suffix.length)
  if (!/^[1-9]\d*$/.test(pageRaw)) return null
  const expected = path.basename(searchableOcrBoxesAbsolutePath(fromBase, Number(pageRaw)))
  if (artifactBase !== expected) return null
  return path.basename(searchableOcrBoxesAbsolutePath(toBase, Number(pageRaw)))
}

function isDirectChild(parentDir: string, candidate: string): boolean {
  return path.dirname(path.resolve(candidate)) === path.resolve(parentDir)
}

/**
 * Move `.searchable/<old>.pdf` and its page-box files to the new PDF name.
 * Missing sidecars are a no-op. An existing destination is left in place.
 */
export async function renameSearchableArtifactsForPdfRename(
  bookFolderAbs: string,
  fromPdfFileName: string,
  toPdfFileName: string,
): Promise<string[]> {
  const fromBase = path.basename(fromPdfFileName)
  const toBase = path.basename(toPdfFileName)
  if (!fromBase || !toBase || fromBase === toBase) return []

  const sideDir = path.resolve(bookFolderAbs, SEARCHABLE_PDF_DIR)
  let names: string[]
  try {
    names = await readdir(sideDir)
  } catch {
    return []
  }

  const moved: string[] = []
  for (const name of names) {
    const nextName = renamedSearchableArtifactFileName(name, fromBase, toBase)
    if (!nextName || nextName === name) continue
    const fromAbs = path.resolve(sideDir, name)
    const toAbs = path.resolve(sideDir, nextName)
    if (!isDirectChild(sideDir, fromAbs) || !isDirectChild(sideDir, toAbs)) continue
    try {
      await access(toAbs)
      continue
    } catch {
      // Destination is free.
    }
    await rename(fromAbs, toAbs)
    moved.push(nextName)
  }
  return moved
}
