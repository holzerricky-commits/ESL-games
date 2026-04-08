'use client'

import { PanelLeftClose, PanelLeftOpen, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { APP_NAV_ITEMS } from '@/lib/navigation'
import { NavLink } from '@/components/nav-link'

interface AppSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 border-r border-[var(--border)] bg-[var(--surface-2)]/95 py-5 transition-[width,padding] duration-200 lg:block',
        collapsed ? 'w-[84px] px-3' : 'w-64 px-4',
      )}
    >
      <div className={cn('mb-6 flex items-center px-2', collapsed ? 'justify-center' : 'justify-between')}>
        <div className={cn('flex items-center', collapsed ? 'gap-0' : 'gap-3')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-blue)] shadow-[0_0_16px_rgba(59,130,246,0.4)]">
            <Zap size={18} className="text-white" fill="currentColor" />
          </div>
          {!collapsed ? (
            <div>
              <p className="text-sm font-bold text-foreground leading-none">ESL Classroom</p>
              <p className="mt-0.5 text-xs text-muted-foreground leading-none">Teacher mode</p>
            </div>
          ) : null}
        </div>

        {!collapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={16} />
          </Button>
        ) : null}
      </div>

      {collapsed ? (
        <div className="mb-6 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Expand sidebar"
          >
            <PanelLeftOpen size={16} />
          </Button>
        </div>
      ) : null}

      <nav className="flex flex-col gap-1">
        {APP_NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  )
}
