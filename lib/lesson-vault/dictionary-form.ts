/**
 * Dictionary form for a vault card.
 * "feathers" → "feather", "flew" → "fly". The sentence on the card stays as printed.
 * A name in the middle of a sentence stays as written ("the parrot Feathers").
 * Phrases and contractions stay as clicked. Ambiguous words stay put unless the
 * sentence shows which one it is ("a saw" stays, "she saw a bird" → see).
 */

export type DictionaryFormOptions = {
  /** When false, a capital letter is not treated as a name. Games use this. */
  names?: boolean
}

const KEEP = new Set(
  `glasses scissors clothes pants trousers jeans shorts news series species
  mathematics physics politics thanks always sometimes across perhaps
  yes plus bus gas lens chaos atlas canvas
  this his its as us`
    .split(/\s+/)
    .filter(Boolean),
)

/** Past or participle → base. Ambiguous ones (saw, left, rose, found, wound) are not here. */
const IRREGULAR_VERB: Record<string, string> = {
  am: 'be',
  is: 'be',
  are: 'be',
  was: 'be',
  were: 'be',
  been: 'be',
  has: 'have',
  had: 'have',
  does: 'do',
  did: 'do',
  done: 'do',
  went: 'go',
  gone: 'go',
  ate: 'eat',
  eaten: 'eat',
  ran: 'run',
  flew: 'fly',
  flown: 'fly',
  seen: 'see',
  made: 'make',
  took: 'take',
  taken: 'take',
  came: 'come',
  gave: 'give',
  given: 'give',
  got: 'get',
  gotten: 'get',
  said: 'say',
  told: 'tell',
  thought: 'think',
  bought: 'buy',
  brought: 'bring',
  caught: 'catch',
  taught: 'teach',
  felt: 'feel',
  kept: 'keep',
  slept: 'sleep',
  meant: 'mean',
  sent: 'send',
  spent: 'spend',
  built: 'build',
  heard: 'hear',
  held: 'hold',
  stood: 'stand',
  understood: 'understand',
  lost: 'lose',
  shot: 'shoot',
  wrote: 'write',
  written: 'write',
  rode: 'ride',
  ridden: 'ride',
  drove: 'drive',
  driven: 'drive',
  broke: 'break',
  broken: 'break',
  spoke: 'speak',
  spoken: 'speak',
  stole: 'steal',
  stolen: 'steal',
  chose: 'choose',
  chosen: 'choose',
  woke: 'wake',
  woken: 'wake',
  awoke: 'awake',
  awoken: 'awake',
  wore: 'wear',
  worn: 'wear',
  tore: 'tear',
  torn: 'tear',
  swore: 'swear',
  sworn: 'swear',
  grew: 'grow',
  grown: 'grow',
  knew: 'know',
  known: 'know',
  threw: 'throw',
  thrown: 'throw',
  drew: 'draw',
  drawn: 'draw',
  blew: 'blow',
  blown: 'blow',
  began: 'begin',
  begun: 'begin',
  drank: 'drink',
  drunk: 'drink',
  sang: 'sing',
  sung: 'sing',
  rang: 'ring',
  rung: 'ring',
  swam: 'swim',
  swum: 'swim',
  sank: 'sink',
  sunk: 'sink',
  shrank: 'shrink',
  shrunk: 'shrink',
  sprang: 'spring',
  sprung: 'spring',
  won: 'win',
  dug: 'dig',
  hung: 'hang',
  stuck: 'stick',
  struck: 'strike',
  spun: 'spin',
  hid: 'hide',
  hidden: 'hide',
  bitten: 'bite',
  forgot: 'forget',
  forgotten: 'forget',
  forgave: 'forgive',
  forgiven: 'forgive',
  froze: 'freeze',
  frozen: 'freeze',
  risen: 'rise',
  fell: 'fall',
  fallen: 'fall',
  led: 'lead',
  met: 'meet',
  paid: 'pay',
  sold: 'sell',
  sat: 'sit',
  slid: 'slide',
  lit: 'light',
  became: 'become',
  fed: 'feed',
  fled: 'flee',
  bled: 'bleed',
  sped: 'speed',
  dealt: 'deal',
  knelt: 'kneel',
  dreamt: 'dream',
  learnt: 'learn',
  leant: 'lean',
  leapt: 'leap',
  bent: 'bend',
  lent: 'lend',
  fought: 'fight',
  shook: 'shake',
  shaken: 'shake',
  shone: 'shine',
  showed: 'show',
  shown: 'show',
  swung: 'swing',
  swept: 'sweep',
  wept: 'weep',
  crept: 'creep',
  spilt: 'spill',
  spoilt: 'spoil',
  burnt: 'burn',
  smelt: 'smell',
  spelt: 'spell',
  laid: 'lay',
  stung: 'sting',
  stank: 'stink',
  stunk: 'stink',
}

const IRREGULAR_NOUN: Record<string, string> = {
  children: 'child',
  men: 'man',
  women: 'woman',
  feet: 'foot',
  teeth: 'tooth',
  geese: 'goose',
  mice: 'mouse',
  lice: 'louse',
  oxen: 'ox',
  knives: 'knife',
  wives: 'wife',
  wolves: 'wolf',
  calves: 'calf',
  halves: 'half',
  shelves: 'shelf',
  thieves: 'thief',
  loaves: 'loaf',
  scarves: 'scarf',
  elves: 'elf',
}

const IE_WORDS = new Set(
  'movie cookie rookie brownie doggie piggie birdie auntie sweetie hippie collie goalie talkie zombie selfie genie calorie'.split(
    ' ',
  ),
)

const COMPARABLE = new Set(
  `tall small fast slow long short old young new large nice close safe late high low
  hard soft loud quiet bright dark warm cold rich poor strong weak clean kind brave wide
  deep cheap thick smooth rough simple gentle narrow shallow heavy healthy early pretty
  funny lucky angry hungry busy easy happy big hot sad fat thin wet red fit great clever`
    .split(/\s+/)
    .filter(Boolean),
)

const ED_BASE = new Set(
  'need feed seed weed deed bleed speed greed tweed indeed proceed exceed succeed hundred sacred wicked naked ragged beloved shed'.split(
    ' ',
  ),
)

const ING_KEEP = new Set(
  `morning evening something nothing everything anything during spring string clothing ceiling
  pudding darling lightning earring offspring interesting boring exciting amazing surprising
  confusing frightening embarrassing`
    .split(/\s+/)
    .filter(Boolean),
)

const ING_SPECIAL: Record<string, string> = { dying: 'die', lying: 'lie', tying: 'tie' }

/** Words whose ending is not a safe suffix; the sentence decides, or they stay as written. */
const SENSE_ONLY = new Set(['saw', 'left', 'rose', 'found', 'tears', 'lives', 'leaves', 'reading', 'wound'])

const DETERMINERS = new Set(
  'a an the this that these those my your his her its our their some any no every each one'.split(' '),
)
const PRONOUNS = new Set('i he she we they you it'.split(' '))
const DOUBLED = new Set(['b', 'd', 'g', 'm', 'n', 'p', 'r', 't', 'z'])

const POSSESSIVE_KEEP = /^(it|that|what|let|who|there|here|he|she)'s$/

export function dictionaryForm(word: string, sentence = '', options?: DictionaryFormOptions): string {
  const raw = word.replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  if (raw.includes(' ') || raw.includes('-')) return raw
  const apostrophe = raw.replace(/’/g, "'")
  if (apostrophe.includes("'")) {
    const lower = apostrophe.toLowerCase()
    if (/'s$/i.test(lower) && !POSSESSIVE_KEEP.test(lower)) {
      return dictionaryForm(apostrophe.replace(/'s$/i, ''), sentence, options)
    }
    return raw
  }
  if (options?.names !== false && isProperName(raw, sentence)) return raw
  return lemma(raw.toLowerCase(), sentence)
}

/** Same dictionary word shares one card. A kept name does not merge with its lowercase twin. */
export function vaultWordKey(word: string): string {
  const trimmed = word.trim()
  if (!trimmed) return ''
  if (isProperName(trimmed, '')) return trimmed.toLowerCase()
  return dictionaryForm(trimmed).toLowerCase()
}

/**
 * On a second save, store the dictionary form.
 * A name, or the same spelling with different capitals, stays as it was.
 */
export function preferredVaultWord(existing: string, incoming: string): string {
  const prev = existing.trim()
  const next = incoming.trim()
  if (!next) return prev
  if (prev.toLowerCase() === next.toLowerCase()) return prev
  if (isProperName(prev, '')) return prev
  if (next.toLowerCase() === dictionaryForm(next).toLowerCase() && vaultWordKey(prev) === vaultWordKey(next)) {
    return next
  }
  return prev
}

function lemma(word: string, sentence: string): string {
  if (word === 'i') return 'I'
  if (KEEP.has(word)) return word
  const noun = IRREGULAR_NOUN[word]
  if (noun) return noun
  const verb = IRREGULAR_VERB[word]
  if (verb) return verb
  const { prev, next } = neighborWords(sentence, word)
  const sensed = senseLemma(word, prev, next)
  if (sensed) return sensed
  if (SENSE_ONLY.has(word)) return word
  return comparativeLemma(word) ?? ingLemma(word, prev) ?? pastLemma(word) ?? numberOrPerson(word) ?? word
}

function senseLemma(word: string, prev: string | null, next: string | null): string | null {
  if (word === 'better' || word === 'best') return 'good'
  if (word === 'worse' || word === 'worst') return 'bad'
  if (word === 'saw') {
    if (prev && DETERMINERS.has(prev)) return null
    if (prev && PRONOUNS.has(prev)) return 'see'
    if (next && (DETERMINERS.has(next) || PRONOUNS.has(next))) return 'see'
    return null
  }
  if (word === 'left') {
    if (prev && ['on', 'to', 'the', 'your', 'my', 'his', 'her', 'our', 'their'].includes(prev)) return null
    if (next && ['side', 'hand', 'turn', 'foot'].includes(next)) return null
    if (prev && PRONOUNS.has(prev)) return 'leave'
    if (next && DETERMINERS.has(next)) return 'leave'
    return null
  }
  if (word === 'rose') {
    if (prev && DETERMINERS.has(prev)) return null
    if (next && ['bush', 'petal', 'petals', 'flower', 'garden', 'thorn', 'thorns'].includes(next)) return null
    if (prev && PRONOUNS.has(prev)) return 'rise'
    if (next && ['up', 'from', 'above', 'early', 'over', 'high'].includes(next)) return 'rise'
    return null
  }
  if (word === 'found') {
    if (prev && DETERMINERS.has(prev)) return null
    if (prev && PRONOUNS.has(prev)) return 'find'
    if (next && (DETERMINERS.has(next) || PRONOUNS.has(next))) return 'find'
    return null
  }
  if (word === 'tears') {
    if (prev && ['in', 'into'].includes(prev)) return null
    if (next && ['fell', 'ran', 'rolled', 'streamed', 'down', 'welled'].includes(next)) return null
    if (prev && PRONOUNS.has(prev)) return 'tear'
    if (next && DETERMINERS.has(next)) return 'tear'
    return null
  }
  if (word === 'lives') {
    if (next && ['in', 'on', 'at', 'with', 'here', 'there', 'near', 'by'].includes(next)) return 'live'
    if (prev && PRONOUNS.has(prev)) return 'live'
    if (next === 'of') return 'life'
    if (prev && (DETERMINERS.has(prev) || ['nine', 'many', 'two', 'three', 'four', 'five', 'seven', 'all'].includes(prev))) {
      return 'life'
    }
    return null
  }
  if (word === 'leaves') {
    if (prev && PRONOUNS.has(prev)) return 'leave'
    if (next && DETERMINERS.has(next)) return 'leave'
    if (prev && (DETERMINERS.has(prev) || ['green', 'fallen', 'autumn', 'dry', 'brown', 'yellow'].includes(prev))) {
      return 'leaf'
    }
    if (next && ['fell', 'fall', 'are', 'were', 'turn', 'turned', 'covered', 'cover'].includes(next)) return 'leaf'
    return null
  }
  if (word === 'reading') {
    if (prev && DETERMINERS.has(prev)) return null
    if (prev || next) return 'read'
    return null
  }
  if (word === 'wound') {
    if (prev && DETERMINERS.has(prev)) return null
    if (prev && PRONOUNS.has(prev)) return 'wind'
    if (next && ['up', 'around', 'tight', 'clock'].includes(next)) return 'wind'
    return null
  }
  return null
}

function comparativeLemma(word: string): string | null {
  let stem: string | null = null
  if (word.endsWith('iest') && word.length > 5) stem = `${word.slice(0, -4)}y`
  else if (word.endsWith('ier') && word.length > 4) stem = `${word.slice(0, -3)}y`
  else if (word.endsWith('est') && word.length > 4) {
    const raw = word.slice(0, -3)
    stem = undouble(raw) ?? raw
  } else if (word.endsWith('er') && word.length > 3) {
    const raw = word.slice(0, -2)
    stem = undouble(raw) ?? raw
  } else return null
  if (COMPARABLE.has(stem)) return stem
  if (COMPARABLE.has(`${stem}e`)) return `${stem}e`
  return null
}

function ingLemma(word: string, prev: string | null): string | null {
  if (ING_KEEP.has(word)) return null
  if (prev && DETERMINERS.has(prev)) return null
  const special = ING_SPECIAL[word]
  if (special) return special
  if (!word.endsWith('ing') || word.length < 5) return null
  const stem = word.slice(0, -3)
  if (!/[aeiouy]/i.test(stem)) return null
  const doubled = undouble(stem)
  if (doubled) return doubled
  if (/[aeiouy]$/i.test(stem)) return stem
  return withSilentE(stem) ?? stem
}

function pastLemma(word: string): string | null {
  if (ED_BASE.has(word)) return null
  if (word.endsWith('ied') && word.length >= 4) {
    const stem = word.slice(0, -3)
    return stem.length <= 1 ? `${stem}ie` : `${stem}y`
  }
  if (word.endsWith('eed') && word.length > 4) return word.slice(0, -1)
  if (!word.endsWith('ed') || word.length < 4) return null
  const stem = word.slice(0, -2)
  const doubled = undouble(stem)
  if (doubled) return doubled
  const silent = withSilentE(stem)
  if (silent) return silent
  if (stem.length >= 2 && /[aeiouy]/i.test(stem)) return stem
  return null
}

function numberOrPerson(word: string): string | null {
  if (word === 'buses') return 'bus'
  if (word === 'gases') return 'gas'
  if (word.endsWith('ies') && word.length >= 4) {
    const withoutS = word.slice(0, -1)
    if (IE_WORDS.has(withoutS)) return withoutS
    const stem = word.slice(0, -3)
    return stem.length <= 1 ? `${stem}ie` : `${stem}y`
  }
  if (/(?:ch|sh|ss|x|z)es$/.test(word) && word.length > 4) {
    const stem = word.slice(0, -2)
    return undouble(stem) ?? stem
  }
  if (word.endsWith('oes') && word.length > 3) {
    const withoutS = word.slice(0, -1)
    if (/^(shoe|toe|canoe|tiptoe|oboe)$/.test(withoutS)) return withoutS
    return word.slice(0, -2)
  }
  if (
    word.endsWith('s') &&
    word.length > 3 &&
    !word.endsWith('ss') &&
    !word.endsWith('ous') &&
    !word.endsWith('ness') &&
    !word.endsWith('is') &&
    !word.endsWith('us')
  ) {
    return word.slice(0, -1)
  }
  return null
}

function undouble(stem: string): string | null {
  if (stem.length < 4) return null
  const last = stem.at(-1)!
  if (last !== stem.at(-2)) return null
  if (!DOUBLED.has(last)) return null
  if (!'aeiou'.includes(stem.at(-3)!)) return null
  return stem.slice(0, -1)
}

function withSilentE(stem: string): string | null {
  if (/[^aeiouy][aeiouy][^aeiouy]$/i.test(stem) || /^[aeiouy][^aeiouy]$/i.test(stem)) return `${stem}e`
  if (/[aeiouy][^aeiouy][cgszv]$/i.test(stem)) return `${stem}e`
  return null
}

function isProperName(word: string, sentence: string): boolean {
  if (!/^\p{Lu}/u.test(word)) return false
  if (word.length > 1 && word === word.toUpperCase()) return false
  if (!sentence) return true
  if (isSentenceInitial(sentence, word)) return false
  return hasLowercaseWordBefore(sentence, word)
}

function isSentenceInitial(sentence: string, word: string): boolean {
  const stripped = sentence.replace(/^[\s"'“”‘’(]+/u, '')
  if (!stripped.startsWith(word)) return false
  const after = stripped.slice(word.length)
  return after.length === 0 || !/^[\p{L}\p{N}]/u.test(after)
}

function hasLowercaseWordBefore(sentence: string, word: string): boolean {
  const match = new RegExp(`([\\p{L}\\p{N}'’-]+)\\s+${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, 'u').exec(sentence)
  if (!match) return false
  const prev = match[1]!
  return /^\p{Ll}/u.test(prev) || prev === 'I'
}

function neighborWords(sentence: string, word: string): { prev: string | null; next: string | null } {
  const tokens = sentence.match(/[\p{L}\p{N}'’-]+/gu)?.map((token) => token.toLowerCase()) ?? []
  const idx = tokens.indexOf(word.toLowerCase())
  if (idx < 0) return { prev: null, next: null }
  return {
    prev: idx > 0 ? tokens[idx - 1]! : null,
    next: idx + 1 < tokens.length ? tokens[idx + 1]! : null,
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
