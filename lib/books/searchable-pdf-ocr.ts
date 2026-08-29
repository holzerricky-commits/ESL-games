import 'server-only'

import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const OCR_MIN_CONFIDENCE = 40

export type OcrRecognizedWord = {
  text: string
  confidence: number
  x0: number
  y0: number
  x1: number
  y1: number
}

type TesseractWorker = {
  recognize: (image: Buffer) => Promise<{
    data: {
      words?: Array<{
        text?: string
        confidence?: number
        bbox?: { x0?: number; y0?: number; x1?: number; y1?: number }
      }>
    }
  }>
}

let workerPromise: Promise<TesseractWorker> | null = null
let ocrChain: Promise<unknown> = Promise.resolve()

function enqueueOcr<T>(fn: () => Promise<T>): Promise<T> {
  const run = ocrChain.then(fn, fn)
  ocrChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function nodeModuleFile(...parts: string[]): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), 'node_modules', ...parts)
}

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const cachePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), '.tesseract-cache')
      await mkdir(cachePath, { recursive: true })
      const require = createRequire(pathToFileURL(nodeModuleFile('tesseract.js', 'package.json')).href)
      const { createWorker } = require('tesseract.js') as {
        createWorker: (
          langs: string,
          oem: number,
          options: Record<string, unknown>,
        ) => Promise<TesseractWorker>
      }
      return createWorker('eng', 1, {
        cachePath,
        workerBlobURL: false,
        workerPath: nodeModuleFile('tesseract.js', 'src', 'worker-script', 'node', 'index.js'),
      })
    })().catch((err: unknown) => {
      workerPromise = null
      throw err
    })
  }
  return workerPromise
}

/** Recognize words on a page image. Serialized so one Tesseract worker is shared. */
export async function recognizePageWords(pngBuffer: Buffer): Promise<OcrRecognizedWord[]> {
  return enqueueOcr(async () => {
    const worker = await getWorker()
    const result = await worker.recognize(pngBuffer)
    const words: OcrRecognizedWord[] = []
    for (const raw of result.data.words ?? []) {
      const text = typeof raw.text === 'string' ? raw.text.trim() : ''
      if (!text) continue
      const confidence = typeof raw.confidence === 'number' ? raw.confidence : 0
      if (confidence < OCR_MIN_CONFIDENCE) continue
      const bbox = raw.bbox
      if (!bbox) continue
      const x0 = Number(bbox.x0)
      const y0 = Number(bbox.y0)
      const x1 = Number(bbox.x1)
      const y1 = Number(bbox.y1)
      if (![x0, y0, x1, y1].every(Number.isFinite)) continue
      words.push({ text, confidence, x0, y0, x1, y1 })
    }
    return words
  })
}
