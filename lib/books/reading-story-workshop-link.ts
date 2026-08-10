/** Link a Literature reading story to a Workshop lesson (frame fuel). */

export interface ReadingStoryWorkshopLink {
  /** Literature (or other peer) story id. */
  storyId: string
  workshopBookId: string
  workshopUnitId: string
  workshopLessonId: string
  /** Optional label for UI. */
  workshopLessonTitle?: string
  updatedAt: string
}

export function sanitizeReadingStoryWorkshopLink(
  input: Partial<ReadingStoryWorkshopLink> & { storyId: string },
): ReadingStoryWorkshopLink | null {
  const storyId = String(input.storyId ?? '').trim()
  const workshopBookId = String(input.workshopBookId ?? '').trim()
  const workshopUnitId = String(input.workshopUnitId ?? '').trim()
  const workshopLessonId = String(input.workshopLessonId ?? '').trim()
  if (!storyId || !workshopBookId || !workshopUnitId || !workshopLessonId) return null
  return {
    storyId,
    workshopBookId,
    workshopUnitId,
    workshopLessonId,
    workshopLessonTitle:
      typeof input.workshopLessonTitle === 'string' && input.workshopLessonTitle.trim()
        ? input.workshopLessonTitle.trim()
        : undefined,
    updatedAt:
      typeof input.updatedAt === 'string' && input.updatedAt.trim()
        ? input.updatedAt.trim()
        : new Date().toISOString(),
  }
}

export function workshopLinkKey(link: Pick<ReadingStoryWorkshopLink, 'workshopBookId' | 'workshopUnitId' | 'workshopLessonId'>): string {
  return `${link.workshopBookId}::${link.workshopUnitId}::${link.workshopLessonId}`
}
