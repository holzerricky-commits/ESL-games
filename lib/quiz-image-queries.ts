/**
 * Stock-style search queries: plain background, clear subject, Google/stock-photo intent.
 * Avoid macro / texture / extreme close-up defaults (they skew to wrong subjects).
 *
 * Priority at runtime: curated override (this file) > optional LLM `imageSearchQuery` > default pattern.
 */

/** Beverages — clear container, no “macro texture” wording. */
const BEVERAGE: Record<string, string> = {
  water: 'glass of water isolated white background stock photo',
  milk: 'glass of milk isolated white background stock photo',
  juice: 'glass of orange juice isolated white background stock photo',
  tea: 'cup of tea isolated white background stock photo',
  coffee: 'cup of coffee isolated white background stock photo',
}

/** Whole fruits/veg/food on white — classroom stock style. */
const FOOD_PRODUCE: Record<string, string> = {
  apple: 'red apple fruit isolated on white background stock photo',
  banana: 'banana fruit isolated on white background stock photo',
  orange: 'orange fruit isolated on white background stock photo',
  carrot: 'carrot vegetable isolated on white background stock photo',
  tomato: 'tomato vegetable isolated on white background stock photo',
  egg: 'egg isolated on white background stock photo',
  bread: 'bread loaf isolated on white background stock photo',
  rice: 'rice bowl white background stock photo simple',
}

/** School/office — disambiguate plant “pencil” etc. */
const STATIONERY: Record<string, string> = {
  pen: 'ballpoint pen writing instrument isolated white background stock photo',
  pencil: 'wooden pencil school supplies isolated white background stock photo',
  eraser: 'eraser school supplies isolated white background stock photo',
  ruler: 'ruler school supplies isolated white background stock photo',
  marker: 'marker pen stationery isolated white background stock photo',
  crayon: 'crayon isolated white background stock photo',
  sharpener: 'pencil sharpener isolated white background stock photo',
  glue: 'glue stick school isolated white background stock photo',
  scissors: 'scissors isolated white background stock photo',
}

/** Scene is mostly the thing itself; scoring drops animals/people in captions. */
const NATURE_SUBJECT: Record<string, string> = {
  grass: 'green grass lawn field full frame nature stock photo',
  sand: 'sand beach ground natural background stock photo',
  snow: 'snow winter white ground nature background stock photo',
  tree: 'tree nature isolated simple background stock photo',
  flower: 'flower isolated on white background stock photo',
  ground: 'ground earth soil natural background stock photo',
}

const SKY_CELESTIAL: Record<string, string> = {
  sky: 'blue sky clouds nature background stock photo wide',
  sun: 'sun bright sky nature stock photo',
  moon: 'moon night sky stock photo',
  star: 'stars night sky stock photo',
}

/**
 * Abstract / polysemous ESL words — first concrete meaning most learners picture first.
 * (e.g. art → painting, not camera or graphic design.)
 */
const ABSTRACT_FIRST_SENSE: Record<string, string> = {
  art: 'artist painter painting canvas palette brushes studio art class stock photo',
  music: 'musical instruments guitar piano violin orchestra classroom stock photo',
  science: 'science laboratory beaker microscope simple student experiment stock photo',
  history: 'old antique history book museum document parchment stock photo',
  math: 'math numbers chalkboard classroom geometry shapes teaching stock photo',
  english: 'English alphabet letters classroom chalkboard learning stock photo',
  language: 'world languages dictionary translation learning classroom stock photo',
  sport: 'sports equipment ball soccer basketball field stock photo',
  fun: 'children playground happy playing outdoors simple stock photo',
  work: 'office desk computer professional working simple stock photo',
  home: 'cozy living room house interior simple stock photo',
  school: 'school building classroom exterior education stock photo',
  friend: 'two friends smiling together simple outdoor stock photo',
  family: 'happy family parents children simple portrait stock photo',
  time: 'clock showing time wall simple stock photo',
  money: 'coins and banknotes cash currency simple white background stock photo',
  food: 'healthy food plate vegetables meal simple stock photo',
  weather: 'weather symbols sun cloud rain simple illustration stock photo',
  city: 'city skyline buildings downtown simple stock photo',
  country: 'countryside rural farm field nature stock photo',
  world: 'world globe map earth simple stock photo',
  peace: 'white dove olive branch peace symbol simple stock photo',
  war: 'historical soldiers uniform museum exhibit stock photo',
  health: 'doctor stethoscope medical check simple clinic stock photo',
  law: 'judge gavel courtroom legal scales stock photo',
  news: 'newspaper headline reading desk simple stock photo',
  idea: 'light bulb idea concept simple white background stock photo',
  dream: 'sleeping person peaceful night bedroom simple stock photo',
  hope: 'sunrise horizon new day nature hopeful stock photo',
  love: 'heart shape red symbol simple white background stock photo',
  fear: 'worried person simple expression studio stock photo',
  anger: 'frustrated expression simple studio portrait stock photo',
  surprise: 'surprised expression simple studio portrait stock photo',
  bank: 'bank building exterior finance street stock photo',
  spring: 'spring season flowers blossom tree nature stock photo',
  fall: 'autumn fall leaves orange tree nature stock photo',
  bat: 'baseball bat equipment isolated white background stock photo',
  bark: 'tree bark texture trunk nature close stock photo',
  date: 'calendar date page simple desk stock photo',
  jam: 'fruit jam jar bread breakfast stock photo',
  mine: 'coal mine tunnel industrial safety helmet stock photo',
  nail: 'fingernail hand simple hygiene stock photo',
  squash: 'squash vegetable gourd food isolated stock photo',
}

export type ImageQueryOptions = {
  /** LLM or teacher phrase; used only when no curated override exists for the lemma. */
  imageSearchQuery?: string | null
}

function mergedOverride(word: string): string | undefined {
  return (
    BEVERAGE[word] ??
    FOOD_PRODUCE[word] ??
    STATIONERY[word] ??
    NATURE_SUBJECT[word] ??
    SKY_CELESTIAL[word] ??
    ABSTRACT_FIRST_SENSE[word]
  )
}

/** If set, `/api/quiz-image` can skip LLM — curated wins in `buildStaticSearchQuery`. */
export function getCuratedImageSearchOverride(rawWord: string): string | undefined {
  return mergedOverride(rawWord.toLowerCase().trim())
}

function sanitizeLlmPhrase(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim().slice(0, 220)
  return t
}

/** Pixabay-oriented — literal stock-style still. */
export function buildStaticSearchQuery(rawWord: string, options?: ImageQueryOptions): string {
  const word = rawWord.toLowerCase().trim()
  const hit = mergedOverride(word)
  if (hit) return hit
  const llm = sanitizeLlmPhrase(options?.imageSearchQuery ?? '')
  if (llm.length >= 3) return llm
  if (word.includes('water')) return BEVERAGE.water
  return `${word} isolated on white background stock photo`
}

const ACTION_WORDS = new Set([
  'run',
  'walk',
  'jump',
  'swim',
  'eat',
  'drink',
  'sleep',
  'read',
  'write',
  'dance',
  'sing',
  'play',
])

/** GIPHY — same intent: clear subject, no “cute/macro” leaning tier-1. */
export function buildGifSearchQuery(rawWord: string, options?: ImageQueryOptions): string {
  const word = rawWord.toLowerCase().trim()
  const gifMap: Record<string, string> = {
    water: 'glass of water loop isolated simple background',
    milk: 'milk glass loop simple',
    juice: 'juice glass loop simple',
    tea: 'tea cup loop simple',
    coffee: 'coffee cup loop simple',
    apple: 'apple loop isolated white',
    banana: 'banana loop isolated',
    orange: 'orange fruit loop simple',
    carrot: 'carrot loop simple',
    tomato: 'tomato loop simple',
    egg: 'egg loop simple',
    bread: 'bread loaf loop simple',
    rice: 'rice bowl loop simple',
    pen: 'ballpoint pen loop stationery',
    pencil: 'pencil school loop',
    eraser: 'eraser loop school',
    ruler: 'ruler loop school',
    grass: 'grass field lawn loop nature',
    sand: 'sand beach loop nature',
    snow: 'snow loop winter',
    tree: 'tree loop nature',
    flower: 'flower loop isolated',
    sky: 'sky clouds loop',
    sun: 'sun sky loop',
    moon: 'moon sky loop',
    star: 'stars sky loop',
    art: 'painting artist palette canvas loop simple',
    music: 'instrument music loop simple educational',
    science: 'science experiment beaker loop educational',
    history: 'old book history loop simple',
    math: 'math numbers loop educational',
    school: 'school classroom loop simple',
    time: 'clock time loop simple',
    money: 'money coins loop simple',
    love: 'heart animation loop simple',
  }
  if (gifMap[word]) return gifMap[word]
  if (word.includes('water')) return gifMap.water
  if (ACTION_WORDS.has(word)) {
    return `${word} simple animation loop educational`
  }
  const llm = sanitizeLlmPhrase(options?.imageSearchQuery ?? '')
  if (llm.length >= 3) {
    return `${llm} loop simple educational`.slice(0, 220)
  }
  return `${word} isolated loop simple background`
}
