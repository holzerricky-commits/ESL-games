import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { listCardFiles, writeVaultPictureFile } from './picture-disk-server'

const dirs: string[] = []

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'vault-pic-'))
  dirs.push(dir)
  return dir
}

describe('writeVaultPictureFile', () => {
  it('replaces a picture that uses another extension', async () => {
    const dir = await tempDir()
    const cardId = 'card-1'
    await writeFile(path.join(dir, `${cardId}.png`), Buffer.from('teacher-png'))
    const wrote = await writeVaultPictureFile(dir, cardId, Buffer.from('web-jpg'), '.jpg')
    expect(wrote).toBe(true)
    expect(await listCardFiles(dir, cardId)).toEqual([`${cardId}.jpg`])
    expect(await readFile(path.join(dir, `${cardId}.jpg`), 'utf8')).toBe('web-jpg')
  })

  it('leaves an existing picture in place when onlyIfEmpty is set, including a different extension', async () => {
    const dir = await tempDir()
    const cardId = 'card-1'
    await writeFile(path.join(dir, `${cardId}.png`), Buffer.from('teacher-png'))
    const wrote = await writeVaultPictureFile(dir, cardId, Buffer.from('web-jpg'), '.jpg', { onlyIfEmpty: true })
    expect(wrote).toBe(false)
    expect(await listCardFiles(dir, cardId)).toEqual([`${cardId}.png`])
    expect(await readFile(path.join(dir, `${cardId}.png`), 'utf8')).toBe('teacher-png')
  })

  it('writes when the card has no picture yet', async () => {
    const dir = await tempDir()
    const cardId = 'card-1'
    const wrote = await writeVaultPictureFile(dir, cardId, Buffer.from('web-jpg'), '.jpg', { onlyIfEmpty: true })
    expect(wrote).toBe(true)
    expect(await readFile(path.join(dir, `${cardId}.jpg`), 'utf8')).toBe('web-jpg')
  })
})
