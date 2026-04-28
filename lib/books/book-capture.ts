import { toCanvas } from 'html-to-image'

export type BookCaptureFormat = 'png' | 'jpeg' | 'webp'

export function slugForFilename(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'x'
}

export function buildExportBaseName(parts: {
  bookId: string
  unitId: string
  page: number
  kind: string
}): string {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const hhmmss = `${hh}${mm}${ss}`
  const raw = `${hhmmss}_${slugForFilename(parts.bookId)}_${slugForFilename(parts.unitId)}_p${parts.page}_${slugForFilename(parts.kind)}`
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)
  return safe || 'export'
}

export function buildPdfPacketBaseName(parts: { bookId: string; unitId: string; pageFrom: number; pageTo: number }): string {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const raw = `${hh}${mm}${ss}_${slugForFilename(parts.bookId)}_${slugForFilename(parts.unitId)}_p${parts.pageFrom}-${parts.pageTo}_packet`
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'packet'
}

export async function settleLayout(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
}

const HTML_TO_IMAGE_OPTS = {
  cacheBust: true,
  pixelRatio: typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 2) : 2,
} as const

export async function captureElementToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  return toCanvas(el, HTML_TO_IMAGE_OPTS)
}

export function applyWatermarkToCanvas(
  source: HTMLCanvasElement,
  line: string,
  opts?: { font?: string; fillStyle?: string },
): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = source.width
  out.height = source.height
  const ctx = out.getContext('2d')
  if (!ctx) return source
  ctx.drawImage(source, 0, 0)
  const font = opts?.font ?? `${Math.max(12, Math.round(source.width * 0.018))}px system-ui, sans-serif`
  ctx.font = font
  ctx.fillStyle = opts?.fillStyle ?? 'rgba(40, 32, 28, 0.55)'
  const pad = Math.round(source.width * 0.012)
  const metrics = ctx.measureText(line)
  const x = Math.max(pad, source.width - metrics.width - pad)
  const y = source.height - pad
  ctx.fillText(line, x, y)
  return out
}

/** Map a rectangle in the element's CSS pixel space to source canvas pixels. */
export function domRectToCanvasCrop(
  canvas: HTMLCanvasElement,
  domRect: { x: number; y: number; width: number; height: number },
  elementW: number,
  elementH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const scaleX = canvas.width / Math.max(1, elementW)
  const scaleY = canvas.height / Math.max(1, elementH)
  const sx = Math.max(0, Math.round(domRect.x * scaleX))
  const sy = Math.max(0, Math.round(domRect.y * scaleY))
  const sw = Math.min(canvas.width - sx, Math.max(1, Math.round(domRect.width * scaleX)))
  const sh = Math.min(canvas.height - sy, Math.max(1, Math.round(domRect.height * scaleY)))
  return { sx, sy, sw, sh }
}

export function cropCanvas(
  source: HTMLCanvasElement,
  crop: { sx: number; sy: number; sw: number; sh: number },
): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = crop.sw
  out.height = crop.sh
  const ctx = out.getContext('2d')
  if (!ctx) return source
  ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh)
  return out
}

export async function canvasToBlob(canvas: HTMLCanvasElement, format: BookCaptureFormat, jpegQuality = 0.88): Promise<Blob> {
  const mime =
    format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('toBlob failed'))
      },
      mime,
      format === 'jpeg' ? jpegQuality : undefined,
    )
  })
}

export type StudentWorkUploadCategory =
  | 'exports-book-review'
  | 'homework-assigned'
  | 'homework-submitted'
  | 'materials'
  | 'audio'
  | 'lesson-notes'

export async function uploadStudentWorkBlob(params: {
  studentId: string
  baseName: string
  blob: Blob
  category: StudentWorkUploadCategory
  meta?: Record<string, unknown>
}): Promise<{ relativePath: string; fileName: string }> {
  const form = new FormData()
  form.set('studentId', params.studentId)
  form.set('category', params.category)
  form.set('baseName', params.baseName)
  const ext =
    params.blob.type === 'image/jpeg' || params.blob.type === 'image/jpg'
      ? 'jpg'
      : params.blob.type === 'image/webp'
        ? 'webp'
        : params.blob.type === 'application/pdf'
          ? 'pdf'
          : 'png'
  form.set('file', params.blob, `${params.baseName}.${ext}`)
  if (params.meta) form.set('meta', JSON.stringify(params.meta))
  const res = await fetch('/api/student-work/upload', { method: 'POST', body: form })
  const data = (await res.json().catch(() => ({}))) as { error?: string; relativePath?: string; fileName?: string }
  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`)
  }
  if (!data.relativePath || !data.fileName) {
    throw new Error('Invalid upload response')
  }
  return { relativePath: data.relativePath, fileName: data.fileName }
}

export async function copyImageBlobToClipboard(blob: Blob): Promise<void> {
  if (!navigator.clipboard?.write) {
    throw new Error('Clipboard API unavailable')
  }
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
}

/** `fileRelativePath` is under `student-work/` without that prefix (from upload `relativePath`). */
export async function patchStudentWorkCaption(params: {
  studentId: string
  fileRelativePath: string
  caption: string
}): Promise<void> {
  const res = await fetch('/api/student-work/patch-meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(data.error || `Meta update failed (${res.status})`)
}

export function relativePathUnderStudentWork(relativePath: string): string {
  const prefix = 'student-work/'
  const n = relativePath.replaceAll('\\', '/')
  if (!n.startsWith(prefix)) return n.replace(/^\/+/, '')
  return n.slice(prefix.length)
}
