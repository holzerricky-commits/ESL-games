'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { BookCoverThumbnail } from '@/components/books/book-cover-thumbnail'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { bookHasCustomCover } from '@/lib/books/book-cover-display'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

export interface BookCoverUploadControlProps {
  book: BookRecord
  pdfReady: boolean
  width: number
  label: string
  className?: string
  onCoverUpdated: (payload: BookLibraryPayload) => void
}

export function BookCoverUploadControl({
  book,
  pdfReady,
  width,
  label,
  className,
  onCoverUpdated,
}: BookCoverUploadControlProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const hasCustom = bookHasCustomCover(book)
  const busy = uploading || resetting

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    try {
      const form = new FormData()
      form.set('bookId', book.id)
      form.set('file', file)
      const res = await fetch('/api/books/cover', { method: 'POST', body: form })
      const payload = (await res.json()) as BookLibraryPayload & { error?: string }
      if (!res.ok) {
        throw new Error(payload.error ?? 'Upload failed.')
      }
      onCoverUpdated(payload)
      toast.success('Cover updated.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.'
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  async function handleReset() {
    setResetting(true)
    try {
      const res = await fetch(`/api/books/cover?bookId=${encodeURIComponent(book.id)}`, {
        method: 'DELETE',
      })
      const payload = (await res.json()) as BookLibraryPayload & { error?: string }
      if (!res.ok) {
        throw new Error(payload.error ?? 'Reset failed.')
      }
      onCoverUpdated(payload)
      toast.success('Cover reset to PDF page 1.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reset failed.'
      toast.error(message)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className={cn('group relative shrink-0', className)}>
      <BookCoverThumbnail
        book={book}
        unitId={`${book.id}-cover-upload`}
        width={width}
        pdfReady={pdfReady}
        label={label}
      />
      {busy ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-background/60 backdrop-blur-[1px]">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : null}
      <div className="absolute bottom-1 right-1 flex items-center gap-0.5">
        {hasCustom ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="h-6 w-6 rounded-full border border-[var(--border)] bg-background/95 shadow-sm"
                aria-label="Reset cover to PDF page 1"
                disabled={busy}
                onClick={() => void handleReset()}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>Reset to PDF cover</TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              className="h-6 w-6 rounded-full border border-[var(--border)] bg-background/95 shadow-sm"
              aria-label="Upload cover image"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>Upload cover image</TooltipContent>
        </Tooltip>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => void handleFileChange(event)}
      />
    </div>
  )
}
