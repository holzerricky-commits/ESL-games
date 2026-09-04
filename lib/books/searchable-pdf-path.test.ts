import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isHiddenLibraryDirName,
  isSearchableSidecarAbsPath,
  SEARCHABLE_PDF_DIR,
  searchablePdfAbsolutePath,
  shouldServeSearchableSidecar,
} from '@/lib/books/searchable-pdf-path'

describe('searchablePdfAbsolutePath', () => {
  it('puts the copy in .searchable next to the original', () => {
    const original = path.join('book-library', 'journeys-g3', 'unit-3.pdf')
    const sidecar = searchablePdfAbsolutePath(original)
    expect(path.basename(path.dirname(sidecar))).toBe(SEARCHABLE_PDF_DIR)
    expect(path.basename(sidecar)).toBe('unit-3.pdf')
  })

  it('does not nest when the path is already a sidecar', () => {
    const sidecar = path.join('book-library', 'foo', SEARCHABLE_PDF_DIR, 'unit.pdf')
    expect(searchablePdfAbsolutePath(sidecar)).toBe(sidecar)
  })
})

describe('isSearchableSidecarAbsPath', () => {
  it('detects the sidecar folder', () => {
    expect(isSearchableSidecarAbsPath(path.join('a', SEARCHABLE_PDF_DIR, 'b.pdf'))).toBe(true)
    expect(isSearchableSidecarAbsPath(path.join('a', 'b.pdf'))).toBe(false)
  })
})

describe('isHiddenLibraryDirName', () => {
  it('skips dot folders so auto-discover does not list the sidecar', () => {
    expect(isHiddenLibraryDirName('.searchable')).toBe(true)
    expect(isHiddenLibraryDirName('journeys-g3')).toBe(false)
  })
})

describe('shouldServeSearchableSidecar', () => {
  it('serves the sidecar when it is as new as the original', () => {
    expect(shouldServeSearchableSidecar(200, 200)).toBe(true)
    expect(shouldServeSearchableSidecar(250, 200)).toBe(true)
  })

  it('rejects a stale sidecar after the original scan was replaced', () => {
    expect(shouldServeSearchableSidecar(100, 200)).toBe(false)
  })
})
