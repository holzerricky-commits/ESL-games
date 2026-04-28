import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Users, Gamepad2, Settings, BookOpenText, CalendarDays } from 'lucide-react'

export interface AppNavItem {
  label: string
  href: string
  icon: LucideIcon
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Students', href: '/students', icon: Users },
  { label: 'Schedule', href: '/schedule', icon: CalendarDays },
  { label: 'Books', href: '/books', icon: BookOpenText },
  { label: 'Games', href: '/games', icon: Gamepad2 },
  { label: 'Settings', href: '/settings', icon: Settings },
]
