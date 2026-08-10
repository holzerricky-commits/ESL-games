import path from 'node:path'
import { access, constants, rm } from 'node:fs/promises'
import { resolveBookFolderForBook } from '@/lib/books/book-cover-path'
import { getBookLibraryRoot, loadBookLibrary, saveBookLibraryManifest } from '@/lib/books/server'
import type { BookLibraryPayload } from '@/lib/books/types'

export type RemoveBookResult =
  | {
      ok: true
      library: BookLibraryPayload
      deletedFolder: string | null
      filesDeleted: boolean
    }
  | { ok: false; error: string }

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

/**
 * Remove a book from the library list. Optionally delete its folder under book-library.
 * Never deletes the book-library root. Skips file delete if another book still uses the folder.
 */
export async function removeBookFromLibrary(options: {
  bookId: string
  deleteFiles: boolean
}): Promise<RemoveBookResult> {
  const bookId = options.bookId.trim()
  if (!bookId) return { ok: false, error: 'bookId is required.' }

  const library = await loadBookLibrary()
  const book = library.books.find((entry) => entry.id === bookId)
  if (!book) return { ok: false, error: 'Book not found.' }

  const folder = resolveBookFolderForBook(book)
  const nextLibrary: BookLibraryPayload = {
    books: library.books.filter((entry) => entry.id !== bookId),
  }

  let deletedFolder: string | null = null
  let filesDeleted = false

  if (options.deleteFiles && folder) {
    const stillUsed = nextLibrary.books.some((entry) => resolveBookFolderForBook(entry) === folder)
    if (stillUsed) {
      await saveBookLibraryManifest(nextLibrary)
      return {
        ok: true,
        library: nextLibrary,
        deletedFolder: null,
        filesDeleted: false,
      }
    }

    const libraryRoot = getBookLibraryRoot()
    const absFolder = path.resolve(libraryRoot, folder)
    const rootPrefix = libraryRoot.endsWith(path.sep) ? libraryRoot : `${libraryRoot}${path.sep}`
    if (absFolder === libraryRoot || !absFolder.startsWith(rootPrefix)) {
      return { ok: false, error: 'Refusing to delete a path outside the book library.' }
    }

    if (await pathExists(absFolder)) {
      try {
        await rm(absFolder, { recursive: true, force: false })
        deletedFolder = folder
        filesDeleted = true
      } catch (error) {
        if (isBusyError(error)) {
          return {
            ok: false,
            error:
              'Could not delete files — the PDF may be open. Close the book reader (and any other app using these files), then try again.',
          }
        }
        const message = error instanceof Error ? error.message : 'Delete failed.'
        return { ok: false, error: `Could not delete files: ${message}` }
      }
    }
  }

  await saveBookLibraryManifest(nextLibrary)
  return {
    ok: true,
    library: nextLibrary,
    deletedFolder,
    filesDeleted,
  }
}
