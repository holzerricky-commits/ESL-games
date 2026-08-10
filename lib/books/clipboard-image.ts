import { fetchBoardImageAsFile } from '@/lib/board-image-import-client'



export const CLIPBOARD_IMAGE_MAX_DIMENSION_PX = 1200

export const CLIPBOARD_IMAGE_MAX_BYTES = 1_500_000

/** Animated GIFs cannot be re-encoded without losing motion — allow a larger raw paste budget. */

export const CLIPBOARD_GIF_MAX_BYTES = 8_000_000



export type ImageNormBox = {

  x: number

  y: number

  w: number

  h: number

}



export type PastedBoardImageResolution = {

  file: File

  animated: boolean

  /** True when clipboard HTML/text had an animation URL but fetch failed and a raster fallback was used. */

  usedFrozenRasterFallback?: boolean

}



export type PasteImageOutcome = {

  ok: boolean

  animated?: boolean

  usedFrozenRasterFallback?: boolean

}



/** User-facing toast kind after a successful paste (shared by board paste entry points). */
export function pasteImageOutcomeToastKind(
  outcome: PasteImageOutcome,
): 'gif' | 'picture' | 'frozen-fallback' | null {
  if (!outcome.ok) return null
  if (outcome.usedFrozenRasterFallback) return 'frozen-fallback'
  if (outcome.animated) return 'gif'
  return 'picture'
}



export function readImageFileFromClipboardData(clipboard: DataTransfer): File | null {

  const imageItem = Array.from(clipboard.items).find((item) => item.type.startsWith('image/'))

  if (!imageItem) return null

  return imageItem.getAsFile()

}

const BOARD_IMAGE_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const BOARD_IMAGE_EXTENSIONS = ['.gif', '.jpeg', '.jpg', '.png', '.webp'] as const

export function isBoardImageFile(file: File): boolean {
  const type = file.type.toLowerCase()
  if (BOARD_IMAGE_MIME_TYPES.has(type)) return true
  const name = file.name.toLowerCase()
  return BOARD_IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension))
}

/** Prefer actual local files, then fall back to browser clipboard image items. */
export function readImageFileFromDataTransfer(dataTransfer: DataTransfer): File | null {
  const files = dataTransfer.files
  if (files) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file && isBoardImageFile(file)) return file
    }
  }
  return readImageFileFromClipboardData(dataTransfer)
}



export function readGifFileFromClipboardFiles(clipboard: DataTransfer): File | null {

  const files = clipboard.files

  if (!files || files.length === 0) return null

  for (let i = 0; i < files.length; i++) {

    const file = files[i]

    if (file && isGifImageFile(file)) return file

  }

  return null

}



/** Pull the first img[src] from clipboard HTML (common when copying GIFs from the web). */

export function extractImageUrlFromClipboardHtml(html: string): string | null {

  const trimmed = html.trim()

  if (!trimmed) return null

  const imgMatch = trimmed.match(/<img[^>]+src=["']([^"']+)["']/i)

  if (!imgMatch?.[1]) return null

  return normalizeImageUrlCandidate(imgMatch[1])

}



/** Detect direct HTTPS image URLs in plain text (e.g. Copy image address). */

export function extractImageUrlFromPlainText(text: string): string | null {

  const trimmed = text.trim()

  if (!trimmed.startsWith('https://')) return null

  const firstToken = trimmed.split(/\s/)[0]

  if (!firstToken) return null

  try {

    const url = new URL(firstToken)

    if (url.protocol !== 'https:') return null

    if (!looksLikeBoardPasteableImageUrl(url)) return null

    return url.toString()

  } catch {

    return null

  }

}



export function looksLikeBoardPasteableImageUrl(url: URL | string): boolean {

  let parsed: URL

  try {

    parsed = typeof url === 'string' ? new URL(url) : url

  } catch {

    return false

  }

  if (parsed.protocol !== 'https:') return false

  return looksLikeAnimatedImageHostOrPath(parsed)

}



function looksLikeAnimatedImageHostOrPath(url: URL): boolean {

  const host = url.hostname.toLowerCase()

  const path = url.pathname.toLowerCase()

  if (path.endsWith('.gif') || path.endsWith('.webp') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png')) {

    return true

  }

  if (host.includes('giphy') || host.includes('tenor') || host.includes('pixabay')) return true

  return false

}



function normalizeImageUrlCandidate(raw: string): string | null {

  const trimmed = raw.trim()

  if (!trimmed.startsWith('https://')) return null

  try {

    const url = new URL(trimmed)

    if (url.protocol !== 'https:') return null

    return url.toString()

  } catch {

    return null

  }

}



export function isGifImageFile(file: File): boolean {

  if (file.type.toLowerCase() === 'image/gif') return true

  return file.name.toLowerCase().endsWith('.gif')

}



export function isWebpImageFile(file: File): boolean {

  if (file.type.toLowerCase() === 'image/webp') return true

  return file.name.toLowerCase().endsWith('.webp')

}



/** RIFF WEBP files with an ANIM chunk are animated. */

export async function isAnimatedWebpFile(file: File): Promise<boolean> {

  if (!isWebpImageFile(file)) return false

  try {

    const buf = await file.slice(0, 512).arrayBuffer()

    const bytes = new Uint8Array(buf)

    for (let i = 0; i <= bytes.length - 4; i++) {

      if (bytes[i] === 0x41 && bytes[i + 1] === 0x4e && bytes[i + 2] === 0x49 && bytes[i + 3] === 0x4d) {

        return true

      }

    }

  } catch {

    return false

  }

  return false

}



export async function isAnimatedImageFile(file: File): Promise<boolean> {

  if (isGifImageFile(file)) return true

  return isAnimatedWebpFile(file)

}



async function tryFetchAnimatedFromClipboardUrls(

  html: string,

  plain: string,

  rasterFile: File | null,

): Promise<

  | { kind: 'animated'; file: File }

  | { kind: 'frozen-fallback'; file: File }

  | null

> {

  if (rasterFile && isGifImageFile(rasterFile)) return null



  const url =

    extractImageUrlFromClipboardHtml(html) ?? extractImageUrlFromPlainText(plain)

  if (!url) return null



  const fetched = await fetchBoardImageAsFile(url)

  if (fetched && (isGifImageFile(fetched) || (await isAnimatedWebpFile(fetched)))) {

    return { kind: 'animated', file: fetched }

  }



  if (rasterFile) {

    return { kind: 'frozen-fallback', file: rasterFile }

  }



  return null

}



/** Resolve the best image file to paste: GIF file → animated URL fetch → raster clipboard image. */

export async function resolvePastedBoardImage(

  clipboard: DataTransfer,

): Promise<PastedBoardImageResolution | null> {
  const rasterFile = readImageFileFromDataTransfer(clipboard)

  let html = ''

  let plain = ''

  try {

    html = clipboard.getData('text/html') ?? ''

    plain = clipboard.getData('text/plain') ?? ''

  } catch {

    /* Some browsers restrict getData during paste */

  }



  const fetched = await tryFetchAnimatedFromClipboardUrls(html, plain, rasterFile)

  if (fetched?.kind === 'animated') {

    return { file: fetched.file, animated: true }

  }

  if (fetched?.kind === 'frozen-fallback') {

    return { file: fetched.file, animated: false, usedFrozenRasterFallback: true }

  }



  if (rasterFile) {

    return { file: rasterFile, animated: await isAnimatedImageFile(rasterFile) }

  }



  return null

}



export async function resolvePastedBoardImageFromNavigatorClipboard(): Promise<PastedBoardImageResolution | null> {

  if (typeof navigator === 'undefined' || !navigator.clipboard?.read) return null

  try {

    const items = await navigator.clipboard.read()

    let rasterFile: File | null = null

    let html = ''

    let plain = ''



    for (const item of items) {

      if (!rasterFile) {

        const imageType = item.types.find((t) => t.startsWith('image/'))

        if (imageType) {

          const blob = await item.getType(imageType)

          rasterFile = new File([blob], 'clipboard-image', { type: imageType })

        }

      }

      if (!html && item.types.includes('text/html')) {

        const blob = await item.getType('text/html')

        html = await blob.text()

      }

      if (!plain && item.types.includes('text/plain')) {

        const blob = await item.getType('text/plain')

        plain = await blob.text()

      }

    }



    const fetched = await tryFetchAnimatedFromClipboardUrls(html, plain, rasterFile)

    if (fetched?.kind === 'animated') {

      return { file: fetched.file, animated: true }

    }

    if (fetched?.kind === 'frozen-fallback') {

      return { file: fetched.file, animated: false, usedFrozenRasterFallback: true }

    }



    if (rasterFile) {

      return { file: rasterFile, animated: await isAnimatedImageFile(rasterFile) }

    }

  } catch {

    return null

  }

  return null

}



export async function readImageFromNavigatorClipboard(): Promise<File | null> {

  const resolved = await resolvePastedBoardImageFromNavigatorClipboard()

  return resolved?.file ?? null

}



function loadImageFromFile(file: File): Promise<HTMLImageElement> {

  return new Promise((resolve, reject) => {

    const url = URL.createObjectURL(file)

    const img = new Image()

    img.onload = () => {

      URL.revokeObjectURL(url)

      resolve(img)

    }

    img.onerror = () => {

      URL.revokeObjectURL(url)

      reject(new Error('Could not decode clipboard image.'))

    }

    img.src = url

  })

}



function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {

  return new Promise((resolve, reject) => {

    canvas.toBlob(

      (blob) => {

        if (!blob) reject(new Error('Could not encode clipboard image.'))

        else resolve(blob)

      },

      type,

      quality,

    )

  })

}



function blobToDataUrl(blob: Blob): Promise<string> {

  return new Promise((resolve, reject) => {

    const reader = new FileReader()

    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')

    reader.onerror = () => reject(reader.error ?? new Error('Could not read encoded image.'))

    reader.readAsDataURL(blob)

  })

}



function fileToDataUrl(file: File): Promise<string> {

  return new Promise((resolve, reject) => {

    const reader = new FileReader()

    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')

    reader.onerror = () => reject(reader.error ?? new Error('Could not read image file.'))

    reader.readAsDataURL(file)

  })

}



async function preserveAnimatedRasterFile(

  file: File,

  maxBytes: number,

  expectedMimePrefix: 'data:image/gif' | 'data:image/webp',

): Promise<{ dataUrl: string; naturalWidth: number; naturalHeight: number } | null> {

  if (file.size <= 0 || file.size > maxBytes) return null



  let img: HTMLImageElement

  try {

    img = await loadImageFromFile(file)

  } catch {

    return null

  }



  const naturalWidth = img.naturalWidth || img.width

  const naturalHeight = img.naturalHeight || img.height

  if (naturalWidth <= 0 || naturalHeight <= 0) return null



  let dataUrl: string

  try {

    dataUrl = await fileToDataUrl(file)

  } catch {

    return null

  }

  if (!dataUrl.startsWith(expectedMimePrefix)) return null



  return { dataUrl, naturalWidth, naturalHeight }

}



async function encodeCanvasWithinByteBudget(

  canvas: HTMLCanvasElement,

  maxBytes: number,

): Promise<{ dataUrl: string; naturalWidth: number; naturalHeight: number } | null> {

  const qualities = [0.92, 0.84, 0.72, 0.6, 0.48, 0.36]

  const types = ['image/webp', 'image/jpeg'] as const



  for (const type of types) {

    for (const quality of qualities) {

      const blob = await canvasToBlob(canvas, type, quality)

      if (blob.size <= maxBytes) {

        const dataUrl = await blobToDataUrl(blob)

        if (!dataUrl.startsWith('data:image/')) return null

        return { dataUrl, naturalWidth: canvas.width, naturalHeight: canvas.height }

      }

    }

  }

  return null

}



export async function downscaleImageFile(

  file: File,

  options: {

    maxDimensionPx?: number

    maxBytes?: number

    maxGifBytes?: number

  } = {},

): Promise<{ dataUrl: string; naturalWidth: number; naturalHeight: number } | null> {

  const maxDimensionPx = options.maxDimensionPx ?? CLIPBOARD_IMAGE_MAX_DIMENSION_PX

  const maxBytes = options.maxBytes ?? CLIPBOARD_IMAGE_MAX_BYTES

  const maxGifBytes = options.maxGifBytes ?? CLIPBOARD_GIF_MAX_BYTES



  if (isGifImageFile(file)) {

    return preserveAnimatedRasterFile(file, maxGifBytes, 'data:image/gif')

  }



  if (isWebpImageFile(file) && (await isAnimatedWebpFile(file))) {

    return preserveAnimatedRasterFile(file, maxGifBytes, 'data:image/webp')

  }



  let img: HTMLImageElement

  try {

    img = await loadImageFromFile(file)

  } catch {

    return null

  }



  const naturalWidth = img.naturalWidth || img.width

  const naturalHeight = img.naturalHeight || img.height

  if (naturalWidth <= 0 || naturalHeight <= 0) return null



  const scale = Math.min(1, maxDimensionPx / Math.max(naturalWidth, naturalHeight))

  const targetW = Math.max(1, Math.round(naturalWidth * scale))

  const targetH = Math.max(1, Math.round(naturalHeight * scale))



  const canvas = document.createElement('canvas')

  canvas.width = targetW

  canvas.height = targetH

  const ctx = canvas.getContext('2d')

  if (!ctx) return null

  ctx.drawImage(img, 0, 0, targetW, targetH)



  return encodeCanvasWithinByteBudget(canvas, maxBytes)

}



export function fitImageNormBox(

  naturalWidth: number,

  naturalHeight: number,

  boardWidthPx: number,

  boardContentHeightPx: number,

  viewportHeightPx: number,

  scrollTopPx: number,

  options: {

    maxWidthFraction?: number

    anchorNorm?: { x: number; y: number } | null

    /** When set (e.g. notebook page using wide-board paste size), pixel targets use these instead of the live board. */

    sizingWidthPx?: number

    sizingViewportHeightPx?: number

  } = {},

): ImageNormBox {

  const maxWidthFraction = options.maxWidthFraction ?? 0.4

  const sizingWidthPx = options.sizingWidthPx ?? boardWidthPx

  const sizingViewportHeightPx = options.sizingViewportHeightPx ?? viewportHeightPx

  const targetWidthPx = Math.max(48, sizingWidthPx * maxWidthFraction)

  const maxHeightPx = Math.max(48, sizingViewportHeightPx * 0.55)

  const scale = Math.min(1, targetWidthPx / naturalWidth, maxHeightPx / naturalHeight)

  const wPx = Math.max(1, naturalWidth * scale)

  const hPx = Math.max(1, naturalHeight * scale)



  const boardW = Math.max(1, boardWidthPx)

  const boardH = Math.max(1, boardContentHeightPx)

  const wNorm = Math.max(0.02, Math.min(1, wPx / boardW))

  const hNorm = Math.max(0.02, Math.min(1, hPx / boardH))



  if (options.anchorNorm) {

    const xNorm = options.anchorNorm.x - wNorm / 2

    const yNorm = options.anchorNorm.y - hNorm / 2

    return {

      x: Math.max(0, Math.min(1 - wNorm, xNorm)),

      y: Math.max(0, Math.min(1 - hNorm, yNorm)),

      w: wNorm,

      h: hNorm,

    }

  }



  const xPx = (boardWidthPx - wPx) / 2

  const yPx = scrollTopPx + Math.max(0, (viewportHeightPx - hPx) / 2)



  return {

    x: Math.max(0, Math.min(1, xPx / boardW)),

    y: Math.max(0, Math.min(1, yPx / boardH)),

    w: wNorm,

    h: hNorm,

  }

}


