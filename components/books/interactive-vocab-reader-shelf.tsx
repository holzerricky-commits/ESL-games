'use client'

import { useState } from 'react'
import { BookOpen, ChevronLeft } from 'lucide-react'
import type { InteractiveVocabPack, InteractiveVocabWord } from '@/lib/books/interactive-vocab'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface InteractiveVocabReaderShelfProps {
  pack: InteractiveVocabPack
  className?: string
}

export function InteractiveVocabReaderShelf({ pack, className }: InteractiveVocabReaderShelfProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<InteractiveVocabWord | null>(null)

  function openWord(w: InteractiveVocabWord) {
    setActive(w)
  }

  function backToList() {
    setActive(null)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setActive(null)
  }

  return (
    <div className={cn('flex justify-end', className)}>
      <div>
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
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b border-border px-4 py-3 text-left">
              <SheetTitle className="text-base font-semibold">{pack.sectionLabel}</SheetTitle>
              <p className="text-xs font-normal text-muted-foreground">Tap a word, then use Back to return to the list.</p>
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
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
