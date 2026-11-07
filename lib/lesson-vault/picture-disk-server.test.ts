import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeVaultPictureFile } from '@/lib/lesson-vault/picture-disk-server'

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'vault-picture-'))
  dirs.push(dir)
  return dir
}

describe('writeVaultPictureFile', () => {
  it('replaces a picture the teacher is saving', async () => {
    const dir = await tempDir()
    await writeVaultPictureFile(dir, 'card-1', Buffer.from('first'), '.jpg')
    const wrote = await writeVaultPictureFile(dir, 'card-1', Buffer.from('second'), '.png')
    expect(wrote).toBe(true)
    expect(await readFile(path.join(dir, 'card-1.png'), 'utf8')).toBe('second')
    expect(await readdir(dir)).toEqual(['card-1.png'])
  })

  it('does not replace a picture that arrived while an automatic copy was running', async () => {
    const dir = await tempDir()
    await writeFile(path.join(dir, 'card-1.jpg'), 'teacher-photo')
    const wrote = await writeVaultPictureFile(dir, 'card-1', Buffer.from('auto-copy'), '.png', {
      onlyIfEmpty: true,
    })
    expect(wrote).toBe(false)
    expect(await readFile(path.join(dir, 'card-1.jpg'), 'utf8')).toBe('teacher-photo')
    expect(await readdir(dir)).toEqual(['card-1.jpg'])
  })

  it('stores the automatic copy when the card is still blank', async () => {
    const dir = await tempDir()
    const wrote = await writeVaultPictureFile(dir, 'card-1', Buffer.from('auto-copy'), '.png', {
      onlyIfEmpty: true,
    })
    expect(wrote).toBe(true)
    expect(await readFile(path.join(dir, 'card-1.png'), 'utf8')).toBe('auto-copy')
    expect(await readdir(dir)).toEqual(['card-1.png'])
  })
})
