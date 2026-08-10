import { NextRequest, NextResponse } from 'next/server'
import { normalizeChallengeDataDiskPayload } from '@/lib/local-data/challenge-data-disk-types'
import {
  readChallengeDataFromDisk,
  writeChallengeDataToDisk,
} from '@/lib/local-data/challenge-data-disk-server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const payload = await readChallengeDataFromDisk()
    return NextResponse.json({ ok: true, ...payload })
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
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Expected challenge data payload.' }, { status: 400 })
  }
  const payload = normalizeChallengeDataDiskPayload(body)
  try {
    await writeChallengeDataToDisk(payload)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
