import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Users, Gamepad2, Settings } from 'lucide-react'

export interface AppNavItem {
  label: string
  href: string
  icon: LucideIcon
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Students', href: '/students', icon: Users },
  { label: 'Games', href: '/games', icon: Gamepad2 },
  { label: 'Settings', href: '/settings', icon: Settings },
]
