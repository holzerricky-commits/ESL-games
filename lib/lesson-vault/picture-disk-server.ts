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

/** Writes the card's picture, replacing any file with another extension. */
export async function writeVaultPictureFile(dir: string, cardId: string, bytes: Uint8Array, ext: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  const fileName = `${cardId}${ext}`
  const absFile = path.join(dir, fileName)
  const tmpFile = `${absFile}.${Date.now()}.tmp`
  await writeFile(tmpFile, bytes)
  for (const old of await listCardFiles(dir, cardId)) {
    if (old !== fileName) await unlink(path.join(dir, old)).catch(() => {})
  }
  await rename(tmpFile, absFile)
}
