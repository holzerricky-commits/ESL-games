'use client'

import { useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PRESENTATION_PDF_EXPORT_TIP } from '@/lib/books/book-catalog-labels'
import {
  PRESENTATION_DIFFICULTY_LEVELS,
  type PresentationDifficultyLevel,
} from '@/lib/books/presentation-levels'
import { cn } from '@/lib/utils'

interface BookDropUploadProps {
  onUploadComplete: () => Promise<void> | void
}

const ACCEPTED_PDF_MIME = 'application/pdf'
const LEVEL_NONE = '__none__'

function isPdfFile(file: File): boolean {
  if (file.type && file.type !== ACCEPTED_PDF_MIME && file.type !== '') {
    // Some browsers omit type; still allow by extension.
    if (!file.name.toLowerCase().endsWith('.pdf')) return false
  }
  return file.name.toLowerCase().endsWith('.pdf')
}

export type UploadBookPdfOptions = {
  asPresentation?: boolean
  presentationLevel?: PresentationDifficultyLevel | null
  targetBookId?: string | null
  /** When uploading many files, skip per-file success toasts. */
  quiet?: boolean
}

/** Upload one PDF into the book library. Shared by the drop panel and library-wide drop. */
export async function uploadBookPdfFile(
  file: File,
  options?: UploadBookPdfOptions,
): Promise<{ bookId?: string; unitCount?: number | null; title?: string }> {
  if (file.type && file.type !== ACCEPTED_PDF_MIME && !file.name.toLowerCase().endsWith('.pdf')) {
    toast.error('Only PDF files are supported.')
    throw new Error('Only PDF files are supported.')
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    toast.error('Please drop a .pdf file.')
    throw new Error('Please drop a .pdf file.')
  }

  const form = new FormData()
  form.set('file', file)
  if (options?.asPresentation || options?.presentationLevel || options?.targetBookId) {
    form.set('asPresentation', '1')
  }
  if (options?.presentationLevel) {
    form.set('presentationLevel', options.presentationLevel)
  }
  if (options?.targetBookId) {
    form.set('targetBookId', options.targetBookId)
  }
  const res = await fetch('/api/books/upload', {
    method: 'POST',
    body: form,
  })
  const body = (await res.json()) as {
    error?: string
    warning?: string
    filePath?: string
    title?: string
    series?: string
    grade?: string | null
    role?: string | null
    contentFormat?: string
    bookFolder?: string
    bookId?: string
    unitTitle?: string
    unitCount?: number | null
  }
  if (!res.ok) {
    throw new Error(body.error ?? 'Upload failed.')
  }

  if (!options?.quiet) {
    const bits = [body.series, body.grade, body.role].filter(Boolean)
    if (body.contentFormat === 'presentation') bits.unshift('Presentation')
    const label = body.title || body.bookFolder || body.filePath || 'book-library'
    const unitBit = body.unitTitle ? ` · deck “${body.unitTitle}”` : ''
    toast.success(
      bits.length > 0
        ? `Uploaded as ${label} (${bits.join(' · ')})${unitBit}`
        : `Uploaded as ${label}${unitBit}`,
    )
  }
  if (body.warning) {
    toast.message(body.warning)
  }

  return {
    bookId: body.bookId,
    unitCount: body.unitCount,
    title: body.title,
  }
}

/** Upload several PDFs sequentially (same options). Returns how many succeeded. */
export async function uploadBookPdfFiles(
  files: File[],
  options?: UploadBookPdfOptions,
): Promise<{ ok: number; failed: number; lastBookId?: string; lastTitle?: string }> {
  const pdfs = files.filter(isPdfFile)
  if (pdfs.length === 0) {
    toast.error('Please drop .pdf files.')
    throw new Error('Please drop a .pdf file.')
  }
  if (pdfs.length !== files.length) {
    toast.message('Skipped non-PDF files.')
  }

  let ok = 0
  let failed = 0
  let lastBookId: string | undefined
  let lastTitle: string | undefined
  const quiet = pdfs.length > 1

  for (const file of pdfs) {
    try {
      const result = await uploadBookPdfFile(file, { ...options, quiet })
      ok += 1
      lastBookId = result.bookId ?? lastBookId
      lastTitle = result.title ?? lastTitle
    } catch {
      failed += 1
    }
  }

  if (quiet) {
    const label = lastTitle || 'library'
    if (ok > 0 && failed === 0) {
      toast.success(
        ok === 1
          ? `Uploaded 1 deck into ${label}.`
          : `Uploaded ${ok} decks into ${label}.`,
      )
    } else if (ok > 0) {
      toast.message(`Uploaded ${ok} deck${ok === 1 ? '' : 's'}; ${failed} failed.`)
    } else {
      toast.error('Upload failed.')
    }
  }

  return { ok, failed, lastBookId, lastTitle }
}

export function BookDropUpload({ onUploadComplete }: BookDropUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [asPresentation, setAsPresentation] = useState(true)
  const [presentationLevel, setPresentationLevel] = useState<PresentationDifficultyLevel | ''>(
    'Starter',
  )
  const canUpload = !uploading

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setUploading(true)
    try {
      const usePresentation = asPresentation || Boolean(presentationLevel)
      await uploadBookPdfFiles(files, {
        asPresentation: usePresentation,
        presentationLevel: usePresentation && presentationLevel ? presentationLevel : null,
      })
      await onUploadComplete()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.'
      if (
        message !== 'Only PDF files are supported.' &&
        message !== 'Please drop a .pdf file.'
      ) {
        toast.error(message)
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <p className="text-xs font-medium text-foreground">Add PDF by drag and drop</p>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Drop one or many PDFs. For slide decks, pick a difficulty so they land in one neat book
        (Starter / Basic / Intermediate / Hard).
      </p>
      <div className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-background/70 px-2.5 py-2">
        <Checkbox
          id="upload-as-presentation"
          checked={asPresentation}
          disabled={!canUpload}
          onCheckedChange={(value) => {
            const next = value === true
            setAsPresentation(next)
            if (next && !presentationLevel) setPresentationLevel('Starter')
            if (!next) setPresentationLevel('')
          }}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="upload-as-presentation" className="text-xs font-medium leading-snug">
            Presentation decks (slide PDFs)
          </Label>
          <p className="text-[11px] leading-snug text-muted-foreground">{PRESENTATION_PDF_EXPORT_TIP}</p>
          {asPresentation ? (
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Difficulty book</Label>
              <Select
                value={presentationLevel || LEVEL_NONE}
                onValueChange={(value) =>
                  setPresentationLevel(
                    value === LEVEL_NONE ? '' : (value as PresentationDifficultyLevel),
                  )
                }
                disabled={!canUpload}
              >
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue placeholder="Pick difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={LEVEL_NONE}>Separate book per file</SelectItem>
                  {PRESENTATION_DIFFICULTY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </div>
      <label
        className={cn(
          'flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-4 text-center transition-colors',
          dragActive
            ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10'
            : 'border-[var(--border)] bg-background hover:bg-[var(--surface-2)]',
          (!canUpload || uploading) && 'cursor-not-allowed opacity-70',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (canUpload) setDragActive(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(false)
          if (!canUpload) return
          const dropped = e.dataTransfer.files
          if (dropped?.length) void uploadFiles(dropped)
        }}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-xs font-medium text-foreground">Drop PDF(s) here</span>
        <span className="text-[11px] text-muted-foreground">or click to choose files</span>
        <input
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          disabled={!canUpload || uploading}
          onChange={(e) => {
            const selected = e.target.files
            if (selected?.length) void uploadFiles(selected)
            e.currentTarget.value = ''
          }}
        />
      </label>
    </section>
  )
}
