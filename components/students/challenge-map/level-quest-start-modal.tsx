'use client'

import Image from 'next/image'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useMemo } from 'react'
import type { ChallengeMapNode } from '@/lib/students/challenge-map'
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const POPUP_SRC = '/Level%20Pop%20Up/Pop%20Up%20Empty.png'
const START_BUTTON_SRC = '/Level%20Pop%20Up/Start%20Quest%20Button.png'

export interface LevelQuestStartModalProps {
  open: boolean
  node: ChallengeMapNode | null
  onClose: () => void
  /** Called when the player confirms; navigate client-side to this href. */
  onStartQuest: (href: string) => void
}

export function LevelQuestStartModal({ open, node, onClose, onStartQuest }: LevelQuestStartModalProps) {
  const canStart = Boolean(node?.launchHref && node.status !== 'locked')

  const lockedHint = useMemo(() => {
    if (!node || node.status !== 'locked') return ''
    return node.unlockHint ?? 'Complete the previous challenge to unlock this mission.'
  }, [node])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPortal>
        <DialogOverlay className="z-[100] bg-black/55 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-[101] w-[min(96vw,52rem)] max-h-[min(92dvh,1280px)] -translate-x-1/2 -translate-y-1/2',
            'border-none bg-transparent p-0 shadow-none outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200',
          )}
          onPointerDownOutside={() => onClose()}
          onEscapeKeyDown={() => onClose()}
        >
          <DialogPrimitive.Title className="sr-only">
            {node ? `Begin the quest: ${node.title}` : 'Begin the quest'}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {node
              ? node.status === 'locked'
                ? `Mission locked. ${node.unlockHint ?? ''}`
                : `Preview step ${node.stepNumber} before starting.`
              : ''}
          </DialogPrimitive.Description>

          {node ? (
            <div key={node.id} className="relative mx-auto w-full">
              <div className="animate-level-quest-panel relative">
                <Image
                  src={POPUP_SRC}
                  alt=""
                  width={1280}
                  height={1040}
                  className="pointer-events-none h-auto w-full select-none"
                  priority
                />
                <div
                  className="pointer-events-none absolute inset-x-[9%] top-[24%] bottom-[40%] flex flex-col items-center justify-center gap-3 px-3 text-center"
                  aria-hidden
                >
                  <p className="text-xl font-bold uppercase tracking-[0.12em] text-[#5a350c]/90 sm:text-2xl">
                    Step {node.stepNumber}
                  </p>
                  <p className="line-clamp-3 text-2xl font-semibold text-[#3d2914] sm:text-3xl">{node.title}</p>
                  {node.status !== 'locked' ? (
                    <p className="text-lg text-[#5a4024]/90 sm:text-xl">
                      Reward <span className="font-bold">+{node.reward}</span> coins
                    </p>
                  ) : (
                    <p className="text-lg leading-snug text-[#6b4a30] sm:text-xl">{lockedHint}</p>
                  )}
                </div>
              </div>

              <div className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 translate-y-1/2">
                {canStart ? (
                  <div className="animate-level-quest-button w-[min(96vw,420px)] max-w-[420px]">
                    <button
                      type="button"
                      className="block w-full cursor-pointer rounded-full border-none bg-transparent p-0 shadow-[0_10px_30px_rgba(0,0,0,0.36)] transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1324] focus-visible:outline-none"
                      onClick={() => {
                        if (node.launchHref) onStartQuest(node.launchHref)
                      }}
                    >
                      <Image
                        src={START_BUTTON_SRC}
                        alt="Start quest"
                        width={840}
                        height={180}
                        className="h-auto w-full"
                      />
                    </button>
                  </div>
                ) : (
                  <div className="animate-level-quest-button rounded-full bg-[#1e2946]/95 px-8 py-4 text-center shadow-lg ring-1 ring-[var(--border)] backdrop-blur-sm">
                    <p className="text-base font-semibold text-foreground sm:text-lg">Mission locked</p>
                    <button
                      type="button"
                      className="mt-2.5 text-xs font-medium text-[var(--brand-blue)] underline-offset-2 hover:underline sm:text-sm"
                      onClick={onClose}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
