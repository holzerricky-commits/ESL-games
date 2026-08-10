import { NextResponse } from 'next/server'
import { removeBookFromLibrary } from '@/lib/books/book-remove-server'

export const runtime = 'nodejs'

/**
 * Remove a book from the library.
 * Body: { bookId: string, deleteFiles?: boolean } — deleteFiles defaults to true.
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
  const deleteFiles = record?.deleteFiles !== false

  try {
    const result = await removeBookFromLibrary({ bookId, deleteFiles })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      library: result.library,
      deletedFolder: result.deletedFolder,
      filesDeleted: result.filesDeleted,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Remove failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
