/** studentId → bookId → unitId → pageKey → document */
export type PageNotesRoot = Record<
  string,
  Record<string, Record<string, Record<string, PageNotesDocument>>>
>

export type PageNotesBlock =
  | { type: 'text'; id: string; text: string }
  | { type: 'image'; id: string; dataUrl: string; alt?: string }

export interface PageNotesDocument {
  v: 1
  blocks: PageNotesBlock[]
  updatedAt: string
}

const STORAGE_KEY = 'esl_book_page_notes_v1'
const DOC_VERSION = 1 as const

/** Rough cap for one serialized document in localStorage (~4MB typical limit; stay conservative). */
export const PAGE_NOTES_MAX_DOC_BYTES = 1_400_000
export const PAGE_NOTES_MAX_TEXT_PER_BLOCK = 32_000
export const PAGE_NOTES_IMAGE_MAX_EDGE = 1200
export const PAGE_NOTES_IMAGE_JPEG_QUALITY = 0.82

function newBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `nb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

function isDataImageUrl(s: string): boolean {
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s)
}

function utf8ByteLength(s: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(s).length
  }
  return s.length
}

export function approxDocumentBytes(doc: PageNotesDocument): number {
  return utf8ByteLength(JSON.stringify(doc))
}

function getRoot(): PageNotesRoot {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as PageNotesRoot
  } catch {
    return {}
  }
}

function setRoot(root: PageNotesRoot): boolean {
  if (typeof window === 'undefined') return false
  try {
    const serialized = JSON.stringify(root)
    if (utf8ByteLength(serialized) > 4_500_000) return false
    localStorage.setItem(STORAGE_KEY, serialized)
    return true
  } catch {
    return false
  }
}

function pageKey(pageNumber: number): string {
  return String(Math.max(1, Math.floor(pageNumber)))
}

function sanitizeBlocks(raw: unknown): PageNotesBlock[] {
  if (!Array.isArray(raw)) return []
  const out: PageNotesBlock[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const id = typeof rec.id === 'string' && rec.id.length > 0 ? rec.id.slice(0, 80) : newBlockId()
    if (rec.type === 'text' && typeof rec.text === 'string') {
      out.push({ type: 'text', id, text: rec.text.slice(0, PAGE_NOTES_MAX_TEXT_PER_BLOCK) })
      continue
    }
    if (rec.type === 'image' && typeof rec.dataUrl === 'string' && isDataImageUrl(rec.dataUrl)) {
      const maxUrl = 1_200_000
      const dataUrl = rec.dataUrl.length > maxUrl ? rec.dataUrl.slice(0, maxUrl) : rec.dataUrl
      const alt = typeof rec.alt === 'string' ? rec.alt.slice(0, 200) : undefined
      out.push({ type: 'image', id, dataUrl, ...(alt ? { alt } : {}) })
    }
  }
  return out
}

export function parsePageNotesDocument(raw: unknown): PageNotesDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.v !== 1) return null
  const blocks = sanitizeBlocks(o.blocks)
  return {
    v: DOC_VERSION,
    blocks,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
  }
}

/** Drop image blocks from the end until the doc fits the byte budget. */
export function trimBlocksToBudget(blocks: PageNotesBlock[], maxBytes: number): { blocks: PageNotesBlock[]; trimmed: boolean } {
  let cur = blocks
  let trimmed = false
  for (let guard = 0; guard < 200; guard++) {
    const doc: PageNotesDocument = {
      v: DOC_VERSION,
      blocks: cur,
      updatedAt: new Date().toISOString(),
    }
    if (approxDocumentBytes(doc) <= maxBytes) return { blocks: cur, trimmed }
    const lastImageIdx = [...cur].map((b, i) => (b.type === 'image' ? i : -1)).filter((i) => i >= 0).pop()
    if (lastImageIdx != null) {
      cur = cur.filter((_, i) => i !== lastImageIdx)
      trimmed = true
      continue
    }
    const textIdx = cur.findIndex((b) => b.type === 'text')
    if (textIdx >= 0) {
      const b = cur[textIdx] as Extract<PageNotesBlock, { type: 'text' }>
      const half = Math.floor(b.text.length / 2)
      if (half < 80) {
        cur = cur.filter((_, i) => i !== textIdx)
      } else {
        const next = [...cur]
        next[textIdx] = { ...b, text: `${b.text.slice(0, half)}…` }
        cur = next
      }
      trimmed = true
      continue
    }
    break
  }
  return { blocks: cur, trimmed }
}

export function loadPageNotes(
  studentId: string,
  bookId: string,
  unitId: string,
  pageNumber: number,
): PageNotesDocument | null {
  const root = getRoot()
  const doc = root[studentId]?.[bookId]?.[unitId]?.[pageKey(pageNumber)]
  if (!doc) return null
  return parsePageNotesDocument(doc)
}

export function savePageNotes(
  studentId: string,
  bookId: string,
  unitId: string,
  pageNumber: number,
  blocks: PageNotesBlock[],
): { ok: boolean; trimmed: boolean } {
  let useBlocks = blocks
  let trimmed = false
  const budget = PAGE_NOTES_MAX_DOC_BYTES
  const trimmedOnce = trimBlocksToBudget(useBlocks, budget)
  useBlocks = trimmedOnce.blocks
  trimmed = trimmedOnce.trimmed

  const doc: PageNotesDocument = {
    v: DOC_VERSION,
    blocks: useBlocks,
    updatedAt: new Date().toISOString(),
  }

  if (approxDocumentBytes(doc) > budget) {
    return { ok: false, trimmed: true }
  }

  const root = getRoot()
  const byStudent = root[studentId] ?? {}
  const byBook = byStudent[bookId] ?? {}
  const byUnit = byBook[unitId] ?? {}
  byUnit[pageKey(pageNumber)] = doc
  byBook[unitId] = byUnit
  byStudent[bookId] = byBook
  root[studentId] = byStudent

  const ok = setRoot(root)
  return { ok, trimmed: trimmed || !ok }
}

/** Drop every page note document for one student (e.g. when deleting the student). */
export function removeAllPageNotesForStudent(studentId: string): void {
  const root = getRoot()
  if (!(studentId in root)) return
  const next: PageNotesRoot = { ...root }
  delete next[studentId]
  setRoot(next)
}

export function clearPageNotes(studentId: string, bookId: string, unitId: string, pageNumber: number): void {
  const root = getRoot()
  const byStudent = root[studentId]
  if (!byStudent) return
  const byBook = byStudent[bookId]
  if (!byBook) return
  const byUnit = byBook[unitId]
  if (!byUnit) return
  delete byUnit[pageKey(pageNumber)]
  if (Object.keys(byUnit).length === 0) {
    delete byBook[unitId]
  }
  if (Object.keys(byBook).length === 0) {
    delete byStudent[bookId]
  }
  if (Object.keys(byStudent).length === 0) {
    delete root[studentId]
  }
  setRoot(root)
}

export function createEmptyDocument(): PageNotesDocument {
  return {
    v: DOC_VERSION,
    blocks: [{ type: 'text', id: newBlockId(), text: '' }],
    updatedAt: new Date().toISOString(),
  }
}

export { newBlockId as newPageNotesBlockId }

export function compressImageBlobToJpegDataUrl(
  blob: Blob,
  maxEdge = PAGE_NOTES_IMAGE_MAX_EDGE,
  quality = PAGE_NOTES_IMAGE_JPEG_QUALITY,
): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (!width || !height) {
        resolve(null)
        return
      }
      const scale = Math.min(1, maxEdge / Math.max(width, height))
      width = Math.max(1, Math.round(width * scale))
      height = Math.max(1, Math.round(height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl || null)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}
