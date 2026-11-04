import type { LessonVaultPictureChoice } from '@/lib/lesson-vault/types'

/** Hosts the server may download vault pictures from (no open proxy). */
const PICTURE_HOSTS = ['static.arasaac.org', 'api.iconify.design', 'pixabay.com', 'cdn.pixabay.com']

export function isAllowedPictureUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && PICTURE_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

export type FetchJson = (url: string) => Promise<unknown>

const ARASAAC_API = 'https://api.arasaac.org/v1/pictograms/en'
const ARASAAC_STATIC = 'https://static.arasaac.org/pictograms'

export function arasaacChoice(id: number): LessonVaultPictureChoice {
  return { thumb: `${ARASAAC_STATIC}/${id}/${id}_300.png`, full: `${ARASAAC_STATIC}/${id}/${id}_500.png` }
}

type ArasaacPictogram = { _id?: unknown; violence?: unknown }

function arasaacIds(data: unknown): number[] {
  if (!Array.isArray(data)) return []
  return (data as ArasaacPictogram[])
    .filter((p) => typeof p?._id === 'number' && p.violence !== true)
    .map((p) => p._id as number)
}

/**
 * ARASAAC learner pictograms for a keyword: exact matches first, then the fuzzy search
 * (only when `fuzzy`, since it can drift to another meaning).
 */
export async function arasaacChoices(
  keyword: string,
  fetchJson: FetchJson,
  opts: { limit: number; fuzzy: boolean },
): Promise<LessonVaultPictureChoice[]> {
  const k = keyword.trim().toLowerCase()
  if (!k) return []
  const ids = arasaacIds(await fetchJson(`${ARASAAC_API}/bestsearch/${encodeURIComponent(k)}`).catch(() => null))
  if (ids.length === 0 && opts.fuzzy) {
    ids.push(...arasaacIds(await fetchJson(`${ARASAAC_API}/search/${encodeURIComponent(k)}`).catch(() => null)))
  }
  return [...new Set(ids)].slice(0, opts.limit).map(arasaacChoice)
}

const ICONIFY = 'https://api.iconify.design'
const FLUENT = 'fluent-emoji-flat'
const SKIN_TONE = /-(light|medium-light|medium|medium-dark|dark)$/

export function fluentChoice(name: string): LessonVaultPictureChoice {
  return {
    thumb: `${ICONIFY}/${FLUENT}/${name}.svg?width=128&height=128`,
    full: `${ICONIFY}/${FLUENT}/${name}.svg?width=512&height=512`,
  }
}

/** Icon names containing the keyword as a word, or a simple form of it (Iconify's search is loose). */
export function relevantFluentNames(keyword: string, icons: readonly string[]): string[] {
  const k = keyword.trim().toLowerCase().replace(/\s+/g, '-')
  if (k.length < 2 || !/^[a-z-]+$/.test(k)) return []
  const form = new RegExp(`^${k}(s|es|ing|ning|ming|ping|ed|ped)?$`)
  const out: string[] = []
  for (const full of icons) {
    const name = full.startsWith(`${FLUENT}:`) ? full.slice(FLUENT.length + 1) : ''
    if (!name || SKIN_TONE.test(name)) continue
    if (name === k || name.split('-').some((p) => form.test(p))) out.push(name)
  }
  // Exact name, then the keyword as the last word ("person-running" over "running-shoe"), then shorter.
  const rank = (name: string) => (name === k ? 0 : form.test(name.split('-').at(-1) ?? '') ? 1 : 2)
  return out.sort((a, b) => rank(a) - rank(b) || a.length - b.length)
}

/** Fluent Emoji (Microsoft, MIT) icons for a keyword. */
export async function fluentChoices(
  keyword: string,
  fetchJson: FetchJson,
  limit: number,
): Promise<LessonVaultPictureChoice[]> {
  const k = keyword.trim().toLowerCase()
  if (k.length < 2) return []
  const data = (await fetchJson(
    `${ICONIFY}/search?query=${encodeURIComponent(k)}&prefix=${FLUENT}&limit=32`,
  ).catch(() => null)) as { icons?: unknown } | null
  const icons = Array.isArray(data?.icons) ? (data.icons as unknown[]).filter((x): x is string => typeof x === 'string') : []
  return relevantFluentNames(k, icons).slice(0, limit).map(fluentChoice)
}

/**
 * Pixabay API image links expire after about a day; the CDN 640 px copy (same path as the
 * 150 px preview) stays, so a later swap from the strip still works.
 */
export function pixabayChoice(thumbUrl: string, fullUrl: string): LessonVaultPictureChoice {
  const stable = /^https:\/\/cdn\.pixabay\.com\/.+_150\.(jpe?g|png)$/i.test(thumbUrl)
    ? thumbUrl.replace(/_150\.(jpe?g|png)$/i, '_640.$1')
    : fullUrl
  return { thumb: thumbUrl || stable, full: stable }
}

/** Pictograms first, then icons, then stock cartoons; up to `max`, no duplicates. */
export function mergePictureChoices(
  lists: { arasaac: LessonVaultPictureChoice[]; fluent: LessonVaultPictureChoice[]; pixabay: LessonVaultPictureChoice[] },
  max: number,
): LessonVaultPictureChoice[] {
  const quota = [
    lists.arasaac.slice(0, 2),
    lists.fluent.slice(0, 1),
    lists.pixabay.slice(0, 2),
  ]
  const rest = [lists.arasaac.slice(2), lists.fluent.slice(1), lists.pixabay.slice(2)]
  const out: LessonVaultPictureChoice[] = []
  const seen = new Set<string>()
  for (const choice of [...quota.flat(), ...rest.flat()]) {
    if (out.length >= max) break
    if (seen.has(choice.full)) continue
    seen.add(choice.full)
    out.push(choice)
  }
  return out
}
