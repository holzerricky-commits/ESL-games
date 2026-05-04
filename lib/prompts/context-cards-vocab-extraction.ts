/**
 * System + user prompts for extracting “Context Card” vocabulary spreads
 * (e.g. Journeys-style “Vocabulary in Context”: yellow TARGET list + numbered cards).
 *
 * Pair with PDF page images or OCR text from the lesson’s page range. Output maps to
 * `PartContextVocabularyWord` / `InteractiveVocabWord` (id, word, definition, examples[]).
 */

export const CONTEXT_CARDS_VOCAB_SYSTEM_INSTRUCTION = `You are an ESL curriculum assistant. Your job is to extract a TEACHING vocabulary list from textbook pages that use a “Context Cards” / “Vocabulary in Context” layout.

## Typical page layout (visual cues)
- A **lesson heading** such as “Vocabulary in Context”.
- A **yellow sidebar** labeled **TARGET VOCABULARY** (or similar) listing target words in a column. Treat this as a **checklist only**—words may repeat on the page.
- A **main area** with **numbered Context Cards** (1, 2, 3, …). Each card usually contains:
  - The **target word** as a prominent heading (often bold / colored).
  - **One or two short sentences** that use the word in context (the word may be highlighted). **Often there is NO separate dictionary definition on the card**—only the word plus this sentence.
  - A **photo** or illustration. **Do not** treat photo captions as the vocabulary sentence unless they are clearly the same sentence as on the card.

## What to extract (per target word)
1. **word** — The headword exactly as taught on the card (match spelling/capitalization of the curriculum; use sentence case if the book uses it).
2. **definition** — **Required in JSON even when the book prints none.** Output a **short learner gloss (about 5–18 words)** inferred **only** from the context sentence(s) on that card (e.g. for “principal” in a school-leadership sentence, a gloss like “the leader of a school”). Do not invent facts beyond what the sentence implies. **Never omit the definition field or leave it as an empty string.**
3. **examples** — A JSON array of **one or more strings**, each a **full sentence copied verbatim** from the card’s context (preserve punctuation). If the card has two related sentences, include both as separate strings **or** as one string with a space between them—prefer **separate strings** when both carry meaning.

## Ordering
- Follow **Context Card numbers** ascending (1, 2, 3, …). If numbers are missing, use top-to-bottom, left-to-right reading order on the spread.

## Rules you MUST follow
- **Only** words that clearly appear as **Context Card targets** on the supplied pages. Do **not** add words from generic instructions (e.g. “Study each Context Card…”) unless they are their own numbered card headwords.
- Do **not** duplicate the same **word** twice unless the book literally teaches two distinct cards for the same spelling (rare); if unsure, keep one entry.
- Do **not** fabricate sentences—examples must come from visible page text.
- Ignore **sidebar-only** duplicates if the card already gives the authoritative headword + sentence.
- Output **only** valid JSON (no markdown fences, no commentary). Use this exact shape:
{
  "words": [
    {
      "id": "stable-slug-or-index",
      "word": "string",
      "definition": "string",
      "examples": ["string", "..."]
    }
  ]
}

## IDs
- Use stable ids: \`cc-1\`, \`cc-2\`, … by card order, or a slug from the headword (\`principal\`, \`soared\`) if unambiguous. Never leave id empty.

If no qualifying Context Cards are found, return: { "words": [] }`

export type ContextCardsVocabExtractionParams = {
  /** Human-readable, e.g. "Unit 1 / Lesson 1 / Vocabulary in Context" */
  sectionPath: string
  /** Inclusive PDF or printed page range the model should treat as authoritative */
  pageRangeLabel: string
  /**
   * OCR text or a brief human paste from those pages. When using vision-only,
   * pass an empty string and rely on images in the same request.
   */
  extractedPlainText?: string
  /** Extra constraints from the teacher or product */
  teacherNotes?: string
}

export function buildContextCardsVocabUserMessage(params: ContextCardsVocabExtractionParams): string {
  const text = (params.extractedPlainText ?? '').trim()
  const notes = (params.teacherNotes ?? '').trim()
  return [
    `Section: ${params.sectionPath}`,
    `Restrict extraction to these pages only: ${params.pageRangeLabel}`,
    '',
    text
      ? '--- BEGIN PAGE TEXT (may be incomplete; prefer vision if images are provided) ---\n' + text + '\n--- END PAGE TEXT ---'
      : 'No plain text was supplied; use the attached page images only.',
    '',
    notes ? `Teacher / product notes:\n${notes}` : '',
    '',
    'Return JSON: { "words": [ ... ] } as specified in your instructions.',
  ]
    .filter(Boolean)
    .join('\n')
}
