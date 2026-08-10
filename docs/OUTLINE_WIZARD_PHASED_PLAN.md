# Outline wizard — phased improvements

Stable product intent: teachers bring their own book PDF; outline setup must work across book shapes (not only Journeys/Wonders recipes).

## Storyline (5)

1. **Auto TOC detect** — propose contents page range + confirm  
2. **Page alignment engine** — auto-suggest printed ↔ PDF sync + confirm  
3. **Adaptive outline from front matter** — flexible tree (lesson level optional)  
4. **Sample unit peek** — deepen tree from one unit’s inner pattern  
5. **Polish** — after real uploads only  

## Build checklist

### Phase 1a — Auto TOC propose + confirm *(current)*

- [x] Score early pages for contents / scope likeness (selectable text)
- [x] Propose contiguous PDF range; stop early after TOC block when body starts
- [x] Structure wizard: auto-scan on open (TOC step), message + From/To fill, Find again / Use suggestion
- [x] Manual From/To always available (scans with no text)

**Test:** Open outline wizard on a digital PDF with a real TOC → suggested range appears and preview jumps there. Scan-only PDF → clear “set by hand” message.

### Phase 1b — Stronger multi-page front packs (later)

- [ ] Prefer Contents + Scope + Skills as one pack when present
- [ ] Tune early-stop / scoring on more series

### Phase 2a / 2b — Alignment

- [ ] Auto-suggest offset / not-counted from printed numbers  
- [ ] Checkpoint jumps to confirm  

### Phase 3a–3c — Adaptive extract

- [ ] Generic flexible tree; merge multi-page front matter; keep series recipes as fallback  

### Phase 4a / 4b — Unit peek

- [ ] Peek Unit 1 → pattern; apply to all readings  

---

Last updated: 2026-08-10 — Phase 1a shipped in code.
