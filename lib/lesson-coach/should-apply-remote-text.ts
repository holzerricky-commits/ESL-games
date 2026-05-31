/**
 * Decide whether a polled coach `sharedText` should replace the live textarea.
 * Prevents stale server text from wiping in-progress typing.
 */
export function shouldApplyRemoteSharedText(
  remote: string,
  local: string,
  lastSyncedToServer: string,
): boolean {
  if (remote === local) return false
  if (remote === lastSyncedToServer) return false

  // Server behind client (common while debounced PATCH is in flight).
  if (local.startsWith(remote) && local.length > remote.length) return false

  // Coach applied a fix: remote extends or edits beyond a stale prefix.
  if (remote.startsWith(local) && remote.length > local.length) return true

  // Replacement edit (apply-fix in the middle/end).
  if (!local.startsWith(remote) && !remote.startsWith(local)) return true

  // Shorter remote while not synced — ignore (stale).
  if (remote.length < local.length) return false

  return remote !== lastSyncedToServer
}
