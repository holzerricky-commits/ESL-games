import { inferBookCatalogLabels, resolveBookCatalogIdentity } from '@/lib/books/book-catalog-labels'
import type { BookRecord } from '@/lib/books/types'

/** Which TOC extraction recipe to use (prompt + week/lesson labeling). */
export const TOC_EXTRACT_PROFILE_IDS = [
  'journeys',
  'wonders_workshop',
  'wonders_literature',
] as const

export type TocExtractProfileId = (typeof TOC_EXTRACT_PROFILE_IDS)[number]

export function isTocExtractProfileId(value: unknown): value is TocExtractProfileId {
  return typeof value === 'string' && (TOC_EXTRACT_PROFILE_IDS as readonly string[]).includes(value)
}

/**
 * Pick TOC extract profile from catalog identity / filename cues.
 * Workshop & Literature roles use Wonders recipes even when series is unset.
 */
export function resolveTocExtractProfile(input: {
  series?: string | null
  role?: string | null
  title?: string | null
  id?: string | null
  folderName?: string | null
}): TocExtractProfileId {
  const series = (input.series ?? '').trim()
  const role = (input.role ?? '').trim()
  const haystack = [input.id, input.title, input.folderName, series, role]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')

  const isWorkshop = role === 'Workshop' || /\bworkshop\b/.test(haystack)
  const isLiterature =
    role === 'Literature' || /\bliterature\b/.test(haystack) || /\banthology\b/.test(haystack)

  if (isWorkshop) return 'wonders_workshop'
  if (isLiterature) return 'wonders_literature'

  if (/^wonders$/i.test(series) || /\bwonders?\b/.test(haystack)) {
    // Series alone: prefer Workshop layout (skill book) over Literature.
    return 'wonders_workshop'
  }

  return 'journeys'
}

export function resolveTocExtractProfileForBook(book: BookRecord): TocExtractProfileId {
  const identity = resolveBookCatalogIdentity(book)
  return resolveTocExtractProfile({
    series: identity.series,
    role: identity.role,
    title: book.title,
    id: book.id,
  })
}

/** Infer profile when only a loose title/id is known (e.g. before catalog save). */
export function resolveTocExtractProfileFromLabels(input: {
  title?: string | null
  id?: string | null
  folderName?: string | null
}): TocExtractProfileId {
  const inferred = inferBookCatalogLabels(input)
  return resolveTocExtractProfile({
    series: inferred.series,
    role: inferred.role,
    title: input.title,
    id: input.id,
    folderName: input.folderName,
  })
}

export const JOURNEYS_TOC_EXTRACT_PROMPT = `You extract textbook TOC structure from images.

Return only valid JSON with this shape:
{
  "units": [
    {
      "unitNumber": 1,
      "title": "Good Citizens",
      "lessons": [
        {
          "lessonNumber": 1,
          "title": "Lesson 1",
          "entries": [
            { "title": "Vocabulary in Context", "startPrintedPage": 10 },
            { "title": "Comprehension: Story Structure + Summarize", "startPrintedPage": 13 },
            { "title": "A Fine, Fine School", "startPrintedPage": 14 }
          ]
        }
      ],
      "specialSections": [
        { "title": "READING POWER", "startPrintedPage": 182 },
        { "title": "Unit Wrap-Up", "startPrintedPage": 184 },
        { "title": "Glossary", "startPrintedPage": null }
      ]
    }
  ]
}

Rules:
- Unit heading appears near top and each unit spans a 2-page TOC spread.
- Lessons are indicated by red shield lesson markers.
- Include only section rows that have dotted leaders to a page number, plus story/title rows with a page number.
- Ignore rows without usable page numbers.
- Keep exact visible order.
- Include unit special sections outside lessons: READING POWER and Unit Wrap-Up.
- If final unit has Glossary without number, set startPrintedPage null and include it anyway.
- Never invent printed page numbers.
`

export const WONDERS_WORKSHOP_TOC_EXTRACT_PROMPT = `You extract McGraw-Hill Wonders Reading/Writing Workshop TOC structure from images.

Return only valid JSON with this shape:
{
  "units": [
    {
      "unitNumber": 6,
      "title": "How on Earth?",
      "lessons": [
        {
          "lessonNumber": 2,
          "title": "Pedal Power",
          "entries": [
            { "title": "Vocabulary", "startPrintedPage": 418 },
            { "title": "Pedal Power", "startPrintedPage": 420 },
            { "title": "Comprehension Strategy: Reread", "startPrintedPage": 424 },
            { "title": "Comprehension Skill: Author's Purpose", "startPrintedPage": 425 },
            { "title": "Genre: Expository Text", "startPrintedPage": 426 },
            { "title": "Vocabulary Strategy: Paragraph Clues", "startPrintedPage": 427 },
            { "title": "Writing: Word Choice", "startPrintedPage": 428 }
          ]
        }
      ],
      "specialSections": [
        { "title": "Grammar Handbook", "startPrintedPage": 472 }
      ]
    }
  ]
}

Rules:
- This is Wonders Workshop (NOT Journeys). There are no red lesson shields.
- Units are labeled Unit 1–6 (often with a Big Idea / essential question). Use the unit theme as title when visible.
- Chunks under a unit are WEEKS (Week 1, Week 2, …), not "Lesson N". Put the week number in lessonNumber and the weekly concept / week theme in title (e.g. "Pedal Power", "Friends Help Friends").
- Inside each week, include rows that have a page number, in visible order. Typical week parts:
  1) Vocabulary (or Words to Know)
  2) Shared Read story title (short main selection — use the story title as the entry title)
  3) Comprehension Strategy: …
  4) Comprehension Skill: …
  5) Genre: …
  6) Vocabulary Strategy: … (or Literary Element: … on poetry weeks)
  7) Writing: …
- Keep exact visible wording for strategy/skill/genre/writing lines when possible.
- Ignore rows without usable page numbers.
- Unit special sections outside weeks: Grammar Handbook (and similar end-matter). Put them in specialSections.
- Never invent printed page numbers.
- Do not invent Journeys labels (Vocabulary in Context, Your Turn, Making Connections, READING POWER, Unit Wrap-Up) unless those exact words appear on the page.
`

export const WONDERS_LITERATURE_TOC_EXTRACT_PROMPT = `You extract McGraw-Hill Wonders Literature Anthology TOC structure from images.

Return only valid JSON with this shape:
{
  "units": [
    {
      "unitNumber": 6,
      "title": "How on Earth?",
      "lessons": [
        {
          "lessonNumber": 2,
          "title": "Pedal Power",
          "entries": [
            { "title": "My Light", "startPrintedPage": 514 },
            { "title": "The Power of Water", "startPrintedPage": 534 }
          ]
        }
      ],
      "specialSections": []
    }
  ]
}

Rules:
- This is Wonders Literature Anthology (NOT Journeys, NOT Workshop). There are no red lesson shields and almost no skill/grammar rows.
- Units are labeled Unit 1–6. Use the unit theme as title when visible.
- Chunks under a unit are WEEKS (Week 1, Week 2, …). Put the week number in lessonNumber and the weekly concept / week theme in title when shown; if only story titles appear under a week, use the first (anchor) story title as the week title.
- Each week usually has TWO reading selections with page numbers:
  1) Anchor / main selection (longer) — first story title
  2) Paired selection (shorter) — second story title
- Prefer emitting numbered post-read rows as their own entries when they appear with a usable page number, in visible order between or after selections:
  - "Respond to the Text" / "Respond" / "Connect" / "Connect to …"
  - "About the Author" / "About the Illustrator" (or Author and Illustrator)
- Include only rows that have a usable page number (story/selection and the post-read rows above). Do not invent post-read entries or page numbers when those rows are absent from the TOC.
- Keep exact visible order. Prefer the printed story titles as entry titles (not "Main Selection"/"Paired Selection" unless that is the only label).
- Ignore rows without usable page numbers.
- Never invent printed page numbers.
- Do not invent Workshop skill rows (Comprehension Strategy, Genre, Vocabulary Strategy, Writing) or Journeys labels unless those exact words appear with page numbers.
`

export function tocExtractPromptForProfile(profile: TocExtractProfileId): string {
  switch (profile) {
    case 'wonders_workshop':
      return WONDERS_WORKSHOP_TOC_EXTRACT_PROMPT
    case 'wonders_literature':
      return WONDERS_LITERATURE_TOC_EXTRACT_PROMPT
    case 'journeys':
    default:
      return JOURNEYS_TOC_EXTRACT_PROMPT
  }
}

/** How AI "lessons" are labeled after extract (Week vs Lesson). */
export function tocChunkLabelStyleForProfile(
  profile: TocExtractProfileId,
): 'lesson' | 'week' {
  return profile === 'journeys' ? 'lesson' : 'week'
}
