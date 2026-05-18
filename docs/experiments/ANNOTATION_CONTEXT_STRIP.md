# Annotation context strip experiments

Two branches from `main` explore where pen/marker/shape/eraser color and thickness controls should live beside the book overlay. No merge to `main` until one approach is chosen.

## Branches

| Branch | UI |
|--------|-----|
| `experiment/annotation-context-strip-v1` | Rail-adjacent vertical strip (`AnnotationContextStrip`) inside the expanded annotation rail shell |
| `experiment/annotation-context-strip-topbar` | Horizontal options bar under top chrome (placeholder only) |

## V1 — rail-adjacent strip

- **Component:** `components/students/annotation-context-strip.tsx`
- **Layout:** `AnnotationRail` uses `flex-row`: tools column + context strip (~4.75rem), same `ANNOTATION_RAIL_SURFACE`, `border-l border-white/10`
- **Visibility:** Strip only when rail is expanded and mode is pen, marker, shape, or eraser; hidden on collapsed peek tab
- **Popovers:** `BookAnnotationToolbar` with `useContextStrip` keeps dash/spectrum/shape grids in popovers; color + thickness move to the strip

## Top bar — future work (this branch)

- **Component:** `components/students/annotation-top-options-bar.tsx` (shell, not wired)
- **Target placement:** Horizontal band under `TopOverlayControls` (`top-12 left-14 right-14`), mirroring V1 controls in a single row
- **Goal:** Photoshop-style “options bar” for the active tool without widening the left rail

## Shared rules (both experiments)

- Tool icons keep the active color dot on the button
- Custom spectrum and advanced shape fill/stroke stay in popovers for V1
- Stamp, text, laser, eyedropper, etc. have no context strip in V1

## Manual test (V1)

1. Open book overlay → expanded rail → **Pen** → strip shows color + thickness; pen popover has dash + custom color only
2. **Marker** / **shape** / **eraser** → strip updates; **stamp** → no strip
3. Collapse rail (`` ` ``) → strip hidden with tools
4. Lesson-paper / capture hide chrome → strip respects `suppressChrome` via rail
5. Popovers open left toward the book and do not clip under the strip
