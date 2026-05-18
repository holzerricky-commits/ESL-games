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
- **Layout:** Horizontal bar at `top-12 left-14 right-14`, centered, same frosted surface as the annotation rail
- **Wiring:** `FullscreenBookOverlayView` renders the bar beside `TopOverlayControls`; `AnnotationRail` keeps a single-column tool stack with `useContextStrip` on the toolbar (slimmer popovers, no rail strip)
- **Visibility:** Shown for pen, marker, shape, and eraser modes; hidden when `suppressChrome`, page list, or whiteboard is open
- **Popovers:** Same slimming as V1 — color and thickness on the top bar; dash, spectrum, and shape advanced options stay in popovers

## Shared rules (both experiments)

- Tool icons keep the active color dot on the button
- Custom spectrum and advanced shape fill/stroke stay in popovers
- Stamp, text, laser, eyedropper, etc. have no context bar

## Manual test (V2)

1. Open book overlay → select **Pen** → top bar shows ink swatches + thickness; pen popover has dash + custom color only
2. **Marker** / **shape** / **eraser** → bar updates; **stamp** → no bar
3. Open page list or whiteboard → bar hides
4. Capture hide chrome → bar respects `suppressChrome`
5. Left rail stays narrow (no side strip); popovers open toward the book without clipping under the top bar
