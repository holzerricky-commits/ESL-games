'use client'

import { useState } from 'react'
import { BookOpen, Check, Loader2, Sparkles } from 'lucide-react'
import {
  DismissibleScanNotice,
  type ScanNotice,
} from '@/components/books/dismissible-scan-notice'
import { CHECKS_DIALOG_STYLE } from '@/components/books/checks-editor-theme'
import { StoryScanProgressBar } from '@/components/books/story-scan-progress-bar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type {
  StoryScanProgress,
  StoryTextScanMode,
} from '@/lib/books/story-text-scan-client'
import { cn } from '@/lib/utils'

export type StoryTextFuelBusy = 'scan' | 'saveText' | null

export interface StoryTextFuelPanelProps {
  storyTitle: string
  /** e.g. "p12–18" or empty */
  pageRangeLabel?: string | null
  textDraft: string
  onTextDraftChange: (value: string) => void
  hasStoryText: boolean
  busy: StoryTextFuelBusy
  scanProgress: StoryScanProgress | null
  onScan: (opts?: { mode: StoryTextScanMode }) => void
  onStopScan?: () => void
  /** Return true when save succeeded — dialog closes. */
  onSave: () => boolean | Promise<boolean>
  /** Disable Scan when pages / unit not ready */
  scanDisabled?: boolean
  /** Partial scan — show Continue + Re-scan from start */
  canContinueScan?: boolean
  /** Controlled dialog open (for “View story” from checks). */
  dialogOpen?: boolean
  onDialogOpenChange?: (open: boolean) => void
  /** Sticky scan outcome — stays until dismissed. */
  scanNotice?: ScanNotice | null
  onDismissScanNotice?: () => void
  className?: string
  /** Hide the left “Text” column label (Books already has one). */
  hideRowLabel?: boolean
  /** `soft` = Apple part-prep cards; `desk` = Stories desk inset border. */
  chrome?: 'desk' | 'soft'
}

function textSnippet(text: string, max = 90): string {
  const one = text.replace(/\s+/g, ' ').trim()
  if (one.length <= max) return one
  return `${one.slice(0, max)}…`
}

function wordCount(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

/**
 * Collapsed story-text fuel row + center dialog for scan / paste / save.
 * Parents own fetch, scan, and save; this is UI only.
 */
export function StoryTextFuelPanel({
  storyTitle,
  pageRangeLabel = null,
  textDraft,
  onTextDraftChange,
  hasStoryText,
  busy,
  scanProgress,
  onScan,
  onStopScan,
  onSave,
  scanDisabled = false,
  canContinueScan = false,
  dialogOpen: controlledOpen,
  onDialogOpenChange,
  scanNotice = null,
  onDismissScanNotice,
  className,
  hideRowLabel = false,
  chrome = 'desk',
}: StoryTextFuelPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onDialogOpenChange ?? setInternalOpen

  const scanning = busy === 'scan'
  const saving = busy === 'saveText'
  const words = wordCount(textDraft)
  const range = pageRangeLabel?.trim() || null
  const showContinue = hasStoryText && canContinueScan
  const soft = chrome === 'soft'

  function openDialog() {
    setOpen(true)
  }

  async function handleSave() {
    const ok = await onSave()
    if (ok) setOpen(false)
  }

  const statusPill = !hasStoryText ? (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium',
        soft
          ? 'bg-[var(--surface-2)] text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]'
          : 'bg-[var(--checks-warn-soft)] text-[var(--checks-ink)] text-[10px] px-2 py-0.5',
      )}
    >
      Needs text
    </span>
  ) : (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium',
        soft
          ? showContinue
            ? 'bg-[var(--surface-2)] text-foreground shadow-[inset_0_0_0_1px_var(--border)]'
            : 'bg-[var(--brand-blue)] text-white'
          : showContinue
            ? 'bg-[var(--checks-warn-soft)] text-[var(--checks-ink)] text-[10px] px-2 py-0.5'
            : 'bg-[var(--checks-ok-soft)] text-[var(--checks-ok)] text-[10px] px-2 py-0.5',
      )}
    >
      {soft && !showContinue ? <Check className="size-3 stroke-[3]" aria-hidden /> : null}
      {showContinue ? 'Partial scan' : 'Text ready'}
    </span>
  )

  return (
    <div className={cn(className)} style={soft ? undefined : CHECKS_DIALOG_STYLE}>
      <div
        className={cn(
          soft
            ? 'rounded-2xl bg-[var(--surface-3)]'
            : 'rounded-xl border border-[var(--checks-border)] bg-[var(--checks-card)]',
        )}
      >
        {!hasStoryText ? (
          <div className={cn('space-y-3', soft ? 'p-4 sm:p-5' : 'space-y-2 p-3')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                {statusPill}
                <p className={cn(soft ? 'text-[14px] text-muted-foreground' : 'text-sm text-[var(--checks-muted)]')}>
                  No story text yet
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className={cn('gap-1.5', soft ? 'h-9 rounded-full px-4' : 'h-8')}
                  disabled={scanning || scanDisabled}
                  onClick={() => onScan({ mode: 'full' })}
                >
                  {scanning ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      Scanning…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" aria-hidden />
                      Scan text
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn(soft ? 'h-9 rounded-full px-3 text-muted-foreground' : 'h-8 text-[var(--checks-muted)]')}
                  disabled={scanning}
                  onClick={openDialog}
                >
                  Paste instead
                </Button>
              </div>
            </div>
            {scanProgress ? (
              <StoryScanProgressBar progress={scanProgress} onCancel={onStopScan} />
            ) : null}
            {scanNotice && onDismissScanNotice ? (
              <DismissibleScanNotice notice={scanNotice} onDismiss={onDismissScanNotice} />
            ) : null}
          </div>
        ) : (
          <div className={cn('space-y-3', soft ? 'p-4 sm:p-5' : 'space-y-2 p-3')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  {statusPill}
                  {words > 0 ? (
                    <span className={cn(soft ? 'text-[13px] text-muted-foreground' : 'text-[11px] text-[var(--checks-muted)]')}>
                      {words.toLocaleString()} word{words === 1 ? '' : 's'}
                      {range ? ` · ${range}` : ''}
                    </span>
                  ) : range ? (
                    <span className={cn(soft ? 'text-[13px] text-muted-foreground' : 'text-[11px] text-[var(--checks-muted)]')}>
                      {range}
                    </span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    'line-clamp-2',
                    soft ? 'text-[14px] leading-relaxed text-muted-foreground' : 'truncate text-sm text-[var(--checks-muted)]',
                  )}
                >
                  {textSnippet(textDraft, soft ? 140 : 90)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={soft ? 'secondary' : 'outline'}
                  className={cn(
                    'gap-1.5',
                    soft ? 'h-9 rounded-full px-4' : 'h-8 border-[var(--checks-border)]',
                  )}
                  disabled={scanning}
                  onClick={openDialog}
                >
                  <BookOpen className="size-3.5" aria-hidden />
                  Open
                </Button>
                {showContinue ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className={cn('gap-1.5', soft ? 'h-9 rounded-full px-4' : 'h-8')}
                      disabled={scanning || scanDisabled}
                      onClick={() => onScan({ mode: 'continue' })}
                    >
                      {scanning ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          Scanning…
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-3.5" aria-hidden />
                          Continue
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn(soft ? 'h-9 rounded-full px-3 text-muted-foreground' : 'h-8 text-[var(--checks-muted)]')}
                      disabled={scanning || scanDisabled}
                      onClick={() => onScan({ mode: 'full' })}
                    >
                      Re-scan
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(soft ? 'h-9 rounded-full px-3 text-muted-foreground' : 'h-8 text-[var(--checks-muted)]')}
                    disabled={scanning || scanDisabled}
                    onClick={() => onScan({ mode: 'full' })}
                  >
                    {scanning ? 'Scanning…' : 'Re-scan'}
                  </Button>
                )}
              </div>
            </div>
            {scanProgress ? (
              <StoryScanProgressBar progress={scanProgress} onCancel={onStopScan} />
            ) : null}
            {scanNotice && onDismissScanNotice ? (
              <DismissibleScanNotice notice={scanNotice} onDismiss={onDismissScanNotice} />
            ) : null}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            'flex h-[min(88vh,720px)] w-[min(96vw,42rem)] max-w-[42rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-[42rem]',
            soft
              ? 'border-border/60 bg-[var(--surface-1)]'
              : 'border-[var(--checks-border)]',
          )}
          style={soft ? undefined : CHECKS_DIALOG_STYLE}
        >
          <DialogHeader
            className={cn(
              'shrink-0 space-y-1 border-b px-5 py-3 text-left',
              soft
                ? 'border-border/60 bg-[var(--surface-2)]'
                : 'border-[var(--checks-border)] bg-white',
            )}
          >
            <DialogTitle className={cn(soft ? 'text-[17px] font-semibold tracking-tight' : 'text-base text-[var(--checks-ink)]')}>
              {storyTitle}
            </DialogTitle>
            <DialogDescription className={cn(soft ? 'text-[13px] text-muted-foreground' : 'text-[var(--checks-muted)]')}>
              Story text for reading checks
              {range ? ` · ${range}` : ''}
              {hasStoryText && words > 0
                ? ` · ${words.toLocaleString()} word${words === 1 ? '' : 's'}`
                : ''}
              {showContinue ? ' · scan incomplete' : ''}
            </DialogDescription>
          </DialogHeader>

          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 py-3',
              soft ? 'bg-[var(--surface-1)]' : 'bg-[var(--checks-bg)]',
            )}
          >
            {scanProgress ? (
              <StoryScanProgressBar progress={scanProgress} onCancel={onStopScan} />
            ) : null}
            {scanNotice && onDismissScanNotice ? (
              <DismissibleScanNotice notice={scanNotice} onDismiss={onDismissScanNotice} />
            ) : null}
            <Textarea
              value={textDraft}
              onChange={(e) => onTextDraftChange(e.target.value)}
              placeholder="Scan from the PDF, or paste the story here."
              className={cn(
                'min-h-0 flex-1 resize-none',
                soft
                  ? 'rounded-2xl border-0 bg-[var(--surface-3)] font-sans text-[14px] leading-relaxed text-foreground shadow-none'
                  : 'border-[var(--checks-border)] bg-white font-mono text-xs text-[var(--checks-ink)]',
              )}
              disabled={scanning}
            />
            <p className={cn('shrink-0', soft ? 'text-[12px] text-muted-foreground' : 'text-[11px] text-[var(--checks-muted)]')}>
              {showContinue
                ? 'Continue scan picks up after saved pages. Re-scan from start replaces everything.'
                : 'Scans this story’s page range. If the PDF has no selectable text, AI reads the page images. You can still paste or edit afterward.'}
            </p>
          </div>

          <DialogFooter
            className={cn(
              'shrink-0 gap-2 border-t px-5 py-3 sm:justify-between',
              soft
                ? 'border-border/60 bg-[var(--surface-2)]'
                : 'border-[var(--checks-border)] bg-white',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              {showContinue ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className={cn('gap-1.5', soft && 'h-9 rounded-full px-4')}
                    disabled={scanning || scanDisabled}
                    onClick={() => onScan({ mode: 'continue' })}
                  >
                    {scanning ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        Scanning…
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5" aria-hidden />
                        Continue scan
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(
                      soft ? 'h-9 rounded-full px-3 text-muted-foreground' : 'text-[var(--checks-muted)]',
                    )}
                    disabled={scanning || scanDisabled}
                    onClick={() => onScan({ mode: 'full' })}
                  >
                    Re-scan from start
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className={cn('gap-1.5', soft && 'h-9 rounded-full px-4')}
                  disabled={scanning || scanDisabled}
                  onClick={() => onScan({ mode: 'full' })}
                >
                  {scanning ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      Scanning…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" aria-hidden />
                      {hasStoryText ? 'Re-scan' : 'Scan text'}
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(soft && 'h-9 rounded-full px-3')}
                disabled={scanning || saving}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className={cn(soft && 'h-9 rounded-full px-5')}
                disabled={scanning || saving}
                onClick={() => void handleSave()}
              >
                {saving ? 'Saving…' : 'Save text'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
