'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { AppNavItem } from '@/lib/navigation'
import { cn } from '@/lib/utils'

interface NavLinkProps {
  item: AppNavItem
  collapsed?: boolean
}

export function NavLink({ item, collapsed = false }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all',
        collapsed ? 'justify-center gap-0' : 'gap-3',
        isActive
          ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/15 text-foreground shadow-[0_0_14px_rgba(59,130,246,0.2)]'
          : 'border-transparent text-muted-foreground hover:border-[var(--border)] hover:bg-[var(--surface-3)] hover:text-foreground',
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon size={16} />
      {!collapsed ? <span>{item.label}</span> : null}
    </Link>
  )
}
