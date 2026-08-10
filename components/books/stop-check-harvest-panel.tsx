'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CHECKS_DIALOG_STYLE } from '@/components/books/checks-editor-theme'
import { Button } from '@/components/ui/button'
import {
  createEmptyReadingCheckPack,
  demoteReadingCheckPackToDraft,
  type ReadingCheckPack,
} from '@/lib/books/reading-check-pack'
import { ensureReadingCheckPackPlacements } from '@/lib/books/reading-check-placement'
import {
  filterNewStopChecks,
  parseReadingStoryStopChecks,
  stopChecksToReadingCheckStops,
  type ReadingStoryStopCheckItem,
} from '@/lib/books/reading-story-stop-checks'
import { cn } from '@/lib/utils'

export interface StopCheckHarvestPanelProps {
  storyId: string
  bookId: string
  unitId: string
  storyText: string
  pack: ReadingCheckPack | null
  onPackChange: (pack: ReadingCheckPack) => void
  className?: string
}

/**
 * Shows publisher Stop and Check items found in story text; import into the check pack.
 */
export function StopCheckHarvestPanel({
  storyId,
  bookId,
  unitId,
  storyText,
  pack,
  onPackChange,
  className,
}: StopCheckHarvestPanelProps) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const items = useMemo(
    () => parseReadingStoryStopChecks(storyText),
    [storyText],
  )

  const newItems = useMemo(
    () => filterNewStopChecks(items, pack?.stops ?? []),
    [items, pack?.stops],
  )

  if (items.length === 0) return null

  async function importItems(selected: ReadingStoryStopCheckItem[]) {
    if (selected.length === 0) {
      toast.message('Those Stop and Check items are already in your pack.')
      return
    }
    setBusy(true)
    try {
      const imported = stopChecksToReadingCheckStops(selected)
      const base =
        pack ??
        createEmptyReadingCheckPack({
          storyId,
          bookId,
          unitId,
        })
      const asDraft =
        base.status === 'approved' ? demoteReadingCheckPackToDraft(base) : { ...base, status: 'draft' as const }
      const nextStops = ensureReadingCheckPackPlacements(
        [...asDraft.stops, ...imported],
        {},
      )
      const next: ReadingCheckPack = {
        ...asDraft,
        stops: nextStops,
        approvedAt: null,
        updatedAt: new Date().toISOString(),
      }

      const res = await fetch('/api/reading-stories/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          storyId,
          bookId,
          unitId,
          stops: next.stops,
          status: 'draft',
        }),
      })
      const data = (await res.json()) as { ok?: boolean; pack?: ReadingCheckPack; error?: string }
      if (!data.ok || !data.pack) {
        toast.error(data.error ?? 'Could not import Stop and Check items.')
        return
      }
      onPackChange(data.pack)
      toast.success(
        `Imported ${selected.length} Stop and Check${selected.length === 1 ? '' : 's'} — set answers, then Approve.`,
      )
    } catch {
      toast.error('Could not import Stop and Check items.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex gap-3 p-3 sm:gap-4', className)} style={CHECKS_DIALOG_STYLE}>
      <div className="w-12 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">Stops</div>
      <div className="min-w-0 flex-1">
        <div className="rounded-xl border border-[var(--checks-border)] bg-[var(--checks-card)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <span className="inline-flex items-center rounded-full bg-[var(--checks-accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--checks-accent)]">
                Stop and Check · {items.length}
              </span>
              <p className="text-sm text-[var(--checks-muted)]">
                {newItems.length > 0
                  ? `${newItems.length} not yet in your pack`
                  : 'All found items already in your pack'}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-[var(--checks-muted)]"
                onClick={() => setOpen((v) => !v)}
              >
                {open ? 'Hide' : 'Show'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8"
                disabled={busy || newItems.length === 0}
                onClick={() => void importItems(newItems)}
              >
                {busy ? 'Importing…' : 'Import new'}
              </Button>
            </div>
          </div>

          {open ? (
            <ul className="mt-3 space-y-2 border-t border-[var(--checks-border)] pt-3">
              {items.map((item) => {
                const already = !newItems.some((n) => n.id === item.id)
                const page =
                  item.displayPage != null
                    ? `p${item.displayPage}`
                    : item.pdfPage != null
                      ? `pdf ${item.pdfPage}`
                      : 'page?'
                return (
                  <li
                    key={item.id}
                    className="rounded-lg border border-[var(--checks-border)] bg-[var(--checks-bg)] px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-[var(--checks-muted)]">
                          {page}
                          {already ? ' · in pack' : ''}
                        </p>
                        <p className="text-sm text-[var(--checks-ink)]">{item.prompt}</p>
                      </div>
                      {!already ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 border-[var(--checks-border)]"
                          disabled={busy}
                          onClick={() => void importItems([item])}
                        >
                          Import
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}
