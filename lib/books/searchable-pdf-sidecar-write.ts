import { chmod, rename, unlink, writeFile } from 'node:fs/promises'

/** Shown when Windows will not replace the sidecar because a reader still has it open. */
export const SEARCHABLE_PDF_FILE_OPEN_ERROR =
  'The book file is open in the reader, so the selectable text could not be saved. Close the book, then try again.'

export function isFileBusyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: string }).code ?? '') : ''
  return code === 'EBUSY' || code === 'EPERM' || code === 'EACCES'
}

function errorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return ''
  return String((error as { code?: string }).code ?? '')
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Textbook scans are often marked read-only, and `copyFile` keeps that attribute.
 * Writing the sidecar then fails with EPERM until the attribute is cleared.
 */
export async function clearReadOnlyAttribute(targetAbs: string): Promise<void> {
  try {
    await chmod(targetAbs, 0o666)
  } catch (error) {
    if (errorCode(error) === 'ENOENT' || isFileBusyError(error)) return
    throw error
  }
}

async function replaceWithTemp(tempAbs: string, targetAbs: string): Promise<void> {
  const backupAbs = `${targetAbs}.${process.pid}.replacing`
  try {
    await rename(targetAbs, backupAbs)
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      await rename(tempAbs, targetAbs)
      return
    }
    throw error
  }
  try {
    await rename(tempAbs, targetAbs)
  } catch (error) {
    await rename(backupAbs, targetAbs).catch(() => undefined)
    throw error
  }
  await unlink(backupAbs).catch((error) => {
    if (!isFileBusyError(error)) throw error
  })
}

/**
 * Replace `targetAbs` with `bytes`. The new file is written beside the target first,
 * then swapped in, so a failed replace leaves the current PDF intact.
 * Clears the read-only attribute that textbook scans keep after copy, and retries
 * while Windows returns EPERM/EBUSY because another reader still has the file open.
 */
export async function writeFileReplacingWithRetry(
  targetAbs: string,
  bytes: Uint8Array,
  options?: { attempts?: number; delayMs?: number },
): Promise<void> {
  const attempts = Math.max(1, options?.attempts ?? 10)
  const delayMs = options?.delayMs ?? 400
  const tempAbs = `${targetAbs}.${process.pid}.writing`
  await writeFile(tempAbs, bytes)

  let replaced = false
  let lastError: unknown
  try {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        await clearReadOnlyAttribute(targetAbs)
        await replaceWithTemp(tempAbs, targetAbs)
        replaced = true
        return
      } catch (error) {
        lastError = error
        if (!isFileBusyError(error) || attempt === attempts - 1) break
        await delay(Math.min(delayMs * (attempt + 1), 1500))
      }
    }
  } finally {
    if (!replaced) await unlink(tempAbs).catch(() => undefined)
  }

  if (isFileBusyError(lastError)) {
    throw new Error(SEARCHABLE_PDF_FILE_OPEN_ERROR)
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Could not save the selectable text into the book file.')
}
