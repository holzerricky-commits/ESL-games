/**
 * Display helpers for wallet / transaction ledger (banking-style clarity).
 */

export function formatSignedCoinAmount(amount: number): string {
  if (amount > 0) return `+${amount}`
  if (amount < 0) return `-${Math.abs(amount)}`
  return '0'
}

/** Relative day label + time, similar to banking / wallet apps. */
export function formatWalletLedgerTimestamp(iso: string): { dayLabel: string; timeLabel: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return { dayLabel: '—', timeLabel: '' }
  }
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startTx = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startToday - startTx) / 86_400_000)

  const timeLabel = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  if (diffDays === 0) return { dayLabel: 'Today', timeLabel }
  if (diffDays === 1) return { dayLabel: 'Yesterday', timeLabel }

  const dayLabel = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
  })
  return { dayLabel, timeLabel }
}
