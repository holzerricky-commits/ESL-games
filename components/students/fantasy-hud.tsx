'use client'

import Image from 'next/image'
import Link from 'next/link'

interface FantasyHUDProps {
  exitHref: string
  onOpenBook?: () => void
  isBookOverlayOpen?: boolean
}

export function FantasyHUD({ exitHref, onOpenBook, isBookOverlayOpen = false }: FantasyHUDProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="animate-map-hud-enter-top absolute inset-x-0 top-1 z-20 flex justify-center px-2 sm:top-2 sm:px-4">
        <div className="w-full max-w-[560px] sm:max-w-[600px]">
          <Image
            src="/HUD/Progress Bar.png"
            alt="Progress bar"
            width={1024}
            height={224}
            className="h-auto w-full select-none object-contain"
            priority
          />
        </div>
      </div>

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[150px] bg-gradient-to-t from-[#120a03]/55 via-[#120a03]/28 to-transparent transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:h-[185px] ${
          isBookOverlayOpen ? 'translate-y-[140%] opacity-0' : 'translate-y-0 opacity-100'
        }`}
      />

      <div
        className={`pointer-events-none animate-map-hud-enter-bottom absolute inset-x-0 bottom-1 z-10 flex justify-center px-2 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:bottom-2 sm:px-4 ${
          isBookOverlayOpen ? 'translate-y-[140%] opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="relative w-full max-w-[610px] sm:max-w-[740px] md:max-w-[800px]">
          <Image
            src="/HUD/Bottom.png"
            alt="Bottom fantasy HUD bar"
            width={1024}
            height={195}
            className="h-auto w-full select-none object-contain"
            priority
          />

          <div className="absolute inset-x-[9%] bottom-[20%] h-[56px] sm:h-[68px] md:h-[78px]">
            <Link
              href={exitHref}
              aria-label="Exit full-screen map"
              className="group pointer-events-auto absolute bottom-[8%] left-[10%] flex h-[48px] -translate-x-1/2 items-end justify-center transition-transform duration-300 ease-out hover:scale-[1.04] active:scale-[0.97] sm:h-[56px] md:h-[64px]"
            >
              <Image
                src="/HUD/Exit.png"
                alt="Exit full-screen map"
                width={160}
                height={190}
                className="h-full w-auto select-none object-contain transition-[filter] duration-300 ease-out drop-shadow-[0_0_8px_rgba(245,158,11,0.3)] group-hover:drop-shadow-[0_0_16px_rgba(251,191,36,0.55)] group-active:drop-shadow-[0_0_20px_rgba(251,191,36,0.72)]"
              />
            </Link>

            <button
              type="button"
              aria-label="Compass"
              className="group pointer-events-auto absolute bottom-[8%] left-[30%] flex h-[48px] -translate-x-1/2 items-end justify-center transition-transform duration-300 ease-out hover:scale-[1.04] active:scale-[0.97] sm:h-[56px] md:h-[64px]"
            >
              <Image
                src="/HUD/Compass.png"
                alt="Compass"
                width={512}
                height={597}
                className="h-full w-auto -translate-y-[2px] select-none object-contain transition-[filter] duration-300 ease-out drop-shadow-[0_0_8px_rgba(245,158,11,0.3)] group-hover:drop-shadow-[0_0_16px_rgba(251,191,36,0.55)] group-active:drop-shadow-[0_0_20px_rgba(251,191,36,0.72)]"
              />
            </button>

            <button
              type="button"
              aria-label="Open spell book"
              onClick={onOpenBook}
              className="group pointer-events-auto absolute bottom-[6%] left-1/2 flex h-[70px] -translate-x-1/2 items-end justify-center transition-transform duration-300 ease-out hover:scale-[1.04] active:scale-[0.97] sm:h-[82px] md:h-[96px]"
            >
              <Image
                src="/HUD/Book.png"
                alt="Open spell book"
                width={220}
                height={170}
                className="h-full w-auto -translate-y-[6px] select-none object-contain transition-[filter] duration-300 ease-out drop-shadow-[0_0_8px_rgba(245,158,11,0.3)] group-hover:drop-shadow-[0_0_16px_rgba(251,191,36,0.55)] group-active:drop-shadow-[0_0_20px_rgba(251,191,36,0.72)]"
              />
            </button>

            <button
              type="button"
              aria-label="Shop stall"
              className="group pointer-events-auto absolute bottom-[8%] left-[70%] flex h-[48px] -translate-x-1/2 items-end justify-center transition-transform duration-300 ease-out hover:scale-[1.04] active:scale-[0.97] sm:h-[56px] md:h-[64px]"
            >
              <Image
                src="/HUD/Shop.png"
                alt="Shop stall"
                width={512}
                height={512}
                className="h-full w-auto select-none object-contain transition-[filter] duration-300 ease-out drop-shadow-[0_0_8px_rgba(245,158,11,0.3)] group-hover:drop-shadow-[0_0_16px_rgba(251,191,36,0.55)] group-active:drop-shadow-[0_0_20px_rgba(251,191,36,0.72)]"
              />
            </button>

            <button
              type="button"
              aria-label="Adventurer backpack"
              className="group pointer-events-auto absolute bottom-[8%] left-[90%] flex h-[48px] -translate-x-1/2 items-end justify-center transition-transform duration-300 ease-out hover:scale-[1.04] active:scale-[0.97] sm:h-[56px] md:h-[64px]"
            >
              <Image
                src="/HUD/Backpack.png"
                alt="Adventurer backpack"
                width={220}
                height={180}
                className="h-full w-auto select-none object-contain transition-[filter] duration-300 ease-out drop-shadow-[0_0_8px_rgba(245,158,11,0.3)] group-hover:drop-shadow-[0_0_16px_rgba(251,191,36,0.55)] group-active:drop-shadow-[0_0_20px_rgba(251,191,36,0.72)]"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
