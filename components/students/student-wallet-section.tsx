'use client'

import { Coins } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatSignedCoinAmount, formatWalletLedgerTimestamp } from '@/lib/wallet-format'
import type { StudentCoinTransactionView } from '@/lib/students/types'

interface StudentWalletSectionProps {
  totalCoins: number
  transactions: StudentCoinTransactionView[]
  /** For aria-labels */
  studentName: string
}

export function StudentWalletSection({ totalCoins, transactions, studentName }: StudentWalletSectionProps) {
  const count = transactions.length

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]"
      aria-label={`Coin wallet for ${studentName}`}
    >
      <div className="border-b border-[var(--border)] bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface-1)] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Available balance</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-4xl font-black tabular-nums tracking-tight text-foreground sm:text-5xl">
                {totalCoins}
              </span>
              <span className="inline-flex items-center gap-1 pb-1 text-sm font-semibold text-muted-foreground">
                <Coins className="h-5 w-5 text-[var(--chart-4)]" strokeWidth={2} aria-hidden />
                coins
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {count === 0 ? 'No transactions yet' : `${count} transaction${count === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <h3 className="text-sm font-semibold text-foreground">Activity</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Newest first · Amount and balance are shown in coins
        </p>

        {count === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Coins appear here when a challenge is completed for the first time.
          </p>
        ) : (
          <ScrollArea className="mt-4 h-[min(28rem,55vh)] pr-3">
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <caption className="sr-only">Coin transaction history for {studentName}</caption>
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">
                      Date
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">
                      Description
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium sm:px-4">
                      Amount
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium sm:px-4">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const { dayLabel, timeLabel } = formatWalletLedgerTimestamp(tx.createdAt)
                    const positive = tx.amount >= 0
                    return (
                      <tr
                        key={tx.id}
                        className="border-b border-[var(--border)] last:border-b-0 transition-colors hover:bg-[var(--surface-2)]/80"
                      >
                        <td className="px-3 py-3 align-top sm:px-4">
                          <div className="font-medium text-foreground">{dayLabel}</div>
                          {timeLabel ? <div className="text-xs text-muted-foreground">{timeLabel}</div> : null}
                        </td>
                        <td className="px-3 py-3 align-top sm:px-4">
                          <div className="font-medium text-foreground">{tx.challengeTitle ?? 'Reward'}</div>
                          <div className="text-xs text-muted-foreground">{tx.reasonLabel}</div>
                        </td>
                        <td
                          className={`px-3 py-3 text-right align-top tabular-nums sm:px-4 ${
                            positive ? 'text-[var(--chart-4)]' : 'text-destructive'
                          }`}
                        >
                          {formatSignedCoinAmount(tx.amount)}
                        </td>
                        <td className="px-3 py-3 text-right align-top tabular-nums font-medium text-foreground sm:px-4">
                          {tx.balanceAfter}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}
      </div>
    </section>
  )
}
