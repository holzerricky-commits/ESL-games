import { createHash } from 'node:crypto'
import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { getBookLibraryRoot, loadBookLibrary } from '@/lib/books/server'
import { resolveBookFolderFromUnitPath } from '@/lib/books/book-audio'
import {
  approveBookExerciseTask,
  clampBookExercisePinCenter,
  clampPageNormRect,
  demoteBookExerciseTaskToDraft,
  nextBookExerciseLabel,
  normalizeWordBank,
  parseBookExerciseKind,
  parseBookExerciseTask,
  isBookExerciseMultipleChoice,
  sanitizeBookExerciseItem,
  sanitizeBookExerciseMcqQuestion,
  sortBookExerciseTasks,
  type BookExerciseItem,
  type BookExerciseKind,
  type BookExerciseMcqQuestion,
  type BookExerciseStatus,
  type BookExerciseTask,
  type PageNormRect,
} from '@/lib/books/book-exercises'

function exercisesDir(bookFolder: string): string {
  return path.resolve(getBookLibraryRoot(), bookFolder, 'exercises')
}

function exercisesIndexPath(bookFolder: string): string {
  return path.resolve(exercisesDir(bookFolder), 'exercises.json')
}

async function resolveBookExercisesFolder(bookId: string): Promise<{
  bookFolder: string
  bookId: string
} | null> {
  const library = await loadBookLibrary()
  const book = library.books.find((item) => item.id === bookId)
  if (!book) return null
  const unitPath = book.units[0]?.filePath ?? ''
  const bookFolder = resolveBookFolderFromUnitPath(unitPath)
  if (!bookFolder) return null
  return { bookFolder, bookId }
}

async function readBookExerciseTasks(bookFolder: string): Promise<BookExerciseTask[]> {
  try {
    const raw = await readFile(exercisesIndexPath(bookFolder), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return sortBookExerciseTasks(
      parsed.map(parseBookExerciseTask).filter((item): item is BookExerciseTask => !!item),
    )
  } catch {
    return []
  }
}

async function writeBookExerciseTasks(bookFolder: string, items: BookExerciseTask[]): Promise<void> {
  const indexPath = exercisesIndexPath(bookFolder)
  await mkdir(path.dirname(indexPath), { recursive: true })
  await writeFile(indexPath, JSON.stringify(sortBookExerciseTasks(items), null, 2), 'utf8')
}

function createExerciseId(bookId: string, unitId: string): string {
  return createHash('sha1')
    .update(`${bookId}::${unitId}::${Date.now()}::${Math.random()}`)
    .digest('hex')
    .slice(0, 16)
}

export async function listBookExerciseTasks(
  bookId: string,
  unitId?: string | null,
): Promise<BookExerciseTask[] | null> {
  const resolved = await resolveBookExercisesFolder(bookId)
  if (!resolved) return null
  const items = await readBookExerciseTasks(resolved.bookFolder)
  if (!unitId) return items
  return items.filter((item) => item.unitId === unitId)
}

export async function createBookExerciseTask(params: {
  bookId: string
  unitId: string
  pdfPage: number
  rect: PageNormRect
  label?: string
  kind?: BookExerciseKind | string
}): Promise<BookExerciseTask | { error: string; status: number }> {
  const resolved = await resolveBookExercisesFolder(params.bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }

  const unitId = params.unitId.trim()
  if (!unitId) return { error: 'unitId is required.', status: 400 }
  const pdfPage = Math.floor(params.pdfPage)
  if (!Number.isFinite(pdfPage) || pdfPage < 1) {
    return { error: 'pdfPage must be a positive page number.', status: 400 }
  }
  const rect = clampPageNormRect(params.rect)
  if (!rect) return { error: 'Draw a larger box around the exercise.', status: 400 }

  const existing = await readBookExerciseTasks(resolved.bookFolder)
  const label =
    typeof params.label === 'string' && params.label.trim()
      ? params.label.trim()
      : nextBookExerciseLabel(existing)

  const now = new Date().toISOString()
  const task: BookExerciseTask = {
    id: createExerciseId(params.bookId, unitId),
    kind: parseBookExerciseKind(params.kind),
    status: 'draft',
    unitId,
    pdfPage,
    rect,
    label,
    wordBank: [],
    items: [],
    questions: [],
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
  }

  await writeBookExerciseTasks(resolved.bookFolder, [...existing, task])
  return task
}

export async function updateBookExerciseTask(params: {
  bookId: string
  taskId: string
  label?: string
  wordBank?: string[]
  items?: BookExerciseItem[]
  questions?: BookExerciseMcqQuestion[]
  status?: BookExerciseStatus
  pin?: [number, number]
}): Promise<BookExerciseTask | { error: string; status: number }> {
  const resolved = await resolveBookExercisesFolder(params.bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }
  const taskId = params.taskId.trim()
  if (!taskId) return { error: 'taskId is required.', status: 400 }

  const existing = await readBookExerciseTasks(resolved.bookFolder)
  const index = existing.findIndex((item) => item.id === taskId)
  if (index < 0) return { error: 'Task not found.', status: 404 }

  const prev = existing[index]!
  const pinOnly =
    params.pin != null &&
    params.label == null &&
    params.wordBank == null &&
    params.items == null &&
    params.questions == null &&
    params.status == null

  const wordBank =
    params.wordBank != null ? normalizeWordBank(params.wordBank) : prev.wordBank
  const items =
    params.items != null
      ? params.items
          .map((item) => sanitizeBookExerciseItem(item, wordBank))
          .filter((item): item is BookExerciseItem => !!item)
      : prev.items.map((item) => sanitizeBookExerciseItem(item, wordBank)).filter((item): item is BookExerciseItem => !!item)
  const questions =
    params.questions != null
      ? params.questions
          .map((question) => sanitizeBookExerciseMcqQuestion(question))
          .filter((question): question is BookExerciseMcqQuestion => !!question)
      : (prev.questions ?? []).map((question) => sanitizeBookExerciseMcqQuestion(question)).filter(
          (question): question is BookExerciseMcqQuestion => !!question,
        )

  let next: BookExerciseTask = {
    ...prev,
    label:
      typeof params.label === 'string' && params.label.trim() ? params.label.trim() : prev.label,
    wordBank,
    items,
    questions,
    ...(params.pin != null ? { pin: clampBookExercisePinCenter(params.pin) } : {}),
    updatedAt: new Date().toISOString(),
  }

  if (pinOnly) {
    // Moving the icon must not un-approve the task.
  } else if (params.status === 'approved') {
    const approved = approveBookExerciseTask(next)
    if (!approved) {
      return {
        error: isBookExerciseMultipleChoice(next)
          ? 'Add at least one question with a prompt, 2–4 choices, and pick the correct answer.'
          : 'Add a word bank, at least one sentence with ___, and pick an answer for each gap.',
        status: 400,
      }
    }
    next = approved
  } else if (params.status === 'draft') {
    next = demoteBookExerciseTaskToDraft(next)
  } else if (prev.status === 'approved') {
    next = demoteBookExerciseTaskToDraft(next)
  }

  const updated = [...existing]
  updated[index] = next
  await writeBookExerciseTasks(resolved.bookFolder, updated)
  return next
}

export async function deleteBookExerciseTask(
  bookId: string,
  taskId: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const resolved = await resolveBookExercisesFolder(bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }
  const id = taskId.trim()
  if (!id) return { error: 'taskId is required.', status: 400 }

  const existing = await readBookExerciseTasks(resolved.bookFolder)
  const next = existing.filter((item) => item.id !== id)
  if (next.length === existing.length) return { error: 'Task not found.', status: 404 }

  await writeBookExerciseTasks(resolved.bookFolder, next)
  return { ok: true }
}
