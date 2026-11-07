import 'server-only'

import { INTERACTIVE_VOCAB_PACKS } from '@/lib/books/interactive-vocab'
import { getContextStore } from '@/lib/context/file-store'
import { planVaultPictures } from '@/lib/gemini'
import { preferPartEntries, preparedMeaningFromEntries } from '@/lib/lesson-vault/prepared-meaning'
import { vaultDirFor, writeVaultPictureFile } from '@/lib/lesson-vault/picture-disk-server
import { vaultPictureUrl } from '@/lib/lesson-vault/picture-paths'
import {
  normalizePlanWord,
  resolvePicturePlans,
  usableVaultGloss,
  wordsNeedingModel,
  type VaultPicturePlan,
} from '@/lib/lesson-vault/picture-plan'
import { searchVaultPictures } from '@/lib/lesson-vault/picture-search'
import {
  arasaacChoices,
  fluentChoices,
  isAllowedPictureUrl,
  mergePictureChoices,
  pixabayChoice,
} from '@/lib/lesson-vault/picture-sources'
import { MAX_PICTURE_CHOICES, type LessonVaultPictureChoice } from '@/lib/lesson-vault/types'
import { fetchPixabayHits } from '@/lib/quiz-image-pixabay'
import { getCuratedImageSearchOverride } from '@/lib/quiz-image-queries'

const PLAN_TIMEOUT_MS = 8_000
const SOURCE_TIMEOUT_MS = 12_000
const DOWNLOAD_TIMEOUT_MS = 12_000
const MAX_SIDE = 800
const MAX_DOWNLOAD_BYTES = 8_000_000

export type AutoPictureStatus = 'found' | 'not-found' | 'abstract' | 'skipped'

export type AutoPictureResult = {
  status: AutoPictureStatus
  url?: string
  choices: LessonVaultPictureChoice[]
  choiceIndex: number
  /** Short meaning for the card. Empty when none could be written. */
  gloss: string
}

export type VaultMeaningLookup = {
  word: string
  sentence: string
  bookId: string
  unitId: string
  lessonId: string
  partId: string
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) })
  if (!res.ok) return null
  return res.json()
}

async function planFor(word: string, sentence: string, needGloss: boolean): Promise<VaultPicturePlan> {
  const key = normalizePlanWord(word)
  const ask = wordsNeedingModel([word]).length > 0 || (needGloss && sentence.trim().length > 0)
  const model = ask ? await withTimeout(planVaultPictures([{ word, sentence }]), PLAN_TIMEOUT_MS, {}) : {}
  return (
    resolvePicturePlans([word], { curated: getCuratedImageSearchOverride, model })[key] ?? {
      picturable: true,
      keyword: key,
      phrase: key,
      gloss: '',
    }
  )
}

/** Teacher-written definition for this word in the lesson, ahead of a model gloss. */
async function lookupPreparedMeaning(input: VaultMeaningLookup): Promise<string> {
  if (!input.bookId || !input.unitId || !input.lessonId || !input.word.trim()) return ''
  try {
    const { parts } = await getContextStore().listContextsForUnit(input.bookId, input.unitId)
    const saved = parts
      .filter((part) => part.lessonId === input.lessonId)
      .map((part) => ({
        partId: part.partId,
        words: (part.interactiveVocabulary ?? []).map((word) => ({ word: word.word, definition: word.definition })),
      }))
    const prefix = `${input.bookId}::${input.unitId}::${input.lessonId}::`
    const hardcoded = Object.entries(INTERACTIVE_VOCAB_PACKS)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, pack]) => ({
        partId: key.slice(prefix.length),
        words: pack.words.map((word) => ({ word: word.word, definition: word.definition })),
      }))
    return preparedMeaningFromEntries(input.word, preferPartEntries([...saved, ...hardcoded], input.partId), input.sentence)
  } catch {
    return ''
  }
}

/** Prepared lesson definition, otherwise a short gloss from the sentence. Blank when there is no sentence and no definition. */
export async function glossForVaultWord(input: VaultMeaningLookup): Promise<string> {
  const sentence = input.sentence.trim()
  const prepared = await lookupPreparedMeaning({ ...input, sentence })
  if (prepared || !sentence) return prepared
  const plan = await planFor(input.word, sentence, true)
  return usableVaultGloss(plan.gloss, sentence, input.word)
}

/** Downloads a choice and returns PNG/JPEG bytes at most 800 px (SVG icons become PNG). */
export async function downloadPictureChoice(url: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  if (!isAllowedPictureUrl(url)) return null
  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) }).catch(() => null)
  if (!res?.ok) return null
  const mime = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  if (!mime.startsWith('image/')) return null
  const raw = Buffer.from(await res.arrayBuffer())
  if (raw.length === 0 || raw.length > MAX_DOWNLOAD_BYTES) return null
  try {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas')
    const img = await loadImage(raw)
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = createCanvas(w, h)
    canvas.getContext('2d').drawImage(img, 0, 0, w, h)
    const keepAlpha = mime === 'image/png' || mime === 'image/svg+xml'
    const bytes = keepAlpha ? await canvas.encode('png') : await canvas.encode('jpeg', 85)
    return { bytes: new Uint8Array(bytes), ext: keepAlpha ? '.png' : '.jpg' }
  } catch {
    return null
  }
}

/** Candidate pictures for a word: learner pictograms, then emoji icons, then Pixabay cartoons. */
async function gatherChoices(word: string, plan: VaultPicturePlan, forceSearch: boolean) {
  const keyword = plan.keyword || normalizePlanWord(word)
  const picturable = plan.picturable || forceSearch
  // Pixabay scores tags against this word, so it must appear in the phrase's wording.
  const stockWord = (plan.phrase || '').toLowerCase().includes(keyword) ? keyword : normalizePlanWord(word)
  const pixabayKey = process.env.PIXABAY_API_KEY?.trim()
  const [arasaac, fluent, pixabay] = await Promise.all([
    withTimeout(arasaacChoices(keyword, fetchJson, { limit: 3, fuzzy: picturable }), SOURCE_TIMEOUT_MS, []),
    picturable ? withTimeout(fluentChoices(keyword, fetchJson, 2), SOURCE_TIMEOUT_MS, []) : Promise.resolve([]),
    picturable && pixabayKey
      ? withTimeout(
          searchVaultPictures(stockWord, plan.phrase, MAX_PICTURE_CHOICES, (query, imageType) =>
            fetchPixabayHits(pixabayKey, query, { imageType, perPage: 40, page: 1 }),
          ).then((r) => r.results.map((hit) => pixabayChoice(hit.thumbUrl, hit.fullUrl))),
          SOURCE_TIMEOUT_MS,
          [],
        )
      : Promise.resolve([] as LessonVaultPictureChoice[]),
  ])
  return {
    keyword,
    picturable,
    counts: `arasaac ${arasaac.length}, emoji ${fluent.length}, pixabay ${pixabay.length}`,
    choices: mergePictureChoices({ arasaac, fluent, pixabay }, MAX_PICTURE_CHOICES),
  }
}

/**
 * Finds and stores a picture for a blank card. Never replaces a file that is already there
 * (a picture you added while this ran wins).
 */
export async function findAndStoreAutoPicture(input: {
  studentId: string
  cardId: string
  word: string
  sentence: string
  forceSearch: boolean
  bookId: string
  unitId: string
  lessonId: string
  partId: string
}): Promise<AutoPictureResult> {
  const sentence = input.sentence.trim()
  const prepared = await lookupPreparedMeaning({ ...input, sentence })
  const plan = await planFor(input.word, sentence, !prepared)
  const gloss = prepared || usableVaultGloss(plan.gloss, sentence, input.word)
  const dir = vaultDirFor(input.studentId)
  if (!dir) return { status: 'not-found', choices: [], choiceIndex: 0, gloss }
  const found = await gatherChoices(input.word, plan, input.forceSearch)
  const log = (status: string) =>
    console.info(`[vault auto-picture] "${input.word}" → ${status} (keyword "${found.keyword}"; ${found.counts})`)

  if (found.choices.length === 0) {
    const status: AutoPictureStatus = found.picturable ? 'not-found' : 'abstract'
    log(status)
    return { status, choices: [], choiceIndex: 0, gloss }
  }
  for (let i = 0; i < found.choices.length; i++) {
    const file = await downloadPictureChoice(found.choices[i]!.full)
    if (!file) continue
    const wrote = await writeVaultPictureFile(dir, input.cardId, file.bytes, file.ext, { onlyIfEmpty: true })
    if (!wrote) {
      log('skipped (card already has a picture)')
      return { status: 'skipped', choices: found.choices, choiceIndex: i, gloss }
    }
    log(`found #${i + 1}`)
    return {
      status: 'found',
      url: vaultPictureUrl(input.studentId, input.cardId, Date.now()),
      choices: found.choices,
      choiceIndex: i,
      gloss,
    }
  }
  log('not-found (no choice could be downloaded)')
  return { status: 'not-found', choices: [], choiceIndex: 0, gloss }
}

/** Stores one of the card's choices as its picture (a swap from the strip). */
export async function storePictureChoice(studentId: string, cardId: string, url: string): Promise<string | null> {
  const dir = vaultDirFor(studentId)
  if (!dir) return null
  const file = await downloadPictureChoice(url)
  if (!file) return null
  await writeVaultPictureFile(dir, cardId, file.bytes, file.ext)
  return vaultPictureUrl(studentId, cardId, Date.now())
}
