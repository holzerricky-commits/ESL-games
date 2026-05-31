import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { GrammarCheckMode } from '@/lib/lesson-coach/grammar-check'
import { runGrammarCheck } from '@/lib/lesson-coach/grammar-check-server'
import { grammarIssueSchema } from '@/lib/lesson-coach/types'

export const runtime = 'nodejs'

const bodySchema = z
  .object({
    text: z.string().max(8_000),
    mode: z.enum(['deep', 'both']).default('both'),
  })
  .strict()

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid body.' }, { status: 400 })
  }

  const { text, mode } = parsed.data
  if (!text.trim()) {
    return NextResponse.json({
      ok: true,
      issues: [],
      issueCount: 0,
      mode: mode as GrammarCheckMode,
    })
  }

  try {
    const result = await runGrammarCheck(text, mode)
    const issues = result.issues.map((issue) => grammarIssueSchema.parse(issue))
    return NextResponse.json({
      ok: true,
      issues,
      issueCount: result.issueCount,
      mode: result.mode,
      warning: result.warning ?? null,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Grammar check failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
