import {
  createEmptyReadingCheckStop,
  type ReadingCheckStop,
} from '@/lib/books/reading-check-pack'
import {
  formatReadingStoryPageMarker,
  parseReadingStoryPageSections,
} from '@/lib/books/reading-story-page-markers'

/** Embedded Stop and Check from publisher pages (Journeys / Wonders). */
export const READING_STORY_STOP_CHECK_OPEN_RE =
  /<<<stop_check\s+display="(\d+|·)"\s+pdf="(\d+)">>>/gi

export const READING_STORY_STOP_CHECK_CLOSE = '<<</stop_check>>>'

export type ReadingStoryStopCheckItem = {
  id: string
  displayPage: number | null
  pdfPage: number | null
  /** Publisher question text. */
  prompt: string
  /** Optional answer / tip if transcribed. */
  answerHint: string | null
}

export function formatReadingStoryStopCheckMarker(args: {
  displayPage: number | null
  pdfPage: number
  prompt: string
  answerHint?: string | null
}): string {
  const pdf = Math.max(1, Math.floor(args.pdfPage))
  const display =
    args.displayPage != null && Number.isFinite(args.displayPage) && args.displayPage >= 1
      ? String(Math.floor(args.displayPage))
      : '·'
  const prompt = args.prompt.trim()
  const answer = args.answerHint?.trim() || ''
  const body = answer ? `${prompt}\n<<<answer>>>\n${answer}` : prompt
  return `<<<stop_check display="${display}" pdf="${pdf}">>>\n${body}\n${READING_STORY_STOP_CHECK_CLOSE}`
}

function newHarvestId(index: number): string {
  return `sc-${index + 1}`
}

function parseStopCheckBody(body: string): { prompt: string; answerHint: string | null } {
  const trimmed = body.trim()
  const answerSplit = trimmed.split(/<<<answer>>>/i)
  const prompt = (answerSplit[0] ?? '').trim()
  const answerHint =
    answerSplit.length > 1 ? (answerSplit.slice(1).join('\n').trim() || null) : null
  return { prompt, answerHint }
}

/**
 * Parse tagged Stop and Check blocks from saved story text.
 */
export function parseReadingStoryStopChecks(storyText: string): ReadingStoryStopCheckItem[] {
  const text = typeof storyText === 'string' ? storyText : ''
  if (!text.trim()) return []

  const out: ReadingStoryStopCheckItem[] = []
  const openRe = new RegExp(READING_STORY_STOP_CHECK_OPEN_RE.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = openRe.exec(text)) != null) {
    const start = match.index + match[0].length
    const closeAt = text.indexOf(READING_STORY_STOP_CHECK_CLOSE, start)
    const end = closeAt >= 0 ? closeAt : text.length
    const displayRaw = match[1]!
    const pdfRaw = match[2]!
    const pdfPage = Math.floor(Number(pdfRaw))
    const displayPage =
      displayRaw !== '·' && /^\d+$/.test(displayRaw) ? Math.floor(Number(displayRaw)) : null
    const { prompt, answerHint } = parseStopCheckBody(text.slice(start, end))
    if (!prompt) continue
    out.push({
      id: newHarvestId(out.length),
      displayPage: displayPage != null && displayPage >= 1 ? displayPage : null,
      pdfPage: Number.isFinite(pdfPage) && pdfPage >= 1 ? pdfPage : null,
      prompt,
      answerHint,
    })
    if (closeAt >= 0) {
      openRe.lastIndex = closeAt + READING_STORY_STOP_CHECK_CLOSE.length
    }
  }

  // Soft harvest: "Stop and Check" headings without markers (older scans).
  if (out.length === 0) {
    out.push(...harvestLooseStopAndCheck(text))
  }

  return out
}

/**
 * Find "Stop and Check" (or similar) lines and attach to nearest page marker.
 */
export function harvestLooseStopAndCheck(storyText: string): ReadingStoryStopCheckItem[] {
  const sections = parseReadingStoryPageSections(storyText)
  const out: ReadingStoryStopCheckItem[] = []
  const headingRe =
    /^(?:Stop\s*(?:and|&)\s*Check|Stop\s*&\s*Check|Check\s*for\s*Understanding)\s*[:.\-]?$/i

  const scanBlock = (
    block: string,
    displayPage: number | null,
    pdfPage: number | null,
  ) => {
    const lines = block.split(/\r?\n/)
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!.trim()
      if (!headingRe.test(line)) continue
      let prompt = ''
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = lines[j]!.trim()
        if (!next) {
          if (prompt) break
          continue
        }
        if (headingRe.test(next) || /^<<<page\b/i.test(next) || /^<<<stop_check\b/i.test(next)) {
          break
        }
        prompt = next
        break
      }
      if (prompt.length < 8) continue
      out.push({
        id: newHarvestId(out.length),
        displayPage,
        pdfPage,
        prompt,
        answerHint: null,
      })
    }
  }

  if (sections.length > 0) {
    for (const section of sections) {
      scanBlock(section.text, section.displayPage, section.pdfPage)
    }
    return out
  }

  scanBlock(storyText, null, null)
  return out
}

/** Prompt block for AI draft — must-cover publisher pauses. */
export function formatStopChecksForPrompt(items: ReadingStoryStopCheckItem[]): string {
  if (items.length === 0) return 'Publisher Stop and Check: (none found)'
  const lines = [
    'Publisher Stop and Check (must cover — rewrite for spoken ESL if needed; do not skip these page beats):',
  ]
  for (const item of items) {
    const page =
      item.displayPage != null
        ? `p${item.displayPage}`
        : item.pdfPage != null
          ? `pdf${item.pdfPage}`
          : 'page?'
    lines.push(`- ${page}: ${item.prompt}`)
    if (item.answerHint) lines.push(`  (hint: ${item.answerHint})`)
  }
  return lines.join('\n')
}

/**
 * Turn harvested publisher questions into draft reading-check stops (teacher edits answers).
 */
export function stopChecksToReadingCheckStops(
  items: ReadingStoryStopCheckItem[],
): ReadingCheckStop[] {
  return items.map((item, index) => {
    const stop = createEmptyReadingCheckStop(item.displayPage, 'true_false')
    const pageLabel =
      item.displayPage != null ? `p${item.displayPage}` : item.pdfPage != null ? `pdf ${item.pdfPage}` : null
    return {
      ...stop,
      label: pageLabel ? `Stop and Check · ${pageLabel}` : `Stop and Check ${index + 1}`,
      midPageNote: 'Publisher Stop and Check',
      questions: [
        {
          ...stop.questions[0]!,
          prompt: item.prompt,
          correctTrue: true,
          evidenceSnippet: item.answerHint,
          evidenceHighlight: null,
        },
      ],
    }
  })
}

/** Deduplicate harvest items already imported (same prompt + page). */
export function filterNewStopChecks(
  items: ReadingStoryStopCheckItem[],
  existingStops: ReadingCheckStop[],
): ReadingStoryStopCheckItem[] {
  return items.filter((item) => {
    const promptKey = item.prompt.trim().toLowerCase()
    return !existingStops.some((stop) => {
      const q = stop.questions[0]?.prompt?.trim().toLowerCase() ?? ''
      if (q !== promptKey) return false
      if (item.displayPage != null && stop.displayPage != null) {
        return item.displayPage === stop.displayPage
      }
      return true
    })
  })
}

/** Example tagged snippet for tests. */
export function buildTaggedStopCheckExample(): string {
  return [
    formatReadingStoryPageMarker({ displayPage: 22, pdfPage: 24 }),
    'Tillie walked to school.',
    formatReadingStoryStopCheckMarker({
      displayPage: 22,
      pdfPage: 24,
      prompt: 'Why did Tillie feel worried?',
      answerHint: 'She saw Mr. Keene in the hallway.',
    }),
  ].join('\n')
}
