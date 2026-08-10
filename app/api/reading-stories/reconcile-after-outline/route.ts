import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  bookRecordFromOutlineDrafts,
  buildDefaultReconcileDecisions,
  listManualOverridesForBook,
  matchManualStoriesToOutline,
  suggestUnitIdForManualPages,
  type ManualStoryReconcileAction,
} from '@/lib/books/reading-story-outline-migrate'
import { mergeStoriesForBook } from '@/lib/books/reading-story-map'
import {
  applyManualStoryReconcile,
  listReadingStoryOverridesForBook,
} from '@/lib/books/reading-story-store'
import { loadBookLibrary } from '@/lib/books/server'
import type { BookLessonRecord } from '@/lib/books/types'
import type { TocUnitDraft } from '@/lib/books/toc-import'

export const runtime = 'nodejs'

const draftSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  needsReview: z.boolean().optional(),
  filePath: z.string().optional(),
  startPageHint: z.number().optional(),
  endPageHint: z.number().optional(),
  anchorConfidence: z.enum(['high', 'medium', 'low']).optional(),
  anchorSource: z.enum(['toc', 'heading', 'fallback']).optional(),
})

const previewBodySchema = z.object({
  action: z.literal('preview'),
  bookId: z.string().min(1),
  drafts: z.array(draftSchema).min(1),
  lessonsByUnit: z.array(z.array(z.any())).min(1),
  fallbackFilePath: z.string().min(1),
})

const applyBodySchema = z.object({
  action: z.literal('apply'),
  bookId: z.string().min(1),
  decisions: z
    .array(
      z.object({
        manualStoryId: z.string().min(1),
        action: z.enum(['merge', 'keep', 'delete']),
        outlineStoryId: z.string().optional(),
        keepUnitId: z.string().nullable().optional(),
      }),
    )
    .min(1)
    .max(80),
})

export async function POST(req: Request) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
    }

    const action =
      typeof body === 'object' && body && 'action' in body
        ? String((body as { action?: string }).action)
        : ''

    if (action === 'preview') {
      const parsed = previewBodySchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: 'Validation failed.', details: parsed.error.flatten() },
          { status: 400 },
        )
      }
      const { bookId, drafts, lessonsByUnit, fallbackFilePath } = parsed.data
      const library = await loadBookLibrary()
      const bookMeta = library.books.find((b) => b.id === bookId)
      if (!bookMeta) {
        return NextResponse.json({ ok: false, error: 'Book not found.' }, { status: 404 })
      }

      const overrides = await listReadingStoryOverridesForBook(bookId)
      const manualsOnly = listManualOverridesForBook(overrides, bookId)
      if (manualsOnly.length === 0) {
        return NextResponse.json({ ok: true, needed: false, candidates: [], defaults: [] })
      }

      const draftBook = bookRecordFromOutlineDrafts(
        bookMeta,
        drafts as TocUnitDraft[],
        lessonsByUnit as BookLessonRecord[][],
        fallbackFilePath,
      )
      const stories = mergeStoriesForBook(bookId, overrides, draftBook)
      const manuals = stories.filter((s) => s.id.startsWith('manual::'))
      const overridesById = Object.fromEntries(overrides.map((o) => [o.storyId, o]))
      const candidates = matchManualStoriesToOutline({
        book: draftBook,
        manuals,
        overridesById,
      })
      const defaults = buildDefaultReconcileDecisions(candidates)

      const enrichedDefaults = defaults.map((d) => {
        if (d.action !== 'keep') return { ...d, keepUnitId: null as string | null }
        const cand = candidates.find((c) => c.manual.id === d.manualStoryId)
        const start = cand?.override.startPage ?? 1
        const end = cand?.override.endPage ?? start
        return {
          ...d,
          keepUnitId: suggestUnitIdForManualPages(draftBook, start, end),
        }
      })

      return NextResponse.json({
        ok: true,
        needed: candidates.length > 0,
        candidates: candidates.map((c) => {
          const def = enrichedDefaults.find((d) => d.manualStoryId === c.manual.id)
          const suggestedAction = (def?.action ?? 'keep') as ManualStoryReconcileAction
          return {
            manualStoryId: c.manual.id,
            manualTitle: c.manual.title,
            manualStartPage: c.override.startPage,
            manualEndPage: c.override.endPage,
            outlineStoryId: c.outline?.id ?? null,
            outlineTitle: c.outline?.title ?? null,
            outlineLessonTitle: c.outline?.lessonTitle ?? null,
            confidence: c.confidence,
            pageOverlap: c.pageOverlap,
            titleScore: c.titleScore,
            suggestedAction,
            suggestedKeepUnitId: def?.keepUnitId ?? null,
            canMerge: Boolean(c.outline),
          }
        }),
        defaults: enrichedDefaults,
      })
    }

    if (action === 'apply') {
      const parsed = applyBodySchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: 'Validation failed.', details: parsed.error.flatten() },
          { status: 400 },
        )
      }
      const out = await applyManualStoryReconcile(parsed.data)
      return NextResponse.json({ ok: true, ...out })
    }

    return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reconcile failed.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
