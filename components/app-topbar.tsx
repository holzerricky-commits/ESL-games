'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeft, Search, Settings } from 'lucide-react'
import { APP_NAV_ITEMS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

interface AppTopbarProps {
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
}

export function AppTopbar({ sidebarCollapsed = false, onToggleSidebar }: AppTopbarProps) {
  const pathname = usePathname()

  return (
    <header className="chrome-frost sticky top-0 z-40">
      <div
        className="flex w-full items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-5"
        style={{ height: 'var(--chrome-header-h)' }}
      >
        {/* Brand + menu toggle (toggle lives here — not inside the rail) */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {onToggleSidebar ? (
            <button
              type="button"
              onClick={onToggleSidebar}
              className={cn(
                'chrome-icon-btn hidden h-9 w-9 lg:inline-flex',
                !sidebarCollapsed && 'bg-[var(--chrome-pill-hover)] text-foreground',
              )}
              title={sidebarCollapsed ? 'Show menu labels' : 'Hide menu labels'}
              aria-label={sidebarCollapsed ? 'Expand side menu' : 'Collapse side menu'}
              aria-expanded={!sidebarCollapsed}
            >
              <PanelLeft size={18} strokeWidth={1.75} />
            </button>
          ) : null}

          <Link
            href="/dashboard"
            className="chrome-motion flex shrink-0 items-center rounded-xl px-1 py-1"
            aria-label="tuto home"
          >
            <Image
              src="/logo.png"
              alt="tuto"
              width={140}
              height={66}
              className="h-8 w-auto object-contain object-left sm:h-9"
              priority
            />
          </Link>
        </div>

        {/* Search — visual only for now */}
        <div className="mx-auto flex min-w-0 flex-1 justify-center px-1 sm:px-4">
          <div className="chrome-search" role="search" aria-label="Search (coming soon)">
            <Search size={15} strokeWidth={2} className="shrink-0 opacity-70" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium tracking-tight text-muted-foreground/85">
              Search students, books…
            </span>
            <kbd className="pointer-events-none hidden shrink-0 rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Profile cluster */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/settings"
            className="chrome-icon-btn h-9 w-9"
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={17} strokeWidth={1.75} />
          </Link>

          <div
            className="flex items-center gap-2 rounded-full py-1 pr-1.5 pl-1 sm:pr-2.5"
            title="Teacher Ricky"
          >
            <span className="chrome-avatar h-8 w-8" aria-hidden>
              TR
            </span>
            <span className="hidden min-w-0 md:block">
              <span className="block truncate text-sm font-semibold leading-none tracking-tight text-foreground">
                Teacher Ricky
              </span>
              <span className="mt-0.5 block truncate text-[11px] leading-none text-muted-foreground">
                You
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Mobile page pills — same soft-sky language as the left menu */}
      <nav
        className="flex gap-1 overflow-x-auto border-t border-[var(--chrome-frost-border)] px-3 py-2 lg:hidden"
        aria-label="Main"
      >
        {APP_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={isActive}
              className={cn('chrome-nav-pill shrink-0 gap-1.5 px-3 py-1.5 text-xs')}
            >
              <Icon size={14} strokeWidth={isActive ? 2.25 : 1.75} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
