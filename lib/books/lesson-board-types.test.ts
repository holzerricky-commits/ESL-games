import { describe, expect, it } from 'vitest'
import {
  createMemoryWhiteboardSessionStorage,
  loadWhiteboardSession,
  loadWhiteboardSessionBestMatch,
} from '@/lib/books/whiteboard-session-storage'
import { annotationStorageLocalWhiteboardKey, annotationStorageSessionKey } from '@/lib/books/whiteboard-storage'
import {
  createEmptyWhiteboardSession,
  whiteboardSessionDocId,
} from '@/lib/books/whiteboard-session-types'
import {
  createLessonBoardPage,
  migrateLessonBoardDocument,
  normalizeLessonBoardSessionDocument,
  prepareLessonBoardSessionForPersist,
  lessonBoardAllowsRunwayGrowth,
  lessonBoardLogicalWidthPx,
  lessonBoardMinContentHeightPx,
  lessonBoardResolveContentHeightPx,
  defaultLessonBoardContentHeightPx,
  lessonBoardMaxContentHeightPx,
  lessonBoardHeightToKeepOneViewportBelowView,
  lessonBoardThumbDimensions,
  lessonBoardUsesSpreadPresentation,
  syncLessonBoardActivePageToCommands,
  syncLessonBoardCommandsToActivePage,
} from '@/lib/books/lesson-board-types'

const key = {
  studentId: 's1',
  bookId: 'b1',
  unitId: 'u1',
  storagePageKey: 'wb-lesson-1',
}

const stroke = {
  kind: 'stroke' as const,
  id: 'p1',
  tool: 'pen' as const,
  points: [
    [0.1, 0.1],
    [0.2, 0.2],
  ] as [number, number][],
}

describe('lesson-board-types', () => {
  it('lessonBoardThumbDimensions differs for standard vs wide', () => {
    const standard = lessonBoardThumbDimensions('standard', 120)
    const wide = lessonBoardThumbDimensions('wide', 120)
    expect(standard.widthPx).toBeLessThan(standard.heightPx)
    expect(wide.widthPx).toBeGreaterThan(wide.heightPx)
    expect(wide.widthPx).toBe(120)
  })

  it('lessonBoardMinContentHeightPx wide matches aspect height', () => {
    expect(lessonBoardMinContentHeightPx('wide', 640)).toBe(Math.round(640 / (16 / 9)))
  })

  it('lessonBoardLogicalWidthPx prefers stored width then orientation fallback', () => {
    expect(
      lessonBoardLogicalWidthPx(
        { orientation: 'wide', logicalWidthPx: 700 },
        { slotWidthPx: 300, spreadWidthPx: 640 },
      ),
    ).toBe(700)
    expect(
      lessonBoardLogicalWidthPx({ orientation: 'wide' }, { slotWidthPx: 300, spreadWidthPx: 640 }),
    ).toBe(640)
    expect(
      lessonBoardLogicalWidthPx({ orientation: 'standard' }, { slotWidthPx: 300, spreadWidthPx: 640 }),
    ).toBe(300)
  })

  it('lessonBoardUsesSpreadPresentation is true only for wide', () => {
    expect(lessonBoardUsesSpreadPresentation('wide')).toBe(true)
    expect(lessonBoardUsesSpreadPresentation('standard')).toBe(false)
  })

  it('lessonBoardResolveContentHeightPx clamps wide to aspect height', () => {
    expect(lessonBoardResolveContentHeightPx('wide', 640, 2400)).toBe(Math.round(640 / (16 / 9)))
    expect(lessonBoardResolveContentHeightPx('standard', 320, 2000)).toBe(2000)
    expect(lessonBoardResolveContentHeightPx('standard', 320, 100, 500)).toBe(1000)
  })

  it('defaultLessonBoardContentHeightPx is view plus one blank screen', () => {
    expect(defaultLessonBoardContentHeightPx(640)).toBe(1280)
    expect(lessonBoardMaxContentHeightPx(640)).toBe(640 * 8)
  })

  it('lessonBoardHeightToKeepOneViewportBelowView grows ahead of scroll', () => {
    expect(lessonBoardHeightToKeepOneViewportBelowView(0, 500, 1000, 8000)).toBe(1000)
    expect(lessonBoardHeightToKeepOneViewportBelowView(200, 500, 1000, 8000)).toBe(1200)
    expect(lessonBoardHeightToKeepOneViewportBelowView(600, 500, 1000, 8000)).toBe(1600)
    expect(lessonBoardHeightToKeepOneViewportBelowView(600, 500, 1000, 1500)).toBe(1500)
  })

  it('lessonBoardAllowsRunwayGrowth is false for wide only', () => {
    expect(lessonBoardAllowsRunwayGrowth('wide')).toBe(false)
    expect(lessonBoardAllowsRunwayGrowth('standard')).toBe(true)
  })

  it('createEmptyWhiteboardSession starts with one standard page', () => {
    const doc = createEmptyWhiteboardSession(key)
    expect(doc.pages).toHaveLength(1)
    expect(doc.pages[0]?.orientation).toBe('standard')
    expect(doc.activePageId).toBe(doc.pages[0]?.id)
    expect(doc.commands).toEqual([])
    expect(whiteboardSessionDocId(doc.key)).toBe(whiteboardSessionDocId(key))
  })

  it('migrateLessonBoardDocument wraps legacy flat commands', () => {
    const legacy = {
      docId: whiteboardSessionDocId(key),
      key,
      commands: [stroke],
      meta: { revision: 0, dirty: false, updatedAt: 1 },
    }
    const migrated = migrateLessonBoardDocument(legacy)
    expect(migrated.pages).toHaveLength(1)
    expect(migrated.pages[0]?.commands).toHaveLength(1)
    expect(migrated.pages[0]?.commands[0]?.id).toBe('p1')
    expect(migrated.activePageId).toBe(migrated.pages[0]?.id)
  })

  it('migrateLessonBoardDocument is idempotent when pages exist', () => {
    const page = createLessonBoardPage('standard', { commands: [stroke] })
    const doc = {
      docId: whiteboardSessionDocId(key),
      key,
      pages: [page],
      activePageId: page.id,
      commands: [stroke],
      meta: { revision: 1, dirty: false, updatedAt: 2 },
    }
    const again = migrateLessonBoardDocument(doc)
    expect(again.pages).toHaveLength(1)
    expect(again.pages[0]?.id).toBe(page.id)
  })

  it('syncLessonBoardCommandsToActivePage copies root commands into active page', () => {
    const page = createLessonBoardPage('standard', { commands: [] })
    const doc = {
      pages: [page],
      activePageId: page.id,
      commands: [stroke],
    }
    const synced = syncLessonBoardCommandsToActivePage(doc)
    expect(synced.pages[0]?.commands).toHaveLength(1)
    expect(synced.pages[0]?.commands[0]?.id).toBe('p1')
  })

  it('syncLessonBoardActivePageToCommands copies active page to root', () => {
    const page = createLessonBoardPage('standard', { commands: [stroke] })
    const doc = {
      pages: [page],
      activePageId: page.id,
      commands: [] as Array<typeof stroke>,
    }
    const synced = syncLessonBoardActivePageToCommands(doc)
    expect(synced.commands).toHaveLength(1)
    expect(synced.commands[0]?.id).toBe('p1')
  })

  it('normalizeLessonBoardSessionDocument migrates then syncs commands', () => {
    const normalized = normalizeLessonBoardSessionDocument({
      commands: [stroke],
      meta: { revision: 0, dirty: false, updatedAt: 0 },
    })
    expect(normalized.pages).toHaveLength(1)
    expect(normalized.commands).toHaveLength(1)
    expect(normalized.pages[0]?.commands).toHaveLength(1)
  })

  it('loadWhiteboardSession migrates legacy storage and preserves docId', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    const docId = whiteboardSessionDocId(key)
    storage.writeRoot({
      [docId]: {
        docId,
        key,
        commands: [stroke],
        meta: { revision: 2, dirty: false, updatedAt: 99 },
      } as never,
    })
    const loaded = loadWhiteboardSession(key, storage)
    expect(loaded.docId).toBe(docId)
    expect(loaded.pages).toHaveLength(1)
    expect(loaded.commands).toHaveLength(1)
    expect(loaded.pages[0]?.commands[0]?.id).toBe('p1')
  })

  it('round-trip save stores commands on active page', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    const doc = createEmptyWhiteboardSession(key)
    doc.commands = [stroke]
    const prepared = prepareLessonBoardSessionForPersist(doc)
    storage.writeRoot({ [doc.docId]: prepared as never })
    const loaded = loadWhiteboardSession(key, storage)
    expect(loaded.commands).toHaveLength(1)
    expect(loaded.pages[0]?.commands).toHaveLength(1)
  })

  it('loadWhiteboardSessionBestMatch picks local ink when class key is empty', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    const classKey = annotationStorageSessionKey('class-live')
    const localKey = annotationStorageLocalWhiteboardKey(key.bookId, key.unitId)
    const localDoc = createEmptyWhiteboardSession({ ...key, storagePageKey: localKey })
    localDoc.commands = [stroke]
    const localPrepared = prepareLessonBoardSessionForPersist(localDoc)
    storage.writeRoot({ [localDoc.docId]: localPrepared as never })

    const primaryKey = { ...key, storagePageKey: localKey }
    const loaded = loadWhiteboardSessionBestMatch(primaryKey, [localKey, classKey], storage)
    expect(loaded.key.storagePageKey).toBe(localKey)
    expect(loaded.docId).toBe(whiteboardSessionDocId(primaryKey))
    expect(loaded.commands).toHaveLength(1)
    expect(loaded.pages[0]?.commands).toHaveLength(1)
  })

  it('loadWhiteboardSessionBestMatch migrates richest legacy class board onto lasting key', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    const localKey = annotationStorageLocalWhiteboardKey(key.bookId, key.unitId)
    const legacyKey = annotationStorageSessionKey('old-class-1')
    const legacyDoc = createEmptyWhiteboardSession({ ...key, storagePageKey: legacyKey })
    legacyDoc.commands = [stroke]
    const prepared = prepareLessonBoardSessionForPersist(legacyDoc)
    storage.writeRoot({ [legacyDoc.docId]: prepared as never })

    const primaryKey = { ...key, storagePageKey: localKey }
    const loaded = loadWhiteboardSessionBestMatch(primaryKey, [localKey], storage)
    expect(loaded.key.storagePageKey).toBe(localKey)
    expect(loaded.docId).toBe(whiteboardSessionDocId(primaryKey))
    expect(loaded.commands).toHaveLength(1)
    expect(loaded.pages[0]?.commands).toHaveLength(1)
  })
})
