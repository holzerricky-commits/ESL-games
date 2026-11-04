export const LESSON_VAULT_PASTE_ZONE_ATTR = 'data-lesson-vault-paste-zone'

/** Pointer or focus is on the vault card list, so Ctrl+V belongs to the vault, not the book. */
export function isLessonVaultPasteZoneActive(): boolean {
  if (typeof document === 'undefined') return false
  const zone = `[${LESSON_VAULT_PASTE_ZONE_ATTR}]`
  return document.querySelector(`${zone}:hover, ${zone}:focus-within`) != null
}
