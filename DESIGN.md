# LeadForge Design System

**Scope:** Visual design language for the LeadForge desktop application (Electron + React + Tailwind + shadcn/ui)
**Direction:** Calm, fast, information-dense, professional enterprise software — the visual register of Linear, Attio, Raycast, GitHub, and the Stripe Dashboard. No AI-generated gradients, no neon glow, no decorative color for its own sake.
**Includes:** color system (light + dark), typography, spacing, elevation, iconography, motion, component tokens, and implementation notes for Tailwind/shadcn + Electron.

---

## 1. Design Principles

1. **Color is structural, not decorative.** Every color in the system exists to communicate hierarchy, state, or meaning (this is data, this is interactive, this succeeded, this needs attention). If a color doesn't do one of those jobs, it doesn't belong.
2. **One accent, used sparingly.** A single signal color carries all "this is interactive / this is important" meaning. It is never used for large surface fills — only for the small set of elements that genuinely want attention: primary actions, active nav state, focus rings, key data points.
3. **Density before decoration.** LeadForge users are scanning tables of companies and contacts for hours at a time. Every token below is tuned for legibility at small sizes and long sessions, not for looking good in a single hero screenshot.
4. **Dark mode is a first-class mode, not an inverted filter.** Surfaces, borders, and the accent color are independently tuned for dark mode rather than mechanically inverted — flat inversion produces washed-out accents and muddy borders.
5. **Quiet by default, precise on demand.** The at-rest UI is close to monochrome; color and motion appear only at the moment they carry information (a status change, a hover, a live job running).

---

## 2. Color System

### 2.1 Neutral Scale (the base of everything)

LeadForge uses a **cool, slightly blue-leaning neutral** (not pure gray, not warm) — this reads as precise/technical rather than soft, matching the reference points (Linear, GitHub, Stripe). One 12-step scale is used for both modes; light mode uses steps 1–12 ascending in darkness, dark mode uses the same scale ascending in lightness.

| Step | Hex | Light mode role | Dark mode role |
|---|---|---|---|
| 1 | `#FAFBFC` | App background | — |
| 2 | `#F4F5F7` | Sunken surfaces (sidebar, table zebra) | — |
| 3 | `#EAECEF` | Card/panel surface | — |
| 4 | `#DFE2E6` | Subtle borders | — |
| 5 | `#C9CDD4` | Default borders | — |
| 6 | `#AEB4BD` | Disabled text / strong borders | — |
| 7 | `#8B929E` | Tertiary text / placeholder | Tertiary text |
| 8 | `#6B7280` | Secondary text | Secondary text |
| 9 | `#4B5261` | — | Default borders |
| 10 | `#2E3440` | Primary text (light mode) | Card/panel surface |
| 11 | `#181B21` | — | Sunken surfaces / sidebar |
| 12 | `#0D0F13` | — | App background |

Dark mode reuses the exact same 12 hex values, mapped in reverse — this is deliberate: it means the palette is one shared token file, and "dark mode" is a role-remapping, not a second palette to maintain.

### 2.2 Semantic Background Tokens

| Token | Light | Dark | Usage |
|---|---|---|---|
| `bg-app` | `#FAFBFC` (step 1) | `#0D0F13` (step 12) | Window background behind all content |
| `bg-sunken` | `#F4F5F7` (step 2) | `#181B21` (step 11) | Sidebar, table header row, code/terminal blocks |
| `bg-surface` | `#FFFFFF` | `#12151A` | Cards, panels, dialogs, dropdowns |
| `bg-surface-raised` | `#FFFFFF` + shadow | `#1B1F26` | Popovers, command palette, tooltips |
| `bg-overlay-scrim` | `rgba(13,15,19,0.45)` | `rgba(0,0,0,0.6)` | Modal/dialog backdrop |
| `bg-hover` | `#EAECEF` (step 3) | `#1F2430` | Row/list-item hover |
| `bg-selected` | `accent/8%` tint | `accent/14%` tint | Selected table row, active list item |

### 2.3 Semantic Foreground (Text) Tokens

| Token | Light | Dark | Usage |
|---|---|---|---|
| `fg-primary` | `#2E3440` (step 10) | `#F4F5F7` (step 2) | Headings, primary body text, table cell primary value |
| `fg-secondary` | `#4B5261`-ish (blend 8/9) → `#5B6270` | `#AEB4BD` (step 6) | Supporting text, secondary table columns, metadata |
| `fg-tertiary` | `#8B929E` (step 7) | `#8B929E` (step 7, shared) | Placeholder text, captions, disabled labels |
| `fg-on-accent` | `#FFFFFF` | `#FFFFFF` | Text/icons on top of accent-filled elements |
| `fg-disabled` | `#AEB4BD` (step 6) | `#4B5261`-ish | Disabled control text |

### 2.4 Accent Color — "Signal"

The single accent, used consistently across both modes for anything genuinely interactive or important: primary buttons, links, active nav/tab indicator, focus rings, checked states, the command-palette highlight, and key numeric callouts on the dashboard (e.g., "12 replies today").

| Token | Light | Dark | Notes |
|---|---|---|---|
| `accent-9` (default) | `#3358E0` | `#5B7CFF` | Base accent — buttons, links, active states |
| `accent-10` (hover) | `#2646C4` | `#7089FF` | Hover/pressed state |
| `accent-3` (subtle fill) | `#EEF1FE` | `#182144` | Selected-row tint, subtle badge background |
| `accent-7` (border) | `#A9B8F5` | `#3B4A8C` | Focus ring, active tab underline |

"Signal" (`#3358E0` in light mode) is a saturated, slightly cool blue chosen deliberately over the more common Linear-purple / Stripe-purple accents so LeadForge reads as its own product rather than a Linear reskin, while staying in the same "calm technical SaaS" register the vision doc asks for. It carries real meaning in a lead-gen tool: it is the color of an active signal in a pipeline (a live workflow, a fresh reply), which the copywriting and iconography reinforce.

### 2.5 Semantic State Colors

State colors are intentionally desaturated relative to the accent so they never compete with it for attention — they appear far less often (only on badges, banners, and status dots) and must read clearly at a glance without shouting.

| State | Light `bg` | Light `fg`/border | Dark `bg` | Dark `fg`/border | Usage |
|---|---|---|---|---|---|
| Success | `#EAF6EE` | `#1E8A4C` | `#122A1B` | `#4ADE80` | Verified email, sent successfully, workflow completed |
| Warning | `#FDF3E0` | `#B8730A` | `#2E230F` | `#F5A524` | Quota nearing limit, risky email, needs review |
| Danger | `#FCEBEC` | `#C42B3A` | `#301418` | `#F76A7A` | Bounced email, failed job, destructive action |
| Info | `#EBF3FE` | `#2361C7` | `#101E33` | `#6FA8FF` | Neutral system notices, informational banners |

### 2.6 Borders & Dividers

- `border-subtle`: step 4 light / step 9 dark — used for table row dividers, card outlines where a near-invisible separation is enough.
- `border-default`: step 5 light / a lighter step-9 blend dark — used for input fields, dropdown outlines, panel borders.
- `border-strong`: step 6 light / step 8 dark — used sparingly, for elements that need to visually separate from a busy background (e.g., the active workflow-canvas node).


---

## 3. Typography

### 3.1 Type Families

Three faces, each with a distinct job — no more, to keep the system calm:

| Role | Typeface | Fallback stack | Why |
|---|---|---|---|
| **UI / body** | **Inter** | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` | The neutral, highly-legible-at-small-sizes workhorse shared by Linear/GitHub/Stripe-style tools; disappears into the content instead of announcing itself. |
| **Display / headings** | **Inter, at heavier weight + tighter tracking** (not a separate display face) | same as above | Rather than introduce a second characterful family (which would push toward a "marketing site" feel), headings use Inter at 600–700 weight with slightly negative letter-spacing — enterprise software earns its personality from restraint, not from a display serif. |
| **Monospace / data** | **JetBrains Mono** | `"SF Mono", Menlo, Consolas, monospace` | Used for anything literal: email addresses, domains, IDs, workflow variable expressions (`{{nodes.discover.output}}`), the terminal-style log viewer, and numeric table columns that benefit from tabular alignment. |

Both Inter and JetBrains Mono are free, open-source (SIL Open Font License), and bundle cleanly into an Electron app with zero licensing cost — consistent with the project's $0 constraint.

### 3.2 Type Scale

A restrained 8-step scale, each step with a defined weight and line-height. Sizes in `rem` (base 16px).

| Token | Size | Line-height | Weight | Usage |
|---|---|---|---|---|
| `text-xs` | 0.75rem / 12px | 1.4 | 400/500 | Table metadata, timestamps, badge labels |
| `text-sm` | 0.8125rem / 13px | 1.45 | 400 | Table body text, secondary UI text (the density workhorse) |
| `text-base` | 0.875rem / 14px | 1.5 | 400 | Primary UI/body text, form inputs |
| `text-md` | 1rem / 16px | 1.5 | 400/500 | Dialog body copy, settings descriptions |
| `text-lg` | 1.125rem / 18px | 1.4 | 500 | Card titles, section subheadings |
| `text-xl` | 1.375rem / 22px | 1.3 | 600 | Page titles (e.g., "Companies", "Campaign: Q3 Outreach") |
| `text-2xl` | 1.75rem / 28px | 1.25 | 600 | Dashboard hero numbers, empty-state headlines |
| `text-3xl` | 2.25rem / 36px | 1.2 | 700, tracking -0.02em | Rare — onboarding/marketing-adjacent surfaces only |

Note the base UI size is **14px, not 16px** — deliberate, because this is a data-dense desktop tool viewed at arm's length on a large monitor for hours, not a marketing page optimized for first-glance readability. Every reference point named in the vision doc (Linear, Attio, Raycast) uses a 13–14px base for the same reason.

### 3.3 Weight Usage

Only three weights are used anywhere in the product: **400 (regular)** for body text, **500 (medium)** for emphasis/labels/active states, and **600 (semibold)** for headings and primary buttons. 700 is reserved for the rare display-scale moment (3.2). Avoiding a wider weight range keeps the UI calm rather than "designed."

### 3.4 Numeric/Tabular Data

All numeric table columns (deal value, contact counts, scores) use `font-variant-numeric: tabular-nums` so digits align vertically across rows — a small detail that matters enormously for a table-heavy CRM.

---

## 4. Spacing System

An 4px base unit, exposed as a Tailwind-compatible scale. Density-critical UI (tables, list rows) should stay on the smaller half of this scale; only dialogs/settings pages should reach for the larger values.

| Token | Value | Typical usage |
|---|---|---|
| `space-1` | 4px | Icon-to-label gap, tight badge padding |
| `space-2` | 8px | Table cell vertical padding, form field gap |
| `space-3` | 12px | Table cell horizontal padding, card internal padding (compact) |
| `space-4` | 16px | Standard card padding, section gap within a panel |
| `space-5` | 20px | Panel padding, dialog internal padding |
| `space-6` | 24px | Gap between major page sections |
| `space-8` | 32px | Page-level top margin, empty-state vertical padding |
| `space-12` | 48px | Rare — large empty-state/onboarding spacing only |

Row height in dense tables is fixed at **36px** (comfortable) with a **32px "compact" mode** toggle for power users, matching the customizable density pattern used by Linear/Attio-style tools.

---

## 5. Radius, Elevation & Borders

### 5.1 Corner Radius

A small, consistent radius scale — enterprise software reads as more "serious" with tighter radii than consumer apps.

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4px | Badges, small buttons, checkboxes |
| `radius-md` | 6px | Inputs, buttons, table cells with fill |
| `radius-lg` | 8px | Cards, dialogs, dropdown menus |
| `radius-full` | 9999px | Avatars, status dots, pill badges |

No radius exceeds 8px anywhere except pills/avatars — this is a deliberate anti-pattern to the "everything is very rounded" consumer-app look, matching the Linear/GitHub/Stripe reference set.

### 5.2 Elevation (Shadows)

Shadows are used only to lift transient, overlay-type surfaces off the base layer (popovers, dropdowns, the command palette, toasts) — never on static cards or panels, which are distinguished by `bg-surface` + `border-subtle` alone. This keeps the resting UI flat and calm, reserving depth for things that are genuinely floating above the canvas.

| Token | Light mode value | Dark mode value | Usage |
|---|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(13,15,19,0.06)` | `0 1px 2px rgba(0,0,0,0.4)` | Dropdown menus, small popovers |
| `shadow-md` | `0 4px 12px rgba(13,15,19,0.10)` | `0 4px 16px rgba(0,0,0,0.5)` | Command palette, larger popovers |
| `shadow-lg` | `0 12px 32px rgba(13,15,19,0.14)` | `0 16px 40px rgba(0,0,0,0.6)` | Modals/dialogs |

Dark mode shadows are darker and slightly larger-spread than a naive inversion would produce, because a light-mode-style soft gray shadow is nearly invisible against a dark background — this is one of the specific reasons dark mode is tuned independently rather than auto-inverted (Principle 4).


---

## 6. Iconography

- **Icon set:** [Lucide](https://lucide.dev) exclusively (open-source, already the icon set used across the shadcn/ui component library, so no second icon system to license or maintain).
- **Default stroke weight:** 1.5px at 16–20px sizes (matches Inter's optical weight at UI text sizes; 2px reads too heavy at small sizes, 1px disappears).
- **Color:** icons inherit `fg-secondary` by default; only icons indicating the accent's meaning (active nav item, primary button icon) use `accent-9`. Status icons (check, alert-triangle, x-circle) use the matching semantic state color from Section 2.5.
- **Sizing scale:** 14px (inline with `text-sm`/`text-base`), 16px (default UI icon — buttons, table rows), 20px (sidebar nav, section headers), 24px (empty states only).

---

## 7. Motion

Motion is used only where it clarifies cause-and-effect — never as ambient decoration (per the vision doc's explicit "no AI gradients / no glowing neon" instruction, motion follows the same restraint).

| Token | Duration | Easing | Usage |
|---|---|---|---|
| `motion-instant` | 100ms | `ease-out` | Hover state changes, button press |
| `motion-fast` | 150ms | `ease-out` | Dropdown/popover open, tab switch |
| `motion-base` | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Dialog open/close, drawer slide-in |
| `motion-slow` | 300ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Page-level transitions (rare — desktop apps mostly cut instantly between views) |

Rules: no auto-playing ambient animation anywhere in the resting UI (no pulsing dots except a genuinely live/in-progress job indicator); every transition respects `prefers-reduced-motion` and collapses to an instant cut when set; loading states use a static skeleton (matching surface tokens) rather than a shimmering gradient, to stay consistent with the "no gradients" rule.

---

## 8. Component Tokens (Key Components)

### 8.1 Buttons

| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| Primary | `accent-9` | `fg-on-accent` | none | `accent-10` |
| Secondary | `bg-surface` | `fg-primary` | `border-default` | `bg-hover` |
| Ghost | transparent | `fg-secondary` | none | `bg-hover` |
| Destructive | `danger fg` on transparent, or filled `danger bg` for confirm step | `#FFFFFF` on filled | none | darkened danger tone |

Height: 32px default, 28px compact, 36px for dialog primary actions. Radius: `radius-md`. Font weight: 500.

### 8.2 Inputs & Forms

Background `bg-surface`, border `border-default`, radius `radius-md`, height 32px (matches button height for alignment in toolbars/filter bars). Focus state: 2px `accent-7` ring with 1px offset — never a color-only focus indicator, to keep keyboard navigation clearly visible (accessibility requirement, Section 10).

### 8.3 Tables

- Header row: `bg-sunken`, `text-xs` weight 500, `fg-secondary`, uppercase tracking +0.02em, height 32px, bottom border `border-default`.
- Body rows: `bg-surface`, height 36px (comfortable) / 32px (compact), bottom border `border-subtle`, hover → `bg-hover`, selected → `bg-selected` with a 2px `accent-9` left border indicator.
- Numeric columns right-aligned with tabular numerals (Section 3.4).

### 8.4 Badges & Status Dots

Pill-shaped (`radius-full`), `text-xs` weight 500, using the semantic-state background/foreground pairs from Section 2.5 (e.g., a "Verified" badge uses success `bg`/`fg`). Status dots (8px circle) precede text in list views for at-a-glance scanning (e.g., a green dot for an active campaign, gray for paused).

### 8.5 Sidebar & Navigation

`bg-sunken`, 240px default width (collapsible to icon-only 56px). Active nav item: `bg-selected` tint + `accent-9` left border (3px) + `fg-primary` text at weight 500; inactive items: `fg-secondary` at weight 400, no background.

### 8.6 Command Palette

`bg-surface-raised`, `shadow-md`, `radius-lg`, centered overlay with `bg-overlay-scrim` backdrop. Selected result row uses `accent-3` background tint (never the full `accent-9` fill, which would be too heavy for a scannable list).

### 8.7 Dialogs & Drawers

`bg-surface`, `shadow-lg`, `radius-lg`, `bg-overlay-scrim` backdrop. Destructive confirmations always use a secondary (not primary) default button focus, so pressing Enter does not accidentally confirm a destructive action.

---

## 9. Dark Mode Strategy

1. **Independent tuning, not inversion.** As established in Sections 2.1–2.6 and 5.2, every token — including the accent — has its own dark-mode value rather than being computed by inverting the light-mode value. `accent-9` shifts from `#3358E0` to a lighter, slightly more saturated `#5B7CFF` because a darker blue loses contrast against a near-black background.
2. **Elevation reads through borders, not just shadow, in dark mode.** Since shadows are harder to perceive on dark backgrounds, dark-mode cards/panels lean more on a visible `border-default` to separate surfaces, with shadow as a secondary cue only on genuinely floating elements (Section 5.2).
3. **Reduced pure black.** The dark-mode app background is `#0D0F13`, not `#000000` — true black next to white text causes harsh perceived contrast (halation) during long sessions; a near-black with a hint of blue keeps it comfortable.
4. **System-follows by default, with manual override.** LeadForge defaults to the OS-level appearance setting (Electron's `nativeTheme.themeSource = 'system'`) and offers an explicit Light/Dark/System toggle in Settings, persisted per user.
5. **Semantic state colors are re-tuned for dark backgrounds**, not just lightened (Section 2.5) — e.g., success green shifts to a lighter, slightly more saturated `#4ADE80` so it doesn't look muddy on `#12151A`.

---

## 10. Accessibility

- **Contrast:** all `fg-primary`/`bg-*` text pairs meet WCAG AA (4.5:1) at minimum; `fg-secondary` meets AA for large/UI text (3:1) but is never used for body paragraph text at `text-sm` or smaller.
- **Focus visibility:** every interactive element has a visible 2px `accent-7` focus ring with offset — never `outline: none` without a replacement, and never a focus indicator relying on color alone.
- **Color is never the only signal.** Status is always paired with an icon or label (e.g., a "Bounced" badge, not just a red dot) so color-blind users aren't dependent on hue alone.
- **Reduced motion:** all `motion-*` tokens collapse to near-instant when `prefers-reduced-motion: reduce` is set (Section 7).
- **Keyboard-first:** every action reachable via mouse is reachable via keyboard (tab order, the command palette, and documented shortcuts per Section 12.4 of the architecture handbook).

---

## 11. Implementation Notes

### 11.1 Token Delivery

Tokens are defined once as CSS custom properties in `packages/ui/tokens.css`, scoped under `:root` (light) and `.dark` (dark, toggled on `<html>` by the theme provider) — the same file backs both raw CSS and the Tailwind config, so there is exactly one source of truth:

```css
:root {
  --bg-app: #FAFBFC;
  --bg-surface: #FFFFFF;
  --fg-primary: #2E3440;
  --accent-9: #3358E0;
  --accent-10: #2646C4;
  --radius-md: 6px;
  --shadow-md: 0 4px 12px rgba(13,15,19,0.10);
  /* ...full token set from Sections 2, 5 */
}

.dark {
  --bg-app: #0D0F13;
  --bg-surface: #12151A;
  --fg-primary: #F4F5F7;
  --accent-9: #5B7CFF;
  --accent-10: #7089FF;
  --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
}
```

### 11.2 Tailwind Mapping

`tailwind.config.ts` maps every token above into `theme.extend.colors`, `theme.extend.borderRadius`, `theme.extend.fontSize`, and `theme.extend.boxShadow` as CSS-variable references (`colors: { 'bg-app': 'var(--bg-app)', ... }`), so components use semantic classes (`bg-app`, `text-fg-secondary`, `rounded-md`) rather than raw hex values anywhere in application code — this is what makes a future re-theme (e.g., a white-label mode in Phase 10's marketplace) a token-file change, not a find-and-replace across components.

### 11.3 shadcn/ui Integration

shadcn/ui components are generated against this same CSS-variable convention (it already expects `--background`, `--foreground`, `--primary`, etc.) — LeadForge's token names above are mapped 1:1 onto shadcn's expected variable names in `packages/ui`, so shadcn primitives (Button, Dialog, Command, Table) automatically pick up the LeadForge palette with no per-component overrides.

### 11.4 Font Loading

Inter and JetBrains Mono are bundled as local font files (`packages/ui/fonts/`) rather than loaded from Google Fonts — this keeps the app fully functional offline (consistent with the architecture's offline-first principle) and avoids any external network dependency for basic UI rendering.