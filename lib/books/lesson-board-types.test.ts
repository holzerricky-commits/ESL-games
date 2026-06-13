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
    expect(lessonBoardResolveContentHeightPx('standard', 320, 2400)).toBe(2400)
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
      commands: [],
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

    const primaryKey = { ...key, storagePageKey: classKey }
    const loaded = loadWhiteboardSessionBestMatch(primaryKey, [classKey, localKey], storage)
    expect(loaded.key.storagePageKey).toBe(classKey)
    expect(loaded.docId).toBe(whiteboardSessionDocId(primaryKey))
    expect(loaded.commands).toHaveLength(1)
    expect(loaded.pages[0]?.commands).toHaveLength(1)
  })

  it('loadWhiteboardSessionBestMatch prefers local ink over an empty multi-page class board', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    const classKey = annotationStorageSessionKey('class-live')
    const localKey = annotationStorageLocalWhiteboardKey(key.bookId, key.unitId)
    const classDoc = createEmptyWhiteboardSession({ ...key, storagePageKey: classKey })
    classDoc.pages = [
      createLessonBoardPage('standard', { id: 'empty-page-1' }),
      createLessonBoardPage('standard', { id: 'empty-page-2' }),
    ]
    classDoc.activePageId = 'empty-page-1'
    classDoc.commands = []
    const localDoc = createEmptyWhiteboardSession({ ...key, storagePageKey: localKey })
    localDoc.commands = [stroke]
    storage.writeRoot({
      [classDoc.docId]: prepareLessonBoardSessionForPersist(classDoc) as never,
      [localDoc.docId]: prepareLessonBoardSessionForPersist(localDoc) as never,
    })

    const primaryKey = { ...key, storagePageKey: classKey }
    const loaded = loadWhiteboardSessionBestMatch(primaryKey, [classKey, localKey], storage)
    expect(loaded.key.storagePageKey).toBe(classKey)
    expect(loaded.docId).toBe(whiteboardSessionDocId(primaryKey))
    expect(loaded.commands).toHaveLength(1)
    expect(loaded.pages[0]?.commands).toHaveLength(1)
  })
})
