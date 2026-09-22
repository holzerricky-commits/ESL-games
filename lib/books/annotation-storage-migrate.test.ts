import { describe, expect, it } from 'vitest'
import {
  ANNOTATION_STORAGE_KEY_V1,
  ANNOTATION_STORAGE_KEY_V2,
  ANNOTATION_STORAGE_V2_MIGRATED_FLAG,
  migrateAnnotationsStorageV1ToV2,
  type AnnotationStorageLike,
} from '@/lib/books/annotation-storage'

function createMemoryStorage(initial: Record<string, string> = {}): AnnotationStorageLike & {
  data: Map<string, string>
  failNextSetFor?: string
} {
  const data = new Map(Object.entries(initial))
  const storage: AnnotationStorageLike & { data: Map<string, string>; failNextSetFor?: string } = {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (storage.failNextSetFor && key === storage.failNextSetFor) {
        storage.failNextSetFor = undefined
        const err = new Error('QuotaExceededError')
        err.name = 'QuotaExceededError'
        throw err
      }
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
  return storage
}

const v1Payload = JSON.stringify({
  stu_1: {
    book_a: {
      unit_1: {
        '3': [{ tool: 'pen', points: [[0.1, 0.1], [0.4, 0.4]], color: '#112233' }],
      },
    },
  },
})

describe('migrateAnnotationsStorageV1ToV2', () => {
  it('migrates v1 strokes into v2 and removes v1', () => {
    const storage = createMemoryStorage({ [ANNOTATION_STORAGE_KEY_V1]: v1Payload })
    migrateAnnotationsStorageV1ToV2(storage)

    expect(storage.getItem(ANNOTATION_STORAGE_KEY_V1)).toBeNull()
    expect(storage.getItem(ANNOTATION_STORAGE_V2_MIGRATED_FLAG)).toBe('1')
    const v2 = JSON.parse(storage.getItem(ANNOTATION_STORAGE_KEY_V2) ?? '{}') as {
      stu_1?: { book_a?: { unit_1?: { '3'?: Array<{ kind?: string; tool?: string }> } } }
    }
    expect(v2.stu_1?.book_a?.unit_1?.['3']?.[0]?.kind).toBe('stroke')
    expect(v2.stu_1?.book_a?.unit_1?.['3']?.[0]?.tool).toBe('pen')
  })

  it('does not write empty v2 when v2 setItem fails; restores v1 for retry', () => {
    const storage = createMemoryStorage({ [ANNOTATION_STORAGE_KEY_V1]: v1Payload })
    storage.failNextSetFor = ANNOTATION_STORAGE_KEY_V2
    migrateAnnotationsStorageV1ToV2(storage)

    expect(storage.getItem(ANNOTATION_STORAGE_KEY_V2)).toBeNull()
    expect(storage.getItem(ANNOTATION_STORAGE_KEY_V1)).toBe(v1Payload)
    expect(storage.getItem(ANNOTATION_STORAGE_V2_MIGRATED_FLAG)).toBeNull()

    // Retry succeeds once quota pressure lifts.
    migrateAnnotationsStorageV1ToV2(storage)
    expect(storage.getItem(ANNOTATION_STORAGE_KEY_V2)).toBeTruthy()
    expect(storage.getItem(ANNOTATION_STORAGE_KEY_V1)).toBeNull()
  })

  it('recovers from prior poison empty v2 left beside intact v1', () => {
    const storage = createMemoryStorage({
      [ANNOTATION_STORAGE_KEY_V1]: v1Payload,
      [ANNOTATION_STORAGE_KEY_V2]: '{}',
    })
    migrateAnnotationsStorageV1ToV2(storage)

    const v2 = JSON.parse(storage.getItem(ANNOTATION_STORAGE_KEY_V2) ?? '{}') as {
      stu_1?: unknown
    }
    expect(v2.stu_1).toBeTruthy()
    expect(storage.getItem(ANNOTATION_STORAGE_KEY_V1)).toBeNull()
    expect(storage.getItem(ANNOTATION_STORAGE_V2_MIGRATED_FLAG)).toBe('1')
  })

  it('does not resurrect v1 after a successful migrate flag when v2 is empty', () => {
    const storage = createMemoryStorage({
      [ANNOTATION_STORAGE_KEY_V1]: v1Payload,
      [ANNOTATION_STORAGE_KEY_V2]: '{}',
      [ANNOTATION_STORAGE_V2_MIGRATED_FLAG]: '1',
    })
    migrateAnnotationsStorageV1ToV2(storage)

    expect(storage.getItem(ANNOTATION_STORAGE_KEY_V2)).toBe('{}')
    expect(storage.getItem(ANNOTATION_STORAGE_KEY_V1)).toBeNull()
  })
})
