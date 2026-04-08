/**
 * Image style profiles: style-dominant queries + provider attributes + metadata scoring hints.
 * UI stores QuizQuestion.imageStyle as human labels; API/query use ImageStyleKey (photo | flat2d | render3d).
 */

export type ImageStyleKey = 'photo' | 'flat2d' | 'render3d'

export type PixabayImageType = 'all' | 'photo' | 'illustration' | 'vector'

export type QuizUiImageStyle = 'Photo' | 'Cartoon / Illustration' | '3D render'

type StyleProfile = {
  staticTemplates: string[]
  gifTemplates: string[]
  requiredTokens: string[]
  forbiddenTokens: string[]
  pixabayImageType: PixabayImageType
  /** Retry second query variant if score is below this threshold. */
  minScoreRetry: number | null
  boostFragments: string[]
  penaltyFragments: string[]
}

/** Merged 2D: cartoon + illustration cues; legacy photo/drawing/icon map here. */
const FLAT2D: StyleProfile = {
  staticTemplates: [
    '{word} colorful cartoon illustration child friendly clean background',
    '{word} digital illustration hand drawn plain background centered',
    '{word} cartoon character simple 2d bold outline minimal backdrop',
    '{word} educational illustration watercolor style simple composition',
  ],
  gifTemplates: [
    '{word} cartoon animation loop 2d classroom safe',
    '{word} illustrated hand drawn animation loop simple',
    '{word} animated cartoon gif simple background',
  ],
  requiredTokens: ['cartoon', 'illustration', '2d', 'hand drawn', 'bold outline', 'artwork'],
  forbiddenTokens: ['real photo', 'camera shot', 'dslr', 'photorealistic', 'meme'],
  pixabayImageType: 'illustration',
  minScoreRetry: 15,
  boostFragments: [
    'cartoon|toon',
    'illustration|illustrated',
    '2d\\s*(animation|character|style)',
    'comic\\s*style|cel\\s*shaded',
    'bold\\s*outline',
    'animated\\s*style',
    'hand\\s*drawn|drawn\\s*art',
    'digital\\s*painting|artwork',
    'watercolor|gouache',
    'editorial\\s*illustration',
  ],
  penaltyFragments: [
    'real\\s*(photo|photography)|dslr',
    'photoreal(istic)?',
    'isometric\\s*3d|cgi|render',
    '3d\\s*render|3d\\s*model',
    'icon|glyph|pictogram|symbol',
    'vector\\s*logo|flat\\s*vector\\s*logo',
    'charcoal|graphite|pencil\\s*sketch',
  ],
}

const PHOTO: StyleProfile = {
  staticTemplates: [
    '{word} real photo single subject clean background',
    '{word} realistic photography plain background stock photo',
    '{word} natural light photo centered subject',
    '{word} isolated subject high quality photo',
  ],
  gifTemplates: [
    '{word} real life gif clean background',
    '{word} realistic footage loop classroom safe',
    '{word} real object animation gif plain scene',
  ],
  requiredTokens: ['real photo', 'realistic', 'natural light', 'single subject'],
  forbiddenTokens: ['cartoon', 'vector', 'icon', '3d render', 'sketch'],
  pixabayImageType: 'photo',
  minScoreRetry: null,
  boostFragments: [
    'real(istic)?\\s*(photo|image|photography)',
    'natural\\s*light',
    'single\\s*(object|subject)',
    'clean\\s*background',
    'studio\\s*shot',
  ],
  penaltyFragments: [
    'cartoon|anime|comic',
    'vector|flat\\s*design',
    'icon|pictogram|glyph',
    '3d\\s*render|cgi|isometric',
    'sketch|line\\s*art|charcoal',
  ],
}

const PROFILES: Record<ImageStyleKey, StyleProfile> = {
  photo: PHOTO,
  flat2d: FLAT2D,
  render3d: {
    staticTemplates: [
      '{word} 3d render cgi isolated clean background',
      '{word} isometric 3d object studio lighting',
      '{word} high detail 3d model minimal background',
      '{word} 3d visualization centered subject plain backdrop',
    ],
    gifTemplates: [
      '{word} 3d animation loop cgi',
      '{word} isometric 3d gif rotating object',
      '{word} cgi motion loop clean background',
    ],
    requiredTokens: ['3d render', 'cgi', 'isometric', 'single object'],
    forbiddenTokens: ['real photo', 'cartoon 2d', 'watercolor', 'sketch', 'icon line'],
    pixabayImageType: 'all',
    minScoreRetry: 14,
    boostFragments: [
      '3d\\s*render|3d\\s*model',
      'cgi|computer\\s*generated',
      'isometric',
      'studio\\s*lighting',
      'low\\s*poly|high\\s*poly',
    ],
    penaltyFragments: [
      'real\\s*photo|photography|dslr',
      'cartoon|2d\\s*animation',
      'watercolor|painting|illustration',
      'pencil|charcoal|sketch',
      'icon|pictogram|glyph',
    ],
  },
}

/** Lowercase lookup keys — legacy labels and slugs → photo, flat2d, or render3d. */
const UI_LABEL_TO_KEY: Record<string, ImageStyleKey> = {
  photo: 'photo',
  flat2d: 'flat2d',
  render3d: 'render3d',
  '3d render': 'render3d',
  cartoon: 'flat2d',
  illustration: 'flat2d',
  'realistic drawing': 'flat2d',
  drawing: 'flat2d',
  'simple icon': 'flat2d',
  icon: 'flat2d',
  'cartoon/illustration': 'flat2d',
}

function normalizedStyleLookupKeys(raw: string): string[] {
  const t = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  const slashNorm = t.replace(/\s*\/\s*/g, '/')
  return t === slashNorm ? [t] : [t, slashNorm]
}

export function parseImageStyleParam(raw: string | null | undefined): ImageStyleKey {
  if (!raw?.trim()) return 'photo'
  for (const key of normalizedStyleLookupKeys(raw)) {
    const mapped = UI_LABEL_TO_KEY[key]
    if (mapped) return mapped
  }
  const collapsed = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (collapsed === 'photo' || collapsed === 'flat2d' || collapsed === 'render3d') return collapsed
  return 'photo'
}

/** Canonical UI label for saved quizzes and the create modal (maps legacy stored values). */
export function quizUiStyleFromStoredOrParam(raw: string | null | undefined): QuizUiImageStyle {
  const key = parseImageStyleParam(raw)
  if (key === 'render3d') return '3D render'
  if (key === 'flat2d') return 'Cartoon / Illustration'
  return 'Photo'
}

export function getPixabayImageType(key: ImageStyleKey): PixabayImageType {
  return PROFILES[key].pixabayImageType
}

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2)
  )
}

function pickTemplateIndex(seed: string, channel: 'static' | 'gif', index: number, length: number): number {
  if (length <= 1) return 0
  const h = Math.abs(
    (seed + `\0${channel}\0${index}`)
      .split('')
      .reduce((acc, ch) => (Math.imul(31, acc) + ch.charCodeAt(0)) | 0, 0)
  )
  return h % length
}

const MAX_STATIC_QUERY_LEN = 160

/** Style-aware query: template + a short slice of base (curated / LLM), no giant token dumps (those yield 0 API hits). */
export function applyStyleToStaticBaseQuery(
  base: string,
  styleKey: ImageStyleKey,
  variant: string,
  addonAttempt: number
): string {
  const profile = PROFILES[styleKey]
  const idx = pickTemplateIndex(variant, 'static', addonAttempt, profile.staticTemplates.length)
  const template = profile.staticTemplates[idx] ?? '{word}'
  const word = extractPrimaryWord(base)
  const templated = template.replace(/\{word\}/g, word || base.trim())
  const baseTail = shortenBaseForMerge(base, templated, 10)
  const merged = mergeQueryParts(templated, baseTail)
  return merged.slice(0, MAX_STATIC_QUERY_LEN)
}

/** Extra fallbacks when styled query returns no hits (short, high-recall). */
export function buildStaticFallbackQueries(q: string, baseStatic: string): string[] {
  const w = q.trim().toLowerCase().slice(0, 120)
  const base = baseStatic.trim().slice(0, 120)
  const out: string[] = []
  const push = (s: string) => {
    const t = s.replace(/\s+/g, ' ').trim()
    if (t && !out.includes(t)) out.push(t)
  }
  push(base)
  push(`${w} stock photo`)
  push(`${w} isolated white background`)
  push(w)
  return out
}

function mergeQueryParts(base: string, addon: string): string {
  const b = base.trim()
  const a = addon.trim()
  if (!a) return b
  const baseWords = tokenSet(b)
  const addonTokens = a.split(/\s+/).filter((w) => {
    const low = w.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (low.length < 2) return false
    return !baseWords.has(low)
  })
  const addonFiltered = addonTokens.join(' ')
  if (!addonFiltered) return b
  return `${b} ${addonFiltered}`.replace(/\s+/g, ' ').trim()
}

/** Append GIF style tokens to a search string (tier). */
export function applyStyleToGifSearchString(
  search: string,
  styleKey: ImageStyleKey,
  variant: string,
  tierIdx: number
): string {
  const profile = PROFILES[styleKey]
  const idx = pickTemplateIndex(variant, 'gif', tierIdx, profile.gifTemplates.length)
  const template = profile.gifTemplates[idx] ?? '{word}'
  const word = extractPrimaryWord(search)
  const templated = template.replace(/\{word\}/g, word || search.trim())
  const tail = shortenBaseForMerge(search, templated, 8)
  const merged = mergeQueryParts(templated, tail)
  return merged.slice(0, 220)
}

export function styleMinScoreForRetry(styleKey: ImageStyleKey): number | null {
  return PROFILES[styleKey].minScoreRetry
}

export function applyStyleRelevanceDelta(styleKey: ImageStyleKey, haystack: string): number {
  const { boostFragments, penaltyFragments, requiredTokens, forbiddenTokens } = PROFILES[styleKey]
  const h = haystack.toLowerCase()
  let d = 0
  for (const frag of boostFragments) {
    try {
      if (new RegExp(frag, 'i').test(h)) d += 6
    } catch {
      /* ignore invalid fragment */
    }
  }
  for (const frag of penaltyFragments) {
    try {
      if (new RegExp(frag, 'i').test(h)) d -= 8
    } catch {
      /* ignore invalid fragment */
    }
  }
  for (const t of requiredTokens) {
    if (tokenMatchesHaystack(h, t)) d += 3
  }
  for (const t of forbiddenTokens) {
    if (tokenMatchesHaystack(h, t)) d -= 5
  }
  return d
}

function shortenBaseForMerge(fullBase: string, already: string, maxWords: number): string {
  const seen = tokenSet(already)
  const words = fullBase
    .trim()
    .split(/\s+/)
    .filter((w) => {
      const low = w.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (low.length < 2) return false
      if (seen.has(low)) return false
      seen.add(low)
      return true
    })
  return words.slice(0, maxWords).join(' ')
}

function tokenMatchesHaystack(haystack: string, token: string): boolean {
  const t = token.trim().toLowerCase()
  if (!t) return false
  const h = haystack.toLowerCase()
  if (t.includes(' ')) return h.includes(t)
  if (t.length <= 4) {
    try {
      return new RegExp(`(^|[^a-z0-9])${escapeReg(t)}([^a-z0-9]|$)`, 'i').test(h)
    } catch {
      return h.includes(t)
    }
  }
  return h.includes(t)
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractPrimaryWord(query: string): string {
  const lowered = query.toLowerCase().trim()
  if (!lowered) return ''
  // Common two-word school phrases should stay intact.
  const preferredPhrases = [
    'orange juice',
    'hot chocolate',
    'ice cream',
    'living room',
    'traffic light',
    'school bus',
  ]
  for (const p of preferredPhrases) {
    if (lowered.includes(p)) return p
  }
  const first = lowered.split(/[^a-z0-9]+/).filter(Boolean)[0] ?? ''
  return first
}
