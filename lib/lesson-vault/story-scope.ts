import type { LessonVaultCard } from '@/lib/lesson-vault/types'

export type StoryScope = {
  partId: string
  label: string
  count: number
}

export type PartOrderEntry = {
  id: string
  title: string
}

/** Parts that have at least one card, ordered like the lesson, then any extra parts. */
export function storyScopes(
  cards: readonly LessonVaultCard[],
  partOrder: readonly PartOrderEntry[] = [],
): StoryScope[] {
  const byPart = new Map<string, { label: string; count: number }>()
  for (const card of cards) {
    const partId = card.partId.trim()
    if (!partId) continue
    const prev = byPart.get(partId)
    if (prev) {
      prev.count += 1
      if (!prev.label && card.partTitle.trim()) prev.label = card.partTitle.trim()
    } else {
      byPart.set(partId, { label: card.partTitle.trim() || partId, count: 1 })
    }
  }
  if (byPart.size === 0) return []

  const out: StoryScope[] = []
  const seen = new Set<string>()
  for (const part of partOrder) {
    const entry = byPart.get(part.id)
    if (!entry) continue
    seen.add(part.id)
    out.push({
      partId: part.id,
      label: part.title.trim() || entry.label,
      count: entry.count,
    })
  }
  for (const [partId, entry] of byPart) {
    if (seen.has(partId)) continue
    out.push({ partId, label: entry.label, count: entry.count })
  }
  return out
}

/** Every card when `partId` is null; otherwise only that part. */
export function cardsForStory(
  cards: readonly LessonVaultCard[],
  partId: string | null,
): LessonVaultCard[] {
  if (partId == null) return [...cards]
  const id = partId.trim()
  if (!id) return [...cards]
  return cards.filter((card) => card.partId.trim() === id)
}

/** True when the chip row would show more than one story. */
export function showStoryScopeChips(scopes: readonly StoryScope[]): boolean {
  return scopes.length > 1
}

/** Prefer the page's part when it has words; otherwise All (null). */
export function defaultStoryPartId(
  scopes: readonly StoryScope[],
  pagePartId: string | null | undefined,
): string | null {
  const id = pagePartId?.trim() || ''
  if (!id) return null
  return scopes.some((scope) => scope.partId === id) ? id : null
}
