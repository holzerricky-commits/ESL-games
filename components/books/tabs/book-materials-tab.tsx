'use client'

import { FileText, FileType2 } from 'lucide-react'
import { BookSetupToolHelp } from '@/components/books/book-setup-tool-help'
import { Button } from '@/components/ui/button'
import { BOOK_SETUP_COPY } from '@/lib/books/book-setup-copy'
import { makeUnitFileUrl } from '@/lib/books/book-file-url'

interface BookMaterialsTabProps {
  materialsLoading: boolean
  downloadedMaterials: Array<{ id: string; title: string; fileName: string; filePath: string; contentType?: string }>
  isPdfMaterial: (material: { fileName: string; filePath: string; contentType?: string }) => boolean
  onOpenFindGuides: () => void
  onOpenScanGuides: () => void
}

export function BookMaterialsTab({
  materialsLoading,
  downloadedMaterials,
  isPdfMaterial,
  onOpenFindGuides,
  onOpenScanGuides,
}: BookMaterialsTabProps) {
  const findCopy = BOOK_SETUP_COPY.materials.findGuides
  const scanCopy = BOOK_SETUP_COPY.materials.scanGuides

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 p-3">
          <BookSetupToolHelp title={findCopy.label} subtitle={findCopy.subtitle} detail={findCopy.detail}>
            <Button type="button" size="sm" variant="outline" className="w-full" onClick={onOpenFindGuides}>
              {findCopy.label}
            </Button>
          </BookSetupToolHelp>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 p-3">
          <BookSetupToolHelp title={scanCopy.label} subtitle={scanCopy.subtitle} detail={scanCopy.detail}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              onClick={onOpenScanGuides}
              disabled={downloadedMaterials.length === 0}
            >
              {scanCopy.label}
            </Button>
          </BookSetupToolHelp>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Supporting files</p>
        {materialsLoading ? (
          <p className="text-sm text-muted-foreground">Loading downloaded files...</p>
        ) : downloadedMaterials.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No files in this book&apos;s supporting folder yet. Use Find teacher guides to download some.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {downloadedMaterials.map((material) => {
              const fileUrl = makeUnitFileUrl(material.filePath)
              const PdfIcon = isPdfMaterial(material) ? FileType2 : FileText
              return (
                <a
                  key={material.id}
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-md border border-[var(--border)] bg-background p-3 transition hover:border-[var(--brand-blue)]/50 hover:bg-[var(--surface-2)]"
                  title={material.fileName}
                >
                  <div className="flex items-start gap-3">
                    <PdfIcon className="mt-0.5 h-10 w-10 shrink-0 text-[var(--brand-blue)]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground group-hover:underline">
                        {material.title || material.fileName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{material.fileName}</p>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
