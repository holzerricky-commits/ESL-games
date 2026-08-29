'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, FileUp, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  BookIdentityFieldsForm,
  draftFromBookIdentity,
  formatBookIdentityLine,
  saveBookIdentity,
  type BookIdentityDraft,
} from '@/components/books/book-identity-fields'
import type { BookStructureManifestSaveMeta } from '@/components/books/book-structure-wizard'
import {
  uploadBookPdfFileWithProgress,
  uploadBookPdfFiles,
} from '@/components/books/book-drop-upload'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listBookSeriesSelectOptions, PRESENTATION_PDF_EXPORT_TIP } from '@/lib/books/book-catalog-labels'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'
import { detectTocPdfRangeFromFileUrl } from '@/lib/books/detect-toc-range-client'
import {
  PRESENTATION_DIFFICULTY_LEVELS,
  type PresentationDifficultyLevel,
} from '@/lib/books/presentation-levels'
import type { BookLibraryPayload } from '@/lib/books/types'
import { cn } from '@/lib/utils'

const LEVEL_NONE = '__none__'

export type AddBookSheetMode = 'add'

type SheetStage = 'pick' | 'uploading' | 'confirm' | 'detecting'

function isPdfFile(file: File): boolean {
  if (file.type && file.type !== 'application/pdf' && file.type !== '') {
    if (!file.name.toLowerCase().endsWith('.pdf')) return false
  }
  return file.name.toLowerCase().endsWith('.pdf')
}

function SoftProgressBar({
  label,
  value,
  indeterminate,
}: {
  label: string
  value?: number
  indeterminate?: boolean
}) {
  const clamped = value == null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="font-medium text-foreground">{label}</span>
        {!indeterminate && value != null ? (
          <span className="tabular-nums text-muted-foreground">{clamped}%</span>
        ) : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
        {indeterminate ? (
          <div className="h-full w-full animate-pulse rounded-full bg-[var(--brand-blue)]/70" />
        ) : (
          <div
            className="h-full rounded-full bg-[var(--brand-blue)] transition-[width] duration-200 ease-[var(--chrome-ease,cubic-bezier(0.22,1,0.36,1))]"
            style={{ width: `${clamped}%` }}
          />
        )}
      </div>
    </div>
  )
}

export type OutlineWorkspaceRequest = {
  bookId: string
  filePath: string
  initialTocRange?: { from: number; to: number } | null
  skipAutoTocDetect?: boolean
}

export type AddBookSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: AddBookSheetMode
  library: BookLibraryPayload | null
  /** Existing book when adding a PDF to it. */
  targetBookId?: string | null
  targetFilePath?: string | null
  onLibraryRefresh: () => Promise<void>
  onLibraryUpdated?: (payload: BookLibraryPayload) => void
  onManifestSaved: (payload: BookLibraryPayload, meta?: BookStructureManifestSaveMeta) => void
  /** Open full-window Cut into units after naming a stacked PDF. */
  onRequestCutUnits?: (payload: { bookId: string; filePath: string }) => void
  /** Open full-window Outline after upload/detect. */
  onRequestOutline?: (payload: OutlineWorkspaceRequest) => void
}

export function AddBookSheet({
  open,
  onOpenChange,
  library,
  targetBookId = null,
  onLibraryRefresh,
  onLibraryUpdated,
  onRequestCutUnits,
  onRequestOutline,
}: AddBookSheetProps) {
  const [stage, setStage] = useState<SheetStage>('pick')
  const [dragActive, setDragActive] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [asPresentation, setAsPresentation] = useState(false)
  const [presentationLevel, setPresentationLevel] = useState<PresentationDifficultyLevel | ''>('')
  const [activeFileName, setActiveFileName] = useState<string | null>(null)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [detectMessage, setDetectMessage] = useState('Looking for contents…')
  const [outlineBookId, setOutlineBookId] = useState<string | null>(null)
  const [outlineFilePath, setOutlineFilePath] = useState<string | null>(null)
  const [identityDraft, setIdentityDraft] = useState<BookIdentityDraft | null>(null)
  const [identitySaving, setIdentitySaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const runIdRef = useRef(0)
  const wasOpenRef = useRef(false)

  const resetPickState = useCallback(() => {
    runIdRef.current += 1
    setDragActive(false)
    setActiveFileName(null)
    setUploadPercent(0)
    setDetectMessage('Looking for contents…')
    setIdentityDraft(null)
    setIdentitySaving(false)
  }, [])

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open
    if (!justOpened) return

    setStage('pick')
    setOutlineBookId(null)
    setOutlineFilePath(null)
    resetPickState()
  }, [open, resetPickState])

  useEffect(() => {
    if (!outlineBookId || outlineFilePath || !library) return
    const book = library.books.find((b) => b.id === outlineBookId)
    const path = book?.units?.[0]?.filePath ?? null
    if (path) setOutlineFilePath(path)
  }, [library, outlineBookId, outlineFilePath])

  const busy = stage === 'uploading' || stage === 'detecting' || identitySaving
  const expanded = stage !== 'pick'
  const looksLikeLine = identityDraft ? formatBookIdentityLine(identityDraft) : ''
  const knownSeries = useMemo(
    () => listBookSeriesSelectOptions({ books: library?.books ?? [] }),
    [library?.books],
  )

  useEffect(() => {
    if (stage !== 'confirm' || !outlineBookId || !library || identityDraft) return
    const book = library.books.find((entry) => entry.id === outlineBookId)
    if (!book) return
    setIdentityDraft(draftFromBookIdentity(book))
  }, [stage, outlineBookId, library, identityDraft])

  function handOffToOutline(
    bookId: string | null,
    filePath: string | null,
    initialTocRange: { from: number; to: number } | null,
  ) {
    if (!bookId || !filePath) {
      toast.error('Upload a PDF first.')
      setStage('pick')
      return
    }
    if (!onRequestOutline) {
      toast.error('Outline is not available here.')
      setStage('pick')
      return
    }
    onOpenChange(false)
    onRequestOutline({
      bookId,
      filePath,
      initialTocRange,
      skipAutoTocDetect: true,
    })
  }

  async function runDetectAndOutline(bookId: string | null, filePath: string | null) {
    const runId = runIdRef.current
    if (!bookId || !filePath) {
      handOffToOutline(bookId, filePath, null)
      return
    }

    setStage('detecting')
    setDetectMessage('Looking for contents…')
    let initialTocRange: { from: number; to: number } | null = null
    try {
      const detect = await detectTocPdfRangeFromFileUrl(makeUnitFileUrl(filePath), {
        onProgress: (message) => {
          if (runId !== runIdRef.current) return
          setDetectMessage(message)
        },
      })
      if (runId !== runIdRef.current) return
      if (detect.ok) {
        initialTocRange = { from: detect.proposal.from, to: detect.proposal.to }
      }
    } catch {
      if (runId !== runIdRef.current) return
    }
    if (runId !== runIdRef.current) return
    handOffToOutline(bookId, filePath, initialTocRange)
  }

  async function runAfterUpload(result: {
    bookId?: string
    filePath?: string
    title?: string
  }) {
    const runId = runIdRef.current
    await onLibraryRefresh()
    if (runId !== runIdRef.current) return

    const bookId = result.bookId ?? null
    const filePath = result.filePath ?? null
    setOutlineBookId(bookId)
    setOutlineFilePath(filePath)

    const skipConfirm = Boolean(targetBookId) || asPresentation || Boolean(presentationLevel)
    if (!skipConfirm && bookId) {
      setIdentityDraft(null)
      setStage('confirm')
      return
    }

    await runDetectAndOutline(bookId, filePath)
  }

  async function saveIdentityIfNeeded(): Promise<boolean> {
    if (!outlineBookId || !library || !identityDraft) return true
    if (!identityDraft.title.trim()) {
      toast.error('Title cannot be empty.')
      return false
    }
    if (!identityDraft.series.trim()) {
      toast.error('Pick or type a series name.')
      return false
    }

    setIdentitySaving(true)
    try {
      const payload = await saveBookIdentity({
        bookId: outlineBookId,
        library,
        draft: identityDraft,
      })
      onLibraryUpdated?.(payload)
      setIdentitySaving(false)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save book details.'
      toast.error(message)
      setIdentitySaving(false)
      return false
    }
  }

  async function continueFromConfirm() {
    if (!outlineBookId || !library || !identityDraft) {
      await runDetectAndOutline(outlineBookId, outlineFilePath)
      return
    }
    const saved = await saveIdentityIfNeeded()
    if (!saved) return
    await runDetectAndOutline(outlineBookId, outlineFilePath)
  }

  async function continueToCutFromConfirm() {
    if (!outlineBookId || !outlineFilePath) {
      toast.error('Upload a PDF first.')
      return
    }
    if (identityDraft) {
      const saved = await saveIdentityIfNeeded()
      if (!saved) return
    }
    if (!onRequestCutUnits) {
      toast.error('Cut into units is not available here.')
      return
    }
    onOpenChange(false)
    onRequestCutUnits({ bookId: outlineBookId, filePath: outlineFilePath })
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(isPdfFile)
    if (files.length === 0) {
      toast.error('Please choose a PDF file.')
      return
    }

    const runId = ++runIdRef.current
    const usePresentation = asPresentation || Boolean(presentationLevel)
    setStage('uploading')
    setActiveFileName(files[0]?.name ?? null)
    setUploadPercent(0)

    try {
      if (files.length === 1) {
        const result = await uploadBookPdfFileWithProgress(files[0]!, {
          targetBookId,
          asPresentation: usePresentation,
          presentationLevel: presentationLevel || null,
          onProgress: (percent) => {
            if (runId !== runIdRef.current) return
            setUploadPercent(percent)
          },
        })
        if (runId !== runIdRef.current) return
        await runAfterUpload(result)
        return
      }

      const result = await uploadBookPdfFiles(files, {
        targetBookId,
        asPresentation: usePresentation,
        presentationLevel: presentationLevel || null,
      })
      if (runId !== runIdRef.current) return
      setUploadPercent(100)
      await runAfterUpload({
        bookId: result.lastBookId,
        title: result.lastTitle,
      })
    } catch (error) {
      if (runId !== runIdRef.current) return
      const message = error instanceof Error ? error.message : 'Upload failed.'
      if (message !== 'Only PDF files are supported.' && message !== 'Please drop a .pdf file.') {
        toast.error(message)
      }
      setStage('pick')
      resetPickState()
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && busy) return
    onOpenChange(next)
  }

  const title =
    stage === 'pick'
      ? targetBookId
        ? 'Add PDF'
        : 'Add Book'
      : stage === 'uploading'
        ? 'Uploading'
        : stage === 'confirm'
          ? 'Name this book'
          : 'Preparing outline'

  const description =
    stage === 'pick'
      ? 'Drop a PDF here or choose a file from your computer.'
      : stage === 'uploading'
        ? activeFileName
          ? `Uploading ${activeFileName}`
          : 'Uploading your PDF…'
        : stage === 'confirm'
          ? looksLikeLine
            ? `This looks like ${looksLikeLine}. Change it if that’s wrong, then continue.`
            : 'Check the title and labels, then continue to outline.'
          : 'Finding the table of contents…'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!busy}
        overlayClassName="bg-black/40 backdrop-blur-[2px]"
        className={cn(
          'flex flex-col gap-0 overflow-hidden border-[var(--border)] bg-[var(--surface-2)] p-0 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.28)] transition-[max-width,height] duration-200 ease-[var(--chrome-ease,cubic-bezier(0.22,1,0.36,1))]',
          stage === 'confirm'
            ? 'w-full sm:max-w-lg'
            : expanded
              ? 'w-full sm:max-w-md'
              : 'w-full sm:max-w-sm',
        )}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault()
        }}
      >
        <DialogHeader className="shrink-0 border-b border-[var(--border)] px-6 py-4 text-left">
          <DialogTitle className="text-[17px] font-semibold tracking-tight">{title}</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {stage === 'pick' ? (
            <div className="space-y-4">
              <button
                type="button"
                className={cn(
                  'flex w-full min-h-[168px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors',
                  dragActive
                    ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10'
                    : 'border-[var(--border)] bg-[var(--surface-3)] hover:bg-[var(--surface-4)]',
                )}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragActive(true)
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
                  const dropped = e.dataTransfer.files
                  if (dropped?.length) void handleFiles(dropped)
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-[14px] font-medium">Drop PDF here</span>
                <span className="text-[12px] text-muted-foreground">or click to browse</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  const list = e.target.files
                  if (list?.length) void handleFiles(list)
                  e.target.value = ''
                }}
              />

              {!targetBookId ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-left text-[12px] text-muted-foreground hover:text-foreground"
                    onClick={() => setOptionsOpen((v) => !v)}
                  >
                    <span>More options</span>
                    <ChevronDown
                      className={cn('h-3.5 w-3.5 transition-transform', optionsOpen && 'rotate-180')}
                    />
                  </button>
                  {optionsOpen ? (
                    <div className="space-y-3 rounded-2xl bg-[var(--surface-3)] px-3 py-3">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="add-book-as-presentation"
                          checked={asPresentation}
                          onCheckedChange={(checked) => setAsPresentation(checked === true)}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="add-book-as-presentation" className="text-[13px] font-medium">
                            Presentation PDF
                          </Label>
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            {PRESENTATION_PDF_EXPORT_TIP}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[12px] text-muted-foreground">Difficulty (optional)</Label>
                        <Select
                          value={presentationLevel || LEVEL_NONE}
                          onValueChange={(value) =>
                            setPresentationLevel(value === LEVEL_NONE ? '' : (value as PresentationDifficultyLevel))
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={LEVEL_NONE}>None</SelectItem>
                            {PRESENTATION_DIFFICULTY_LEVELS.map((level) => (
                              <SelectItem key={level} value={level}>
                                {level}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Button
                type="button"
                variant="secondary"
                className="h-9 w-full gap-2 rounded-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-3.5 w-3.5" />
                Choose PDF
              </Button>
            </div>
          ) : null}

          {stage === 'confirm' && identityDraft && outlineBookId ? (
            <BookIdentityFieldsForm
              bookId={outlineBookId}
              draft={identityDraft}
              onChange={setIdentityDraft}
              knownSeries={knownSeries}
              showFormat={false}
            />
          ) : null}

          {stage === 'uploading' ? (
            <div className="space-y-5 py-2">
              <SoftProgressBar label="Uploading PDF" value={uploadPercent} />
              {activeFileName ? (
                <p className="truncate text-[12px] text-muted-foreground">{activeFileName}</p>
              ) : null}
            </div>
          ) : null}

          {stage === 'detecting' ? (
            <div className="space-y-5 py-2">
              <SoftProgressBar label={detectMessage} indeterminate />
            </div>
          ) : null}
        </div>

        {stage === 'pick' || stage === 'confirm' ? (
          <DialogFooter className="shrink-0 border-t border-[var(--border)] px-6 py-3 sm:justify-end">
            {stage === 'pick' ? (
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-full"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            ) : (
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full"
                  disabled={
                    identitySaving || !identityDraft?.title.trim() || !identityDraft?.series.trim()
                  }
                  onClick={() => void continueToCutFromConfirm()}
                >
                  This PDF is several units
                </Button>
                <Button
                  type="button"
                  className="h-9 rounded-full"
                  disabled={
                    identitySaving || !identityDraft?.title.trim() || !identityDraft?.series.trim()
                  }
                  onClick={() => void continueFromConfirm()}
                >
                  {identitySaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Continue
                </Button>
              </div>
            )}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
