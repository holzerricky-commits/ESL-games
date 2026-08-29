export const BOOK_SETUP_TABS = ['outline', 'materials', 'audio', 'stories', 'plan', 'advanced'] as const

export type BookSetupTab = (typeof BOOK_SETUP_TABS)[number]

/** @deprecated Legacy Map / Ready / Tools stage ids — kept for old URLs only. */
export const BOOK_PREP_STAGES = ['map', 'ready', 'tools'] as const
export type BookPrepStage = (typeof BOOK_PREP_STAGES)[number]

export const BOOK_TOOLS_TABS = ['materials', 'audio', 'plan', 'advanced'] as const
export type BookToolsTab = (typeof BOOK_TOOLS_TABS)[number]

export function parseBookSetupTab(value: string | null | undefined): BookSetupTab | null {
  if (!value) return null
  // Legacy URL: Check pages tab removed — land on Outline.
  if (value === 'check-pages') return 'outline'
  // Legacy stage aliases (old Map / Ready / Tools hub)
  if (value === 'map') return 'outline'
  if (value === 'ready') return 'stories'
  if (value === 'tools') return 'materials'
  return BOOK_SETUP_TABS.includes(value as BookSetupTab) ? (value as BookSetupTab) : null
}

/** Default Advanced tools tab: Outline until mapped, otherwise Materials. */
export function defaultBookSetupTab(hasOutline: boolean): BookSetupTab {
  return hasOutline ? 'materials' : 'outline'
}

export function resolveBookSetupTab(
  requested: string | null | undefined,
  hasOutline: boolean,
): BookSetupTab {
  return parseBookSetupTab(requested) ?? defaultBookSetupTab(hasOutline)
}

/** @deprecated Prefer pill tabs; kept for URL stage aliases. */
export function prepStageFromTab(tab: BookSetupTab): BookPrepStage {
  if (tab === 'outline') return 'map'
  if (tab === 'stories') return 'ready'
  return 'tools'
}

/** @deprecated Prefer pill tabs; kept for URL stage aliases. */
export function defaultTabForPrepStage(
  stage: BookPrepStage,
  currentTab?: BookSetupTab | null,
): BookSetupTab {
  if (stage === 'map') return 'outline'
  if (stage === 'ready') return 'stories'
  if (currentTab && (BOOK_TOOLS_TABS as readonly string[]).includes(currentTab)) {
    return currentTab
  }
  return 'materials'
}

export function buildBooksPageHref(params: {
  book?: string | null
  unit?: string | null
  tab?: BookSetupTab | null
  student?: string | null
  /** Focus a story row on the Stories tab (deep link from Prepare glance). */
  story?: string | null
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
  if (params.tab) search.set('tab', params.tab)
  if (params.student?.trim()) search.set('student', params.student.trim())
  if (params.story?.trim()) search.set('story', params.story.trim())
  if (params.preview) search.set('preview', '1')
  if (params.lesson?.trim()) search.set('lesson', params.lesson.trim())
  if (params.part?.trim()) search.set('part', params.part.trim())
  const query = search.toString()
  return query ? `/books?${query}` : '/books'
}

export const BOOK_SETUP_COPY = {
  outline: {
    label: 'Edit lesson outline',
    subtitle: 'Define units, lessons, and PDF page ranges.',
    detail:
      'Open the structure wizard to read the table of contents from your PDF and save units, lessons, parts, and page alignment. Prefer Edit outline on the lesson shelf when you can.',
    tabLabel: 'Outline',
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
  stories: {
    label: 'Reading stories',
    subtitle: 'Legacy multi-story desk — prefer part prep on the lesson shelf.',
    detail:
      'Older multi-story tools (workshop link, harvest, frame). Day-to-day pages, text, and checks live on each story part from the lesson shelf.',
    tabLabel: 'Stories',
  },
  plan: {
    label: 'Teaching focus grid',
    subtitle: 'Optional lesson planning notes by focus area.',
    detail:
      'Define book-level focus areas (vocab, grammar, etc.) and add notes per lesson. Optional for prep\u2014not required to teach.',
    tabLabel: 'Plan',
  },
  advanced: {
    tabLabel: 'Advanced',
    emptyHint: 'Pick a unit, lesson, or part from the Outline tab.',
  },
} as const

/** @deprecated Map/Ready/Tools chrome removed in Phase D. */
export const BOOK_PREP_STAGE_COPY: Record<BookPrepStage, { label: string; hint: string }> = {
  map: { label: 'Map', hint: 'Outline & pages' },
  ready: { label: 'Ready', hint: 'Stories & checks' },
  tools: { label: 'Tools', hint: 'Guides & extras' },
}
