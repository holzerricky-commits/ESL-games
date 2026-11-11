import { mkdir, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getStudentWorkRoot } from '@/lib/students/student-work-path'
import { LESSON_VAULT_PICTURE_MIME_BY_EXT } from '@/lib/lesson-vault/picture-paths'

/** `student-work/<studentId>/vault`, or null if the id would escape the root. */
export function vaultDirFor(studentId: string): string | null {
  const root = getStudentWorkRoot()
  const dir = path.resolve(root, studentId, 'vault')
  return dir.startsWith(root + path.sep) ? dir : null
}

/** Picture files for one card (normally zero or one). */
export async function listCardFiles(dir: string, cardId: string): Promise<string[]> {
  try {
    const names = await readdir(dir)
    return names.filter((name) => {
      const ext = path.extname(name).toLowerCase()
      return name.slice(0, -ext.length) === cardId && ext in LESSON_VAULT_PICTURE_MIME_BY_EXT
    })
  } catch {
    return []
  }
}

/**
 * Writes the card's picture, replacing any file with another extension.
 * `onlyIfEmpty` leaves a picture that landed while this one was downloading
 * (a teacher drop during an automatic copy). The check is immediately before the rename.
 * Returns false when that existing picture was kept.
 */
export async function writeVaultPictureFile(
  dir: string,
  cardId: string,
  bytes: Uint8Array,
  ext: string,
  options?: { onlyIfEmpty?: boolean },
): Promise<boolean> {
  await mkdir(dir, { recursive: true })
  const fileName = `${cardId}${ext}`
  const absFile = path.join(dir, fileName)
  const tmpFile = `${absFile}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  await writeFile(tmpFile, bytes)
  try {
    const existing = await listCardFiles(dir, cardId)
    if (options?.onlyIfEmpty) {
      if (existing.length > 0) return false
    } else {
      for (const old of existing) {
        if (old !== fileName) await unlink(path.join(dir, old)).catch(() => {})
      }
    }
    await rename(tmpFile, absFile)
    if (options?.onlyIfEmpty) {
      const extras = (await listCardFiles(dir, cardId)).filter((name) => name !== fileName)
      if (extras.length > 0) {
        await unlink(absFile).catch(() => {})
        return false
      }
    }
    return true
  } finally {
    await unlink(tmpFile).catch(() => {})
  }
}
