'use client'

import { Suspense, useState, type ReactNode } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { AppTopbar } from '@/components/app-topbar'
import { ClassUpcomingReminder } from '@/components/class-upcoming-reminder'
import { ClassAutoStartReconciler } from '@/components/class-auto-start-reconciler'
import { LocalStudentDataHydrator } from '@/components/local-student-data-hydrator'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  // Start collapsed (icons only); expand from the header button
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  return (
    <div className="min-h-screen w-full bg-background">
      <AppTopbar
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
      />
      <div className="flex w-full">
        <AppSidebar collapsed={sidebarCollapsed} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full">{children}</div>
        </main>
      </div>
      <LocalStudentDataHydrator />
      <ClassAutoStartReconciler />
      <Suspense fallback={null}>
        <ClassUpcomingReminder />
      </Suspense>
    </div>
  )
}
