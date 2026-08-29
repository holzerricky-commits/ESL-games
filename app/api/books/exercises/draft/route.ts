import { NextResponse } from 'next/server'
import {
  draftBookExerciseFromCropJpeg,
  draftBookExerciseMcqFromCropJpeg,
} from '@/lib/books/draft-book-exercise-gemini'
import { listBookExerciseTasks, updateBookExerciseTask } from '@/lib/books/book-exercises-server'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_JPEG_CHARS = 3_500_000

function readJpegBase64(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  const comma = trimmed.indexOf(',')
  const data = trimmed.startsWith('data:') && comma >= 0 ? trimmed.slice(comma + 1) : trimmed
  if (data.length < 80 || data.length > MAX_JPEG_CHARS) return null
  if (!/^[A-Za-z0-9+/]+=*$/.test(data.slice(0, 80))) return null
  return data
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      bookId?: string
      taskId?: string
      jpegBase64?: string
    } | null
    const bookId = String(body?.bookId ?? '').trim()
    const taskId = String(body?.taskId ?? '').trim()
    if (!bookId || !taskId) {
      return NextResponse.json({ ok: false, error: 'bookId and taskId are required.' }, { status: 400 })
    }
    const jpegBase64 = readJpegBase64(body?.jpegBase64)
    if (!jpegBase64) {
      return NextResponse.json({ ok: false, error: 'Could not read the picture of that box.' }, { status: 400 })
    }

    const items = await listBookExerciseTasks(bookId)
    if (items == null) {
      return NextResponse.json({ ok: false, error: 'Book not found.' }, { status: 404 })
    }
    const task = items.find((item) => item.id === taskId)
    if (!task) {
      return NextResponse.json({ ok: false, error: 'Task not found.' }, { status: 404 })
    }

    if (task.kind === 'multiple_choice') {
      const drafted = await draftBookExerciseMcqFromCropJpeg({ jpegBase64 })
      if (!drafted.ok) {
        return NextResponse.json(
          { ok: false, error: drafted.error, unusable: drafted.unusable === true },
          { status: drafted.unusable ? 422 : 502 },
        )
      }

      const saved = await updateBookExerciseTask({
        bookId,
        taskId,
        questions: drafted.draft.questions,
        status: 'draft',
      })
      if ('error' in saved) {
        return NextResponse.json({ ok: false, error: saved.error }, { status: saved.status })
      }

      return NextResponse.json({ ok: true, item: saved })
    }

    const drafted = await draftBookExerciseFromCropJpeg({ jpegBase64 })
    if (!drafted.ok) {
      return NextResponse.json(
        { ok: false, error: drafted.error, unusable: drafted.unusable === true },
        { status: drafted.unusable ? 422 : 502 },
      )
    }

    const saved = await updateBookExerciseTask({
      bookId,
      taskId,
      wordBank: drafted.draft.wordBank,
      items: drafted.draft.items,
      status: 'draft',
    })
    if ('error' in saved) {
      return NextResponse.json({ ok: false, error: saved.error }, { status: saved.status })
    }

    return NextResponse.json({ ok: true, item: saved })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to draft from that box.' }, { status: 500 })
  }
}
