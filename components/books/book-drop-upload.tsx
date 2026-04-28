'use client'

import { useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface BookDropUploadProps {
  onUploadComplete: () => Promise<void> | void
}

const ACCEPTED_PDF_MIME = 'application/pdf'

function sanitizeSegment(raw: string): string {
  return raw
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function inferBookNameFromFileName(fileName: string): string {
  const stem = fileName.replace(/\.pdf$/i, '')
  const stripped =
    stem
      .replace(/\s*[-_]\s*(unit|lesson|chapter|part)\b.*$/i, '')
      .replace(/\s+(unit|lesson|chapter|part)\b.*$/i, '') || stem
  return sanitizeSegment(stripped) || sanitizeSegment(stem)
}

export function BookDropUpload({ onUploadComplete }: BookDropUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const canUpload = !uploading

  async function uploadFile(file: File) {
    if (file.type && file.type !== ACCEPTED_PDF_MIME) {
      toast.error('Only PDF files are supported.')
      return
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please drop a .pdf file.')
      return
    }
    const inferredBookName = inferBookNameFromFileName(file.name)
    if (!inferredBookName) {
      toast.error('Could not infer a valid book name from this filename.')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch('/api/books/upload', {
        method: 'POST',
        body: form,
      })
      const body = (await res.json()) as { error?: string; filePath?: string }
      if (!res.ok) {
        throw new Error(body.error ?? 'Upload failed.')
      }
      toast.success(`Uploaded to ${body.filePath ?? 'book-library'}`)
      await onUploadComplete()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.'
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <p className="text-xs font-medium text-foreground">Add PDF by drag and drop</p>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Drop a PDF and the app infers the book from filename, then copies it into `book-library` automatically.
      </p>
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
          if (canUpload) setDragActive(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragActive(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          if (!canUpload) return
          const dropped = e.dataTransfer.files?.[0]
          if (dropped) void uploadFile(dropped)
        }}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
        <span className="text-xs font-medium text-foreground">Drop PDF here</span>
        <span className="text-[11px] text-muted-foreground">or click to choose file</span>
        <input
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          disabled={!canUpload || uploading}
          onChange={(e) => {
            const selected = e.target.files?.[0]
            if (selected) void uploadFile(selected)
            e.currentTarget.value = ''
          }}
        />
      </label>
    </section>
  )
}
