import 'server-only'

import { type ReadingCheckPack } from '@/lib/books/reading-check-pack'
import { applyStoryEvidencePagesToStops } from '@/lib/books/reading-check-placement'
import {
  analyzeStoryForCheckDraft,
  formatReadingCheckDraftPlanForPrompt,
} from '@/lib/books/reading-check-draft-plan'
import {
  formatLessonFrameForPrompt,
  isLessonFrameReady,
  type LessonFrameRecord,
} from '@/lib/books/lesson-frame'
import { parseStopsFromAi } from '@/lib/books/parse-reading-check-ai-stops'
import { READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER } from '@/lib/books/reading-story-page-markers'
import {
  formatStopChecksForPrompt,
  parseReadingStoryStopChecks,
  type ReadingStoryStopCheckItem,
} from '@/lib/books/reading-story-stop-checks'
import { resolveGeminiApiKey } from '@/lib/gemini'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const

const MAX_STORY_CHARS = 48_000

const SYSTEM_INSTRUCTION = `You are an ESL reading teacher writing short comprehension checks for a children's story.

## Placement rules (follow in order)

1. **Beat priority** — place checks at story beats, not on a page timer:
   - MUST cover: problem/goal appears, turning point, resolution/ending.
   - SHOULD cover: new character or setting, clear cause→effect.
   - MAY cover: small surprise, joke, or vivid moment if it helps follow the story.

2. **displayPage = page of the evidence** — never earlier:
   - Set displayPage to the printed page number of the <<<page display="N" ...>>> block that contains your evidenceSnippet.
   - The student must already be able to read the answer on that page (or earlier). Do NOT put a check on page N if the fact first appears on page N+1.
   - If the beat ends mid-page, still use that page’s display number (use midPageNote if helpful). Never “preview” a later event on an earlier page.

3. **Page density** — use the Draft plan "Page briefs" and "Dense pages" in the user message:
   - On dense pages (lots of events or many words), multiple **light** checks on the **same displayPage** are encouraged.
   - Light checks: quick true/false or who/where recall — seconds to answer aloud.
   - There is NO minimum spacing between checks and NO maximum checks per page.
   - Prefer heavier why/how questions only at major beats.

4. **No filler** — never add a check only because pages passed. Never use "every N pages."

5. **Illustration-only pages** — story text may include "${READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER}" on art-only spreads:
   - For a visual beat: use a spoken "look at the picture" style prompt OR true/false about what the picture shows; set displayPage to that illustration page when possible; use midPageNote if needed.
   - Or anchor on the nearest text page with a label that references the picture page.

6. **Question weight** — prefer true_false for light stackable checks; use mcq for slightly richer recall. Reserve deeper why/how for turning points.

7. **One question per stop** — if a dense page needs several checks, return several stops (same displayPage is OK). Each stop has exactly one question.

## Lesson frame (when provided in the user message)

When a Lesson frame block is present:
- At least **half** of the checks must practice the named **comprehension skill** on story evidence (e.g. cause→effect questions if the skill is Cause and Effect).
- Include **at least one** check that ties to the **essential question** (student can answer from this story).
- **Vocabulary** checks only for words listed under Target vocabulary — put them in story context (not dictionary definitions).
- Use the **reading strategy** where a beat fits (e.g. predict before a turning point).
- Put the skill or purpose in the stop **label** when helpful (e.g. "Cause: Tillie leaves" / "EQ: taking risks").
- Remaining checks may be light story recall to keep flow.

When no Lesson frame is present: write good beat-based comprehension checks as usual.

## Publisher Stop and Check (when listed in the user message)

- Treat each listed Stop and Check as a **must-cover** beat on that page.
- Include a stop for each one (rewrite wording for spoken ESL if clumsy; keep the same thinking demand).
- Do **not** invent a second competing question on the exact same beat unless the page is dense and needs an extra light check.
- Still add other skill/beat checks elsewhere in the story.

## Question format

For each stop, write exactly ONE question for spoken answer in class:
- Prefer true/false OR multiple choice (4 options, one correct).
- Age-appropriate English.
- Labels should be short beat names a teacher can tap (e.g. "After Tillie goes home").
- Include story evidence so a teacher can verify the answer:
  - evidenceSnippet: 1–3 sentences copied VERBATIM from the story text on the same page as displayPage (not paraphrased; not from illustration placeholders; not from a later page).
  - evidenceHighlight: a short phrase that appears inside evidenceSnippet and supports the correct answer.

Return ONLY JSON (no markdown fences) with this shape:
{
  "stops": [
    {
      "label": "string",
      "displayPage": number or null,
      "midPageNote": "string or null",
      "question": {
        "kind": "true_false" | "mcq",
        "prompt": "string",
        "correctTrue": boolean (required for true_false),
        "choices": ["A","B","C","D"] (required for mcq, exactly 4),
        "correctIndex": 0-3 (required for mcq),
        "evidenceSnippet": "string (verbatim from story)",
        "evidenceHighlight": "string (substring of evidenceSnippet)"
      }
    }
  ]
}`

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim()
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    : trimmed
  const first = withoutFence.indexOf('{')
  const last = withoutFence.lastIndexOf('}')
  const candidate = first >= 0 && last > first ? withoutFence.slice(first, last + 1) : withoutFence
  return JSON.parse(candidate) as unknown
}

async function callGeminiJson(
  userText: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = await resolveGeminiApiKey()
  if (!key) {
    return {
      ok: false,
      error: 'Gemini API key is not configured. Set GEMINI_API_KEY to generate checks.',
    }
  }
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            generationConfig: {
              temperature: 0.35,
              responseMimeType: 'application/json',
              maxOutputTokens: 8192,
            },
          }),
        },
      )
      if (!res.ok) continue
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
      if (text) return { ok: true, text }
    } catch {
      continue
    }
  }
  return { ok: false, error: 'Gemini could not draft checks. Try again, or write them by hand.' }
}

function skillAwareClosingLine(
  draftPlan: { targetMinChecks: number; targetMaxChecks: number },
  frame: LessonFrameRecord | null,
): string {
  const range = `${draftPlan.targetMinChecks}–${draftPlan.targetMaxChecks}`
  if (!frame || !isLessonFrameReady(frame)) {
    return `Propose ${range} comprehension checks as JSON.`
  }
  const skill = frame.comprehensionSkill.trim() || 'the lesson comprehension skill'
  return [
    `Propose ${range} checks as JSON.`,
    `At least half must practice: ${skill}.`,
    frame.essentialQuestion.trim()
      ? `Include at least one check tied to the essential question: ${frame.essentialQuestion.trim()}`
      : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Draft a reading-check pack from saved story text (never approved).
 * When a ready lesson frame is passed, questions skew toward that week's skill.
 */
export async function draftReadingCheckPackWithGemini(params: {
  storyId: string
  bookId: string
  unitId: string
  storyTitle?: string
  storyText: string
  startDisplayPage?: number | null
  endDisplayPage?: number | null
  book?: BookRecord | null
  unit?: BookUnitRecord | null
  totalPdfPages?: number | null
  /** Ready lesson frame — ignored if missing or still draft. */
  lessonFrame?: LessonFrameRecord | null
  /** Harvested publisher Stop and Check items (optional; also parsed from story text). */
  stopChecks?: ReadingStoryStopCheckItem[] | null
}): Promise<
  | { ok: true; pack: ReadingCheckPack; usedLessonFrame: boolean; stopCheckCount: number }
  | { ok: false; error: string }
> {
  const raw = params.storyText.trim()
  if (!raw) {
    return {
      ok: false,
      error: 'Scan or paste story text first, then generate checks.',
    }
  }

  const storyText =
    raw.length > MAX_STORY_CHARS ? `${raw.slice(0, MAX_STORY_CHARS)}\n\n[…truncated…]` : raw

  const draftPlan = analyzeStoryForCheckDraft(storyText)
  const frame =
    params.lessonFrame && isLessonFrameReady(params.lessonFrame) ? params.lessonFrame : null
  const usedLessonFrame = frame != null

  const stopChecks =
    params.stopChecks && params.stopChecks.length > 0
      ? params.stopChecks
      : parseReadingStoryStopChecks(raw)
  const stopCheckCount = stopChecks.length

  const pageHint =
    params.startDisplayPage != null && params.endDisplayPage != null
      ? `Printed page range hint: p${params.startDisplayPage}–${params.endDisplayPage} (use displayPage within this range when possible). Page markers look like <<<page display="N" pdf="M">>> — use the display number when setting displayPage.`
      : 'Page numbers may be unknown; set displayPage to null if unsure.'

  const userText = [
    `Story title: ${params.storyTitle?.trim() || 'Untitled story'}`,
    pageHint,
    '',
    formatReadingCheckDraftPlanForPrompt(draftPlan),
    '',
    usedLessonFrame ? formatLessonFrameForPrompt(frame) : 'Lesson frame: (none — use general comprehension)',
    '',
    formatStopChecksForPrompt(stopChecks),
    '',
    'Story text:',
    storyText,
    '',
    skillAwareClosingLine(draftPlan, frame),
  ].join('\n')

  const gem = await callGeminiJson(userText)
  if (!gem.ok) return gem

  let parsed: unknown
  try {
    parsed = parseJsonFromModelText(gem.text)
  } catch {
    return { ok: false, error: 'AI returned unreadable draft. Try generate again.' }
  }

  const stops = parseStopsFromAi(parsed, { maxStops: draftPlan.targetMaxChecks })
  if (stops.length < draftPlan.targetMinChecks) {
    return {
      ok: false,
      error: `AI draft was too thin (got ${stops.length}, expected at least ${draftPlan.targetMinChecks}). Try generate again, or add checks by hand.`,
    }
  }

  const placed = applyStoryEvidencePagesToStops(stops, raw, {
    book: params.book ?? null,
    unit: params.unit ?? null,
    totalPdfPages: params.totalPdfPages ?? null,
    startDisplayPage: params.startDisplayPage ?? null,
    endDisplayPage: params.endDisplayPage ?? null,
  })

  const now = new Date().toISOString()
  return {
    ok: true,
    usedLessonFrame,
    stopCheckCount,
    pack: {
      storyId: params.storyId,
      bookId: params.bookId,
      unitId: params.unitId,
      status: 'draft',
      stops: placed,
      updatedAt: now,
      approvedAt: null,
    },
  }
}
