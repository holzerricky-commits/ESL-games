'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { NotebookPen, Trash2, X } from 'lucide-react'
import {
  clearPageNotes,
  compressImageBlobToJpegDataUrl,
  createEmptyDocument,
  loadPageNotes,
  newPageNotesBlockId,
  PAGE_NOTES_MAX_TEXT_PER_BLOCK,
  type PageNotesBlock,
  savePageNotes,
} from '@/lib/books/page-notes-storage'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const SAVE_DEBOUNCE_MS = 520

export interface BookPageNotesPanelProps {
  open: boolean
  onClose: () => void
  studentId: string
  bookId: string
  unitId: string
  notesPage: number
  onNotesPageChange: (page: number) => void
  numPages: number
  /** Left page index of the visible spread (same as overlay `pageNumber` in spread mode). */
  spreadLeftPage: number
  isSinglePageMode: boolean
}

function mergeAdjacentTextBlocks(blocks: PageNotesBlock[]): PageNotesBlock[] {
  const merged: PageNotesBlock[] = []
  for (const b of blocks) {
    if (b.type === 'text' && merged.length > 0 && merged[merged.length - 1]!.type === 'text') {
      const last = merged[merged.length - 1] as Extract<PageNotesBlock, { type: 'text' }>
      merged[merged.length - 1] = {
        ...last,
        text: `${last.text}${b.text}`.slice(0, PAGE_NOTES_MAX_TEXT_PER_BLOCK),
      }
    } else {
      merged.push(b)
    }
  }
  return merged
}

export function BookPageNotesPanel({
  open,
  onClose,
  studentId,
  bookId,
  unitId,
  notesPage,
  onNotesPageChange,
  numPages,
  spreadLeftPage,
  isSinglePageMode,
}: BookPageNotesPanelProps) {
  const [blocks, setBlocks] = useState<PageNotesBlock[]>(() => createEmptyDocument().blocks)
  const [storageHint, setStorageHint] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const focusedTextBlockIndex = useRef(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blocksRef = useRef<PageNotesBlock[]>(blocks)
  const notesPageRef = useRef(notesPage)
  const pageBoundRef = useRef<{ studentId: string; bookId: string; unitId: string; notesPage: number } | null>(null)
  blocksRef.current = blocks
  notesPageRef.current = notesPage

  const spreadRightPage = spreadLeftPage + 1 <= numPages ? spreadLeftPage + 1 : null
  const showSpreadSwitcher = !isSinglePageMode && spreadRightPage != null

  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | null = null
    if (open) {
      id = setTimeout(() => setIsVisible(true), 16)
    } else {
      setIsVisible(false)
    }
    return () => {
      if (id) clearTimeout(id)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const prev = pageBoundRef.current
    if (prev) {
      const sameUnit =
        prev.studentId === studentId && prev.bookId === bookId && prev.unitId === unitId
      if (sameUnit && prev.notesPage !== notesPage) {
        savePageNotes(studentId, bookId, unitId, prev.notesPage, blocksRef.current)
      }
      if (!sameUnit) {
        savePageNotes(prev.studentId, prev.bookId, prev.unitId, prev.notesPage, blocksRef.current)
      }
    }

    pageBoundRef.current = { studentId, bookId, unitId, notesPage }

    const loaded = loadPageNotes(studentId, bookId, unitId, notesPage)
    const next = loaded?.blocks?.length ? loaded.blocks : createEmptyDocument().blocks
    setBlocks(next)
    setStorageHint(null)
  }, [open, studentId, bookId, unitId, notesPage])

  useEffect(() => {
    if (!open) return
    return () => {
      const p = pageBoundRef.current
      if (!p) return
      savePageNotes(p.studentId, p.bookId, p.unitId, p.notesPage, blocksRef.current)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      const { ok, trimmed } = savePageNotes(
        studentId,
        bookId,
        unitId,
        notesPageRef.current,
        blocksRef.current,
      )
      if (!ok) {
        setStorageHint('Could not save notes (storage full). Remove images or shorten text.')
      } else if (trimmed) {
        setStorageHint('Some content was trimmed so notes would fit in storage.')
      } else {
        setStorageHint(null)
      }
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [blocks, open, studentId, bookId, unitId, notesPage])

  const updateTextBlock = useCallback((index: number, text: string) => {
    const slice = text.slice(0, PAGE_NOTES_MAX_TEXT_PER_BLOCK)
    setBlocks((prev) => {
      const next = [...prev]
      const cur = next[index]
      if (!cur || cur.type !== 'text') return prev
      next[index] = { ...cur, text: slice }
      return next
    })
  }, [])

  const insertImageAfter = useCallback((blockIndex: number, dataUrl: string) => {
    const imageId = newPageNotesBlockId()
    setBlocks((prev) => {
      const next = [...prev]
      const insertAt = blockIndex + 1
      next.splice(insertAt, 0, { type: 'image', id: imageId, dataUrl })
      const after = next[insertAt + 1]
      if (!after || after.type !== 'text') {
        next.splice(insertAt + 1, 0, { type: 'text', id: newPageNotesBlockId(), text: '' })
      }
      return next
    })
  }, [])

  const removeBlockAt = useCallback((index: number) => {
    setBlocks((prev) => {
      const filtered = prev.filter((_, j) => j !== index)
      const merged = mergeAdjacentTextBlocks(filtered)
      return merged.length === 0 ? createEmptyDocument().blocks : merged
    })
  }, [])

  const onRootPaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items?.length) return
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!item?.type.startsWith('image/')) continue
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        const dataUrl = await compressImageBlobToJpegDataUrl(file)
        if (dataUrl) {
          let idx = focusedTextBlockIndex.current
          const cur = blocksRef.current[idx]
          if (!cur || cur.type !== 'text') {
            idx = blocksRef.current.findIndex((b) => b.type === 'text')
            if (idx < 0) idx = 0
          }
          insertImageAfter(idx, dataUrl)
        }
        return
      }
    },
    [insertImageAfter],
  )

  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="Close page notes"
        onClick={onClose}
        className={cn(
          'absolute inset-0 z-[41] bg-[#120a03]/40 transition-opacity duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          isVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-page-notes-title"
        className={cn(
          'absolute inset-y-0 right-0 z-[42] flex w-[min(480px,88vw)] flex-col border-l border-[#4a3421]/20 bg-gradient-to-b from-[#fdfaf4] to-[#efe6d8] shadow-[-12px_0_32px_rgba(12,6,2,0.15)] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          isVisible ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        )}
        onPaste={onRootPaste}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#4a3421]/15 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <NotebookPen className="h-4 w-4 shrink-0 text-[#5c4030]" aria-hidden />
            <h2 id="book-page-notes-title" className="truncate text-sm font-semibold text-[#2a1d12]">
              Page notes
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 border-[#5c4030]/25 bg-white/60 text-[#3d2918]"
              aria-label="Clear notes for this page"
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 border-[#5c4030]/25 bg-white/60 text-[#3d2918]"
              aria-label="Close page notes"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        {showSpreadSwitcher ? (
          <div
            className="flex shrink-0 gap-1 border-b border-[#4a3421]/10 px-3 py-2"
            role="tablist"
            aria-label="Which spread page to edit"
          >
            <Button
              type="button"
              size="sm"
              variant={notesPage === spreadLeftPage ? 'default' : 'outline'}
              className={
                notesPage === spreadLeftPage
                  ? 'h-8 flex-1 bg-[#5c4030] text-white hover:bg-[#5c4030]/90'
                  : 'h-8 flex-1 border-[#5c4030]/25 bg-white/50 text-[#3d2918]'
              }
              onClick={() => onNotesPageChange(spreadLeftPage)}
            >
              Page {spreadLeftPage}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={notesPage === spreadRightPage ? 'default' : 'outline'}
              className={
                notesPage === spreadRightPage
                  ? 'h-8 flex-1 bg-[#5c4030] text-white hover:bg-[#5c4030]/90'
                  : 'h-8 flex-1 border-[#5c4030]/25 bg-white/50 text-[#3d2918]'
              }
              onClick={() => onNotesPageChange(spreadRightPage)}
            >
              Page {spreadRightPage}
            </Button>
          </div>
        ) : (
          <p className="shrink-0 border-b border-[#4a3421]/10 px-3 py-1.5 text-center text-[11px] font-medium tabular-nums text-[#5c4030]/90">
            Page {notesPage}
          </p>
        )}

        {storageHint ? (
          <p className="shrink-0 bg-amber-100/80 px-3 py-1.5 text-[11px] text-amber-950">{storageHint}</p>
        ) : null}

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-color:rgba(107,78,50,0.35)_transparent] [scrollbar-width:thin]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(transparent, transparent 27px, rgba(92,64,48,0.08) 28px), linear-gradient(90deg, rgba(255,255,255,0.35), rgba(255,255,255,0))',
            backgroundSize: '100% 28px, 100%',
            backgroundAttachment: 'local',
          }}
        >
          <div className="flex flex-col gap-4">
            {blocks.map((block, index) => {
              if (block.type === 'text') {
                return (
                  <Textarea
                    key={block.id}
                    value={block.text}
                    onChange={(e) => updateTextBlock(index, e.target.value)}
                    onFocus={() => {
                      focusedTextBlockIndex.current = index
                    }}
                    placeholder="Write about this page… Paste images from the clipboard."
                    className="min-h-[120px] resize-y border-[#5c4030]/20 bg-white/40 text-[#2a1d12] placeholder:text-[#5c4030]/45"
                    aria-label={`Notes text block ${index + 1}`}
                  />
                )
              }
              return (
                <figure key={block.id} className="relative rounded-md border border-[#5c4030]/15 bg-white/50 p-2 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element -- user data URL from paste */}
                  <img src={block.dataUrl} alt={block.alt ?? 'Pasted note image'} className="max-h-[280px] w-full object-contain" />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="absolute right-2 top-2 h-7 text-xs"
                    onClick={() => removeBlockAt(index)}
                  >
                    Remove
                  </Button>
                </figure>
              )
            })}
          </div>
        </div>

        <p className="shrink-0 border-t border-[#4a3421]/10 px-3 py-2 text-[10px] leading-snug text-[#5c4030]/75">
          Notes are saved on this device only and stay with this page.
        </p>
      </aside>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear notes for page {notesPage}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes all text and images in these notes. Ink on the book page is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--brand-red)] text-white hover:bg-[var(--brand-red)]/90"
              onClick={() => {
                clearPageNotes(studentId, bookId, unitId, notesPage)
                setBlocks(createEmptyDocument().blocks)
                setStorageHint(null)
                setClearOpen(false)
              }}
            >
              Clear notes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
