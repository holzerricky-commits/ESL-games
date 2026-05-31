# Annotation context strip experiments

Two branches from `main` explore where pen/marker/shape/eraser color and thickness controls should live beside the book overlay. No merge to `main` until one approach is chosen.

## Branches

| Branch | UI |
|--------|-----|
| `experiment/annotation-context-strip-v1` | Rail-adjacent vertical strip (`AnnotationContextStrip`) inside the expanded annotation rail shell |
| `experiment/annotation-context-strip-topbar` | Horizontal top options bar (`AnnotationTopOptionsBar`) under top chrome |

## V1 — rail-adjacent strip

- **Component:** `components/students/annotation-context-strip.tsx`
- **Layout:** `AnnotationRail` uses `flex-row`: tools column + context strip (~4.75rem), same `ANNOTATION_RAIL_SURFACE`, `border-l border-white/10`
- **Visibility:** Strip only when rail is expanded and mode is pen, marker, shape, or eraser; hidden on collapsed peek tab
- **Popovers:** `BookAnnotationToolbar` with `useContextStrip` keeps dash/spectrum/shape grids in popovers; color + thickness move to the strip

## V2 — top options bar (this branch)

- **Component:** `components/students/annotation-top-options-bar.tsx`
- **Primitives:** `annotation-top-strip-color-cluster.tsx`, `annotation-top-strip-palette-dropdown.tsx`, `annotation-top-strip-controls.tsx` (`TopStripCycleChip` and tool chips), `annotation-top-strip-stamp-cluster.tsx`
- **Layout:** Centered **peninsula** flush with viewport top (`top-0`, `w-max`, `rounded-b-xl` only, `h-10`). **Active color** (or stamp preview) + up to **4 recents** + chevron (opens top dropdown, not left-rail popover); cycle chips for enums; fixed **9rem** thickness slot; trailing **pin grip** (`z-[65]`). Page list / whiteboard at `top-14` (`z-[60]`)
- **Recents:** `sessionStorage` via `lib/books/annotation-strip-recents.ts` (pen, marker, shape stroke, text, sticky); updated when picking colors
- **Animation:** Clip wrapper at top edge; strip slides in/out with `translate-y` (not a floating island)
- **Auto-hide:** After ~3s idle, strip slides up; hover top edge (`h-3` peek zone) or **1px hairline** when hidden to reveal; pin grip persists preference in `localStorage` (`esl-top-options-bar-pinned`); palette dropdown open keeps bar visible
- **Wiring:** `FullscreenBookOverlayView` renders the bar at overlay root; close button at `right-3 top-14`; `AnnotationRail` uses `useContextStrip` — rail buttons **activate tool only** (no duplicate color/thickness popovers)
- **Class timer:** `ClassSessionMapTimer` at `right-3 top-3`, `elevated` when book overlay is open so it stays visible
- **Top bar tools:** pen, marker, shapes (kind + fill + stroke/fill colors), eraser (mode + thickness), stamp, text, sticky, callout (stroke color), eyedropper (variant chip)
- **Excluded:** laser — toolbar button only, no top bar
- **Eyedropper rail:** click activates; long-press / right-click still opens variant picker on the rail (advanced entry)

## Shared rules (both experiments)

- Tool icons keep the active color dot on the button
- Custom spectrum lives in the top dropdown (`variant="strip"`) when using V2

## Manual test (V2)

1. Each drawing tool above → peninsula appears; idle ~3s → hides; top edge hover → reveals; pin works
2. Chevron opens dropdown **down from top bar** (not left rail)
3. Switching tools closes palette dropdown and resets idle timer
4. Left rail: pen/marker/shapes/stamp/text/sticky/eraser = activate only; eyedropper keeps long-press menu
5. Laser → no top bar
6. Shapes: kind chip + fill chip + stroke/fill colors coherent on canvas
7. Text: plain vs filled — fill swatches in dropdown only when filled
8. Page list / whiteboard → bar hidden
