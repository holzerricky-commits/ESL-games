import { preserveCase } from '@/lib/writing-assist/spell-engine'

/** Strip apostrophe-like chars so `shouldnt`, `shouldn't`, and `shouldn't` share one lookup key. */
export function contractionLookupKey(word: string): string {
  return word.toLowerCase().replace(/[\u0027\u2018\u2019\u0060\u00b4\u02bc`´]/g, '')
}

/** Missing-apostrophe forms → expanded contraction (checked before SymSpell). */
const CONTRACTIONS: Record<string, string> = {
  // be
  im: "i'm",
  youre: "you're",
  theyre: "they're",
  // have
  ive: "i've",
  weve: "we've",
  youve: "you've",
  theyve: "they've",
  shouldve: "should've",
  couldve: "could've",
  wouldve: "would've",
  mightve: "might've",
  mustve: "must've",
  // will / shall
  youll: "you'll",
  theyll: "they'll",
  itll: "it'll",
  thatll: "that'll",
  wholl: "who'll",
  therell: "there'll",
  // would / had (skip id, wed, shed, hell, shell, well — valid words on their own)
  youd: "you'd",
  theyd: "they'd",
  itd: "it'd",
  thatd: "that'd",
  howd: "how'd",
  whod: "who'd",
  // not
  dont: "don't",
  wont: "won't",
  cant: "can't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  havent: "haven't",
  hasnt: "hasn't",
  hadnt: "hadn't",
  didnt: "didn't",
  doesnt: "doesn't",
  shouldnt: "shouldn't",
  couldnt: "couldn't",
  wouldnt: "wouldn't",
  mightnt: "mightn't",
  mustnt: "mustn't",
  neednt: "needn't",
  oughtnt: "oughtn't",
  shant: "shan't",
  aint: "ain't",
  // other
  lets: "let's",
  thats: "that's",
  whats: "what's",
  hes: "he's",
  shes: "she's",
  its: "it's",
  theres: "there's",
  heres: "here's",
  whos: "who's",
  hows: "how's",
  wheres: "where's",
}

export function suggestContraction(word: string): string | null {
  const key = contractionLookupKey(word)
  if (!key) return null
  const hit = CONTRACTIONS[key]
  if (!hit) return null
  const expanded = preserveCase(word, hit)
  if (expanded === word) return null
  return expanded
}

export function isKnownContractionTypo(word: string): boolean {
  const key = contractionLookupKey(word)
  return key.length > 0 && key in CONTRACTIONS
}
