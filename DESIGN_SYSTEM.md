# DESIGN_SYSTEM

## Overall Design Philosophy

The app is a **light-first, teacher-led classroom interface** optimized for calm prep and clarity during live sessions.

- **Light is default**: warm off-white page background, white panels, hairline borders only where structure is needed.
- **Flat over nested**: one surface level per view block; spacing and typography replace box-in-box layouts.
- **Icons over paragraphs**: secondary actions use subtle icon buttons with tooltips; text labels reserved for primary CTAs (Start, Save, Stop).
- **Color as meaning**: blue = primary flow, green = success, red = incorrect/destructive, amber = highlight/wallet.
- **Readable at distance**: timers, scores, and question prompts stay large during quiz/play (screen-share rule).
- **Minimal motion**: no decorative glows or gradient blobs on prep screens; quiz outcome FX may animate.

**Exception:** Fullscreen book / class session overlay keeps its own dark glass + golden mat aesthetic — independent of the teacher shell.

---

## Color Palette

### Active Design Tokens (single source of truth)

Only tokens below are considered active design-system color tokens (`app/globals.css` `:root` for light; `.dark` block preserved for future toggle).

| Token | Light hex | Semantic Use |
|---|---|---|
| `--background` | `#F7F7F5` | Page canvas (warm off-white) |
| `--foreground` | `#1A1A18` | Primary readable text |
| `--card` | `#FFFFFF` | Card and modal panel background |
| `--card-foreground` | `#1A1A18` | Text on card surfaces |
| `--popover` | `#FFFFFF` | Floating panel surface |
| `--primary` | `#3B6FD4` | Primary interactive color |
| `--primary-foreground` | `#FFFFFF` | Text/icon on primary |
| `--secondary` | `#F0F0EC` | Secondary surface/action |
| `--muted` | `#F0F0EC` | Quiet UI regions |
| `--muted-foreground` | `#6B6B63` | Secondary/meta text |
| `--accent` | `#EEF3FB` | Subtle highlight surface |
| `--destructive` | `#D64555` | Destructive/error base |
| `--border` | `#E8E8E4` | Hairline borders (sidebar, inputs, tables) |
| `--input` | `#E8E8E4` | Input baseline border |
| `--ring` | `#3B6FD4` | Focus ring |
| `--brand-blue` | `#3B6FD4` | Primary CTA color |
| `--brand-green` | `#2D9B78` | Success/Correct |
| `--brand-yellow` | `#C4923A` | Celebration/highlight |
| `--brand-red` | `#D64555` | Incorrect/danger |
| `--surface-1` | `#F7F7F5` | Page canvas |
| `--surface-2` | `#FFFFFF` | Primary panel |
| `--surface-3` | `#F0F0EC` | Nested tone (no extra border) |
| `--surface-4` | `#E8E8E4` | Strong hover/elevated tone |

Dark palette values live in `.dark { ... }` (legacy storybook-night).

---

## Typography

- **Primary sans**: Inter (`--font-inter`) mapped to `--font-sans`.
- **Monospace**: Space Mono for timers and tabular metrics only.
- **Weight**: `font-semibold` for section titles; `font-black` reserved for quiz timer, score, and countdown hero.

---

## Spacing & Layout Rules

### Container and rhythm

- Primary layouts: centered `max-w-7xl`, horizontal padding `px-4 sm:px-6 lg:px-8`.
- Section spacing: `space-y-6` between major blocks; `gap-3` within rows.

### Radius

- Token base: `--radius: 0.5rem`.
- `rounded-lg` for controls; `rounded-xl` for modals only when needed.

### Layout simplification (strict)

1. **One bordered container per view block** — never border inside border.
2. Use `.ui-section`, `.ui-row`, `.ui-section-title`, `.ui-icon-btn` utilities from `globals.css`.
3. Prefer `space-y-*` and muted text over helper paragraphs.
4. Stat displays: inline icon + value row, not framed mini-cards.
5. No decorative gradient blobs or glow on dashboard/shell pages.

---

## Component Style Guidelines

### Buttons

- **Primary CTA**: `primary` fill, white text, semibold label.
- **Secondary**: ghost or outline; icon-only with `title` for utility actions.
- **Danger**: `destructive` variant only for irreversible actions.

### Cards

- Default Card has light border + subtle shadow; avoid nesting Card inside bordered sections.
- Prefer flat `.ui-section` for list pages.

### Tabs

- Underline or minimal pill style; avoid boxed TabsList on profile/plan pages.

### Modals

- White shell on blurred backdrop; sticky footer for primary action.

### Icons

- `lucide-react` only; size 16–18 for shell controls.

---

## Theme Rules

- App opens **light** by default (`:root` tokens).
- `.dark` class + block preserved for future user toggle.
- Fullscreen book overlay CSS is scoped and does not depend on shell theme.

---

## Classroom Screen-Share Optimization

- Timer, score, question prompt, and answer controls stay large and high contrast during quiz/play.
- One primary action per decision area (Start, Save, Retry, Back).
- Modal spacing adequate for projected screens.

---

## Implementation Rules

1. **No new hex in feature components** without adding a named token in `app/globals.css` and documenting here.
2. **No nested bordered containers** in new work.
3. **Icon + tooltip** for secondary actions; text label for classroom-critical primary actions.
4. **Feature additions** that introduce a new visual pattern must update this file in the same change.
