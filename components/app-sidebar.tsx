'use client'

import { cn } from '@/lib/utils'
import { APP_NAV_ITEMS } from '@/lib/navigation'
import { NavLink } from '@/components/nav-link'

interface AppSidebarProps {
  collapsed: boolean
}

export function AppSidebar({ collapsed }: AppSidebarProps) {
  return (
    <aside
      className={cn(
        'chrome-sidebar sticky z-30 hidden shrink-0 lg:flex lg:flex-col',
        collapsed ? 'w-[4.25rem] px-2.5 py-3' : 'w-56 px-3 py-3',
      )}
      style={{
        top: 'var(--chrome-header-h)',
        height: 'calc(100vh - var(--chrome-header-h))',
      }}
    >
      <nav
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-y-auto pt-1',
          collapsed ? 'items-center gap-1' : 'gap-0.5',
        )}
        aria-label="Main"
      >
        {APP_NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  )
}
