# DESIGN_SYSTEM

## Overall Design Philosophy

The app is a **dark-first, teacher-led classroom interface** optimized for speed, clarity, and confidence during live sessions.

- **Dark is default and intentional**: all core screens are designed against deep surfaces with bright semantic accents.
- **Decision velocity over decoration**: every screen favors immediate action visibility (start, stop, save, score, retry).
- **Color as meaning**: blue = primary flow, green = success, red = incorrect/destructive, yellow = highlight/celebration.
- **Readable at distance**: headings, timers, and score numbers are intentionally bold and large for screen sharing.
- **Playful but controlled motion**: animation supports engagement and feedback without reducing functional clarity.

---

## Color Palette

### Active Design Tokens (single source of truth)

Only tokens below are considered active design-system color tokens for this app (`app/globals.css`).

| Token | Hex | Semantic Use |
|---|---|---|
| `--background` | `#0a0f1a` | Base app background |
| `--foreground` | `#e8f0fe` | Primary readable text |
| `--card` | `#0f1829` | Card and modal panel background |
| `--card-foreground` | `#e8f0fe` | Text on card surfaces |
| `--popover` | `#0f1829` | Floating panel surface |
| `--popover-foreground` | `#e8f0fe` | Text on popovers |
| `--primary` | `#3b82f6` | Primary interactive color |
| `--primary-foreground` | `#ffffff` | Text/icon on primary |
| `--secondary` | `#1e293b` | Secondary surface/action |
| `--secondary-foreground` | `#e8f0fe` | Text on secondary |
| `--muted` | `#1e293b` | Quiet UI regions |
| `--muted-foreground` | `#64748b` | Secondary/meta text |
| `--accent` | `#facc15` | Highlight/attention |
| `--accent-foreground` | `#0a0f1a` | Text on accent |
| `--destructive` | `#ef4444` | Destructive/error base |
| `--destructive-foreground` | `#ffffff` | Text on destructive |
| `--border` | `#1e3a5f` | Structural borders/dividers |
| `--input` | `#1e293b` | Input baseline surface |
| `--ring` | `#3b82f6` | Focus ring |
| `--brand-blue` | `#3b82f6` | Primary CTA color |
| `--brand-blue-bright` | `#60a5fa` | Primary hover/brighter state |
| `--brand-green` | `#22c55e` | Success/Correct |
| `--brand-green-bright` | `#4ade80` | Success hover |
| `--brand-yellow` | `#facc15` | Celebration/highlight |
| `--brand-red` | `#ef4444` | Incorrect/danger |
| `--surface-1` | `#0a0f1a` | Deepest page canvas |
| `--surface-2` | `#0f1829` | Header/footer/modal shell |
| `--surface-3` | `#1e293b` | Nested panel/input area |
| `--surface-4` | `#1e3a5f` | Strong hover/elevated panel |
| `--chart-1` | `#3b82f6` | Data/chart color 1 |
| `--chart-2` | `#22c55e` | Data/chart color 2 |
| `--chart-3` | `#facc15` | Data/chart color 3 |
| `--chart-4` | `#f97316` | Data/chart color 4 |
| `--chart-5` | `#a855f7` | Data/chart color 5 |
| `--sidebar` | `#0f1829` | Sidebar surface |
| `--sidebar-foreground` | `#e8f0fe` | Sidebar text |
| `--sidebar-primary` | `#3b82f6` | Sidebar emphasis |
| `--sidebar-primary-foreground` | `#ffffff` | Sidebar emphasis text |
| `--sidebar-accent` | `#1e293b` | Sidebar secondary surface |
| `--sidebar-accent-foreground` | `#e8f0fe` | Sidebar secondary text |
| `--sidebar-border` | `#1e3a5f` | Sidebar border |
| `--sidebar-ring` | `#3b82f6` | Sidebar focus ring |

### Controlled non-token colors currently used

These are allowed only for animation particles/effects unless promoted to tokens:

- `#ec4899`, `#eab308`
- Alpha overlays: `bg-black/60`, `bg-black/70`, `bg-black/80`
- Controlled glow alphas around existing token hues

---

## Typography

### Font families

- **Primary sans**: Inter (`--font-inter`) mapped to `--font-sans`.
- **Monospace**: Space Mono (`--font-space-mono`) mapped to `--font-mono`.
- `font-sans antialiased` is the global default.

### Type scale currently in use

| Usage | Size | Weight | Notes |
|---|---|---|---|
| Metadata / helper | `text-xs` | `font-medium` / `font-semibold` | quiet support text |
| Standard UI body | `text-sm` | `font-medium` / `font-semibold` | labels and content rows |
| Input/body base | `text-base` | regular-bold | default readable base |
| Local emphasis | `text-lg` | `font-bold` | compact emphasis |
| Section titles / prompts | `text-2xl` | `font-bold` | often `leading-tight` |
| High-action controls | `text-xl` | `font-bold` to `font-black` | answer controls/major CTA |
| Score display | `text-3xl` to `text-8xl` | `font-black` | high-visibility numerals |
| Countdown hero | `clamp(8rem, 25vw, 20rem)` | `font-black` mono | maximum attention |

### Typography behavior rules

- Monospace is reserved for machine-like values (timer, compact counts, tabular metrics).
- `font-black` is reserved for urgency states (timer, score, correctness actions).
- Secondary info must use `text-muted-foreground`, not custom gray values.

---

## Spacing & Layout Rules

### Container and rhythm

- Primary layouts use centered max-width containers:
  - Dashboard: `max-w-7xl`
  - Results: `max-w-5xl`
  - Quiz creation modal: `max-w-3xl`
- Standard horizontal padding: `px-6`.
- Standard section spacing:
  - Headers/toolbars: `py-4`
  - Main blocks: `py-8` to `py-10`
  - Internal rhythm: `gap-3` to `gap-6`

### Radius and shape

- Token base radius: `--radius: 0.75rem`.
- Practical component tiers:
  - `rounded-xl` for controls/sub-panels
  - `rounded-2xl` for cards and major blocks
  - `rounded-3xl` for key empty states and modal shells

### Borders and elevation

- Border presence is default (`border-[var(--border)]`) on major containers.
- Elevation is communicated mainly with glow and subtle hover transitions, not heavy box shadows.

### Structural patterns

- Quiz overview: responsive card grid (`sm:2 / lg:3 / xl:4`).
- Data/result views: stacked rows with expandable details.

---

## Component Style Guidelines

### Buttons

- **Primary CTA**: `brand-blue` fill, white text, bold label, optional controlled glow.
- **Success CTA**: `brand-green` fill, dark text for contrast.
- **Danger action**: `brand-red` or red-outline treatment; never ambiguous neutral color.
- **Outline action**: border + surface hover, visually secondary to primary CTA.
- **Ghost/icon action**: utility-only controls; must remain low emphasis until hover/focus.
- Standard motion budget: `150-300ms`, with scale reserved for top-priority actions only.

### Cards and panels

- Use `card` surface with `border` as default container style.
- Interactive cards may increase border emphasis and apply subtle tokenized glow on hover.
- Nested controls within cards should step to `surface-3`.
- Quiz library cards should use a 3-zone structure for scanability and action stability:
  - top media cover (`16:9`) with count badge for fast visual differentiation,
  - middle metadata block (title, notes, pass info),
  - bottom action zones split into primary play row and secondary utility row.
- On quiz cards, only challenge/practice actions should carry strong emphasis and labels; edit/delete remain utility icon buttons.

### Inputs and textareas

- Baseline: rounded, bordered, high-contrast foreground.
- Backgrounds in feature screens should use `surface-2` or `surface-3`.
- Focus indicators must rely on `--ring`, never custom ad-hoc focus colors.

### Badges

- Badge use is informational (counts, states, percentages), not decorative.
- Prefer `outline` variant + token border/text, with low-opacity background tint.

### Modals and overlays

- Full-screen backdrop must include dark alpha + blur.
- Modal content shell must use `card`/`surface-2` and visible border.
- Long modals require internal scrolling and sticky header/footer controls.

### Icons

- Icon system: `lucide-react` only.
- Typical control size: `14-20`.
- Icon-only buttons are utility actions; major actions should include text labels.

---

## Animation Rules

### Animation categories

1. **Functional animations** (clarity-first):
   - Purpose: indicate state transition, affordance, focus, or timing urgency.
   - Examples: `slide-up`, `countdown-in`, timer pulse, hover transitions.
   - Must be brief and predictable (`150ms-400ms`, except timer pulse loop).

2. **Celebratory animations** (emotion-first, context-limited):
   - Purpose: reinforce achievement and classroom engagement.
   - Allowed contexts: end-of-quiz outcomes only.
   - Must not block user actions, hide score, or delay next step controls.

### Persistent vs one-shot rules

- **One-shot required** for primary outcome flashes and the main fail gags (first-read impact).
- **Persistent loops allowed** for low-intensity indicators (e.g., timer pulse while running).
- **Perfect Score animation rule**:
  - Opening fireworks / flashes may be dramatic (one-shot or short fades).
  - **Ambient loops are allowed** for perfect score only: low-intensity background glow, continuous confetti stream, and gentle repeating micro-bursts—kept **behind** score and controls, `pointer-events: none`, and toned so legibility stays high.
  - Respect `prefers-reduced-motion`: disable or heavily reduce looping particles; keep score and actions usable.
  - Interaction controls must remain immediately visible and never blocked (Back/Retry).

### Fail animation rules

- Tone: **light, funny, encouraging** (never punitive, alarming, or humiliating).
- Intensity: lower than perfect-score celebration; no aggressive flashing.
- Messaging: should support retry behavior and confidence.
- Visual style: playful symbols/character motion are preferred over harsh error effects.

### Timing and easing baseline

- Micro interactions: `150-300ms`.
- Entrances/transitions: `300-400ms`.
- Outcome particles: typically `500-2500ms`, with staggering allowed.
- Use `ease-out` for most motion; reserve custom overshoot curves for countdown emphasis only.

---

## Dark Theme Consistency Rules

This app is currently dark-only in real usage.

- `<html class="dark">` is intentionally enforced.
- New components must use existing `surface-*`, `foreground`, and `muted-foreground` tokens.
- Structural separation must come from tokenized borders and surface contrast, not arbitrary grayscale.
- Backdrop overlays must preserve content legibility with dark alpha and blur.
- Any future light-mode work must be scoped as a deliberate project, not mixed ad hoc into existing components.

---

## Future Improvement Rules

These are strict implementation rules for this app:

1. **No new hex in feature components** without first adding a named token in `app/globals.css` and documenting it here.
2. **No mixed theme logic**: do not introduce light-only class behavior while app root is forced dark.
3. **One primary action per view block** (header, modal footer, result decision area). Avoid CTA competition.
4. **Keep screen-share readability**: critical values (timer, score, pass/fail) must remain large and high contrast.
5. **Motion cannot reduce usability**: controls must remain clickable and visible during all animations.
6. **Avoid style drift from shadcn defaults**: if overriding primitives, align to existing `surface-*` and token hierarchy.
7. **Preserve existing rhythm**: default to current paddings, gaps, and radius tiers unless there is a documented UX reason.
8. **Feature additions require design-system update**: any new major visual pattern must be added to this file in the same change.
9. **Do not use icon-only primary actions** for classroom-critical flows (Start, Save, Stop, Retry, Back).
10. **No silent visual experiments**: temporary novelty effects must be behind explicit settings or removed before release.

---

## Classroom Screen-Share Optimization

Design decisions for projected/remote classroom usage:

- **Large critical text**: timer, score, question prompt, and correctness controls must stay readable from distance.
- **High contrast by default**: foreground vs background and CTA contrast must remain strong in all states.
- **Minimal simultaneous distractions**: avoid running multiple animated zones at once during active questioning.
- **Timer prominence**: active timer must remain visually dominant and always visible during question phase.
- **Clean control zones**: teacher action buttons should remain in stable, predictable locations.
- **Fast glance status**: use color + icon + label together for pass/fail/correctness clarity.
- **Modal discipline**: modals must not feel cramped on shared screens; preserve adequate spacing and sticky actions.

---

## Review Questions Screen Guidelines

Guidelines specific to quiz question review/edit flow:

- **Image handling**
  - Always show loading, success, and error states.
  - Preserve clear fallback when image fails (`Image unavailable` + recovery action).
  - URL input and upload must remain secondary utilities, not primary clutter.

- **Icon placement**
  - Top-left region: order/reposition controls (up/down) tied to question sequence.
  - Top-right region: settings/customize + remove actions.
  - Bottom image corners: media utility actions (link/upload), visually separated from question editing actions.

- **Global vs per-question controls**
  - Global settings are the default source for style/GIF behavior.
  - Per-question customization is an explicit override, not hidden implicit behavior.
  - UI copy must communicate override behavior clearly.

- **Editing clarity**
  - Question text input remains central and always visible.
  - Vocabulary badge and question index should remain visible for orientation.
  - Reorder controls must stay disabled at boundaries (first/last item) to avoid invalid actions.

- **Density control**
  - Keep each question card self-contained and scannable.
  - Avoid adding extra action rows unless they materially improve teacher speed.

