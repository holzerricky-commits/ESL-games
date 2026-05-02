import type { BookContextRecord, LessonContextRecord, PartContextRecord, UnitContextRecord } from '@/lib/context/types'

export interface ContextStore {
  getBookContext(bookId: string): Promise<BookContextRecord | null>
  saveBookContext(record: BookContextRecord): Promise<BookContextRecord>
  getUnitContext(bookId: string, unitId: string): Promise<UnitContextRecord | null>
  saveUnitContext(record: UnitContextRecord): Promise<UnitContextRecord>
  getLessonContext(bookId: string, unitId: string, lessonId: string): Promise<LessonContextRecord | null>
  saveLessonContext(record: LessonContextRecord): Promise<LessonContextRecord>
  getPartContext(bookId: string, unitId: string, lessonId: string, partId: string): Promise<PartContextRecord | null>
  savePartContext(record: PartContextRecord): Promise<PartContextRecord>
  listContextsForUnit(bookId: string, unitId: string): Promise<{
    unit: UnitContextRecord | null
    lessons: LessonContextRecord[]
    parts: PartContextRecord[]
  }>
  listContextsForBook(bookId: string): Promise<{
    units: UnitContextRecord[]
    lessons: LessonContextRecord[]
    parts: PartContextRecord[]
  }>
}
