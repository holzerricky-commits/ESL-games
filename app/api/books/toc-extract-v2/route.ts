import { NextResponse } from 'next/server'
import { z } from 'zod'
import { extractTocWithGeminiV2, normalizeTocExtractProfile } from '@/lib/books/gemini-toc-v2'
import { TOC_EXTRACT_PROFILE_IDS } from '@/lib/books/toc-extract-profile'

export const runtime = 'nodejs'

const imageSchema = z.object({
  pdfPage: z.number().int().min(1),
  mimeType: z.string().min(3).max(64).optional(),
  base64: z.string().min(100).max(4_500_000),
})

const continuationSchema = z
  .object({
    unitNumber: z.number().int().min(1).nullable().optional(),
    title: z.string().min(1).max(220),
    lastLessonNumber: z.number().int().min(1).nullable().optional(),
  })
  .optional()
  .nullable()

const bodySchema = z.object({
  images: z.array(imageSchema).min(1).max(16),
  totalPdfPages: z.number().int().min(1),
  notCountedPdfPages: z.array(z.number().int().min(1)).max(500).optional(),
  /** journeys | wonders_workshop | wonders_literature — defaults to journeys */
  profile: z.enum(TOC_EXTRACT_PROFILE_IDS).optional(),
  /** Open unit from the previous extract pass (multi-page batching). */
  continuationHint: continuationSchema,
})

export async function POST(req: Request) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed.', details: parsed.error.flatten() }, { status: 400 })
    }
    const {
      images,
      totalPdfPages,
      notCountedPdfPages = [],
      profile: profileRaw,
      continuationHint = null,
    } = parsed.data
    const profile = normalizeTocExtractProfile(profileRaw)
    const out = await extractTocWithGeminiV2(
      images,
      totalPdfPages,
      notCountedPdfPages,
      profile,
      continuationHint,
    )
    if (!out.ok) {
      return NextResponse.json({ error: out.error }, { status: out.status ?? 502 })
    }
    return NextResponse.json({
      drafts: out.drafts,
      lessonsByUnit: out.lessonsByUnit,
      diagnostics: out.diagnostics,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TOC extraction crashed.'
    return NextResponse.json(
      { error: `TOC extraction failed unexpectedly. ${message}` },
      { status: 500 },
    )
  }
}
