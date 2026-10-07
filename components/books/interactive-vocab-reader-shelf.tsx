'use client'

import { useEffect, useState } from 'react'
import { BookOpen, ChevronLeft, ImageIcon, BookmarkPlus } from 'lucide-react'
import type { InteractiveVocabPack, InteractiveVocabWord } from '@/lib/books/interactive-vocab'
import { useSavedWords } from '@/components/students/fullscreen-book-overlay/hooks/useSavedWords'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface InteractiveVocabReaderShelfProps {
  pack: InteractiveVocabPack
  className?: string
  /** Controlled open state (e.g. left workspace bar launcher). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Hide the built-in Vocabulary button when another launcher owns the trigger. */
  hideTrigger?: boolean
  /** Controlled active word (tap from page highlight). */
  activeWordId?: string | null
  onActiveWordIdChange?: (wordId: string | null) => void
  studentId?: string
  /** Open picture search with this headword. */
  onFindPicture?: (word: string) => void
}

export function InteractiveVocabReaderShelf({
  pack,
  className,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
  activeWordId: activeWordIdProp,
  onActiveWordIdChange,
  studentId = '',
  onFindPicture,
}: InteractiveVocabReaderShelfProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [uncontrolledActiveId, setUncontrolledActiveId] = useState<string | null>(null)
  const [savingWord, setSavingWord] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : uncontrolledOpen
  const activeIdControlled = activeWordIdProp !== undefined
  const activeWordId = activeIdControlled ? (activeWordIdProp ?? null) : uncontrolledActiveId

  const { saveWord } = useSavedWords({
    studentId,
    onPersistenceError: (message) => toast.error(message),
  })

  function setOpen(next: boolean) {
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  function setActiveWordId(next: string | null) {
    if (!activeIdControlled) setUncontrolledActiveId(next)
    onActiveWordIdChange?.(next)
  }

  useEffect(() => {
    if (open) return
    if (!activeIdControlled) setUncontrolledActiveId(null)
    onActiveWordIdChange?.(null)
  }, [open, activeIdControlled, onActiveWordIdChange])

  const active: InteractiveVocabWord | null =
    activeWordId != null ? (pack.words.find((w) => w.id === activeWordId) ?? null) : null

  function openWord(w: InteractiveVocabWord) {
    setActiveWordId(w.id)
  }

  function backToList() {
    setActiveWordId(null)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
  }

  function handleSave() {
    if (!active || !studentId.trim()) {
      toast.error(studentId.trim() ? 'Nothing to save.' : 'Open a student session to save words.')
      return
    }
    setSavingWord(true)
    try {
      const mode = saveWord({
        source: active.word,
        chinese: active.definition.trim() || '—',
        exampleEn: active.examples[0] ?? '',
      })
      toast.success(mode === 'updated' ? 'Word updated in saved words.' : 'Word saved.')
    } finally {
      setSavingWord(false)
    }
  }

  return (
    <div className={cn(!hideTrigger && 'flex justify-end', className)}>
      <div>
        {!hideTrigger ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-2 shadow-md"
            onClick={() => setOpen(true)}
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            Vocabulary
          </Button>
        ) : null}
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b border-border px-4 py-3 text-left">
              <SheetTitle className="text-base font-semibold">{pack.sectionLabel}</SheetTitle>
              <p className="text-xs font-normal text-muted-foreground">
                Tap a word on the page or in the list, then use Back to return.
              </p>
            </SheetHeader>

            {!active ? (
              <ScrollArea className="flex-1 px-2 py-3">
                <ul className="space-y-1">
                  {pack.words.map((w) => (
                    <li key={w.id}>
                      <button
                        type="button"
                        className="flex w-full rounded-md border border-transparent px-3 py-2.5 text-left text-sm font-medium transition hover:border-border hover:bg-muted/80"
                        onClick={() => openWord(w)}
                      >
                        {w.word}
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <div className="flex flex-1 flex-col gap-3 px-4 py-3">
                <Button type="button" variant="ghost" size="sm" className="w-fit gap-1 px-2 -ml-2" onClick={backToList}>
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Back to list
                </Button>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold capitalize">{active.word}</h3>
                  <p className="text-sm leading-relaxed text-foreground">{active.definition}</p>
                  {active.examples.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Examples</p>
                      <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-foreground">
                        {active.examples.map((ex, i) => (
                          <li key={i}>{ex}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-1.5"
                    disabled={savingWord}
                    onClick={handleSave}
                  >
                    <BookmarkPlus className="h-4 w-4" aria-hidden />
                    Save
                  </Button>
                  {onFindPicture ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => onFindPicture(active.word)}
                    >
                      <ImageIcon className="h-4 w-4" aria-hidden />
                      Find picture
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
