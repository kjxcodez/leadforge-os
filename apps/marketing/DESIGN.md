# LeadForge OS — Design System
### The Official Design Bible v1.0

---

## How to Read This Document

This is the single source of truth for every surface LeadForge OS ships: the desktop app, the marketing site, documentation, the dashboard, release notes, and everything that comes after. Nothing here is decorative. Every token, rule, and constraint exists so that a designer, engineer, or AI system can build a new screen without inventing anything or guessing at intent.

The test for every decision in this system: **does it read as engineered, or does it read as designed-to-impress?** LeadForge OS chooses engineered, every time.

---

# 1. Brand Strategy

## Mission
To give sales teams and technical operators a single, local-first system that turns raw market information into structured intelligence, and structured intelligence into executed outreach — without surrendering ownership of their data to a browser tab.

## Vision
A world where the tools professionals depend on to grow their business are as fast, private, and precise as the engineering tools they already trust — where "AI-powered" means quieter and more capable, not louder and more automated.

## Core Principles
1. **Execution over ideas.** A pipeline of unworked leads is worth nothing. LeadForge is built around finishing the loop: discover → enrich → organize → execute → grow.
2. **Local-first is a design constraint, not a feature.** Speed and privacy come from architecture, not marketing copy. The product should feel instant because it mostly is.
3. **Ownership is non-negotiable.** Data belongs to the user. The interface should never obscure this — exports, local storage, and transparency are first-class, not buried in settings.
4. **AI assists; it doesn't perform.** Automation should feel like a competent colleague executing a task you approved, not a black box making decisions for you.
5. **Quiet confidence.** The product doesn't need motion, gradients, or exclamation points to prove it's powerful. Restraint is the flex.

## Brand Promise
LeadForge OS gives you the structure and speed of an engineering tool, applied to the messiest part of running a business: finding and reaching the right people.

## Brand Keywords
Precision · Engineering · Execution · Trust · Structure · Calm · Speed · Minimalism · Power

## Personality
Quiet. Highly competent. Precise. Engineering-first. Doesn't perform for the room. Built by people who obsess over the details no one will ever compliment them for.

## Voice
Direct, technical, and specific. LeadForge speaks like a senior engineer explaining a system, not a marketer selling a dream. It never says "revolutionary," "game-changing," or "AI will transform your business." It says what the system does, in plain terms, and lets the specificity do the persuading.

## Tone by Context
| Context | Tone |
|---|---|
| Marketing site | Confident, plainspoken, quietly opinionated |
| Documentation | Precise, procedural, zero fluff |
| Dashboard / product copy | Terse, functional, never cute |
| Release notes / changelog | Factual, dated, changelog-style — "Added," "Fixed," "Changed," never "We're excited to announce" |
| Error states | Direct about what happened and what to do next — never apologetic, never vague |

## Messaging Principles
- Lead with mechanism, not adjectives. "Runs locally, syncs when you're online" beats "blazing fast and secure."
- One idea per sentence. No stacked clauses, no marketing rhythm (rule-of-three lists, sentence fragments for emphasis).
- Numbers and specifics outrank superlatives. "Enriches 500 records in under 40 seconds" beats "enriches leads instantly."
- Never say AI is magic. Name what it does: "drafts," "classifies," "flags," "summarizes."

---

# 2. Color System

The existing desktop app — deep black, soft greys, white type, a restrained orange accent — is the anchor. The web system extends this palette; it does not reinvent it. Orange is a signal color, used the way a compiler warning or a status LED is used: sparingly, and only when it means something.

## Primary Palette (Dark Mode — default surface)

| Token | Hex | Usage |
|---|---|---|
| `color-bg-base` | `#0A0A0B` | Root background, app canvas |
| `color-bg-surface-1` | `#131316` | Cards, panels, sidebar |
| `color-bg-surface-2` | `#1B1B1F` | Nested panels, modals, popovers |
| `color-bg-surface-3` | `#232327` | Hover surface, active row |
| `color-border-subtle` | `#232327` | Default hairline borders |
| `color-border-default` | `#2E2E33` | Card edges, dividers between sections |
| `color-border-strong` | `#3D3D44` | Focused input borders, emphasis dividers |

## Accent — "Forge Orange"

| Token | Hex | Usage |
|---|---|---|
| `color-accent` | `#E8622C` | Primary CTA, active nav state, key data highlight, logo cut |
| `color-accent-hover` | `#F17441` | Hover state on accent elements |
| `color-accent-muted` | `#E8622C` at 12% opacity | Accent-tinted backgrounds (badges, subtle highlights) |
| `color-accent-border` | `#E8622C` at 35% opacity | Borders on accent-adjacent elements |

Orange never appears as a background fill larger than a button or badge. It is a marker, not a mood. If more than one accent-colored element is visible at once outside of a data visualization, that's a signal to remove one.

## Text

| Token | Hex | Usage |
|---|---|---|
| `color-text-primary` | `#F4F4F5` | Headings, primary body copy, primary UI labels |
| `color-text-secondary` | `#A3A3AB` | Supporting copy, descriptions, secondary labels |
| `color-text-tertiary` | `#6E6E76` | Captions, timestamps, placeholder text, disabled labels |
| `color-text-disabled` | `#4A4A50` | Disabled control labels |
| `color-text-on-accent` | `#0A0A0B` | Text/icons on top of the accent color |

## Semantic Colors

Semantic colors are deliberately desaturated relative to typical SaaS defaults — they read as instrumentation, not decoration.

| Token | Hex | Usage |
|---|---|---|
| `color-success` | `#3FB27F` | Success states, positive deltas |
| `color-success-muted` | `#3FB27F` at 12% | Success background fills |
| `color-warning` | `#D9A441` | Warning states, caution banners |
| `color-warning-muted` | `#D9A441` at 12% | Warning background fills |
| `color-danger` | `#E24C4B` | Errors, destructive actions, negative deltas |
| `color-danger-muted` | `#E24C4B` at 12% | Error background fills |
| `color-info` | `#5B8DEF` | Informational states, links in body copy |
| `color-info-muted` | `#5B8DEF` at 12% | Info background fills |

Note: success/warning/danger/info are used for *state*, never for brand decoration. A chart may use them to encode meaning; a marketing page should not.

## Light Mode (secondary — dashboard/docs only, not the default identity)

Light mode exists for documentation and accessibility, not as the brand's primary face. The desktop app and marketing site remain dark by default.

| Token | Hex |
|---|---|
| `color-bg-base` | `#FAFAF9` |
| `color-bg-surface-1` | `#FFFFFF` |
| `color-bg-surface-2` | `#F2F2F0` |
| `color-border-subtle` | `#E7E7E5` |
| `color-border-default` | `#DADAD7` |
| `color-text-primary` | `#151517` |
| `color-text-secondary` | `#55555B` |
| `color-text-tertiary` | `#87878E` |
| `color-accent` | `#D6551F` *(darkened ~8% for AA contrast on white)* |

## Accessibility & Contrast

- Body text (`color-text-primary` on `color-bg-base`): **15.8:1** — exceeds AAA.
- Secondary text (`color-text-secondary` on `color-bg-base`): **7.1:1** — exceeds AA for normal text.
- Tertiary text (`color-text-tertiary` on `color-bg-base`): **4.6:1** — meets AA for normal text; use only for non-critical captions.
- Accent orange on dark background: **6.2:1** — safe for text and icons, not just large elements.
- Text-on-accent (`#0A0A0B` on `#E8622C`): **8.9:1**.
- Never place `color-text-tertiary` or below on `color-bg-surface-2/3` without checking contrast individually — nested surfaces reduce the ratio.
- All interactive elements require a visible focus ring: 2px, `color-accent`, 2px offset from the element edge. Focus is never removed, only restyled.

---

# 3. Typography

## Typeface Roles

| Role | Typeface | Rationale |
|---|---|---|
| UI / Body / Display | **Inter** (variable) | The default vocabulary of precision software (Linear, Vercel, GitHub all lean on it or its relatives). Chosen deliberately, not by default — its lack of personality *is* the personality: it disappears in favor of content and structure. |
| Monospace / Code / Data | **JetBrains Mono** | Technical, slightly warmer than Berkeley/IBM Plex Mono, distinct ligature-free option available for tabular data. Used for code blocks, terminal output, IDs, keys, and tabular numeric data. |

Do not introduce a third typeface. Do not use a serif anywhere in the system — serif reads as editorial/consumer, which conflicts with the engineering brand.

## Type Scale (desktop base: 16px root)

| Token | Size / Line Height | Weight | Usage |
|---|---|---|---|
| `display-xl` | 64px / 68px | 600 | Hero headlines only (marketing site) |
| `display-lg` | 48px / 54px | 600 | Section headers on marketing pages |
| `heading-xl` | 32px / 40px | 600 | Page titles (docs, dashboard) |
| `heading-lg` | 24px / 32px | 600 | Section titles |
| `heading-md` | 20px / 28px | 600 | Card titles, subsection headers |
| `heading-sm` | 16px / 24px | 600 | Component titles, table headers |
| `body-lg` | 17px / 28px | 400 | Lead paragraphs, marketing body copy |
| `body-md` | 15px / 24px | 400 | Default UI and documentation body |
| `body-sm` | 13px / 20px | 400 | Secondary UI text, form helper text |
| `caption` | 12px / 16px | 500 | Labels, timestamps, metadata, eyebrows |
| `code-md` | 14px / 22px | 400 (mono) | Inline code, code blocks |
| `code-sm` | 12px / 18px | 400 (mono) | Terminal-style dense output, table data |

## Weights
Use only **400 (Regular)**, **500 (Medium)**, and **600 (Semibold)**. Never 700+ (Bold) — it reads as consumer/marketing emphasis, not engineering precision. Emphasis is created through color, size, and spacing — not boldness beyond Semibold.

## Letter Spacing
- Display and Heading styles: `-0.02em` to `-0.01em` (slight negative tracking tightens large type)
- Body styles: `0em` (default)
- Caption / eyebrow / all-caps labels: `+0.04em` (opens up small uppercase text for legibility)

## Paragraph & Reading Rules
- Max line length for body copy: **72 characters** (documentation), **60 characters** (marketing lead paragraphs).
- Paragraph spacing: 1.5× the body line-height between paragraphs, never additional margin on the last paragraph in a block.
- Never justify text. Left-align always.

## Tables
- Header row: `caption` style, `color-text-tertiary`, uppercase, `+0.04em` tracking, bottom border `color-border-default`.
- Body rows: `body-sm` or `code-sm` for numeric/ID columns, row divider `color-border-subtle`, no zebra striping — LeadForge doesn't use pattern-fills to compensate for weak hierarchy.

## Code Blocks
- Background: `color-bg-surface-2`, 1px border `color-border-subtle`, 6px radius.
- Font: JetBrains Mono, `code-md`.
- Syntax highlighting palette stays within the semantic + accent tokens — no additional "rainbow" syntax colors introduced.

---

# 4. Grid System

## Breakpoints
| Name | Width |
|---|---|
| Mobile | 0–639px |
| Tablet | 640–1023px |
| Desktop | 1024–1439px |
| Wide | 1440px+ |

## Containers
| Context | Max width |
|---|---|
| Marketing page container | 1200px |
| Documentation content column | 760px (sidebar + content = 1200px total) |
| Dashboard canvas | Fluid, full viewport minus sidebar (240px) |

## Spacing Scale (8px base system)
`4, 8, 12, 16, 24, 32, 48, 64, 96, 128` (px)

- 4px: icon-to-label gaps, tight inline spacing
- 8px: default gap between related elements
- 16px: default padding inside components (buttons, inputs, list items)
- 24px: padding inside cards, gap between form fields
- 32px: gap between distinct component groups
- 48/64px: section-internal spacing on marketing pages
- 96/128px: spacing between major sections on marketing pages

Never use off-scale values (e.g., 20px, 28px, 40px) except where an icon's intrinsic size forces an exception — and even then, prefer adjusting the icon size to the scale.

## Columns
- Desktop: 12-column grid, 24px gutter, 24px outer margin minimum (scales up on Wide).
- Tablet: 8-column grid, 20px gutter.
- Mobile: 4-column grid, 16px gutter, 16px outer margin.

## Responsive Behavior
- Content reflows, never crops. Tables become stacked key/value cards below Tablet width.
- Sidebar navigation (docs, dashboard) collapses to a top drawer below Tablet width — it does not disappear or get replaced with a hamburger-only pattern without a visible current-location indicator.
- Marketing hero copy drops from `display-xl` to `display-lg`'s size at Tablet, and to `heading-xl` at Mobile — never below 32px for a hero headline.

---

# 5. Components

Every component below inherits: `color-border-subtle` for resting borders, 6px–8px corner radius (see radius scale in §5.0), and no shadow beyond the minimal elevation defined per-component. Shadows in this system communicate stacking order, never decoration.

## 5.0 Foundational Component Tokens
- **Corner radius scale:** `radius-sm: 4px` (badges, tags, checkboxes) · `radius-md: 8px` (buttons, inputs, small cards) · `radius-lg: 12px` (cards, modals) · `radius-xl: 16px` (large panels, the app window itself)
- **Elevation scale:** `elevation-0`: none (default resting state) · `elevation-1`: `0 1px 2px rgba(0,0,0,0.4)` (dropdowns, tooltips) · `elevation-2`: `0 8px 24px rgba(0,0,0,0.5)` (modals, dialogs). No elevation level above 2 exists in this system.

## Buttons
| Variant | Background | Text | Border | Usage |
|---|---|---|---|---|
| Primary | `color-accent` | `color-text-on-accent` | none | One per view, the single most important action |
| Secondary | `color-bg-surface-2` | `color-text-primary` | `color-border-default` | Standard actions |
| Ghost | transparent | `color-text-secondary` | none | Tertiary actions, toolbar icons |
| Destructive | transparent → `color-danger` on confirm step | `color-danger` | `color-danger` at 35% | Delete, revoke, disconnect |

- Height: 36px (default), 32px (compact/toolbar), 44px (marketing site CTA only).
- Padding: 16px horizontal, never less, regardless of height.
- Radius: `radius-md`.
- Only one Primary button visible per screen region. If two actions compete, one becomes Secondary.

## Inputs
- Background `color-bg-surface-1`, border `color-border-default`, `radius-md`.
- Focus: border becomes `color-accent`, plus the standard 2px focus ring.
- Placeholder text: `color-text-tertiary`.
- Error state: border `color-danger`, helper text below in `color-danger`, `caption` style.
- Height: 36px single-line, `body-md` type inside.

## Cards
- Background `color-bg-surface-1`, border `color-border-subtle`, `radius-lg`, 24px internal padding.
- Hover (only if the card is interactive/clickable): border brightens to `color-border-default`, background to `color-bg-surface-2`. No lift/scale transform, no shadow pop.

## Dialogs / Modals
- Background `color-bg-surface-2`, `radius-lg`, `elevation-2`.
- Overlay: `#000000` at 60% opacity, no blur (see §8 on glass/blur usage).
- Max width 480px for confirmation dialogs, 640px for form dialogs.
- Close affordance always present top-right; Escape key always closes.

## Tables
- See §3 typography rules. Row height 44px default, 36px in dense/compact mode.
- Sortable headers show a static caret, not an animated one, when active.

## Badges / Tags
- `radius-sm`, `caption` type, 4px vertical / 8px horizontal padding.
- Neutral badge: `color-bg-surface-3` background, `color-text-secondary` text.
- Status badges use the `-muted` semantic background with the full-strength semantic text color.

## Navigation (Top Nav — marketing/docs)
- Height 64px, background `color-bg-base` at 92% opacity with a 1px bottom border, becomes fully opaque on scroll (no blur — see §8).
- Logo left, primary links center-left or center, CTA button right.

## Sidebar (Docs/Dashboard)
- Width 240px fixed (dashboard), 280px (docs, to accommodate nested lists).
- Background `color-bg-base` (flush with canvas — the sidebar is not a distinct "card" floating on the canvas).
- Active item: `color-accent-muted` background, `color-accent` left border (2px), `color-text-primary` label.

## Footer (Marketing)
- Background `color-bg-base`, top border `color-border-subtle`.
- Simple 4–5 column link layout. No newsletter-signup gradient panel, no oversized closing CTA — the footer is reference material, not a second hero.

## Hero Sections
- Left-aligned or centered text, generous top spacing (128px+ from nav on Desktop), one clear headline (`display-lg` or `display-xl`), one supporting line (`body-lg`, `color-text-secondary`, max 60 characters/line), one primary + one ghost CTA.
- No stock photography. No abstract 3D blob. See §8 Imagery.

## Pricing Cards
- Structure over ornamentation: plan name (`heading-md`), price (`display-lg`-scale numeral, mono figures), one-line positioning, feature list with `radius-sm` check icons in `color-accent`, single CTA per card.
- The recommended-plan card gets a `color-border-strong` + subtle `color-accent-border` outline — never a differently colored background or a "Most Popular" ribbon.

## Feature Cards
- Icon (see §6) top-left, `heading-sm` title, `body-sm` description, optional inline code or data snippet. Grid of 3 or 4, never more than 4 per row.

## Testimonials
- Used sparingly. Plain text quote in `body-lg`, attribution in `caption` + company logo in monochrome (grayscale, matched to `color-text-tertiary`) — logos never appear in their native brand color, to keep the page's palette disciplined.

## Timeline (Roadmap / Release History)
- Vertical line in `color-border-default`, nodes in `color-bg-surface-1` with `color-accent` ring when "current," `color-border-default` ring when past/future.
- Numbering used only where chronological order is the actual point (release history) — not decoratively on generic feature lists (see frontend-design principle on numbered markers).

## FAQ
- Accordion, `color-border-subtle` dividers, plus/minus icon (not chevron-rotate) to open/close — a subtle nod to precision/binary state rather than a generic accordion affordance.

## Release Cards / Changelog Entries
- Date in `caption` + mono, version tag as a `badge`, changes grouped under plain-text labels: **Added**, **Changed**, **Fixed**, **Removed** — never emoji bullets.

## Download Cards
- Platform icon (monochrome, see §6), platform name, version number in mono, single download button per platform. System requirements in `caption` below the button.

## Documentation Layout
- Three-column: sidebar nav (280px) / content (760px max) / on-page table-of-contents (200px, sticky, appears at Desktop+ only).
- Code blocks always show the language label top-left in `caption` style and a copy-icon top-right.

---

# 6. Icons

## Style
- **Stroke-based, geometric, never filled** (except for the small set of status/badge icons where a filled dot or check communicates state faster than an outline could).
- Stroke width: **1.5px** at 24×24px base grid (scales proportionally at other sizes — never a fixed 1.5px regardless of size).
- Corner treatment: **slightly rounded joins** (2px radius on stroke corners) to echo the logo's rounded-square-with-a-cut language, without becoming cartoonish. Terminals of open paths are squared, not round-capped — round caps read as "friendly," which conflicts with the brand.
- Recommended base library: **Lucide** (or a custom set built to the same stroke/geometry rules) — consistent, technical, no per-icon personality.

## Size System
`16px` (inline with `body-sm`/`caption` text) · `20px` (inline with `body-md`, default UI icon) · `24px` (standalone buttons, nav) · `32px` (feature card icons, empty states).

## Illustration Style
LeadForge OS does not use character illustration, mascots, or narrative scenes. Where an illustrative moment is needed (empty states, onboarding), it is built from the same primitives as the UI itself: line, grid, node, connector — abstracted diagrams of the product's own data model (a network of enriched contact nodes, a pipeline of stages), rendered in `color-text-tertiary` and `color-accent` only. The product illustrates itself; it never reaches for generic stock metaphors (rockets, light bulbs, high-fives).

## Empty States
- One diagram-style illustration (per above), one line of `body-md` explaining what's missing, one line of `body-sm`/`color-text-tertiary` explaining why, one primary action to resolve it. Never a joke, never an exclamation point.

---

# 7. Motion

## Philosophy
Motion in LeadForge OS exists to communicate state change and spatial continuity — never to entertain. If a person could screenshot two frames of an animation one second apart and not be able to tell what changed structurally, the animation is decorative and should be cut.

## Durations & Easing
| Token | Duration | Easing | Usage |
|---|---|---|---|
| `motion-instant` | 100ms | `ease-out` | Hover color/border changes, button press feedback |
| `motion-fast` | 150ms | `ease-out` | Dropdown open, tooltip appear, toggle switches |
| `motion-base` | 200ms | `cubic-bezier(0.2, 0, 0, 1)` | Modal/dialog enter-exit, panel expand/collapse |
| `motion-slow` | 300ms | `cubic-bezier(0.2, 0, 0, 1)` | Page-level transitions, scroll-triggered reveals (marketing only) |

No animation in the system exceeds 300ms. Nothing loops indefinitely except a loading spinner/progress indicator, and even those prefer a determinate progress bar wherever the underlying operation supports it.

## Page Transitions
Marketing site: content fades and shifts 8px vertically on scroll-into-view, once, on first view only (no re-triggering on scroll-up/scroll-down). Dashboard/desktop app: no page transition animation — panel content swaps instantly, because in a productivity tool, transition animation is latency.

## Hover Interactions
- Color, border, and background transitions only (`motion-instant`).
- No scale/transform hovers on cards, buttons, or nav items — no "lift," no "grow." A hover state should feel like a light switching, not an object moving toward the user.

## Loading States
- Skeleton screens (using `color-bg-surface-2`/`3` blocks) for content that's about to render, not spinners, wherever layout is known in advance.
- Spinners reserved for indeterminate, short (<2s expected) operations. Long operations (enrichment batches, imports) get a determinate progress bar with a numeric count ("Enriching 214 / 500").

## Micro-interactions
- Toggle switches: 150ms slide, no bounce/overshoot easing.
- Copy-to-clipboard: icon swaps to a checkmark for 1.2s, no toast unless the action happened outside visual context (e.g., a background export finishing).

## What Should NEVER Animate
- Text content appearing character-by-character or "typewriter" style, anywhere.
- Logo animation on load (the logo is a mark, not a performance).
- Confetti, particle effects, or celebratory animation of any kind on success states — success is communicated by a calm checkmark and color change, nothing more.
- Parallax scrolling effects.
- Any animation triggered purely by page load with no user action or state change behind it, beyond the single first-view reveal described above.

---

# 8. Imagery

## Photography
Not used. LeadForge OS has no place for stock photography of people in offices, handshakes, or "diverse team collaborating around a laptop" imagery anywhere in the system, including marketing.

## Illustrations
See §6 — abstracted, data-primitive-based only (nodes, connectors, grids). No mascots, no isometric-office-scene illustrations, no line-art humans.

## Backgrounds
- Solid `color-bg-base` is the default and preferred background everywhere.
- Subtle texture is permitted only as a **very low-opacity (2–4%) grain/noise layer** on large hero backgrounds, to prevent flat black from banding on displays — never as a visible decorative pattern.
- No animated gradient backgrounds ("aurora" effects), no mesh gradients.

## Patterns / Abstract Graphics
- A restrained, technical dot-grid or fine line-grid (matching the 8px spacing system, rendered at ~4% opacity of `color-border-subtle`) may appear behind hero sections or architecture diagrams to reinforce the "engineered" feeling — always subordinate to content, never competing with it.
- Diagram-style graphics (system architecture, data flow) are welcome and encouraged on the marketing site's "Architecture" section — rendered in the same stroke/line language as the icon system.

## 3D
Not used in this version of the system. If introduced later, it must be restrained to a single hero moment (e.g., an exploded-view diagram of the desktop app's architecture) rendered in flat, unlit, technical style — never glossy/rendered "product shot" 3D with dramatic lighting.

## Gradients
Permitted only as **very subtle** (5–8% opacity difference) linear gradients used to add depth to large surfaces (e.g., a hero background transitioning from `color-bg-base` to a 4% lighter shade) — never as a visible, nameable color gradient (no orange-to-purple, no rainbow). If a person can name the two colors in the gradient, it's too strong.

## Glass / Blur
Used sparingly and only functionally: a sticky top nav may use a light backdrop-blur (8–12px) purely so text remains legible while scrolling beneath it — never as a decorative "frosted glass panel" aesthetic applied to cards or hero content.

## When to Use Imagery/Graphics
Screenshots of the actual desktop app (real UI, real data — anonymized where needed), architecture diagrams, and abstract data-primitive illustrations.

## When NOT to Use
Anything that could appear on a generic SaaS template: people photos, 3D blob shapes, gradient orbs, mascots, emoji as UI elements, isometric illustration scenes.

---

# 9. Landing Page Style (Structural Guidance — Not a Layout Build)

This section describes the *shape* of the future landing page's content, not its code or visual mockup, per this project's scope.

- **Hero:** Headline states what LeadForge OS is in one sentence using plain nouns, not metaphor ("A local-first desktop OS for finding and closing your next customer" — illustrative, not final copy). Supporting line addresses why desktop/local-first matters. Primary CTA: Download. Ghost CTA: View docs or Watch a 60-second walkthrough. A real screenshot of the desktop app anchors the hero visually — not an abstract graphic.
- **Features:** Organized around the stated philosophy — Transform → Execute → Grow — as three grouped sections rather than a flat grid of 9 disconnected feature cards. Order carries meaning here, so numbering/sequence treatment is appropriate (unlike a generic feature grid).
- **Architecture:** A section explaining local-first/hybrid sync in a real diagram (Electron shell, local SQLite cache, cloud source of truth) — this is where the "engineering-first" brand gets to prove itself with substance, not adjectives.
- **Downloads:** Platform cards per §5, version + changelog link visible, no arbitrary "coming soon" filler platforms.
- **Roadmap:** Timeline component (§5), status-tagged (Shipped / In Progress / Planned), sourced from real product status, not aspirational marketing bullets.
- **Release Timeline:** Reverse-chronological changelog entries (§5 Release Cards).
- **Documentation:** Entry point/teaser only on the marketing site, linking out to the full docs layout (§5).
- **FAQ:** Real objections a technical buyer would have (data ownership, offline behavior, pricing, migration from existing CRM) — not generic "Is my data safe?" filler.
- **Footer:** Reference-only, per §5.

---

# 10. Desktop Consistency

The website is not allowed to look like a "landing page for" the app — it must look like the **outermost surface of the same product.**

Concretely:
- Every color token, spacing value, radius, and type style used on the website is pulled from this document's tokens — none are website-specific.
- The website's top nav uses the same 64px height, the same border treatment, and the same logo lockup as the desktop app's title bar region.
- Buttons, badges, and cards on the website are the *same components*, not reinterpretations — a Primary button on the pricing page and a Primary button inside the desktop app should be visually identical.
- Screenshots of the real product appear early and often on the website — the marketing site's job is partly to prove the desktop app looks exactly like the marketing site claims.
- Documentation (often the most-visited "website" surface for a technical audience) uses the identical sidebar, type scale, and code-block treatment as any in-app help panel.

If a component needs to look meaningfully different between the website and the app, that's a signal the component isn't finished yet — not a reason to fork it.

---

# 11. Inspiration — Principles Extracted (Not Copied)

| Product | Principle extracted for LeadForge OS |
|---|---|
| **Linear** | Restraint as a brand signal; a single accent color used with extreme discipline; near-zero decorative motion. |
| **Raycast** | Dark-mode-first identity where the dark theme isn't a "mode" but the actual brand; heavy reliance on monospace for anything data/technical. |
| **Warp** | Making a technical/terminal-adjacent product feel premium through typography and spacing rather than skeuomorphic terminal styling. |
| **GitHub** | Documentation and changelog patterns that treat factual, dated, structured writing as a design material in itself. |
| **Vercel** | Confident use of negative space at hero scale; type-led hero sections with minimal supporting graphics. |
| **Stripe** | Docs-as-product-quality — the idea that documentation deserves the same design rigor as the marketing homepage. |
| **Framer** | Precision in motion — when Framer animates, it's always spatially meaningful (this reinforces LeadForge's Motion philosophy in §7, applied with more restraint). |
| **Arc Browser** | Permission to have exactly one moment of personality (their sidebar/Spaces concept) inside an otherwise utilitarian shell — LeadForge's equivalent "one moment" is the logo's diagonal cut, echoed subtly in icon corner treatment. |
| **Apple Developer / Pro Apps** | Technical audience does not need to be entertained to be persuaded — dense, well-organized information presented with genuine typographic care outperforms simplified marketing fluff for this audience. |
| **Notion** | Calm, generous whitespace even in information-dense product surfaces; structure communicated through spacing and hierarchy rather than visual noise. |

None of these products is being imitated directly — no direct component, layout, or graphic is lifted from any of them. What's extracted is *why* each of these products feels premium to a technical audience, applied to LeadForge's own subject matter (local-first execution, not chat, not automation-for-its-own-sake).

---

# 12. Governance — How This Document Gets Used

- Any new interface, screen, or marketing asset built for LeadForge OS starts from this document's tokens, not from a fresh visual decision.
- If a needed pattern isn't covered here (a component, a content type, a new surface), the correct move is to **extend this document** with a decision that follows its existing principles — not to improvise in the artifact being built.
- The logo is the one fixed point every other decision defends: nothing in color, type, motion, or imagery should compete with its quiet, engineered, single-cut geometry.
- Revisit this document only when the product itself fundamentally changes — not on a yearly "refresh" cycle. The design goal is durability, not seasonal relevance.