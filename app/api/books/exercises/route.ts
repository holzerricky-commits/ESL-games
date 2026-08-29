import { NextResponse } from 'next/server'
import {
  createBookExerciseTask,
  deleteBookExerciseTask,
  listBookExerciseTasks,
  updateBookExerciseTask,
} from '@/lib/books/book-exercises-server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    const unitId = url.searchParams.get('unitId')?.trim() || null
    if (!bookId) {
      return NextResponse.json({ ok: false, error: 'bookId is required.' }, { status: 400 })
    }
    const items = await listBookExerciseTasks(bookId, unitId)
    if (items == null) {
      return NextResponse.json({ ok: false, error: 'Book not found.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, items })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load exercises.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      bookId?: string
      unitId?: string
      pdfPage?: number
      rect?: { x?: number; y?: number; w?: number; h?: number }
      label?: string
      kind?: string
    } | null
    const bookId = String(body?.bookId ?? '').trim()
    const unitId = String(body?.unitId ?? '').trim()
    const pdfPage = Number(body?.pdfPage)
    const rect = body?.rect
    if (!bookId || !unitId) {
      return NextResponse.json({ ok: false, error: 'bookId and unitId are required.' }, { status: 400 })
    }
    if (!rect || typeof rect !== 'object') {
      return NextResponse.json({ ok: false, error: 'rect is required.' }, { status: 400 })
    }
    const result = await createBookExerciseTask({
      bookId,
      unitId,
      pdfPage,
      rect: {
        x: Number(rect.x),
        y: Number(rect.y),
        w: Number(rect.w),
        h: Number(rect.h),
      },
      label: body?.label,
      kind: body?.kind,
    })
    if ('error' in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, item: result })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to save the exercise box.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      bookId?: string
      taskId?: string
      label?: string
      wordBank?: string[]
      items?: Array<{ id?: string; stem?: string; answers?: string[] }>
      questions?: Array<{ id?: string; prompt?: string; choices?: string[]; correctIndex?: number | null }>
      status?: 'draft' | 'approved'
      pin?: [number, number] | { x?: number; y?: number }
    } | null
    const bookId = String(body?.bookId ?? '').trim()
    const taskId = String(body?.taskId ?? '').trim()
    if (!bookId || !taskId) {
      return NextResponse.json({ ok: false, error: 'bookId and taskId are required.' }, { status: 400 })
    }
    const pinRaw = body?.pin
    const pin =
      Array.isArray(pinRaw) && pinRaw.length >= 2
        ? ([Number(pinRaw[0]), Number(pinRaw[1])] as [number, number])
        : pinRaw && typeof pinRaw === 'object' && !Array.isArray(pinRaw)
          ? ([Number(pinRaw.x), Number(pinRaw.y)] as [number, number])
          : undefined
    const result = await updateBookExerciseTask({
      bookId,
      taskId,
      label: body?.label,
      wordBank: Array.isArray(body?.wordBank) ? body.wordBank.map(String) : undefined,
      items: Array.isArray(body?.items) ? body.items : undefined,
      questions: Array.isArray(body?.questions) ? body.questions : undefined,
      status: body?.status === 'approved' || body?.status === 'draft' ? body.status : undefined,
      pin: pin && Number.isFinite(pin[0]) && Number.isFinite(pin[1]) ? pin : undefined,
    })
    if ('error' in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, item: result })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to save the exercise.' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    const taskId = url.searchParams.get('taskId')?.trim() ?? ''
    if (!bookId || !taskId) {
      return NextResponse.json({ ok: false, error: 'bookId and taskId are required.' }, { status: 400 })
    }
    const result = await deleteBookExerciseTask(bookId, taskId)
    if ('error' in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to delete the exercise.' }, { status: 500 })
  }
}
