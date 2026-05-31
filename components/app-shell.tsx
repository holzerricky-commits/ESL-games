'use client'

import { Suspense, useState, type ReactNode } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { AppTopbar } from '@/components/app-topbar'
import { ClassUpcomingReminder } from '@/components/class-upcoming-reminder'
import { LocalStudentDataHydrator } from '@/components/local-student-data-hydrator'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="min-h-screen w-full bg-background">
      <AppTopbar />
      <div className="flex w-full">
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
      <LocalStudentDataHydrator />
      <Suspense fallback={null}>
        <ClassUpcomingReminder />
      </Suspense>
    </div>
  )
}
