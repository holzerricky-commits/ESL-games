import type { ReactNode } from 'react'
import { AppShell } from '@/components/app-shell'

interface TeacherLayoutProps {
  children: ReactNode
}

export default function TeacherLayout({ children }: TeacherLayoutProps) {
  return <AppShell>{children}</AppShell>
}
