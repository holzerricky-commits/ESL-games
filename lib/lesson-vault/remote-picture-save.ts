/**
 * After a web picture finishes downloading, decide whether it may replace
 * what the card shows. A picture attached while the download was in flight stays.
 */
export function decideRemotePictureSave(args: {
  beforeUrl: string
  nowUrl: string
  /** Local url from a successful upload. Null when nothing was written. */
  uploadedUrl: string | null
  requestedUrl: string
}): { action: 'apply'; url: string } | { action: 'keep' } {
  const before = args.beforeUrl.trim()
  const now = args.nowUrl.trim()
  const requested = args.requestedUrl.trim()
  const uploaded = args.uploadedUrl?.trim() ?? ''
  if (now !== before && now !== '' && now !== uploaded) return { action: 'keep' }
  if (uploaded) return { action: 'apply', url: uploaded }
  if (requested && (now === before || now === '' || now === requested)) {
    return { action: 'apply', url: requested }
  }
  return { action: 'keep' }
}
