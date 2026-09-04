import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveBookFileServeAbsolutePath } from '@/lib/books/resolve-book-file-serve-path'
import { SEARCHABLE_PDF_DIR } from '@/lib/books/searchable-pdf-path'

async function makeTempBookDir() {
  return mkdtemp(path.join(os.tmpdir(), 'book-file-serve-'))
}

describe('resolveBookFileServeAbsolutePath', () => {
  const dirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    )
  })

  it('serves a fresh searchable sidecar when it exists', async () => {
    const root = await makeTempBookDir()
    dirs.push(root)
    const original = path.join(root, 'unit.pdf')
    const sidecarDir = path.join(root, SEARCHABLE_PDF_DIR)
    const sidecar = path.join(sidecarDir, 'unit.pdf')
    await writeFile(original, 'original-scan')
    await mkdir(sidecarDir)
    await writeFile(sidecar, 'searchable-copy')
    const past = new Date(Date.now() - 60_000)
    const now = new Date()
    await utimes(original, past, past)
    await utimes(sidecar, now, now)

    await expect(resolveBookFileServeAbsolutePath(original)).resolves.toBe(sidecar)
  })

  it('serves the replaced original when the sidecar is older', async () => {
    const root = await makeTempBookDir()
    dirs.push(root)
    const original = path.join(root, 'unit.pdf')
    const sidecarDir = path.join(root, SEARCHABLE_PDF_DIR)
    const sidecar = path.join(sidecarDir, 'unit.pdf')
    await mkdir(sidecarDir)
    await writeFile(sidecar, 'old-searchable-copy')
    await writeFile(original, 'new-scan')
    const past = new Date(Date.now() - 60_000)
    const now = new Date()
    await utimes(sidecar, past, past)
    await utimes(original, now, now)

    await expect(resolveBookFileServeAbsolutePath(original)).resolves.toBe(original)
  })

  it('falls back to the original when no sidecar exists', async () => {
    const root = await makeTempBookDir()
    dirs.push(root)
    const original = path.join(root, 'unit.pdf')
    await writeFile(original, 'scan-only')

    await expect(resolveBookFileServeAbsolutePath(original)).resolves.toBe(original)
  })
})
