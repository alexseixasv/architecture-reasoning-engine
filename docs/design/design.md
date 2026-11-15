# Architecture Reasoning Engine — Design System

Visual foundation for the browser workspace that sits on top of the deterministic analysis API. The product name is **Architecture Reasoning Engine**. This document is an engineering UI system — not a retail or consumer brand kit.

## 1. Visual theme & atmosphere

The workspace should feel like a **compact technical control surface**: cool neutrals, sharp hierarchy, dense but readable data, and restrained motion. Panels float lightly on a cool off-white canvas. Primary actions use a single slate-teal accent. Monospace is reserved for IDs, quantities, formula identifiers, JSON, and refusal codes.

**Key characteristics**

- Cool off-white page canvas with white content panels
- Dark slate typography for high-contrast technical reading
- One accent color (slate-teal) for focus, links, and primary CTAs
- IBM Plex Sans for UI chrome; IBM Plex Mono for technical values
- Compact density: short labels, tight vertical rhythm, no marketing hero
- Semantic status colors for success / warning / error / info
- Soft elevation only (whisper shadows); no glow stacks
- Interaction feedback: disabled states, loading indicators, `scale(0.98)` press on primary buttons

**Page rhythm**

Header (deep slate) → Workspace grid (canvas) → Panel cards (white) → Status banners (semantic tints) → Footer metadata (muted).

## 2. Color palette & roles

### Surfaces

| Token | Hex | Role |
| --- | --- | --- |
| `--color-canvas` | `#F7F8FA` | Page background |
| `--color-panel` | `#FFFFFF` | Cards, editors, modals |
| `--color-panel-muted` | `#F1F5F9` | Nested wells, code/JSON background |
| `--color-border` | `#E2E8F0` | Hairlines, inputs |
| `--color-border-strong` | `#CBD5E1` | Focused/emphasized borders |
| `--color-header` | `#0B1220` | App chrome / header band |

### Text

| Token | Value | Role |
| --- | --- | --- |
| `--color-ink` | `#0F172A` | Primary headings and body |
| `--color-ink-muted` | `#475569` | Secondary labels, metadata |
| `--color-ink-subtle` | `#64748B` | Placeholders, empty-state hints |
| `--color-ink-on-dark` | `#F8FAFC` | Text on header |
| `--color-ink-on-dark-muted` | `rgba(248, 250, 252, 0.72)` | Secondary on header |

### Accent

| Token | Hex | Role |
| --- | --- | --- |
| `--color-accent` | `#0F766E` | Primary CTA, focus rings, active tabs |
| `--color-accent-hover` | `#0D9488` | Hover on primary |
| `--color-accent-tint` | `#CCFBF1` | Soft selected / info wash |

### Semantic

| Token | Hex | Role |
| --- | --- | --- |
| `--color-success` | `#047857` | Persist OK, grounded explanation |
| `--color-success-tint` | `#D1FAE5` | Success banner background |
| `--color-warning` | `#B45309` | Validation warnings, fallback |
| `--color-warning-tint` | `#FEF3C7` | Warning banner background |
| `--color-danger` | `#B91C1C` | Errors, OCC conflict, provider failure |
| `--color-danger-tint` | `#FEE2E2` | Error banner background |
| `--color-info` | `#1D4ED8` | Neutral informational callouts |
| `--color-info-tint` | `#DBEAFE` | Info banner background |

### Do / don’t

- Do keep accent usage sparse (CTAs and focus), not full-page washes.
- Do use semantic tints for banners, not accent green for errors.
- Don’t introduce café cream canvases, gold “ceremony” accents, or multi-green brand ladders.
- Don’t use pure black `#000` for body text on light panels — prefer `--color-ink`.

## 3. Typography

### Families

- **UI:** `"IBM Plex Sans", "Helvetica Neue", Helvetica, Arial, sans-serif`
- **Technical / code:** `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`

Load via Google Fonts or self-host. No proprietary retail typefaces.

### Hierarchy

| Role | Size | Weight | Line height | Notes |
| --- | --- | --- | --- | --- |
| App title | 20px | 600 | 1.3 | Header product name |
| Panel title (H2) | 16px | 600 | 1.4 | Section headers |
| Body | 14px | 400 | 1.5 | Default copy |
| Label | 12px | 600 | 1.3 | Form labels, uppercase optional |
| Meta / caption | 12px | 400 | 1.4 | Timings, IDs (mono for IDs) |
| Metric value | 14–16px | 600 | 1.3 | Mono for numbers and units |
| JSON editor | 13px | 400 | 1.45 | Mono, panel-muted background |

### Principles

- Prefer **weight and color** over large size jumps for hierarchy inside panels.
- Technical identifiers (`architectureId`, `formulaId`, refusal codes) always use mono.
- Body text never invents engine numbers in decorative type — numbers come from the API response.

## 4. Spacing & layout

Rem scale anchored at `1rem = 16px` (standard root; do not use 62.5% retail tricks).

| Token | Value | Use |
| --- | --- | --- |
| `--space-1` | 4px | Tight chip gaps |
| `--space-2` | 8px | Inline control gaps |
| `--space-3` | 12px | Label → control |
| `--space-4` | 16px | Panel padding (compact) |
| `--space-5` | 24px | Section gaps |
| `--space-6` | 32px | Workspace column gap |
| `--space-7` | 48px | Page margins (desktop) |

**Workspace grid**

- Desktop (`lg+`): two columns — left: input + review + persist; right: scenario + results + usage.
- Mobile: single column stack in the same order.
- Max content width ~1280px centered.

## 5. Components

### Buttons

- **Primary:** accent fill, white text, `8px` radius, `8px 14px` padding, `scale(0.98)` on active.
- **Secondary:** white fill, accent text, `1px` accent border.
- **Danger outline:** danger border/text for destructive or conflict actions.
- Disabled: 50% opacity, `pointer-events: none`, and `aria-disabled`.

### Inputs

- Textarea and text inputs: white/panel-muted fill, `1px` border, `8px` radius, focus ring `2px` accent tint.
- Labels always visible (not placeholder-only).
- JSON editor: mono, min-height ~240px, horizontal scroll for long lines.

### Panels / cards

- White background, `1px` `--color-border`, `12px` radius.
- Shadow: `0 1px 2px rgba(15, 23, 42, 0.06)` — whisper only.
- Header row: panel title + optional status chip.

### Status chips & banners

- Chips: small mono/sans pill (`6px` radius) for `PROPOSED`, `ANSWERED`, `UNSUPPORTED`, `fallback`, etc.
- Banners: full-width tint bar with icon/text; never auto-dismiss critical OCC/provider errors.

### Tables / metric lists

- Prefer definition lists or compact tables: metric id (mono) | value + unit | formulaId.
- Refused metrics: warning/danger styling with reason code visible.

## 6. Motion & feedback

- Transitions: `150–200ms ease` on color/opacity/transform.
- Loading: inline spinner or “Working…” on the action button; disable duplicate submits.
- Preserve drafts when requests fail — never clear the architecture textarea or JSON editor on error.
- Empty states: one short sentence + what to do next (e.g. “Extract an architecture before analyzing”).

## 7. Accessibility

- Visible focus rings on all interactive controls.
- Form controls associated with `<label>` / `aria-labelledby`.
- Color is not the only status signal — include text (Error / Warning / Success).
- Target contrast ≥ WCAG AA for body text on canvas/panels.
- Keyboard: Tab order follows visual order; primary actions reachable without pointer.

## 8. Do / don’t (product-specific)

**Do**

- Show assumptions, unknowns, conflicts, and refusals as first-class UI.
- Label Fake vs priced usage honestly (`estimatedCostUsd` may be null).
- Keep extraction non-persistent until the user explicitly saves.

**Don’t**

- Build drag-and-drop architecture diagrams or graph editors in this phase.
- Calculate utilization, capacity, or latency in the browser.
- Invent API fields, endpoints, or usage numbers.
- Ship marketing landing pages, rewards metaphors, or unrelated brand assets.

## 9. Implementation mapping

| Concern | Implementation |
| --- | --- |
| Tokens | CSS variables in `frontend/src/assets/styles.css` |
| Utility classes | Tailwind mapped to the tokens above |
| Fonts | IBM Plex Sans + Mono via stylesheet import |
| Workspace | Single SPA view; responsive CSS grid |

This design system is the visual source of truth for the Phase 8 frontend. Update tokens here before inventing one-off colors in components.
