# TUTO — DESIGN SYSTEM

## 1. Overall Design Philosophy

The app is a **light-first, teacher-led classroom interface** optimized for calm preparation, clarity during live sessions, and efficient daily use.

The goal is to create a beautiful, understated, thoughtfully designed educational productivity app.

The interface should feel:

- Minimalist, but not boring.
- Modern, but not trendy.
- Friendly, but not childish.
- Functional, but not overly corporate.
- Visually interesting through thoughtful details rather than decorative effects.

### Core Principles

- **Light is default**: Warm off-white page background, white panels, hairline borders only where structure is needed.
- **Flat over nested**: One surface level per view block; spacing and typography replace box-in-box layouts.
- **Icons over paragraphs**: Secondary actions use subtle icon buttons with tooltips; text labels reserved for primary CTAs (Start, Save, Stop).
- **Color as meaning**: Blue = primary flow, green = success, red = incorrect/destructive, amber = highlight/wallet.
- **Readable at distance**: Timers, scores, and question prompts stay large during quiz/play (screen-share rule).
- **Minimal motion**: No decorative glows or gradient blobs on prep screens; quiz outcome effects may animate.
- **Intentional over conventional**: Do not default to familiar SaaS dashboard patterns. Every component should have a reason to look and behave the way it does.
- **Distinctive through restraint**: The app should feel recognizable through its proportions, typography, spacing and details, not decorative effects.
- **Content before containers**: Organize information through hierarchy, alignment and whitespace rather than putting everything inside cards.
- **Natural visual hierarchy**: Not every element deserves equal visual attention. Important information should stand out; secondary information should remain quiet.
- **Functional beauty**: Interactions, controls and information architecture should feel as carefully designed as the visual appearance.
- **Consistency without uniformity**: Components should belong to the same design language without forcing every page into the same layout or component structure.
- **Avoid design trends for their own sake**: Do not introduce visual patterns simply because they are common in modern AI-generated interfaces.

**Exception:** Fullscreen book / class session overlay keeps its own dark glass + golden mat aesthetic — independent of the teacher shell.

---

## 2. Design Anti-Patterns & Visual Restraint

Avoid the following patterns unless there is a clear functional or aesthetic reason to use them.

### Unnecessary UI Decoration

- No decorative gradient blobs, glows or mesh gradients.
- No glassmorphism or backdrop blur on ordinary application surfaces.
- No decorative illustrations or floating 3D elements.
- No unnecessary icon circles or colored icon backgrounds.
- No shadows on every container.
- No decorative elements that compete with actual content.

### Over-Containerization

- Do not turn every content group into a card.
- Avoid nested cards and unnecessary bordered sections.
- Do not use a card grid when a simple list, table or structured layout would work better.
- Avoid excessive rounded containers and pill-shaped elements.
- Do not create separate boxes for information that naturally belongs together.

### Excessive Visual Noise

- Avoid unnecessary status badges, tags and labels.
- Avoid excessive uppercase section labels.
- Avoid too many competing accent colors.
- Avoid unnecessary dividers between every item.
- Avoid excessive use of decorative icons.
- Avoid unnecessary visual effects that add complexity without improving usabilit
