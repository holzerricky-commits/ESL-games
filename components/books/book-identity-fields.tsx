'use client'

import { useEffect, useMemo, useState } from 'react'
import { FolderCog, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BOOK_GRADE_PRESETS,
  BOOK_ROLE_PRESETS,
  DEFAULT_BOOK_SERIES,
  formatBookDisplayTitle,
  listBookSeriesSelectOptions,
  PRESENTATION_PDF_EXPORT_TIP,
  PRESENTATIONS_SERIES,
  resolveBookCatalogIdentity,
  resolveBookContentFormat,
} from '@/lib/books/book-catalog-labels'
import type { BookDiskCleanupPlan } from '@/lib/books/book-disk-naming'
import { PRESENTATION_DIFFICULTY_LEVELS } from '@/lib/books/presentation-levels'
import type { BookContentFormat, BookLibraryPayload, BookRecord } from '@/lib/books/types'

const GRADE_NONE = '__none__'
const ROLE_NONE = '__none__'
/** Select sentinel — never persist as a book series. */
const SERIES_ADD_NEW = '__add_new_series__'

export type BookIdentityDraft = {
  title: string
  series: string
  grade: string
  role: string
  contentFormat: BookContentFormat
}

interface BookIdentitySharedProps {
  book: BookRecord
  library: BookLibraryPayload
  onSaved: (payload: BookLibraryPayload) => void
  onRemoved?: (payload: BookLibraryPayload, removedBookId: string) => void
}

interface BookIdentityEditDialogProps extends Omit<BookIdentitySharedProps, 'onRemoved'> {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function bookNeedsPersistInferred(book: BookRecord): boolean {
  const identity = resolveBookCatalogIdentity(book)
  return (
    book.series === undefined ||
    (Boolean(identity.grade) && book.grade === undefined) ||
    (Boolean(identity.role) && book.role === undefined)
  )
}

export function draftFromBookIdentity(book: BookRecord): BookIdentityDraft {
  const identity = resolveBookCatalogIdentity(book)
  return {
    title: identity.title,
    series: identity.series || DEFAULT_BOOK_SERIES,
    grade: identity.grade ?? '',
    role: identity.role ?? '',
    contentFormat: resolveBookContentFormat(book),
  }
}

export function formatBookIdentityLine(draft: Pick<BookIdentityDraft, 'series' | 'grade' | 'role'>): string {
  return [draft.series, draft.grade, draft.role].map((part) => part.trim()).filter(Boolean).join(' · ')
}

function applyIdentityDraftToBook(entry: BookRecord, draft: BookIdentityDraft): BookRecord {
  return {
    ...entry,
    title: draft.title.trim(),
    series: draft.series.trim() || DEFAULT_BOOK_SERIES,
    grade: draft.grade.trim(),
    role: draft.role.trim(),
    contentFormat: draft.contentFormat,
  }
}

export function isBookIdentityDraftDirty(book: BookRecord, draft: BookIdentityDraft): boolean {
  const identity = resolveBookCatalogIdentity(book)
  const persistedSeries = book.series?.trim() ?? ''
  const persistedGrade = book.grade === undefined ? null : book.grade.trim()
  const persistedRole = book.role === undefined ? null : book.role.trim()
  const persistedFormat = resolveBookContentFormat(book)
  return (
    draft.title.trim() !== book.title.trim() ||
    draft.series.trim() !== (persistedSeries || identity.series) ||
    draft.grade.trim() !== (persistedGrade === null ? identity.grade ?? '' : persistedGrade) ||
    draft.role.trim() !== (persistedRole === null ? identity.role ?? '' : persistedRole) ||
    draft.contentFormat !== persistedFormat
  )
}

export async function saveBookIdentity(params: {
  bookId: string
  library: BookLibraryPayload
  draft: BookIdentityDraft
}): Promise<BookLibraryPayload> {
  const nextTitle = params.draft.title.trim()
  if (!nextTitle) {
    throw new Error('Title cannot be empty.')
  }
  const nextSeries = params.draft.series.trim()
  if (!nextSeries || nextSeries === SERIES_ADD_NEW) {
    throw new Error('Pick or type a series name.')
  }
  const nextBooks = params.library.books.map((entry) => {
    if (entry.id !== params.bookId) return entry
    return applyIdentityDraftToBook(entry, { ...params.draft, series: nextSeries })
  })
  const payload: BookLibraryPayload = { books: nextBooks }
  const res = await fetch('/api/books/manifest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = (await res.json()) as BookLibraryPayload & { error?: string }
  if (!res.ok) {
    throw new Error(body.error ?? 'Could not save book details.')
  }
  return body
}

function withFormatSideEffects(draft: BookIdentityDraft, nextFormat: BookContentFormat): BookIdentityDraft {
  let series = draft.series
  let role = draft.role
  if (
    nextFormat === 'presentation' &&
    (series === DEFAULT_BOOK_SERIES || series === 'Other' || !series.trim())
  ) {
    series = PRESENTATIONS_SERIES
  }
  if (
    nextFormat === 'presentation' &&
    !(PRESENTATION_DIFFICULTY_LEVELS as readonly string[]).includes(role)
  ) {
    role = 'Starter'
  }
  if (nextFormat === 'book' && (PRESENTATION_DIFFICULTY_LEVELS as readonly string[]).includes(role)) {
    role = ''
  }
  return { ...draft, contentFormat: nextFormat, series, role }
}

export function BookIdentityFieldsForm({
  bookId,
  draft,
  onChange,
  showFormat = true,
  knownSeries,
}: {
  bookId: string
  draft: BookIdentityDraft
  onChange: (next: BookIdentityDraft) => void
  showFormat?: boolean
  /** Series already used in the library (and any extras). */
  knownSeries?: string[]
}) {
  const [addingSeries, setAddingSeries] = useState(false)

  const seriesOptions = useMemo(
    () =>
      listBookSeriesSelectOptions({
        extraSeries: [...(knownSeries ?? []), draft.series],
      }),
    [knownSeries, draft.series],
  )

  const selectValue = addingSeries ? SERIES_ADD_NEW : draft.series.trim() || DEFAULT_BOOK_SERIES

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {showFormat ? (
        <div className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 sm:col-span-2">
          <div className="flex items-start gap-2">
            <Checkbox
              id={'book-presentation-' + bookId}
              checked={draft.contentFormat === 'presentation'}
              onCheckedChange={(value) => {
                onChange(withFormatSideEffects(draft, value === true ? 'presentation' : 'book'))
              }}
              className="mt-0.5"
            />
            <div className="min-w-0 space-y-1">
              <Label htmlFor={'book-presentation-' + bookId} className="text-sm font-medium leading-snug">
                Mark as presentation (slide PDF)
              </Label>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Same open / assign / bookmark flow as a book. Still a PDF under the hood.
              </p>
              {draft.contentFormat === 'presentation' ? (
                <p className="text-[11px] leading-snug text-muted-foreground">{PRESENTATION_PDF_EXPORT_TIP}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={'book-title-' + bookId}>Title</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={'book-title-' + bookId}
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            className="min-w-[12rem] flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...draft,
                title: formatBookDisplayTitle({
                  series: draft.series,
                  grade: draft.grade || null,
                  role: draft.role || null,
                }),
              })
            }
          >
            Suggest from labels
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Series</Label>
        <Select
          value={selectValue}
          onValueChange={(value) => {
            if (value === SERIES_ADD_NEW) {
              setAddingSeries(true)
              onChange({ ...draft, series: '' })
              return
            }
            setAddingSeries(false)
            onChange({ ...draft, series: value })
          }}
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder="Series" />
          </SelectTrigger>
          <SelectContent>
            {seriesOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
            <SelectItem value={SERIES_ADD_NEW}>Add new series…</SelectItem>
          </SelectContent>
        </Select>
        {addingSeries ? (
          <div className="space-y-1.5 pt-1">
            <Label htmlFor={'book-series-new-' + bookId} className="text-[12px] text-muted-foreground">
              New series name
            </Label>
            <Input
              id={'book-series-new-' + bookId}
              value={draft.series}
              placeholder="e.g. Oxford"
              autoFocus
              onChange={(event) => onChange({ ...draft, series: event.target.value })}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>Grade</Label>
        <Select
          value={draft.grade || GRADE_NONE}
          onValueChange={(value) => onChange({ ...draft, grade: value === GRADE_NONE ? '' : value })}
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GRADE_NONE}>Not set</SelectItem>
            {BOOK_GRADE_PRESETS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label>{draft.contentFormat === 'presentation' ? 'Difficulty' : 'Role'}</Label>
        <Select
          value={draft.role || ROLE_NONE}
          onValueChange={(value) => onChange({ ...draft, role: value === ROLE_NONE ? '' : value })}
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder={draft.contentFormat === 'presentation' ? 'Difficulty' : 'Role'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ROLE_NONE}>Not set</SelectItem>
            {(draft.contentFormat === 'presentation' ? PRESENTATION_DIFFICULTY_LEVELS : BOOK_ROLE_PRESETS).map(
              (option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function BookIdentityEditDialog({
  open,
  onOpenChange,
  book,
  library,
  onSaved,
}: BookIdentityEditDialogProps) {
  const [draft, setDraft] = useState<BookIdentityDraft>(() => draftFromBookIdentity(book))
  const [saving, setSaving] = useState(false)

  const knownSeries = useMemo(
    () => listBookSeriesSelectOptions({ books: library.books }),
    [library.books],
  )

  useEffect(() => {
    if (!open) return
    setDraft(draftFromBookIdentity(book))
  }, [open, book])

  const dirty = isBookIdentityDraftDirty(book, draft)
  const needsPersistInferred = bookNeedsPersistInferred(book)
  const canSave = draft.title.trim().length > 0 && draft.series.trim().length > 0 && (dirty || needsPersistInferred)

  async function handleSave() {
    if (!draft.title.trim()) {
      toast.error('Title cannot be empty.')
      return
    }
    if (!draft.series.trim()) {
      toast.error('Pick or type a series name.')
      return
    }
    setSaving(true)
    try {
      const payload = await saveBookIdentity({ bookId: book.id, library, draft })
      onSaved(payload)
      toast.success('Book details saved.')
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save book details.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit book details</DialogTitle>
          <DialogDescription>
            Title, series, grade, and role. Folder rename is under the book menu → Clean up files.
          </DialogDescription>
        </DialogHeader>

        <BookIdentityFieldsForm
          bookId={book.id}
          draft={draft}
          onChange={setDraft}
          knownSeries={knownSeries}
        />

        {needsPersistInferred && !dirty ? (
          <p className="text-[11px] text-muted-foreground">Guessed labels — save to keep them.</p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSave || saving} onClick={() => void handleSave()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BookIdentityDangerMenu({
  book,
  onSaved,
  onRemoved,
  onEdit,
}: Omit<BookIdentitySharedProps, 'library'> & {
  library?: BookLibraryPayload
  /** When set, adds Edit details at the top of the menu. */
  onEdit?: () => void
}) {
  const [cleanupOpen, setCleanupOpen] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupApplying, setCleanupApplying] = useState(false)
  const [cleanupPlan, setCleanupPlan] = useState<BookDiskCleanupPlan | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removeDeletingFiles, setRemoveDeletingFiles] = useState(true)
  const [removeApplying, setRemoveApplying] = useState(false)

  async function openCleanupPreview() {
    if (bookNeedsPersistInferred(book)) {
      toast.error('Save book details first (Edit), then clean up files.')
      return
    }
    setCleanupOpen(true)
    setCleanupLoading(true)
    setCleanupPlan(null)
    try {
      const res = await fetch('/api/books/cleanup-disk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: book.id, dryRun: true }),
      })
      const body = (await res.json()) as {
        error?: string
        plan?: BookDiskCleanupPlan
      }
      if (!res.ok) {
        throw new Error(body.error ?? 'Could not preview cleanup.')
      }
      setCleanupPlan(body.plan ?? null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not preview cleanup.'
      toast.error(message)
      setCleanupOpen(false)
    } finally {
      setCleanupLoading(false)
    }
  }

  async function applyCleanup() {
    setCleanupApplying(true)
    try {
      const res = await fetch('/api/books/cleanup-disk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: book.id, dryRun: false }),
      })
      const body = (await res.json()) as {
        error?: string
        library?: BookLibraryPayload
        plan?: BookDiskCleanupPlan
      }
      if (!res.ok) {
        throw new Error(body.error ?? 'Cleanup failed.')
      }
      if (body.library) {
        onSaved(body.library)
      }
      setCleanupOpen(false)
      if (body.plan?.alreadyClean) {
        toast.success('Files already use clean names.')
      } else {
        toast.success('Files cleaned up on disk.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cleanup failed.'
      toast.error(message)
    } finally {
      setCleanupApplying(false)
    }
  }

  async function applyRemove() {
    setRemoveApplying(true)
    try {
      const res = await fetch('/api/books/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: book.id, deleteFiles: removeDeletingFiles }),
      })
      const body = (await res.json()) as {
        error?: string
        library?: BookLibraryPayload
        filesDeleted?: boolean
      }
      if (!res.ok) {
        throw new Error(body.error ?? 'Could not remove book.')
      }
      if (!body.library) {
        throw new Error('Could not remove book.')
      }
      setRemoveOpen(false)
      onRemoved?.(body.library, book.id)
      toast.success(
        removeDeletingFiles && body.filesDeleted
          ? 'Book removed and files deleted.'
          : 'Book removed from the library.',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not remove book.'
      toast.error(message)
    } finally {
      setRemoveApplying(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 px-0"
            aria-label="Book actions"
            disabled={cleanupLoading || removeApplying}
          >
            {cleanupLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onEdit ? (
            <DropdownMenuItem
              disabled={cleanupLoading || removeApplying}
              onSelect={() => onEdit()}
            >
              <Pencil className="h-4 w-4" />
              Edit details…
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            disabled={cleanupLoading || removeApplying}
            onSelect={() => {
              void openCleanupPreview()
            }}
          >
            <FolderCog className="h-4 w-4" />
            Clean up files…
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={removeApplying}
            onSelect={() => {
              setRemoveDeletingFiles(true)
              setRemoveOpen(true)
            }}
          >
            <Trash2 className="h-4 w-4" />
            Remove from library…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={cleanupOpen}
        onOpenChange={(nextOpen) => {
          if (cleanupApplying) return
          setCleanupOpen(nextOpen)
          if (!nextOpen) setCleanupPlan(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clean up files on disk?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Renames this book&apos;s folder and main PDF to match Series / Grade / Role. The hidden book id
                  stays the same so class history and ink stay linked.
                </p>
                {cleanupLoading ? (
                  <p className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Checking current names…
                  </p>
                ) : null}
                {cleanupPlan ? (
                  <ul className="list-disc space-y-1 pl-4 text-foreground">
                    {cleanupPlan.summaryLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-xs">Close the book reader first if the rename fails.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleanupApplying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={cleanupLoading || cleanupApplying || !cleanupPlan}
              onClick={(event) => {
                event.preventDefault()
                void applyCleanup()
              }}
            >
              {cleanupApplying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {cleanupPlan?.alreadyClean ? 'OK' : 'Rename files'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={removeOpen}
        onOpenChange={(nextOpen) => {
          if (removeApplying) return
          setRemoveOpen(nextOpen)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this book?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">{book.title}</span> will leave your
                  library list. Student links to this book will be cleared.
                </p>
                <label className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-1)] p-3 text-foreground">
                  <Checkbox
                    checked={removeDeletingFiles}
                    onCheckedChange={(value) => setRemoveDeletingFiles(value === true)}
                    disabled={removeApplying}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium">Also delete the PDF folder on disk</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Recommended for mistaken uploads. Uncheck to keep the files and only hide the book from
                      the list.
                    </span>
                  </span>
                </label>
                <p className="text-xs">Close the book reader first if delete fails because the file is open.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeApplying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeApplying}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void applyRemove()
              }}
            >
              {removeApplying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {removeDeletingFiles ? 'Remove and delete files' : 'Remove from list only'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
