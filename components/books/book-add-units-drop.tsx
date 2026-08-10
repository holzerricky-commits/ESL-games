'use client'

import { useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { uploadBookPdfFiles } from '@/components/books/book-drop-upload'
import { isPresentationBook } from '@/lib/books/book-catalog-labels'
import type { BookRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

interface BookAddUnitsDropProps {
  book: BookRecord
  onUploadComplete: () => Promise<void> | void
}

/** Drop more PDFs into the currently selected library book (as extra units / decks). */
export function BookAddUnitsDrop({ book, onUploadComplete }: BookAddUnitsDropProps) {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const canUpload = !uploading
  const isPresentation = isPresentationBook(book)

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setUploading(true)
    try {
      await uploadBookPdfFiles(files, {
        targetBookId: book.id,
        asPresentation: isPresentation,
      })
      await onUploadComplete()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.'
      if (message !== 'Please drop a .pdf file.') {
        toast.error(message)
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="space-y-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/60 p-3">
      <p className="text-xs font-medium text-foreground">
        {isPresentation ? 'Add more decks to this level' : 'Add more PDFs to this book'}
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {isPresentation
          ? `Drop several slide PDFs — they become decks inside “${book.title}”.`
          : `Drop PDFs to append as units inside “${book.title}”.`}
      </p>
      <label
        className={cn(
          'flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-3 text-center transition-colors',
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
