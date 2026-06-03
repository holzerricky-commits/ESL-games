import type { AnnotationCommand } from '@/lib/books/annotation-command-types'

export type InkSessionCommand = AnnotationCommand

export type InkSessionMeta = {
  revision: number
  dirty: boolean
  updatedAt: number
}

export type InkSessionDocument = {
  docId: string
  commands: InkSessionCommand[]
  meta: InkSessionMeta
}
