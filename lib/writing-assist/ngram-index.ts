const BIGRAM_URL = '/writing-assist/en-us-bigrams.json'

type BigramEntry = [string, string, number]

let loadPromise: Promise<Map<string, { word: string; count: number }[]>> | null = null

function buildMap(entries: BigramEntry[]): Map<string, { word: string; count: number }[]> {
  const map = new Map<string, { word: string; count: number }[]>()
  for (const [w1, w2, count] of entries) {
    const list = map.get(w1) ?? []
    const existing = list.find((x) => x.word === w2)
    if (existing) existing.count = Math.max(existing.count, count)
    else list.push({ word: w2, count })
    map.set(w1, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => b.count - a.count)
  }
  return map
}

export async function loadNgramIndex(): Promise<Map<string, { word: string; count: number }[]>> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const res = await fetch(BIGRAM_URL)
      if (!res.ok) throw new Error(`Bigram fetch failed: ${res.status}`)
      const entries = (await res.json()) as BigramEntry[]
      return buildMap(entries)
    })()
  }
  return loadPromise
}

export function getBigramNextWords(
  index: Map<string, { word: string; count: number }[]>,
  prev: string,
  prev2?: string,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  const add = (w: string) => {
    const lower = w.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      out.push(lower)
    }
  }

  if (prev2) {
    const list2 = index.get(prev2)
    if (list2) {
      for (const hit of list2.slice(0, 4)) {
        if (hit.word.startsWith(prev) || prev.startsWith(hit.word.slice(0, 2))) add(hit.word)
      }
    }
  }

  const list = index.get(prev)
  if (list) {
    for (const hit of list.slice(0, 12)) add(hit.word)
  }

  return out
}

/** For tests: build index from entries without fetch. */
export function buildNgramIndexForTest(entries: BigramEntry[]): Map<string, { word: string; count: number }[]> {
  return buildMap(entries)
}

export function resetNgramIndexForTests(): void {
  loadPromise = null
}
