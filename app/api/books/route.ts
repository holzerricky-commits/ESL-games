import { NextResponse } from 'next/server'
import { loadBookLibrary } from '@/lib/books/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const library = await loadBookLibrary()
    return NextResponse.json(library)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load book library'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
