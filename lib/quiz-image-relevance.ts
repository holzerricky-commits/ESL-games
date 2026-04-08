/**
 * ESL vocabulary image relevance: stock-style literal match, penalize wrong subjects.
 */

import { applyStyleRelevanceDelta, type ImageStyleKey } from '@/lib/quiz-image-style'

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Substrings that usually mean “not a simple vocab illustration” (people, events, memes). */
export const DISTRACTOR_TERMS: readonly string[] = [
  'child',
  'children',
  'kid',
  'kids',
  'baby',
  'toddler',
  'family',
  'mother',
  'father',
  'parent',
  'parents',
  'playing',
  'playground',
  'picnic',
  'wedding',
  'party',
  'crowd',
  'couple',
  'friends',
  'friendship',
  'selfie',
  'portrait',
  'smiling',
  'laughing',
  'festival',
  'parade',
  'stadium',
  'concert',
  'birthday',
  'graduation',
  'vacation',
  'tourist',
  'boyfriend',
  'girlfriend',
]

const MEME_BANNED = [
  'meme',
  'reaction',
  'celebrity',
  'zuckerberg',
  'tiktok',
  'interview',
  'podcast',
  'lol',
  'lmao',
] as const

/** Words where we want pen/pencil not plant or extreme nib shots — match queries file. */
const STATIONERY_VOCAB = new Set([
  'pen',
  'pencil',
  'eraser',
  'ruler',
  'marker',
  'crayon',
  'sharpener',
  'glue',
  'scissors',
])

/**
 * Scenes where the “thing” should fill the frame; animals/people are secondary subjects we penalize.
 */
const NATURE_FULLFRAME_VOCAB = new Set([
  'grass',
  'sand',
  'snow',
  'sky',
  'ground',
  'tree',
  'flower',
  'sun',
  'moon',
  'star',
])

/** Wrong plant/other hits for stationery searches. */
const STATIONERY_CONFUSER_TERMS = [
  'dandelion',
  'daisy',
  'tulip',
  'rose',
  'sunflower',
  'bloom',
  'petal',
  'wildflower',
  'botanical',
  'garden flower',
]

/**
 * Score Pixabay (and similar stock) metadata for literal stock-style ESL match.
 * Favors white/plain background and clear subject; avoids macro/tip confusion.
 */
export function scoreTextRelevance(
  vocabWord: string,
  haystack: string,
  imageStyle?: ImageStyleKey | null
): number {
  const h = haystack.toLowerCase()
  const w = vocabWord.toLowerCase().trim()
  const tokens = tokenize(vocabWord)
  let score = 0
  for (const t of tokens) {
    if (t.length < 2) continue
    if (h.includes(t)) score += 5
    try {
      if (new RegExp(`\\b${escapeRegex(t)}\\b`, 'i').test(h)) score += 4
    } catch {
      /* ignore */
    }
  }

  if (
    /(isolated|white background|plain background|studio shot|studio|product|stock photo|stock image|copy space|simple background|clean background|cut out)/.test(
      h
    )
  ) {
    score += 6
  }
  if (/(still life|single object|hero|minimal)/.test(h)) score += 3

  if (NATURE_FULLFRAME_VOCAB.has(w)) {
    if (/(lawn|meadow|field|landscape|greenery|turf|full frame|background|nature)/.test(h)) score += 4
    if (
      /(dog|dogs|cat|cats|pet|puppy|kitten|cow|cows|horse|horses|sheep|bird|birds|animal|animals)/.test(h)
    ) {
      score -= 14
    }
    if (/(person|people|human|walking|runner|child|boy |girl |man |woman |picnic|bench)/.test(h)) {
      score -= 12
    }
  }

  if (STATIONERY_VOCAB.has(w)) {
    for (const term of STATIONERY_CONFUSER_TERMS) {
      if (h.includes(term)) score -= 12
    }
    if (/( pen tip|pencil tip|fountain nib|nib | tip macro|macro lens|extreme close|microscop)/.test(h)) {
      score -= 10
    }
    if (/(stationery|writing|school supply|office supply|ballpoint|wooden pencil)/.test(h)) score += 5
  }

  if (w === 'art') {
    if (/(camera|dslr|lens\b|photograph|photography|tripod)/.test(h)) score -= 14
    if (/(paint|painting|painter|palette|canvas|easel|brush\b|watercolor|acrylic)/.test(h)) score += 8
  }

  if (!NATURE_FULLFRAME_VOCAB.has(w) && /(\bmacro\b|extreme close|microscopic|texture study)/.test(h)) {
    score -= 5
  }

  for (const d of DISTRACTOR_TERMS) {
    if (h.includes(d)) score -= 10
  }
  if (/(person|people|human|face|man |woman |boy |girl )/.test(h)) score -= 6

  if (imageStyle) {
    score += applyStyleRelevanceDelta(imageStyle, h)
  }
  return score
}

export type GiphyMetaFields = {
  title?: string
  slug?: string
  username?: string
  alt_text?: string
}

/**
 * Score a GIPHY hit for classroom vocab GIFs: literal word match, distractor penalties, meme penalties.
 */
export function scoreGifMetadata(
  rawWord: string,
  item: GiphyMetaFields,
  imageStyle?: ImageStyleKey | null
): number {
  const haystack = [item.title, item.slug, item.username, item.alt_text]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  let score = scoreTextRelevance(rawWord, haystack, imageStyle)

  const word = rawWord.toLowerCase().trim()
  if (word.length >= 2) {
    try {
      if (item.slug && new RegExp(`\\b${escapeRegex(word)}\\b`, 'i').test(item.slug)) {
        score += 5
      }
    } catch {
      /* ignore */
    }
  }

  if (/(isolated|white|simple|loop|stationery|school|nature)/.test(haystack)) score += 2
  if (/(food|drink|vocab|educational|illustration|icon|animation|cartoon)/.test(haystack)) score += 2

  for (const b of MEME_BANNED) {
    if (haystack.includes(b)) score -= 8
  }
  if (/(funny|comedy|prank)/.test(haystack)) score -= 6

  return score
}
