'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import { X, Play, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AnimationSettings } from '@/lib/types'
import {
  getAnimationSettings,
  saveAnimationSettings,
  DEFAULT_ANIMATION_SETTINGS,
} from '@/lib/storage'

interface AnimationPreset {
  id: string
  name: string
  description: string
}

const SUCCESS_PRESET: AnimationPreset = {
  id: 'gentle-sparkles',
  name: 'Gentle Sparkles',
  description: 'Soft rising neutral sparkles with a gentle pulse',
}

const PERFECT_PRESET: AnimationPreset = {
  id: 'fireworks-celebration',
  name: 'Fireworks Celebration',
  description: 'Colorful fireworks bursting + falling confetti with bright flashes',
}

const FAIL_PRESET: AnimationPreset = {
  id: 'warm-encouragement',
  name: 'Warm encouragement',
  description: 'Game-style stars (third red neon) with blue-green sparks and a soft looping backdrop',
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

function AnimationPreview({ presetId, category }: { presetId: string; category: 'success' | 'perfect' | 'fail' }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [particles, setParticles] = useState<
    Array<Record<string, string | number> & { id: string; type: string }>
  >([])

  const playAnimation = () => {
    if (isPlaying) return
    setIsPlaying(true)
    const newParticles: Array<Record<string, string | number> & { id: string; type: string }> = []

    if (category === 'success') {
      for (let i = 0; i < 15; i++) {
        newParticles.push({
          id: String(i),
          type: 'sparkle',
          x: 25 + Math.random() * 50,
          y: 80,
          endY: 10 + Math.random() * 20,
          size: 2 + Math.random() * 3,
          delay: (i / 15) * 0.3,
          duration: 1.5 + Math.random() * 0.5,
          color: '#facc15',
          opacity: 0.6 + Math.random() * 0.4,
        })
      }
    } else if (category === 'perfect') {
      const colors = ['#facc15', '#22c55e', '#3b82f6', '#f97316', '#a855f7']

      for (let i = 0; i < 25; i++) {
        const angle = (i / 25) * Math.PI * 2
        const distance = 20 + Math.random() * 30
        newParticles.push({
          id: `burst-${i}`,
          type: 'firework',
          x: 50,
          y: 40,
          endX: 50 + Math.cos(angle) * distance,
          endY: 40 + Math.sin(angle) * distance,
          size: 3 + Math.random() * 2,
          delay: 0,
          duration: 0.8,
          color: colors[Math.floor(Math.random() * colors.length)],
        })
      }

      for (let i = 0; i < 20; i++) {
        newParticles.push({
          id: `confetti-${i}`,
          type: 'confetti',
          x: 20 + Math.random() * 60,
          y: 20,
          endY: 90,
          sway: (Math.random() - 0.5) * 40,
          size: 3 + Math.random() * 3,
          delay: 0.5 + (i / 20) * 0.3,
          duration: 1.5 + Math.random() * 0.5,
          color: colors[Math.floor(Math.random() * colors.length)],
        })
      }
    } else if (category === 'fail') {
      newParticles.push({ id: 'enc-ambient', type: 'enc-ambient', delay: 0, duration: 3 })
      newParticles.push({ id: 'enc-loop-bg', type: 'enc-loop-bg', delay: 0, duration: 3 })
      newParticles.push({ id: 'enc-inset', type: 'enc-inset', delay: 0, duration: 3 })

      for (let i = 0; i < 10; i++) {
        newParticles.push({
          id: `enc-${i}`,
          type: 'enc-lift',
          x: 10 + Math.random() * 80,
          y: 70 + Math.random() * 18,
          delay: (i / 10) * 0.55,
          duration: 3.2 + Math.random() * 2.2,
          sway: (Math.random() - 0.5) * 32,
          rise: -(28 + Math.random() * 20),
          useOrange: Math.random() > 0.42 ? 1 : 0,
          size: 5 + Math.random() * 6,
        })
      }
    }

    setParticles(newParticles)

    const durationMs = category === 'fail' ? 11000 : 2500
    setTimeout(() => {
      setIsPlaying(false)
      setParticles([])
    }, durationMs)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={playAnimation}
        disabled={isPlaying}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--surface-3)] border border-[var(--border)] hover:bg-[var(--surface-4)] hover:border-[var(--brand-blue)] transition-colors disabled:opacity-50"
        title="Preview animation"
      >
        <Play size={14} className="text-[var(--brand-blue)]" fill="currentColor" />
      </button>

      {isPlaying && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
          {category === 'perfect' && (
            <div
              className="fixed inset-0 perfect-fx-flash"
              style={{
                background: 'rgba(250,204,21,0.2)',
                animation: 'flash-burst 0.5s ease-out',
                pointerEvents: 'none',
              }}
            />
          )}

          {particles.map((particle) => {
            if (particle.type === 'enc-ambient') {
              return <div key={particle.id} className="fixed inset-0 encouragement-fx-ambient" />
            }
            if (particle.type === 'enc-loop-bg') {
              return <div key={particle.id} className="fixed inset-0 encouragement-fx-loop-bg" />
            }
            if (particle.type === 'enc-inset') {
              return <div key={particle.id} className="fixed inset-0 encouragement-fx-inset" />
            }
            if (particle.type === 'enc-lift') {
              const redEmber = 'color-mix(in srgb, var(--brand-red) 68%, transparent)'
              const orangeEmber = 'color-mix(in srgb, var(--chart-4) 58%, transparent)'
              const useOrange = particle.useOrange === 1
              const emberColor = useOrange ? orangeEmber : redEmber
              return (
                <div
                  key={particle.id}
                  className="encouragement-fx-lift absolute rounded-full pointer-events-none"
                  style={
                    {
                      left: `${particle.x}%`,
                      top: `${particle.y}%`,
                      width: `${particle.size}px`,
                      height: `${particle.size}px`,
                      backgroundColor: emberColor,
                      boxShadow: `0 0 ${Number(particle.size) + 4}px ${emberColor}`,
                      animation: `encouragement-lift ${particle.duration}s ease-out forwards`,
                      animationDelay: `${particle.delay}s`,
                      '--enc-sway': `${particle.sway}px`,
                      '--enc-rise': `${particle.rise}vh`,
                    } as CSSProperties
                  }
                />
              )
            }
            if (particle.type === 'sparkle') {
              return (
                <div
                  key={particle.id}
                  className="absolute rounded-full"
                  style={
                    {
                      left: `${particle.x}%`,
                      top: `${particle.y}%`,
                      width: particle.size,
                      height: particle.size,
                      backgroundColor: particle.color as string,
                      opacity: particle.opacity as number,
                      boxShadow: `0 0 ${Number(particle.size) * 2}px ${particle.color}`,
                      animation: `rise-fade ${particle.duration}s ease-out forwards`,
                      animationDelay: `${particle.delay}s`,
                      '--rise-distance': `${(particle.endY as number) - (particle.y as number)}vh`,
                    } as CSSProperties
                  }
                />
              )
            }
            if (particle.type === 'firework') {
              return (
                <div
                  key={particle.id}
                  className="absolute rounded-full"
                  style={
                    {
                      left: `${particle.x}%`,
                      top: `${particle.y}%`,
                      width: particle.size,
                      height: particle.size,
                      backgroundColor: particle.color as string,
                      boxShadow: `0 0 ${Number(particle.size) * 3}px ${particle.color}`,
                      animation: `burst-out ${particle.duration}s ease-out forwards`,
                      animationDelay: `${particle.delay}s`,
                      '--burst-end-x': `${(particle.endX as number) - (particle.x as number)}vw`,
                      '--burst-end-y': `${(particle.endY as number) - (particle.y as number)}vh`,
                    } as CSSProperties
                  }
                />
              )
            }
            if (particle.type === 'confetti') {
              return (
                <div
                  key={particle.id}
                  className="absolute rounded-full"
                  style={
                    {
                      left: `${particle.x}%`,
                      top: `${particle.y}%`,
                      width: particle.size,
                      height: particle.size,
                      backgroundColor: particle.color as string,
                      animation: `fall-sway ${particle.duration}s ease-in forwards`,
                      animationDelay: `${particle.delay}s`,
                      '--fall-distance': `${(particle.endY as number) - (particle.y as number)}vh`,
                      '--sway-distance': `${particle.sway}vw`,
                    } as CSSProperties
                  }
                />
              )
            }
            return null
          })}
        </div>
      )}
    </div>
  )
}

function PresetCard({
  preset,
  isSelected,
  onSelect,
  category,
}: {
  preset: AnimationPreset
  isSelected: boolean
  onSelect: () => void
  category: 'success' | 'perfect' | 'fail'
}) {
  return (
    <div
      className={`rounded-xl border-2 p-4 transition-colors ${
        isSelected
          ? 'border-[var(--brand-blue)] bg-[var(--surface-3)]'
          : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand-blue)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground text-sm">{preset.name}</h4>
          <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
        </div>
        {isSelected && <Check size={18} className="text-[var(--brand-blue)] shrink-0" />}
      </div>

      <div className="flex gap-2">
        <AnimationPreview presetId={preset.id} category={category} />
        <button
          type="button"
          onClick={onSelect}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
            isSelected
              ? 'bg-[var(--brand-blue)] text-white'
              : 'bg-[var(--surface-3)] border border-[var(--border)] text-foreground hover:bg-[var(--surface-4)] hover:border-[var(--brand-blue)]'
          }`}
        >
          {isSelected ? 'Selected' : 'Select'}
        </button>
      </div>
    </div>
  )
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<AnimationSettings>(() => ({ ...DEFAULT_ANIMATION_SETTINGS }))

  useEffect(() => {
    if (isOpen) {
      setSettings(getAnimationSettings())
    }
  }, [isOpen])

  const handleSelectAnimation = (category: 'success' | 'perfect' | 'fail', presetId: string) => {
    const newSettings = { ...settings, [category]: presetId }
    setSettings(newSettings)
    saveAnimationSettings(newSettings)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--surface-3)] transition-colors text-muted-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div>
            <h3 className="text-lg font-bold text-foreground mb-1">Animations</h3>
            <p className="text-sm text-muted-foreground">Choose animations for different quiz outcomes</p>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">Success animation</h4>
            <p className="text-xs text-muted-foreground">Plays when student passes (but not perfect)</p>
            <PresetCard
              preset={SUCCESS_PRESET}
              isSelected={settings.success === SUCCESS_PRESET.id}
              onSelect={() => handleSelectAnimation('success', SUCCESS_PRESET.id)}
              category="success"
            />
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">Perfect score animation</h4>
            <p className="text-xs text-muted-foreground">Plays when student gets 100%</p>
            <PresetCard
              preset={PERFECT_PRESET}
              isSelected={settings.perfect === PERFECT_PRESET.id}
              onSelect={() => handleSelectAnimation('perfect', PERFECT_PRESET.id)}
              category="perfect"
            />
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">Encouragement animation</h4>
            <p className="text-xs text-muted-foreground">Plays when student does not pass</p>
            <PresetCard
              preset={FAIL_PRESET}
              isSelected={settings.fail === FAIL_PRESET.id}
              onSelect={() => handleSelectAnimation('fail', FAIL_PRESET.id)}
              category="fail"
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-3 justify-end px-6 py-4 border-t border-[var(--border)] bg-[var(--card)]">
          <Button
            onClick={onClose}
            className="bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-bright)] text-white font-bold"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
