export const BOOK_SHELF_TABS = ['lessons', 'audio', 'materials'] as const

export type BookShelfTab = (typeof BOOK_SHELF_TABS)[number]

/**
 * Tab on the book's lesson shelf. Unknown values (including the removed
 * Advanced tools tabs: outline, stories, plan, advanced) land on Lessons.
 */
export function parseBookShelfTab(value: string | null | undefined): BookShelfTab {
  if (value === 'audio') return 'audio'
  if (value === 'materials' || value === 'tools') return 'materials'
  return 'lessons'
}

export function buildBooksPageHref(params: {
  book?: string | null
  unit?: string | null
  /** Lessons is the default and is omitted from the URL. */
  tab?: BookShelfTab | null
  student?: string | null
  /** Shelf Browse / Preview — not a teaching session. */
  preview?: boolean | null
  /** Lesson desk deep link. */
  lesson?: string | null
  /** Part prep shell deep link. */
  part?: string | null
}): string {
  const search = new URLSearchParams()
  if (params.book?.trim()) search.set('book', params.book.trim())
  if (params.unit?.trim()) search.set('unit', params.unit.trim())
  if (params.tab && params.tab !== 'lessons') search.set('tab', params.tab)
  if (params.student?.trim()) search.set('student', params.student.trim())
  if (params.preview) search.set('preview', '1')
  if (params.lesson?.trim()) search.set('lesson', params.lesson.trim())
  if (params.part?.trim()) search.set('part', params.part.trim())
  const query = search.toString()
  return query ? `/books?${query}` : '/books'
}

export const BOOK_SETUP_COPY = {
  lessons: {
    tabLabel: 'Lessons',
  },
  materials: {
    findGuides: {
      label: 'Find teacher guides',
      subtitle: 'Search online and download PDFs into this book.',
      detail:
        'Search for official pacing guides, teacher editions, and worksheets. Approved downloads are saved to this book\u2019s supporting folder.',
    },
    scanGuides: {
      label: 'Scan guides for hints',
      subtitle: 'Read downloaded files and suggest outline mappings.',
      detail:
        'After you have supporting PDFs, scan them for unit, lesson, and part labels you can apply to your outline.',
    },
    tabLabel: 'Materials',
  },
  audio: {
    label: 'Listening tracks',
    subtitle: 'Attach the book\u2019s audio folder so you can play tracks in class.',
    detail:
      'Drop a folder of mp3/m4a/wav files. They stay with this book and open from the speaker icon on the left strip while teaching.',
    autoPlaceLabel: 'Auto-place speakers',
    autoPlaceDetail:
      'Private shortcut: upload a crop of the book\u2019s listening mark, then scan pages. Matching numbers drop speakers for you — fix the rest on the page.',
    tabLabel: 'Audio',
  },
  focusGrid: {
    label: 'Focus grid',
    subtitle: 'Optional lesson planning notes by focus area.',
  },
} as const
