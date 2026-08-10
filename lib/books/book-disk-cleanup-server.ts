import path from 'node:path'
import { access, constants, readFile, rename, writeFile } from 'node:fs/promises'
import {
  applyDiskCleanupPlanToBook,
  planBookDiskCleanup,
  type BookDiskCleanupPlan,
} from '@/lib/books/book-disk-naming'
import { getBookLibraryRoot, loadBookLibrary, saveBookLibraryManifest } from '@/lib/books/server'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'

export type BookDiskCleanupResult =
  | { ok: true; dryRun: true; plan: BookDiskCleanupPlan; book: BookRecord }
  | { ok: true; dryRun: false; plan: BookDiskCleanupPlan; library: BookLibraryPayload }
  | { ok: false; error: string; plan?: BookDiskCleanupPlan }

async function pathExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function isBusyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: string }).code ?? '') : ''
  return code === 'EBUSY' || code === 'EPERM' || code === 'EACCES' || code === 'ENOTEMPTY'
}

function lockedMessage(detail: string): string {
  return `${detail} Close the book reader (and any other app using these files), then try again.`
}

async function renameWithFriendlyError(fromAbs: string, toAbs: string, label: string): Promise<void> {
  try {
    await rename(fromAbs, toAbs)
  } catch (error) {
    if (isBusyError(error)) {
      throw new Error(lockedMessage(`Could not rename ${label} — the file may be open.`))
    }
    const message = error instanceof Error ? error.message : 'Rename failed.'
    throw new Error(`Could not rename ${label}: ${message}`)
  }
}

async function rewriteMaterialsIndexPaths(
  bookFolder: string,
  plan: BookDiskCleanupPlan,
): Promise<void> {
  if (!plan.currentFolder) return
  const indexAbs = path.resolve(getBookLibraryRoot(), bookFolder, 'supporting', 'materials-index.json')
  if (!(await pathExists(indexAbs))) return

  try {
    const raw = await readFile(indexAbs, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return

    const oldPrefix = `book-library/${plan.currentFolder}/`
    const newPrefix = `book-library/${plan.targetFolder}/`
    let changed = false
    const next = parsed.map((item) => {
      if (!item || typeof item !== 'object') return item
      const row = item as { filePath?: unknown }
      if (typeof row.filePath !== 'string') return item
      const normalized = row.filePath.replaceAll('\\', '/')
      if (!normalized.startsWith(oldPrefix) && !normalized.startsWith(newPrefix)) return item
      const rewritten = normalized.startsWith(oldPrefix)
        ? `${newPrefix}${normalized.slice(oldPrefix.length)}`
        : normalized
      if (rewritten === normalized) return item
      changed = true
      return { ...row, filePath: rewritten }
    })

    if (changed) {
      await writeFile(indexAbs, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    }
  } catch {
    // Supporting index is best-effort; book PDF paths are the critical rewrite.
  }
}

/**
 * Preview or apply disk cleanup for one book.
 * Never changes book.id. Updates books.json paths on apply.
 */
export async function runBookDiskCleanup(options: {
  bookId: string
  dryRun: boolean
}): Promise<BookDiskCleanupResult> {
  const library = await loadBookLibrary()
  const book = library.books.find((entry) => entry.id === options.bookId)
  if (!book) {
    return { ok: false, error: 'Book not found.' }
  }

  const plan = planBookDiskCleanup(book)

  if (options.dryRun) {
    return { ok: true, dryRun: true, plan, book }
  }

  if (plan.alreadyClean) {
    return { ok: true, dryRun: false, plan, library }
  }

  if (!plan.currentFolder) {
    return { ok: false, error: 'No book folder found on disk to clean up.', plan }
  }

  const root = getBookLibraryRoot()
  const currentAbs = path.resolve(root, plan.currentFolder)
  const targetAbs = path.resolve(root, plan.targetFolder)

  if (!currentAbs.startsWith(root) || !targetAbs.startsWith(root)) {
    return { ok: false, error: 'Invalid book folder path.', plan }
  }

  if (!(await pathExists(currentAbs))) {
    return { ok: false, error: `Folder not found: ${plan.currentFolder}`, plan }
  }

  if (plan.folderNeedsRename && (await pathExists(targetAbs))) {
    return {
      ok: false,
      error: `Target folder already exists: ${plan.targetFolder}. Rename or remove it first.`,
      plan,
    }
  }

  // 1) Rename folder first (moves cover + supporting with it).
  let activeFolder = plan.currentFolder
  let activeFolderAbs = currentAbs
  let folderMoved = false
  if (plan.folderNeedsRename) {
    try {
      await renameWithFriendlyError(currentAbs, targetAbs, `folder "${plan.currentFolder}"`)
      folderMoved = true
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Folder rename failed.',
        plan,
      }
    }
    activeFolder = plan.targetFolder
    activeFolderAbs = targetAbs
  }

  // 2) Rename PDF files inside the (possibly new) folder.
  const completedFileRenames: typeof plan.fileRenames = []
  for (const fileRename of plan.fileRenames) {
    const fromName = fileRename.fromFileName
    const toName = fileRename.toFileName
    if (fromName === toName) {
      completedFileRenames.push(fileRename)
      continue
    }

    const fromAbs = path.resolve(activeFolderAbs, fromName)
    const toAbs = path.resolve(activeFolderAbs, toName)
    if (!fromAbs.startsWith(activeFolderAbs) || !toAbs.startsWith(activeFolderAbs)) {
      return { ok: false, error: 'Invalid PDF path during cleanup.', plan }
    }

    if (!(await pathExists(fromAbs))) {
      // Folder may have moved; keep folder-only path rewrite below.
      break
    }

    if (await pathExists(toAbs)) {
      return {
        ok: false,
        error: `Target PDF already exists: ${toName}.`,
        plan,
      }
    }

    try {
      await renameWithFriendlyError(fromAbs, toAbs, `PDF "${fromName}"`)
      completedFileRenames.push(fileRename)
    } catch (error) {
      const partialPlan: BookDiskCleanupPlan = {
        ...plan,
        fileRenames: completedFileRenames,
        folderNeedsRename: folderMoved,
      }
      if (folderMoved || completedFileRenames.length > 0) {
        await rewriteMaterialsIndexPaths(activeFolder, partialPlan)
        const patchedBook = applyDiskCleanupPlanToBook(book, partialPlan)
        const nextLibrary: BookLibraryPayload = {
          books: library.books.map((entry) => (entry.id === book.id ? patchedBook : entry)),
        }
        try {
          await saveBookLibraryManifest(nextLibrary)
        } catch {
          // ignore secondary save error; surface rename error
        }
        return {
          ok: false,
          error:
            (error instanceof Error ? error.message : 'PDF rename failed.') +
            (folderMoved
              ? ' Folder was renamed and the library list was updated to the new folder where possible.'
              : ''),
          plan,
        }
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'PDF rename failed.',
        plan,
      }
    }
  }

  const finalPlan: BookDiskCleanupPlan = {
    ...plan,
    folderNeedsRename: folderMoved || plan.folderNeedsRename,
    fileRenames:
      completedFileRenames.length === plan.fileRenames.length
        ? plan.fileRenames
        : completedFileRenames,
  }

  // 3) Rewrite supporting materials-index paths (best effort).
  await rewriteMaterialsIndexPaths(activeFolder, finalPlan)

  // 4) Rewrite book manifest paths and save (id unchanged).
  const nextBook = applyDiskCleanupPlanToBook(book, finalPlan)
  const nextLibrary: BookLibraryPayload = {
    books: library.books.map((entry) => (entry.id === book.id ? nextBook : entry)),
  }

  try {
    await saveBookLibraryManifest(nextLibrary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save library list.'
    return {
      ok: false,
      error: `${message} Files may already be renamed — refresh and check paths.`,
      plan,
    }
  }

  return { ok: true, dryRun: false, plan: finalPlan, library: nextLibrary }
}
