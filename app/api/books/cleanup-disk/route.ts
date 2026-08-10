import { NextResponse } from 'next/server'
import { runBookDiskCleanup } from '@/lib/books/book-disk-cleanup-server'

export const runtime = 'nodejs'

/**
 * Preview or apply book folder/PDF cleanup.
 * Body: { bookId: string, dryRun?: boolean }
 * Never renames book.id.
 */
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const bookId = typeof record?.bookId === 'string' ? record.bookId.trim() : ''
  if (!bookId) {
    return NextResponse.json({ error: 'bookId is required.' }, { status: 400 })
  }
  const dryRun = record?.dryRun !== false

  try {
    const result = await runBookDiskCleanup({ bookId, dryRun })
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, plan: result.plan ?? null },
        { status: 400 },
      )
    }
    if (result.dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        plan: result.plan,
        bookId: result.book.id,
      })
    }
    return NextResponse.json({
      ok: true,
      dryRun: false,
      plan: result.plan,
      library: result.library,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cleanup failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
