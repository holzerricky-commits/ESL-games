import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface OverlayDialogsProps {
  pdfDialogOpen: boolean
  setPdfDialogOpen: (open: boolean) => void
  numPages: number | null
  pdfFrom: string
  setPdfFrom: (value: string) => void
  pdfTo: string
  setPdfTo: (value: string) => void
  runPdfPacketExport: () => Promise<void>
  captionDialog: { fileRel: string } | null
  setCaptionDialog: (next: { fileRel: string } | null) => void
  captionDraft: string
  setCaptionDraft: (value: string) => void
  onSaveCaption: () => Promise<void>
}

export function OverlayDialogs({
  pdfDialogOpen,
  setPdfDialogOpen,
  numPages,
  pdfFrom,
  setPdfFrom,
  pdfTo,
  setPdfTo,
  runPdfPacketExport,
  captionDialog,
  setCaptionDialog,
  captionDraft,
  setCaptionDraft,
  onSaveCaption,
}: OverlayDialogsProps) {
  return (
    <>
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export page range as PDF</DialogTitle>
            <DialogDescription>
              Captures each page in single-page layout (up to 40 pages) and saves one PDF under{' '}
              <code className="text-xs">student-work/…/exports/book-review/</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pdf-from">From page</Label>
              <Input
                id="pdf-from"
                type="number"
                min={1}
                max={numPages ?? 1}
                value={pdfFrom}
                onChange={(e) => setPdfFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdf-to">To page</Label>
              <Input
                id="pdf-to"
                type="number"
                min={1}
                max={numPages ?? 1}
                value={pdfTo}
                onChange={(e) => setPdfTo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPdfDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void runPdfPacketExport()}>
              Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={captionDialog != null}
        onOpenChange={(o) => {
          if (!o) setCaptionDialog(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Optional caption</DialogTitle>
            <DialogDescription>
              Add a short note for this file. It is stored in the sidecar <code className="text-xs">.meta.json</code> next
              to the image or PDF.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            rows={3}
            placeholder="e.g. Review irregular verbs on this page"
            className="resize-none"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCaptionDialog(null)}>
              Skip
            </Button>
            <Button type="button" onClick={() => void onSaveCaption()}>
              Save caption
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
