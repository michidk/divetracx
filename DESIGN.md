# Divetracx design system

## Atmosphere and identity

Divetracx is a calm, precise dive logbook. It combines a cool sea-glass page, crisp
white cards, deep-water ink, and a single teal accent. Dive data — depths, times,
pressures, gases, coordinates — should read like instrument output: compact,
aligned, and unambiguous.

Reliability is part of the visual identity. Profiles, maps, and pictures must show
useful content or an intentional empty state, never a broken placeholder. Imported
data is never silently altered by presentation: units, precision, and provenance
stay visible.

## Color

Use these semantic tokens from `src/styles.css`:

- Page: `--background`, `#f4f8f8`. The body adds a faint teal radial glow at the
  top right; do not repeat it inside components.
- Ink: `--foreground`, `#102c31`.
- Card: `--card` / `--card-foreground`, `#ffffff` / `#102c31`.
- Muted surface: `--muted`, `#e9f1f1`. Muted text: `--muted-foreground`,
  `#597176`.
- Accent surface: `--accent` / `--accent-foreground`, `#d9eeef` / `#102c31`.
  Used for icon tiles and selected rows, never for text emphasis.
- Primary action: `--primary` / `--primary-foreground`, `#087f8c` / `#f5ffff`.
- Border: `--border`, `#d3e1e2`.
- Destructive: `--destructive` / `--destructive-foreground`, `#dc2626` /
  `#ffffff`. Inline destructive text uses `text-red-600`.
- Warning: `--warning` / `--warning-foreground`, `#d97706` / `#92400e`.

Teal identifies interaction and current state, not decoration. Section
eyebrows, active navigation, icon tiles, focus rings, and the site-map pin all
derive from `--primary`.

Add new semantic roles to `src/styles.css` before using them. The one sanctioned
exception is data visualization: the dive-profile chart and per-tank series use a
fixed categorical palette (`#0891b2`, `#7c3aed`, `#ea580c`, `#16a34a`,
`#db2777`, `#4f46e5`) so tanks stay distinguishable regardless of theme.
Certification cards use a `from-primary via-primary to-cyan-800` gradient as
their card surface.

Agency logos use a rounded-rectangle frame everywhere they appear. Profile-card
agency badges show both the agency name and membership number and fall back to
initials when a logo cannot be loaded.

The profile certification list uses a star control to select up to eight
certifications for the Divetracx card. The card shows only starred certifications;
one to three starred items use one column, while four to eight use two columns.
Certification pill labels keep their full names and reduce their font size only
as needed to fit the available width.
When insurance details are recorded, the card footer shows the insurer, optional
plan, and policy number. It also shows the diver's emergency-contact name, phone,
and email when available.
On desktop, the Divetracx card and certifications occupy the profile page's left
column while the personal-details form occupies the right column.

Body text must meet WCAG 2.2 AA contrast on its actual surface. Form-control
outlines need at least 3:1 contrast with adjacent colors. There is currently a
single light theme; do not add `dark:` utilities piecemeal — a dark theme is a
token-level change.

## Typography

- UI and body: `Manrope`, sans-serif (`font-sans`).
- Data: `DM Mono`, monospace (`font-mono`). Use it for depths, durations,
  pressures, coordinates, certification numbers, serials, and dive numbers so
  columns of values align.

Scale:

- Page title: `text-4xl`, weight 600, `tracking-tight`; the hero variant grows
  to `md:text-5xl` with `text-balance`.
- Section eyebrow: `text-xs`, weight 700, uppercase, `tracking-[0.2em]`,
  `text-primary`. Muted eyebrows for grouped metadata use weight 500 or 600,
  `tracking-wide`, and `text-muted-foreground`.
- Section title: `text-xl` or `font-semibold` at body size, weight 600.
- Body: `text-sm` to `text-base`, weight 400 to 600.
- Helper text: `text-xs`, `text-muted-foreground`.

Body content never drops below 14px. Helper text, attribution, and control
labels may use 12px when legible.

## Spacing and layout

- The page frame is `mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12`.
- The header is sticky, `h-16`, `bg-background/90 backdrop-blur-xl`, with a
  `border-b border-border/80`.
- Cards use `p-5` or `p-6`; card headers stack with `gap-1.5`.
- Grids step from one column to `sm:grid-cols-2` and, for stat tiles,
  `lg:grid-cols-4`, with `gap-4` or `gap-5`.
- Minimum tap target is 44px: interactive controls use `min-h-11`, icon buttons
  `size-11`, list rows `min-h-16`.

## Radius and depth

- Cards, panels, buttons, and inputs: `rounded-2xl` for surfaces,
  `rounded-xl` for controls and inline tiles, `rounded-lg` for small badges and
  the `sm` button size.
- Surfaces are flat: `border border-border bg-card` with no shadow. Shadows are
  reserved for the brand mark (`shadow-lg shadow-primary/20`), error cards
  (`shadow-xl shadow-primary/5`), and the map pin.
- Layering uses transparency, not elevation: `bg-muted/40` for callouts,
  `bg-muted/50` for row hover, `color-mix` with `--card` for map controls.

## Components

Shared primitives live in `src/components/ui/` (shadcn-style wrappers over Base
UI): `alert`, `badge`, `button`, `card`, `checkbox`, `input`, `scroll-area`,
`select`, `textarea`. Domain components live in `src/components/`. When a UI
pattern gains a second consumer, promote it to a shared component with one
visual contract instead of copying classes.

### Buttons

`Button` variants: `default` (filled primary), `outline` (`border bg-card`),
`ghost`, `destructive`. Sizes: `default` (`min-h-11 px-5`), `sm`
(`min-h-9 rounded-lg px-3`), `lg` (`min-h-12 px-7`), `icon` (`size-11`). Every
button is `rounded-xl`, `text-sm font-semibold`, and shows a
`focus-visible:ring-2 ring-primary/30`. `SaveButton` wraps the pending state so
forms never show two competing submit affordances.

### Cards and stat tiles

`Card` is `rounded-2xl border border-border bg-card`; `CardLink` is the same
surface as a whole-card link. `StatCard` is an `article` with a `text-primary`
Lucide icon, a muted uppercase label, and a large mono value. Use it for
aggregate numbers on Overview, Stats, and detail pages.

### Badges and states

`Badge` variants: `default`, `secondary`, `outline`, `warning`, `destructive`.
Import statuses (discovered, new, changed, unchanged, failed) and integration
capabilities map onto these; do not introduce ad-hoc pill styles.

### Notifications

Sonner provides app-wide transient notifications at the bottom right. Use an
error toast for action failures whose inline location may be outside the current
viewport; keep field-validation errors directly beneath their fields. Toasts
must use plain-language titles and retain the actionable server message as their
description.

### Record lists

`DiveLinkList` and similar lists are `grid` rows with an icon tile
(`size-9 rounded-lg bg-accent text-primary`), a truncating primary label, a
mono trailing value, and a chevron. Rows separate with `border-b border-border`
and highlight with `hover:bg-muted/50`. Empty lists render a centered
`text-sm text-muted-foreground` sentence in the form "No dives yet."

### Forms

`EntityForm` provides the field stack and inline star rating. Dive editors select
existing taxonomy values; creating or renaming taxonomies belongs in Settings,
not alongside the dive fields. Dive operator and boat are adjacent taxonomy
selects in the main Dive section. The dive people picker is a searchable popover;
selected people render as rows with a role select and remove action. New
assignments default to Buddy. The Depth & time section carries the paper-logbook
extras — a safety-stop toggle with an inline minutes input, and a Dive tables
group with single-letter pressure-group inputs (upper-cased, mono) and residual
nitrogen time; total bottom time is derived and displayed read-only. Field labels are `text-sm font-medium`;
validation and server errors appear directly under the field in
`text-sm text-red-600` with `aria-live="polite"`. Recorded dive profiles, import
history, and external provenance are view-only and must not gain edit
affordances.

### Destructive actions

`DeleteRecordButton` renders a ghost button in `text-red-600`, asks for
confirmation before deleting, and reports failures inline with
`aria-live="polite"`. Never delete on the first click.

The AI access settings page groups MCP tools into Read, Create and update, and
Delete cards. Every tool has an independent switch, while the page-level MCP
switch pauses the endpoint without discarding clients or history. Destructive
tools and scopes use the destructive badge treatment; connected clients show
their live scopes and require confirmation before revocation.

### Media

`PictureGallery` is a `sm:grid-cols-2` grid of `aspect-[4/3]` images in
`rounded-xl bg-muted` frames with a subtle `hover:scale-[1.02]`. `PhotoManager`
adds upload and removal; failures show inline in red. Profile and buddy avatars
fall back to the bundled illustrated diver (`src/assets/diver-fallback.png`),
never to initials or an empty box.

### Certification cards

`CertificationCard` renders a physical-card-shaped surface with the teal
gradient, a bold tracked eyebrow, the certification name, and a mono card
number; scanned fronts and backs are bounded to `856×540`. Agency names, codes,
and logos under `public/agency-logos/` are resolved through
`src/modules/profile/agency-catalog.ts`.

### Dive profile chart

`dive-profile-chart.tsx` is hand-written SVG: depth on an inverted axis,
temperature and decompression-ceiling series, per-tank pressure lines in the
categorical palette, and tank-switch markers drawn as labelled circles with
connector lines and an `aria-label`. Axes use the mono face and gridlines use
`--border`. Do not introduce a charting library for this chart.

### Logbook dive diagram

When a dive has no recorded samples, `manual-dive-diagram.tsx` replaces the
chart with a paper-logbook schematic: the surface line steps down to a flat
bottom labelled with the bottom time, climbs back up through an optional
safety-stop shelf, and returns to the surface. Boxed values above the line
carry the pressure group before and after the surface interval, the interval
itself, and the ending pressure group; the depth panel lists average and
maximum depth; a sum line reads `RNT + ABT = TBT` in minutes. The sketch is
never scaled to the data — the kicker says "Schematic · not to scale" — and
missing values render as an em dash in `--muted-foreground`, never as zero.
The whole SVG is a single `role="img"` whose `aria-label` reads the numbers
out in prose.

### Site map

MapLibre GL in a `rounded-xl border` frame. The canvas is desaturated
(`saturate(0.72)`) so teal markers stay legible. Pins are 20px primary circles
with a card-colored ring; clusters show a mono count; the selected pin scales to
1.1 and raises its z-index. Controls are restyled to `rounded-xl` card surfaces
with `--accent` hover. `CoordinatePicker` reuses the same frame with a
click-to-pin interaction and a muted helper callout.

### Navigation

The header nav is icon-first: Dives, Sites, Buddies, Gear, Stats, Profile, and a
Settings gear. Labels are hidden below `lg`, so every item carries an
`aria-label`. The active item uses `bg-accent text-foreground`; inactive items
are `text-muted-foreground` and turn `text-foreground` on hover. Demo builds
show an amber read-only banner directly under the header.

### Error state

`AppError` is a centered `max-w-lg` card with a `size-14 rounded-2xl
bg-destructive/10 text-destructive` icon tile, a plain-language title, and the
technical message beneath in muted text.

## Content vocabulary and formatting

- Units follow the metric logbook convention: metres with one decimal, minutes as
  integers, bar as integers, °C with one decimal, coordinates as signed decimals
  with seven places.
- Dates are absolute and locale-formatted (`toLocaleString()` for timestamps,
  `yyyy-MM-dd` for date inputs); there is no relative time anywhere.
- Dive types are free-form and often German (they come from DiveMate);
  `dive-type-icon.ts` picks an icon by keyword and falls back to a fish. Do not
  normalize the user's names in the UI.
- Sentence case for headings and buttons; no trailing periods on labels.
- Empty states say what is missing and, when possible, how to fill it.

## Motion and interaction

- Transitions are `150ms ease-out` on color, opacity, and transform only.
- Hover scale is capped at 1.02 for images and 1.1 for map pins and rating
  stars.
- The map inspector uses `@starting-style` for its entrance; there is no other
  entrance animation.
- Respect `prefers-reduced-motion` when adding any new transform animation.

## Accessibility constraints

- Every interactive element has a visible focus style: a 2px `--primary`
  outline with `outline-offset: 3px` on links and buttons, or the
  `ring-primary/30` ring on shared controls.
- Icon-only controls carry `aria-label`; decorative icons carry
  `aria-hidden="true"`.
- Live regions (`aria-live="polite"`) announce form errors and async results.
- Touch targets are at least 44×44 CSS pixels; on coarse pointers or below
  640px the map inspector docks to the bottom edge.
- Verify changed routes at 375px, 768px, and 1280px with keyboard navigation.
