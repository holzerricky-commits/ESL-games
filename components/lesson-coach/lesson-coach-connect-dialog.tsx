'use client'

import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Smartphone } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { isLocalhostHost } from '@/lib/lesson-coach/coach-url'
import { fetchPacingNotesForLesson } from '@/lib/lesson-coach/fetch-lesson-pacing-context'
import { useLessonCoachSession } from '@/lib/lesson-coach/use-lesson-coach-session'

type LessonCoachConnectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string | null
  coachUrl: string | null
  onSessionCreated: (payload: { id: string; coachUrl: string }) => void
  studentId?: string
  studentName?: string
  bookId?: string | null
  bookTitle?: string | null
  unitId?: string | null
  unitTitle?: string | null
  lessonId?: string | null
  lessonTitle?: string | null
  partId?: string | null
  partTitle?: string | null
}

export function LessonCoachConnectDialog({
  open,
  onOpenChange,
  sessionId,
  coachUrl,
  onSessionCreated,
  studentId,
  studentName,
  bookId,
  bookTitle,
  unitId,
  unitTitle,
  lessonId,
  lessonTitle,
  partId,
  partTitle,
}: LessonCoachConnectDialogProps) {
  const { createSession, loading, connectionStatus } = useLessonCoachSession(sessionId, 'overlay')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copyDone, setCopyDone] = useState(false)

  const localhostWarning =
    coachUrl && typeof window !== 'undefined'
      ? isLocalhostHost(new URL(coachUrl).host)
      : typeof window !== 'undefined' && isLocalhostHost(window.location.host)

  useEffect(() => {
    if (!coachUrl || !open) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    void QRCode.toDataURL(coachUrl, { margin: 1, width: 220 }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [coachUrl, open])

  const handleCreate = useCallback(async () => {
    const pacingNotes =
      bookId
        ? await fetchPacingNotesForLesson({
            bookId,
            unitId,
            lessonId,
            partId,
            bookTitle,
            unitTitle,
            lessonTitle,
            partTitle,
          })
        : undefined

    const result = await createSession({
      studentId,
      studentName,
      bookId: bookId ?? undefined,
      bookTitle: bookTitle ?? undefined,
      unitId: unitId ?? undefined,
      unitTitle: unitTitle ?? undefined,
      lessonId: lessonId ?? undefined,
      lessonTitle: lessonTitle ?? undefined,
      partId: partId ?? undefined,
      partTitle: partTitle ?? undefined,
      pacingNotes,
    })
    onSessionCreated({ id: result.id, coachUrl: result.coachUrl })
  }, [
    createSession,
    onSessionCreated,
    studentId,
    studentName,
    bookId,
    bookTitle,
    unitId,
    unitTitle,
    lessonId,
    lessonTitle,
    partId,
    partTitle,
  ])

  const handleCopy = useCallback(async () => {
    if (!coachUrl) return
    await navigator.clipboard.writeText(coachUrl)
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }, [coachUrl])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Coach on phone
          </DialogTitle>
          <DialogDescription>
            Scan on the same Wi‑Fi. Students only see your shared browser window — not this page.
          </DialogDescription>
        </DialogHeader>

        {!sessionId ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Creates a private session linked to this book page. Pacing notes are filled from saved
              book context when available. Open the URL on your phone or tablet.
            </p>
            <Button type="button" onClick={() => void handleCreate()} disabled={loading}>
              {loading ? 'Creating…' : 'Create session'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL from qrcode
              <img src={qrDataUrl} alt="QR code to open teacher coach" className="rounded-lg border" />
            ) : (
              <div className="flex h-[220px] w-[220px] items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
                QR…
              </div>
            )}

            {coachUrl ? (
              <p className="w-full break-all text-center font-mono text-xs text-muted-foreground">
                {coachUrl}
              </p>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              onClick={() => void handleCopy()}
              disabled={!coachUrl}
            >
              <Copy className="h-4 w-4" />
              {copyDone ? 'Copied' : 'Copy link'}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Phone status:{' '}
              <span className="font-medium text-foreground">
                {connectionStatus === 'connected'
                  ? 'Connected'
                  : connectionStatus === 'waiting'
                    ? 'Waiting for phone…'
                    : connectionStatus === 'stale'
                      ? 'Phone idle'
                      : '—'}
              </span>
            </p>

            {localhostWarning ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                This link uses <strong>localhost</strong> — your phone cannot open it. On your PC,
                open the app via your Wi‑Fi IP (e.g. <code>192.168.1.x:3000</code>) or run{' '}
                <code>npm run dev:lan</code>, then create a new session.
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
