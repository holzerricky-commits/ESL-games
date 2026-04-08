import Link from 'next/link'
import { APP_NAV_ITEMS } from '@/lib/navigation'

export function AppTopbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface-2)]/90 px-4 py-3 backdrop-blur-md lg:hidden">
      <nav className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto">
        {APP_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-3)] px-3 py-1.5 text-xs font-semibold text-foreground whitespace-nowrap"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
