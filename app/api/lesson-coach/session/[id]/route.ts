import { NextResponse } from 'next/server'
import { lessonCoachSessionPatchSchema } from '@/lib/lesson-coach/types'
import { getLessonCoachSession, patchLessonCoachSession } from '@/lib/lesson-coach/session-store'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params
  const session = getLessonCoachSession(id)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Session not found.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, session })
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = lessonCoachSessionPatchSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid patch.' }, { status: 400 })
  }

  const session = patchLessonCoachSession(id, parsed.data)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Session not found.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, session })
}
