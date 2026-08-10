import {
  formatReadingStoryPageMarker,
  isIllustrationOnlySectionText,
  parseReadingStoryPageSections,
} from '@/lib/books/reading-story-page-markers'

/** Word count above which a page is considered dense (multiple light checks OK). */
export const READING_CHECK_DENSE_PAGE_WORD_THRESHOLD = 80

export type ReadingCheckDraftPageBrief = {
  displayPage: number | null
  pdfPage: number
  wordCount: number
  illustrationOnly: boolean
  dense: boolean
}

export type ReadingCheckDraftPlan = {
  textPageCount: number
  illustrationPageCount: number
  densePages: ReadingCheckDraftPageBrief[]
  targetMinChecks: number
  targetMaxChecks: number
  pageBriefs: string[]
}

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}

export function targetCheckRangeForTextPageCount(textPageCount: number): {
  min: number
  max: number
} {
  if (textPageCount <= 6) return { min: 2, max: 4 }
  if (textPageCount <= 14) return { min: 4, max: 8 }
  return { min: 6, max: 12 }
}

function formatPageBriefLabel(brief: ReadingCheckDraftPageBrief): string {
  const page =
    brief.displayPage != null ? `p${brief.displayPage}` : `pdf${brief.pdfPage}`
  if (brief.illustrationOnly) return `${page}: illustration only`
  if (brief.dense) return `${page}: dense (${brief.wordCount}w), multiple light checks OK`
  return `${page}: ${brief.wordCount}w`
}

/**
 * Analyze saved story text for AI check drafting (beat density, length budget).
 */
export function analyzeStoryForCheckDraft(
  storyText: string,
  opts?: { denseWordThreshold?: number },
): ReadingCheckDraftPlan {
  const threshold = opts?.denseWordThreshold ?? READING_CHECK_DENSE_PAGE_WORD_THRESHOLD
  const sections = parseReadingStoryPageSections(storyText)

  let textPageCount = 0
  let illustrationPageCount = 0
  const pageBriefRows: ReadingCheckDraftPageBrief[] = []

  for (const section of sections) {
    const illustrationOnly = isIllustrationOnlySectionText(section.text)
    const wordCount = illustrationOnly ? 0 : countWords(section.text)
    const dense = !illustrationOnly && wordCount >= threshold

    if (illustrationOnly) {
      illustrationPageCount += 1
    } else {
      textPageCount += 1
    }

    pageBriefRows.push({
      displayPage: section.displayPage,
      pdfPage: section.pdfPage,
      wordCount,
      illustrationOnly,
      dense,
    })
  }

  // Paste-only text with no markers: treat whole body as one text page.
  if (sections.length === 0 && storyText.trim()) {
    const wordCount = countWords(storyText)
    textPageCount = 1
    pageBriefRows.push({
      displayPage: null,
      pdfPage: 0,
      wordCount,
      illustrationOnly: false,
      dense: wordCount >= threshold,
    })
  }

  const { min: targetMinChecks, max: targetMaxChecks } =
    targetCheckRangeForTextPageCount(textPageCount)

  const densePages = pageBriefRows.filter((p) => p.dense)
  const pageBriefs = pageBriefRows.map(formatPageBriefLabel)

  return {
    textPageCount,
    illustrationPageCount,
    densePages,
    targetMinChecks,
    targetMaxChecks,
    pageBriefs,
  }
}

/** Compact block for the Gemini user message. */
export function formatReadingCheckDraftPlanForPrompt(plan: ReadingCheckDraftPlan): string {
  const denseLabels = plan.densePages
    .map((p) => (p.displayPage != null ? `p${p.displayPage}` : `pdf${p.pdfPage}`))
    .join(', ')

  const lines = [
    `Draft plan: ${plan.textPageCount} text page${plan.textPageCount === 1 ? '' : 's'}, ${plan.illustrationPageCount} illustration-only, target ${plan.targetMinChecks}–${plan.targetMaxChecks} checks`,
  ]
  if (denseLabels) {
    lines.push(`Dense pages: ${denseLabels}`)
  }
  if (plan.pageBriefs.length > 0) {
    lines.push('Page briefs:')
    for (const brief of plan.pageBriefs) {
      lines.push(`- ${brief}`)
    }
  }
  return lines.join('\n')
}

/** Build a minimal tagged story excerpt for tests. */
export function buildTaggedStoryExcerpt(
  pages: Array<{ displayPage: number; pdfPage: number; text: string }>,
): string {
  return pages
    .map(
      (p) =>
        `${formatReadingStoryPageMarker({ displayPage: p.displayPage, pdfPage: p.pdfPage })}\n${p.text}`,
    )
    .join('\n\n')
}
