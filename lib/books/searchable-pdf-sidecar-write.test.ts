import { chmod, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  isFileBusyError,
  writeFileReplacingWithRetry,
} from '@/lib/books/searchable-pdf-sidecar-write'

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'searchable-sidecar-'))
  dirs.push(dir)
  return dir
}

describe('isFileBusyError', () => {
  it('treats Windows lock codes as busy', () => {
    expect(isFileBusyError({ code: 'EPERM' })).toBe(true)
    expect(isFileBusyError({ code: 'EBUSY' })).toBe(true)
    expect(isFileBusyError({ code: 'ENOENT' })).toBe(false)
  })
})

describe('writeFileReplacingWithRetry', () => {
  it('replaces an unlocked file', async () => {
    const dir = await tempDir()
    const target = path.join(dir, 'book.pdf')
    await writeFile(target, 'original')
    await writeFileReplacingWithRetry(target, Buffer.from('next'))
    expect(await readFile(target, 'utf8')).toBe('next')
  })

  it('replaces a read-only copy of a textbook scan', async () => {
    const dir = await tempDir()
    const target = path.join(dir, 'book.pdf')
    await writeFile(target, 'original')
    await chmod(target, 0o444)
    await writeFileReplacingWithRetry(target, Buffer.from('next'))
    expect(await readFile(target, 'utf8')).toBe('next')
  })

  it('replaces the file once the reader lets go', async () => {
    const dir = await tempDir()
    const target = path.join(dir, 'book.pdf')
    await writeFile(target, 'original')
    const handle = await open(target, 'r')
    const pending = writeFileReplacingWithRetry(target, Buffer.from('next'), {
      attempts: 8,
      delayMs: 40,
    })
    setTimeout(() => {
      void handle.close()
    }, 70)
    await pending
    expect(await readFile(target, 'utf8')).toBe('next')
  })
})
