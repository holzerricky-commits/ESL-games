import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveBookFileRequestPath } from '@/app/api/book-file/route'

describe('resolveBookFileRequestPath', () => {
  const cwd = path.resolve('/tmp/esl-games')
  const libraryRoot = path.join(cwd, 'book-library')

  it('accepts files inside book-library', () => {
    expect(resolveBookFileRequestPath('book-library/book-a/unit-1.pdf', cwd, libraryRoot)).toBe(
      path.join(libraryRoot, 'book-a', 'unit-1.pdf'),
    )
  })

  it('rejects sibling directories with the same prefix as book-library', () => {
    expect(resolveBookFileRequestPath('book-library-extra/secret.pdf', cwd, libraryRoot)).toBeNull()
  })

  it('rejects paths that escape the project root', () => {
    expect(resolveBookFileRequestPath('../outside.pdf', cwd, libraryRoot)).toBeNull()
  })
})
