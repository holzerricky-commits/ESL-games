import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildCoachUrlFromRequest } from '@/lib/lesson-coach/coach-url'
import { createLessonCoachSession } from '@/lib/lesson-coach/session-store'

export const runtime = 'nodejs'

const createBodySchema = z
  .object({
    studentId: z.string().max(128).optional(),
    studentName: z.string().max(200).optional(),
    bookId: z.string().max(128).optional(),
    bookTitle: z.string().max(300).optional(),
    unitId: z.string().max(128).optional(),
    unitTitle: z.string().max(300).optional(),
    partId: z.string().max(128).optional(),
    partTitle: z.string().max(300).optional(),
    lessonId: z.string().max(128).optional(),
    lessonTitle: z.string().max(300).optional(),
    pacingNotes: z.string().max(20_000).optional(),
  })
  .strict()

export async function POST(req: Request) {
  let body: unknown = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = createBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid body.' }, { status: 400 })
  }

  const id = randomUUID()
  const session = createLessonCoachSession(id, {
    ...parsed.data,
    overlayLastSeenAt: Date.now(),
  })
  const coachUrl = buildCoachUrlFromRequest(req, id)

  return NextResponse.json({
    ok: true,
    id: session.id,
    coachUrl,
    session,
  })
}
