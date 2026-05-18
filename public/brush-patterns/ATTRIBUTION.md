# Brush pattern assets

Tiles in this folder are used as repeating pen ink patterns in the fullscreen book reader.

## Included patterns

| File | Pattern id | Source (personal import) |
|------|------------|--------------------------|
| `rainbow.png` | `rainbow` | Project-generated seamless HSL + sparkle (`scripts/generate-brush-rainbow-tile.ps1`). |
| `galaxy.png` | `galaxy` | User-supplied glitter texture (512×512). |
| `lava.png` | `lava` | [Lava texture](https://opengameart.org/content/lava-texture) (Lamoot, CC0) — `lava_texture.png`, resized to 512. |
| `ocean.png` | `ocean` | [Seamless water tiles](https://opengameart.org/content/seamless-water-tiles) (CC0) — `light_water_0.jpg`, resized to 512. |
| `silver.png` | `silver` | [Texture pack seamless - metal](https://opengameart.org/content/texture-pack-seamless-metalpng) (Heathal) — `metal.png`, resized to 512. |
| `gold.png` | `gold` | [Tileable metal textures](https://opengameart.org/content/tileable-metal-textures) (CC0) — `treadplate2.png`, resized to 512. |
| `bronze.png` | `bronze` | [Tileable metal textures](https://opengameart.org/content/tileable-metal-textures) (CC0) — `treadplate1.png`, resized to 512. |
| `rose-gold.png` | `rose-gold` | Warm tint derived from `gold.png` in-repo (for personal use). |

Bump `version` in `manifest.json` after replacing tiles so cached patterns reload in the app.

## Adding your own patterns

1. Export a **seamless** tile from Photoshop (same width/height; edges must match).
2. Save as PNG in this folder (e.g. `lava.png`) at **512×512** (match `tileSizePx` in `manifest.json`).
3. Add an entry to `manifest.json` with a unique `id`, `label`, `file`, and `fallbackColor` (hex used until the image loads and for storage fallback). Bump `version`.
4. If you want a new toolbar swatch, add one row in `lib/books/annotation-palettes.ts` with `patternId` matching the manifest `id`. Existing swatches pick up the PNG automatically — no code change in `pen-ink.ts`.

Recommended tile size: **512×512** (match `tileSizePx` in `manifest.json`).

## Photoshop seamless export (512×512)

1. **Canvas** — New file **512×512 px**, **sRGB**, 8-bit.
2. **Seamless tile** — Filter → Other → **Offset** (wrap around by half width/height, e.g. 256×256). Paint or paste so the **center cross** blends; repeat Offset until edges are invisible.
3. **Flatten** — Merge layers; avoid heavy outer glow that breaks tiling.
4. **Export** — File → Export → Export As → **PNG** (no transparency required unless you want it).
5. **App** — Save as `public/brush-patterns/{id}.png`, add manifest row, **bump `version`**, hard refresh.

The app preloads all manifest patterns when the fullscreen book opens and shows “Loading brush textures…” in the pen color popover until tiles are ready.
