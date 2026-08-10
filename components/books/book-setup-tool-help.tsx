'use client'

import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface BookSetupToolHelpProps {
  title: string
  subtitle: string
  detail: string
  className?: string
  children?: React.ReactNode
}

export function BookSetupToolHelp({ title, subtitle, detail, className, children }: BookSetupToolHelpProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6 shrink-0 text-muted-foreground"
                  aria-label={`About ${title}`}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="max-w-sm text-sm">
                {detail}
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}
