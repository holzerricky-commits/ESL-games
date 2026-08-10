import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  sanitizeReadingCheckPack,
  type ReadingCheckPack,
} from '@/lib/books/reading-check-pack'
import {
  sanitizeReadingStoryRangeOverride,
  type ReadingStoryRangeOverride,
} from '@/lib/books/reading-story-map'
import {
  sanitizeReadingStoryTextRecord,
  type ReadingStoryTextRecord,
} from '@/lib/books/reading-story-text'
import {
  sanitizeReadingStoryWorkshopLink,
  type ReadingStoryWorkshopLink,
} from '@/lib/books/reading-story-workshop-link'

const DIR = join(/* turbopackIgnore: true */ process.cwd(), 'data', 'reading-stories')
const MAPS_PATH = join(DIR, 'maps.json')
const WORKSHOP_LINKS_PATH = join(DIR, 'workshop-links.json')
const TEXT_DIR = join(DIR, 'text')
const PACKS_DIR = join(DIR, 'packs')

function storyTextPath(storyId: string): string {
  const safe = storyId.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return join(TEXT_DIR, `${safe}.json`)
}

function storyPackPath(storyId: string): string {
  const safe = storyId.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return join(PACKS_DIR, `${safe}.json`)
}

async function readMaps(): Promise<Record<string, ReadingStoryRangeOverride>> {
  try {
    const raw = await readFile(MAPS_PATH, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, ReadingStoryRangeOverride> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const sanitized = sanitizeReadingStoryRangeOverride({
        ...(value as ReadingStoryRangeOverride),
        storyId: String((value as ReadingStoryRangeOverride).storyId ?? key),
      })
      if (sanitized) out[sanitized.storyId] = sanitized
    }
    return out
  } catch {
    return {}
  }
}

async function writeMaps(maps: Record<string, ReadingStoryRangeOverride>): Promise<void> {
  await mkdir(DIR, { recursive: true })
  await writeFile(MAPS_PATH, JSON.stringify(maps, null, 2), 'utf8')
}

let writeQueue: Promise<unknown> = Promise.resolve()

function queueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task)
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export async function listReadingStoryOverrides(): Promise<ReadingStoryRangeOverride[]> {
  const maps = await readMaps()
  return Object.values(maps)
}

export async function listReadingStoryOverridesForBook(
  bookId: string,
): Promise<ReadingStoryRangeOverride[]> {
  const all = await listReadingStoryOverrides()
  return all.filter((o) => {
    if (o.bookId) return o.bookId === bookId
    return o.storyId.startsWith(`${bookId}::`) || o.storyId.startsWith(`manual::${bookId}::`)
  })
}

export async function getReadingStoryOverride(
  storyId: string,
): Promise<ReadingStoryRangeOverride | null> {
  const maps = await readMaps()
  return maps[storyId] ?? null
}

export async function saveReadingStoryOverride(
  input: Partial<ReadingStoryRangeOverride> & { storyId: string },
): Promise<ReadingStoryRangeOverride> {
  const sanitized = sanitizeReadingStoryRangeOverride(input)
  if (!sanitized) {
    throw new Error('Invalid reading story range.')
  }
  return queueWrite(async () => {
    const maps = await readMaps()
    const prev = maps[sanitized.storyId]
    const next: ReadingStoryRangeOverride = {
      ...prev,
      ...sanitized,
      updatedAt: new Date().toISOString(),
    }
    maps[next.storyId] = next
    await writeMaps(maps)
    return next
  })
}

export async function deleteReadingStoryOverride(storyId: string): Promise<boolean> {
  const id = storyId.trim()
  if (!id) return false
  return queueWrite(async () => {
    const maps = await readMaps()
    if (!(id in maps)) return false
    delete maps[id]
    await writeMaps(maps)
    return true
  })
}

async function safeUnlink(path: string): Promise<void> {
  try {
    await unlink(path)
  } catch {
    // missing file is fine
  }
}

export async function deleteReadingStoryText(storyId: string): Promise<void> {
  const id = storyId.trim()
  if (!id) return
  await safeUnlink(storyTextPath(id))
}

export async function deleteReadingCheckPackFile(storyId: string): Promise<void> {
  const id = storyId.trim()
  if (!id) return
  await safeUnlink(storyPackPath(id))
}

/** Remove map override + saved text + check pack for a story. */
export async function deleteReadingStoryRecord(storyId: string): Promise<{ ok: true }> {
  const id = storyId.trim()
  if (!id) throw new Error('storyId is required.')
  await queueWrite(async () => {
    const maps = await readMaps()
    if (id in maps) {
      delete maps[id]
      await writeMaps(maps)
    }
    await safeUnlink(storyTextPath(id))
    await safeUnlink(storyPackPath(id))
  })
  return { ok: true }
}

export async function getReadingStoryText(storyId: string): Promise<ReadingStoryTextRecord | null> {
  try {
    const raw = await readFile(storyTextPath(storyId), 'utf8')
    const parsed = JSON.parse(raw) as Partial<ReadingStoryTextRecord>
    return sanitizeReadingStoryTextRecord({
      ...parsed,
      storyId: String(parsed.storyId ?? storyId),
      bookId: String(parsed.bookId ?? ''),
      unitId: String(parsed.unitId ?? ''),
    })
  } catch {
    return null
  }
}

export async function listReadingStoryTextsForBook(
  bookId: string,
): Promise<ReadingStoryTextRecord[]> {
  try {
    await mkdir(TEXT_DIR, { recursive: true })
    const names = await readdir(TEXT_DIR)
    const out: ReadingStoryTextRecord[] = []
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      try {
        const raw = await readFile(join(TEXT_DIR, name), 'utf8')
        const parsed = JSON.parse(raw) as Partial<ReadingStoryTextRecord>
        const record = sanitizeReadingStoryTextRecord({
          ...parsed,
          storyId: String(parsed.storyId ?? ''),
          bookId: String(parsed.bookId ?? ''),
          unitId: String(parsed.unitId ?? ''),
        })
        if (record && record.bookId === bookId) out.push(record)
      } catch {
        // skip bad file
      }
    }
    return out
  } catch {
    return []
  }
}

export async function saveReadingStoryText(
  input: Partial<ReadingStoryTextRecord> & { storyId: string; bookId: string; unitId: string },
): Promise<ReadingStoryTextRecord> {
  const sanitized = sanitizeReadingStoryTextRecord(input)
  if (!sanitized) {
    throw new Error('Invalid reading story text.')
  }
  return queueWrite(async () => {
    const next: ReadingStoryTextRecord = {
      ...sanitized,
      updatedAt: new Date().toISOString(),
    }
    await mkdir(TEXT_DIR, { recursive: true })
    await writeFile(storyTextPath(next.storyId), JSON.stringify(next, null, 2), 'utf8')
    return next
  })
}

export async function getReadingCheckPack(storyId: string): Promise<ReadingCheckPack | null> {
  try {
    const raw = await readFile(storyPackPath(storyId), 'utf8')
    const parsed = JSON.parse(raw) as Partial<ReadingCheckPack>
    return sanitizeReadingCheckPack({
      ...parsed,
      storyId: String(parsed.storyId ?? storyId),
      bookId: String(parsed.bookId ?? ''),
      unitId: String(parsed.unitId ?? ''),
    })
  } catch {
    return null
  }
}

export async function listReadingCheckPacksForBook(bookId: string): Promise<ReadingCheckPack[]> {
  try {
    await mkdir(PACKS_DIR, { recursive: true })
    const names = await readdir(PACKS_DIR)
    const out: ReadingCheckPack[] = []
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      try {
        const raw = await readFile(join(PACKS_DIR, name), 'utf8')
        const parsed = JSON.parse(raw) as Partial<ReadingCheckPack>
        const record = sanitizeReadingCheckPack({
          ...parsed,
          storyId: String(parsed.storyId ?? ''),
          bookId: String(parsed.bookId ?? ''),
          unitId: String(parsed.unitId ?? ''),
        })
        if (record && record.bookId === bookId) out.push(record)
      } catch {
        // skip bad file
      }
    }
    return out
  } catch {
    return []
  }
}

export async function saveReadingCheckPack(
  input: Partial<ReadingCheckPack> & { storyId: string; bookId: string; unitId: string },
): Promise<ReadingCheckPack> {
  const sanitized = sanitizeReadingCheckPack(input)
  if (!sanitized) {
    throw new Error('Invalid reading check pack.')
  }
  return queueWrite(async () => {
    const next: ReadingCheckPack = {
      ...sanitized,
      updatedAt: new Date().toISOString(),
    }
    await mkdir(PACKS_DIR, { recursive: true })
    await writeFile(storyPackPath(next.storyId), JSON.stringify(next, null, 2), 'utf8')
    return next
  })
}

export type ApplyManualStoryReconcileResult = {
  merged: number
  kept: number
  deleted: number
  errors: string[]
}

/**
 * Apply post-outline decisions: merge text/packs onto outline stories, re-home keeps, or delete manuals.
 */
export async function applyManualStoryReconcile(args: {
  bookId: string
  decisions: Array<{
    manualStoryId: string
    action: 'merge' | 'keep' | 'delete'
    outlineStoryId?: string
    /** When keeping, optional new unit id so the story shows under the new outline. */
    keepUnitId?: string | null
  }>
}): Promise<ApplyManualStoryReconcileResult> {
  const { bookId, decisions } = args
  const result: ApplyManualStoryReconcileResult = { merged: 0, kept: 0, deleted: 0, errors: [] }

  for (const decision of decisions) {
    const manualId = decision.manualStoryId.trim()
    if (!manualId.startsWith('manual::')) {
      result.errors.push(`Skipped non-manual id: ${manualId}`)
      continue
    }

    try {
      if (decision.action === 'delete') {
        await deleteReadingStoryRecord(manualId)
        result.deleted += 1
        continue
      }

      if (decision.action === 'keep') {
        const override = await getReadingStoryOverride(manualId)
        if (override && decision.keepUnitId) {
          await saveReadingStoryOverride({
            ...override,
            storyId: manualId,
            bookId,
            unitId: decision.keepUnitId,
          })
          const text = await getReadingStoryText(manualId)
          if (text) {
            await saveReadingStoryText({
              ...text,
              storyId: manualId,
              bookId,
              unitId: decision.keepUnitId,
            })
          }
          const pack = await getReadingCheckPack(manualId)
          if (pack) {
            await saveReadingCheckPack({
              ...pack,
              storyId: manualId,
              bookId,
              unitId: decision.keepUnitId,
            })
          }
        }
        result.kept += 1
        continue
      }

      // merge
      const outlineId = decision.outlineStoryId?.trim() ?? ''
      if (!outlineId || outlineId.startsWith('manual::')) {
        result.errors.push(`Merge needs outline story for ${manualId}`)
        continue
      }
      const outlineParts = outlineId.split('::')
      if (outlineParts.length !== 4 || outlineParts[0] !== bookId) {
        result.errors.push(`Invalid outline story id for merge: ${outlineId}`)
        continue
      }
      const [, unitId, lessonId, partId] = outlineParts
      if (!unitId || !lessonId || !partId) {
        result.errors.push(`Invalid outline story id for merge: ${outlineId}`)
        continue
      }

      const manualOverride = await getReadingStoryOverride(manualId)
      const existingOutlineOverride = await getReadingStoryOverride(outlineId)

      const startPage =
        manualOverride && Number.isFinite(manualOverride.startPage)
          ? manualOverride.startPage
          : existingOutlineOverride?.startPage
      const endPage =
        manualOverride && Number.isFinite(manualOverride.endPage)
          ? manualOverride.endPage
          : existingOutlineOverride?.endPage

      if (typeof startPage === 'number' && typeof endPage === 'number') {
        await saveReadingStoryOverride({
          storyId: outlineId,
          bookId,
          unitId,
          lessonId,
          partId,
          title: manualOverride?.title ?? existingOutlineOverride?.title,
          startPage,
          endPage,
          rangeConfirmed: Boolean(manualOverride?.rangeConfirmed ?? existingOutlineOverride?.rangeConfirmed),
        })
      }

      const manualText = await getReadingStoryText(manualId)
      const outlineText = await getReadingStoryText(outlineId)
      if (manualText && (!outlineText || !outlineText.text?.trim())) {
        await saveReadingStoryText({
          ...manualText,
          storyId: outlineId,
          bookId,
          unitId,
        })
      }

      const manualPack = await getReadingCheckPack(manualId)
      const outlinePack = await getReadingCheckPack(outlineId)
      if (manualPack && (!outlinePack || !(outlinePack.stops?.length > 0))) {
        await saveReadingCheckPack({
          ...manualPack,
          storyId: outlineId,
          bookId,
          unitId,
        })
      }

      await deleteReadingStoryRecord(manualId)
      result.merged += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`${manualId}: ${message}`)
    }
  }

  return result
}

async function readWorkshopLinks(): Promise<Record<string, ReadingStoryWorkshopLink>> {
  try {
    const raw = await readFile(WORKSHOP_LINKS_PATH, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, ReadingStoryWorkshopLink> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const sanitized = sanitizeReadingStoryWorkshopLink({
        ...(value as ReadingStoryWorkshopLink),
        storyId: String((value as ReadingStoryWorkshopLink).storyId ?? key),
      })
      if (sanitized) out[sanitized.storyId] = sanitized
    }
    return out
  } catch {
    return {}
  }
}

async function writeWorkshopLinks(links: Record<string, ReadingStoryWorkshopLink>): Promise<void> {
  await mkdir(DIR, { recursive: true })
  await writeFile(WORKSHOP_LINKS_PATH, JSON.stringify(links, null, 2), 'utf8')
}

export async function getReadingStoryWorkshopLink(
  storyId: string,
): Promise<ReadingStoryWorkshopLink | null> {
  const links = await readWorkshopLinks()
  return links[storyId.trim()] ?? null
}

export async function listReadingStoryWorkshopLinksForBook(
  bookId: string,
): Promise<ReadingStoryWorkshopLink[]> {
  const id = bookId.trim()
  if (!id) return []
  const links = await readWorkshopLinks()
  return Object.values(links).filter(
    (link) =>
      link.storyId.startsWith(`${id}::`) || link.storyId.startsWith(`manual::${id}::`),
  )
}

export async function saveReadingStoryWorkshopLink(
  input: Partial<ReadingStoryWorkshopLink> & { storyId: string },
): Promise<ReadingStoryWorkshopLink> {
  const sanitized = sanitizeReadingStoryWorkshopLink(input)
  if (!sanitized) {
    throw new Error('Invalid workshop lesson link.')
  }
  return queueWrite(async () => {
    const links = await readWorkshopLinks()
    const next: ReadingStoryWorkshopLink = {
      ...sanitized,
      updatedAt: new Date().toISOString(),
    }
    links[next.storyId] = next
    await writeWorkshopLinks(links)
    return next
  })
}

export async function deleteReadingStoryWorkshopLink(storyId: string): Promise<boolean> {
  const id = storyId.trim()
  if (!id) return false
  return queueWrite(async () => {
    const links = await readWorkshopLinks()
    if (!(id in links)) return false
    delete links[id]
    await writeWorkshopLinks(links)
    return true
  })
}
