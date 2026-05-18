# Brush patterns — phased implementation plan

**Goal:** OneNote-style effect pens using **your own seamless tiles** from `public/brush-patterns/`, with reliable drawing in **single-page and two-page spread** modes.

**Milestone tie-in:** Phase 1 lesson ritual — teacher can annotate the book during class without broken pens.

**Status:** Phases 0–4 complete.

---

## Folder layout (Phase 0 — done)

```
public/brush-patterns/
  manifest.json      # ids, labels, filenames, fallback colors, tileSizePx
  ATTRIBUTION.md     # licenses and sources
  rainbow.png        # 192×192, CC0 (OpenGameArt)
  galaxy.png         # 192×192, CC0 (OpenGameArt)
```

You add more PNGs later and extend `manifest.json` (see `ATTRIBUTION.md`).

---

## Phase 1 — Fix spread drawing (bugfix) — done

**Invariant (see `.cursor/rules/spread-effect-pen-ink.mdc`):**

- Live preview: `draft.points` → `splitSpreadNormPolylineToPageNormalizedChains` → page layer `setLiveStrokeDraft` (same path as commit).
- Commit: same split on `draft.points` — **not** client-space split for pen/marker.

---

## Phase 2 — Image-based tiles for rainbow & galaxy — done

**Keep** procedural tiles for lava, ocean, metallics until you add PNGs (Phase 3).

**Tasks**

1. Add `lib/books/brush-pattern-manifest.ts`:
   - Load `/brush-patterns/manifest.json` (fetch or static import).
   - Types: `BrushPatternId`, `BrushPatternEntry`, `getBrushPattern(id)`.
2. Add `lib/books/brush-pattern-loader.ts`:
   - `loadBrushPatternTile(id): Promise<HTMLCanvasElement | null>` — cache by id + revision.
   - Scale loaded image to `manifest.tileSizePx` (192).
   - `preloadBrushPatterns(ids: string[])` for book open.
3. Refactor `lib/books/pen-ink.ts`:
   - For `rainbow` and `galaxy`, use loader instead of `paintRainbowTile` / `paintGalaxyTile`.
   - `applyPenStrokeStyle`: if tile not ready, use `fallbackColor` from manifest; optional async repaint when load completes (page layer `paint()` refresh).
   - Guard `pattern.setTransform` (feature-detect or try/catch → no transform, still stroke).
4. Update `penSwatchPreviewStyle` for rainbow/galaxy to `url(/brush-patterns/rainbow.png)` repeat (match manifest paths).
5. Unit test: manifest parses; loader returns canvas with expected dimensions (mock `Image` in vitest if needed).

**Exit criteria:** Rainbow and galaxy match manifest files; no regression on solids; spread fix from Phase 1 still holds.

**Files:** `lib/books/pen-ink.ts`, new loader/manifest modules, `lib/books/annotation-palettes.ts` (preview only if needed).

---

## Phase 3 — Manifest-driven palette & your custom patterns — done

**Implemented**

1. `penInkStyle` on stored strokes accepts **`solid`**, any **`manifest.json` id**, or procedural ids (`lava`, `ocean`, metallics) until a PNG exists.
2. `isPenInkStyle` / `isProceduralBrushPattern` — manifest ids win over procedural when both exist.
3. `annotation-palettes.ts` swatches use **`patternId`** (stored as `penInkStyle`).
4. Adding a brush: drop `public/brush-patterns/{id}.png`, add manifest row (+ optional palette row if new swatch).

**Exit criteria:** Adding `public/brush-patterns/lava.png` + manifest entry (+ palette row if needed) is enough — no `pen-ink.ts` change.

---

## Phase 4 — Polish — done

- **Preload:** `preloadAllManifestBrushPatterns()` when fullscreen overlay opens (`useFullscreenBookOverlayController`) and when a book unit loads (`BookCanvasStage`).
- **Loading UI:** Pen color popover shows “Loading brush textures…” / “Preparing selected brush…” via `useBrushPatternPreload` + `PenColorSwatchGrid`.
- **Cache bust:** Asset tiles keyed by `manifest.json` `version`; procedural tiles use `PEN_INK_TILE_REVISION` (`{version}-p{proceduralRev}`).
- **Docs:** Photoshop seamless workflow in `public/brush-patterns/ATTRIBUTION.md`.
- Procedural galaxy/rainbow painters removed in Phase 2 (PNG-only).

---

## What we are **not** doing in these phases

- Student-facing pattern editor or in-app tile upload.
- Automatic directory scanning without `manifest.json` (explicit manifest keeps palette and storage predictable).
- Perfect pattern alignment across spread seam beyond current page-origin + phase model (good enough for v1).

---

## Suggested order of work

| Order | Phase | Effort (rough) |
|-------|--------|----------------|
| 1 | Phase 1 — spread fix | Small |
| 2 | Phase 2 — image loader + rainbow/galaxy | Medium |
| 3 | Phase 3 — manifest-driven ids + your new PNGs | Medium |
| 4 | Phase 4 — polish | Small, optional |

---

## Parking lot (later)

- SVG patterns (canvas `createPattern` needs bitmap; rasterize or skip).
- High-DPI tiles (384×384) with `tileSizePx` in manifest.
- Marker/highlighter textured fills (separate from pen stroke path).

---

## Phase 0 checklist (completed)

- [x] `public/brush-patterns/` created
- [x] `manifest.json` with `rainbow` and `galaxy`
- [x] CC0 starter tiles downloaded and resized to 192×192
- [x] `ATTRIBUTION.md` with sources and add-your-own steps
- [x] This phased plan document

**Next:** Add custom PNGs (lava/ocean/etc.) via manifest + palette row only; see `ATTRIBUTION.md`.
