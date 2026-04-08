'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GameComingSoonProps {
  title: string
  description: string
  coverImage: string
}

export function GameComingSoon({ title, description, coverImage }: GameComingSoonProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-[var(--border)] bg-[var(--surface-2)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Button variant="outline" size="sm" asChild className="border-[var(--border)] gap-2 shrink-0">
            <Link href="/games">
              <ArrowLeft size={16} />
              Games
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">{title}</h1>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="relative mb-8 aspect-[21/9] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-3)]">
          <Image src={coverImage} alt="" width={1200} height={514} className="h-full w-full object-cover opacity-80" />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 p-6 text-center backdrop-blur-[2px]">
            <Sparkles className="mb-3 h-10 w-10 text-[var(--brand-blue-bright)]" />
            <p className="text-xl font-bold text-foreground">Under construction</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          This game will get its own dashboard and tools in a future update. For now, try{' '}
          <Link href="/games/timed-challenge" className="font-semibold text-[var(--brand-blue-bright)] underline-offset-4 hover:underline">
            Timed Challenge
          </Link>
          .
        </p>
      </main>
    </div>
  )
}
