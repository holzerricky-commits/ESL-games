import { NextRequest, NextResponse } from 'next/server'
import {
  readRosterPrefsFromDisk,
  writeRosterPrefsToDisk,
} from '@/lib/local-data/roster-prefs-disk-server'
import { normalizeStudentsRosterPrefs } from '@/lib/students/students-roster-prefs'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const prefs = await readRosterPrefsFromDisk()
    return NextResponse.json({ ok: true, prefs })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }
  const prefs = normalizeStudentsRosterPrefs(body)
  try {
    await writeRosterPrefsToDisk(prefs)
    return NextResponse.json({ ok: true, prefs })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
