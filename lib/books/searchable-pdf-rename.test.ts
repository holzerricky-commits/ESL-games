import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SEARCHABLE_PDF_DIR } from '@/lib/books/searchable-pdf-path'
import {
  renamedSearchableArtifactFileName,
  renameSearchableArtifactsForPdfRename,
} from '@/lib/books/searchable-pdf-rename'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('renamedSearchableArtifactFileName', () => {
  it('renames the sidecar PDF and that file’s page boxes only', () => {
    expect(renamedSearchableArtifactFileName('Scan.pdf', 'Scan.pdf', 'journeys-g3-book-1.pdf')).toBe(
      'journeys-g3-book-1.pdf',
    )
    expect(
      renamedSearchableArtifactFileName('Scan.p3.boxes.json', 'Scan.pdf', 'journeys-g3-book-1.pdf'),
    ).toBe('journeys-g3-book-1.p3.boxes.json')
    expect(
      renamedSearchableArtifactFileName('Other.p3.boxes.json', 'Scan.pdf', 'journeys-g3-book-1.pdf'),
    ).toBeNull()
    expect(renamedSearchableArtifactFileName('Scan.pdf', 'Scan.pdf', 'Scan.pdf')).toBeNull()
  })
})

describe('renameSearchableArtifactsForPdfRename', () => {
  it('moves the selectable copy with the renamed unit PDF', async () => {
    const root = await mkdirTemp()
    const side = path.join(root, SEARCHABLE_PDF_DIR)
    await mkdir(side, { recursive: true })
    await writeFile(path.join(side, 'Volume 1.pdf'), 'searchable-bytes')
    await writeFile(path.join(side, 'Volume 1.p2.boxes.json'), '{"pdfPage":2}\n')
    await writeFile(path.join(side, 'Volume 2.p2.boxes.json'), '{"pdfPage":2,"other":true}\n')

    const moved = await renameSearchableArtifactsForPdfRename(root, 'Volume 1.pdf', 'unit-01.pdf')

    expect(moved.sort()).toEqual(['unit-01.p2.boxes.json', 'unit-01.pdf'])
    expect(await readFile(path.join(side, 'unit-01.pdf'), 'utf8')).toBe('searchable-bytes')
    expect(await readFile(path.join(side, 'unit-01.p2.boxes.json'), 'utf8')).toContain('"pdfPage":2')
    expect(await readFile(path.join(side, 'Volume 2.p2.boxes.json'), 'utf8')).toContain('"other":true')
  })

  it('does nothing when this PDF was never made selectable', async () => {
    const root = await mkdirTemp()
    await expect(
      renameSearchableArtifactsForPdfRename(root, 'Scan.pdf', 'journeys-g3-book-1.pdf'),
    ).resolves.toEqual([])
  })
})

async function mkdirTemp(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'searchable-rename-'))
  tempDirs.push(dir)
  return dir
}
