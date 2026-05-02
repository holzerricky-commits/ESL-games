'use client'

import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  applyBackupPayload,
  buildBackupPayload,
  downloadBackupJson,
  validateBackupPayload,
} from '@/lib/local-data-backup'

export function LocalDataBackupCard() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingJson, setPendingJson] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handlePickFile = () => inputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      let data: unknown
      try {
        data = JSON.parse(text) as unknown
      } catch {
        toast.error('That file is not valid JSON.')
        return
      }
      const parsed = validateBackupPayload(data)
      if (!parsed) {
        toast.error('That file is not a valid ESL backup JSON.')
        return
      }
      setPendingJson(text)
      setConfirmOpen(true)
    }
    reader.onerror = () => toast.error('Could not read the file.')
    reader.readAsText(file, 'utf-8')
  }

  const handleConfirmRestore = () => {
    if (!pendingJson) {
      setConfirmOpen(false)
      return
    }
    try {
      const data = JSON.parse(pendingJson) as unknown
      const payload = validateBackupPayload(data)
      if (!payload) {
        toast.error('Invalid backup.')
        setConfirmOpen(false)
        setPendingJson(null)
        return
      }
      const { keysWritten } = applyBackupPayload(payload)
      toast.success(`Restored ${keysWritten} storage keys. Reloading…`)
      setConfirmOpen(false)
      setPendingJson(null)
      window.setTimeout(() => {
        window.location.reload()
      }, 600)
    } catch {
      toast.error('Could not parse backup.')
      setConfirmOpen(false)
      setPendingJson(null)
    }
  }

  return (
    <>
      <Card className="border-[var(--border)] bg-[var(--card)] lg:col-span-2">
        <CardHeader>
          <CardTitle>Data backup (Phase 0)</CardTitle>
          <CardDescription>
            Quizzes, students, results, book notes, and other data live in this browser&apos;s{' '}
            <code className="text-xs">localStorage</code> under keys starting with{' '}
            <code className="text-xs">esl_</code>. Export before clearing site data or switching browsers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="default"
            className="bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-bright)] text-white"
            onClick={() => {
              const n = Object.keys(buildBackupPayload().localStorage).length
              downloadBackupJson()
              toast.success(`Downloaded backup (${n} keys).`)
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Download backup JSON
          </Button>
          <Button type="button" variant="outline" onClick={handlePickFile}>
            <Upload className="mr-2 h-4 w-4" />
            Restore from JSON…
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="w-full text-xs text-muted-foreground">
            Restore overwrites only keys listed in the file. Reloads the app after restore. See{' '}
            <code className="text-[11px]">docs/PHASE0.md</code> for the full Phase 0 checklist.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore local data?</AlertDialogTitle>
            <AlertDialogDescription>
              This writes all keys from the backup into this browser&apos;s localStorage and reloads the page.
              Keys in the backup overwrite current values; other <code className="text-xs">esl_*</code> keys
              not in the file are left unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingJson(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore}>Restore and reload</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
