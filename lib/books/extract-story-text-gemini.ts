import 'server-only'

import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { slicePdfToTwoPageBytes } from '@/lib/context/slice-pdf-two-pages'
import { READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER } from '@/lib/books/reading-story-page-markers'
import { resolveGeminiApiKey } from '@/lib/gemini'

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const

/** Pages per Gemini call — matches proven vocab PDF window size. */
const CHUNK_PAGES = 2

const SYSTEM_INSTRUCTION = `You are a careful transcription assistant for children's ESL reading anthologies.

The attached PDF contains only the page(s) named in the user message (often image scans of a printed book).

Your job:
- Transcribe the **story prose** in reading order (left-to-right, top-to-bottom).
- Keep paragraph breaks where they clearly exist.
- Skip page numbers, headers, footers, lesson chrome, vocabulary boxes, directions, and non-story sidebars — **except** publisher **Stop and Check** (or "Stop & Check" / "Check for Understanding") boxes at the bottom of story pages: keep those.
- When you find a Stop and Check (or similar) box, output it using this exact shape (use the PDF page number from the user message for pdf="…"; use printed page if visible else · for display):
  <<<stop_check display="N" pdf="M">>>
  the question text
  <<<answer>>>
  answer or tip text if printed (omit the <<<answer>>> line if none)
  <<</stop_check>>>
- Do not invent text. If a word is unreadable, use [?] for that word.
- If a page has no story prose (full-page illustration, title spread with no body), output a line exactly: --- Page N --- (use the PDF page number from the user message) followed by the exact line: ${READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER}
- If a multi-page attachment mixes text and art, transcribe text pages normally and mark art-only pages with --- Page N --- and ${READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER}.
- Return plain text only — no JSON, no markdown fences, no commentary before or after the transcript.`

async function callGeminiWithPdf(
  userText: string,
  pdfBytes: Uint8Array,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = await resolveGeminiApiKey()
  if (!key) {
    return {
      ok: false,
      error: 'Gemini API key is not configured. Set GEMINI_API_KEY, or paste the story text manually.',
    }
  }
  const base64 = Buffer.from(pdfBytes).toString('base64')
  const failures: string[] = []
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [
              {
                role: 'user',
                parts: [
                  { text: userText },
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
            },
          }),
        },
      )
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 180)
        if (res.status === 429) {
          failures.push(`${model}: rate limited`)
        } else {
          failures.push(`${model}: HTTP ${res.status}${snippet ? ` (${snippet})` : ''}`)
        }
        continue
      }
      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> }
          finishReason?: string
        }>
        promptFeedback?: { blockReason?: string }
      }
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
      if (text) return { ok: true, text }
      const block = data?.promptFeedback?.blockReason
      const finish = data?.candidates?.[0]?.finishReason
      failures.push(
        `${model}: empty${block ? ` (blocked: ${block})` : finish ? ` (${finish})` : ''}`,
      )
    } catch (err) {
      failures.push(`${model}: ${err instanceof Error ? err.message : 'network error'}`)
    }
  }
  const detail = failures[0] ?? 'unknown error'
  const rateLimited = failures.some((f) => /rate limited/i.test(f))
  return {
    ok: false,
    error: rateLimited
      ? 'Gemini is rate-limiting story page reads right now. Wait a few minutes, then use Continue scan (or Re-scan). Or paste the text by hand.'
      : `Gemini could not read these story pages (${detail}). Try again, or paste the text manually.`,
  }
}

function pageHeading(start: number, end: number): string {
  if (start === end) return `--- Page ${start} ---`
  return `--- Pages ${start}–${end} ---`
}

async function getPdfPageCount(absFilePath: string): Promise<number> {
  const bytes = await readFile(absFilePath)
  const src = await PDFDocument.load(bytes)
  return src.getPageCount()
}

/** How many PDF pages Gemini reads per request. */
export const STORY_TEXT_SCAN_CHUNK_PAGES = CHUNK_PAGES

/**
 * Transcribe one PDF page slice (usually 1–2 pages) via Gemini.
 */
export async function extractStoryTextChunkWithGemini(
  absFilePath: string,
  chunkStartPdfPage: number,
  chunkEndPdfPage: number,
): Promise<{ ok: true; text: string; extractedPages: number } | { ok: false; error: string }> {
  const key = await resolveGeminiApiKey()
  if (!key) {
    return {
      ok: false,
      error: 'Gemini API key is not configured. Set GEMINI_API_KEY, or paste the story text manually.',
    }
  }

  const start = Math.max(1, Math.floor(chunkStartPdfPage))
  const end = Math.max(start, Math.floor(chunkEndPdfPage))

  let filePageCount = 0
  try {
    filePageCount = await getPdfPageCount(absFilePath)
  } catch {
    return {
      ok: false,
      error: 'Could not open this unit’s PDF. Check the file is attached to the unit, then try again.',
    }
  }

  if (filePageCount < 1) {
    return {
      ok: false,
      error: 'This unit’s PDF has no pages. Attach the correct file, or paste the story text manually.',
    }
  }

  if (start > filePageCount) {
    return {
      ok: false,
      error: `Those pages aren’t in this PDF (file has ${filePageCount} pages; scan asked for ${start}–${end}). Open the book, note where the story starts in the file, update the page range, or paste the text.`,
    }
  }

  const chunkEnd = Math.min(end, filePageCount)
  const pdfBytes = await slicePdfToTwoPageBytes(absFilePath, start, chunkEnd)
  if (!pdfBytes?.length) {
    return {
      ok: false,
      error: `Could not cut PDF pages ${start}–${chunkEnd} (file has ${filePageCount} pages). Try different pages, or paste the story text.`,
    }
  }

  const pageRangeLabel =
    start === chunkEnd
      ? `PDF page ${start} (1-based). The attachment contains ONLY this page.`
      : `PDF pages ${start}–${chunkEnd} (1-based, inclusive). The attachment contains ONLY these pages.`

  const gem = await callGeminiWithPdf(
    `${pageRangeLabel}\n\nTranscribe the story prose from these pages.`,
    pdfBytes,
  )
  if (!gem.ok) return gem

  const body = gem.text.trim()
  if (!body) {
    return { ok: true, text: '', extractedPages: 0 }
  }

  return {
    ok: true,
    text: `${pageHeading(start, chunkEnd)}\n${body}`,
    extractedPages: chunkEnd - start + 1,
  }
}

/**
 * Transcribe story prose for an inclusive PDF page span via Gemini (image-friendly).
 * Sends sequential 2-page PDF slices and stitches plain text in order.
 */
export async function extractStoryTextWithGemini(
  absFilePath: string,
  startPdfPage: number,
  endPdfPage: number,
): Promise<
  | { ok: true; text: string; pageCount: number; extractedPages: number }
  | { ok: false; error: string }
> {
  const start = Math.max(1, Math.floor(startPdfPage))
  const end = Math.max(start, Math.floor(endPdfPage))
  const pageCount = end - start + 1

  const parts: string[] = []
  let extractedPages = 0

  for (let chunkStart = start; chunkStart <= end; chunkStart += CHUNK_PAGES) {
    const chunkEnd = Math.min(chunkStart + CHUNK_PAGES - 1, end)
    const gem = await extractStoryTextChunkWithGemini(absFilePath, chunkStart, chunkEnd)
    if (!gem.ok) return gem
    if (gem.text.trim()) {
      extractedPages += gem.extractedPages
      parts.push(gem.text.trim())
    }
  }

  const text = parts.join('\n\n').trim()
  if (!text) {
    return {
      ok: false,
      error:
        'AI found no story text on those pages. Check the page range, try again, or paste the text manually.',
    }
  }

  return { ok: true, text, pageCount, extractedPages }
}
