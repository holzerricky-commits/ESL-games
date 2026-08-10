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
      data-active={isActive}
      className={cn(
        'chrome-nav-pill',
        collapsed ? 'h-10 w-10 justify-center gap-0 px-0' : 'gap-3 px-3.5 py-2.5',
      )}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon size={collapsed ? 18 : 17} strokeWidth={isActive ? 2.25 : 1.75} />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  )
}
