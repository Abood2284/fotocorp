# Fotocorp UI Context

## Visual Direction

Fotocorp should feel like a premium editorial stock platform: image-first, clean, gallery-like, and licensing-aware. Public pages should be closer to the disciplined browsing patterns of Shutterstock/Getty than to an admin dashboard. The public experience should foreground the image archive, search, editorial metadata, and access state without exposing implementation details.

Admin and account pages can be more operational and dense, but public pages should remain polished, spacious, and image-led.

---

## Color Palette

The palette is built on a warm-white base. The primary surface is pure white; all supporting surfaces shift toward warm paper and stone tones rather than the cool gray-blue tints common in generic SaaS UIs. This keeps photography dominant and gives the platform an archival, editorial weight.

**Mood:** Deep navy for authority. Warm off-white and stone for editorial cleanliness. Amber/gold as the premium licensing accent. Warm-tinted borders to avoid the cold sterility of neutral gray. Muted red exclusively for copyright, watermark, and destructive states.

---

## Current Theme Tokens

The active global tokens live in `apps/web/src/app/globals.css`.

### Backgrounds & Surfaces

| Role | CSS Variable | Value | Notes |
|---|---|---|---|
| Page background | `--background` | `#ffffff` | Pure white — primary surface |
| Card surface | `--card` | `#ffffff` | Same as background |
| Elevated surface | `--surface-elevated` | `#ffffff` | White for modal/popover lift |
| Warm paper | `--surface-warm` | `#faf8f5` | Subtle off-white; use for section bands, hero backs |
| Stone surface | `--surface-stone` | `#f3efe8` | Warmer muted surface; section dividers, alternating rows |
| Muted surface | `--muted` | `#ede9e0` | Warm muted fill; tag backgrounds, skeleton states |
| Amber wash | `--accent-wash` | `#fdf4e3` | Light amber tint; selected states, highlighted cards |
| Primary wash | `--primary-wash` | `#eef1f8` | Light navy tint; active nav, info states |

> **Removed:** `--surface-subtle: #f8fafc` — replaced by `--surface-warm` and `--surface-stone`. The original value had a cool blue cast that conflicted with the warm editorial base.

---

### Typography & Text

| Role | CSS Variable | Value |
|---|---|---|
| Primary text | `--foreground` | `#0d0f1a` |
| Body text | `--foreground-body` | `#4b5563` |
| Muted text | `--muted-foreground` | `#6b7280` |
| Caption text | `--foreground-caption` | `#9ca3af` |

---

### Brand — Primary (Navy)

| Role | CSS Variable | Value |
|---|---|---|
| Primary | `--primary` | `#1a2540` |
| Primary hover | `--primary-hover` | `#131c31` |
| Primary muted | `--primary-muted` | `#263460` |
| Primary wash | `--primary-wash` | `#eef1f8` |
| Primary foreground | `--primary-foreground` | `#ffffff` |

> **Updated from `#1e2a4a`** to `#1a2540` — marginally richer navy with a cooler ink quality that reads more authoritative against warm surfaces.

---

### Brand — Accent (Amber / Gold)

The accent communicates premium licensing, download CTAs, subscription actions, and watermark branding. It should never be overused — one strong focal point per screen.

| Role | CSS Variable | Value |
|---|---|---|
| Accent | `--accent` | `#c07c0a` |
| Accent hover | `--accent-hover` | `#9a6108` |
| Accent mid | `--accent-mid` | `#f0c96b` |
| Accent wash | `--accent-wash` | `#fdf4e3` |
| Accent foreground | `--accent-foreground` | `#ffffff` |

> **Updated from `#d97706`** to `#c07c0a` — deeper, richer amber that reads as gold rather than orange. Works better against white without looking like a warning state.

---

### Borders

| Role | CSS Variable | Value |
|---|---|---|
| Border | `--border` | `#e5dfd3` |
| Border subtle | `--border-subtle` | `#ede9e0` |
| Border strong | `--border-strong` | `#c9c0b0` |

> **Updated from cool-gray** (`#e5e7eb` / `#eef2f7`) to warm-tinted values. Cool gray borders look like generic SaaS against warm surfaces; warm borders read as intentional editorial design.

---

### Status & Copyright

| Role | CSS Variable | Value |
|---|---|---|
| Destructive | `--destructive` | `#b91c1c` |
| Destructive light | `--destructive-light` | `#fef2f2` |
| Copyright | `--copyright` | `#b91c1c` |

> `--copyright` is an alias for `--destructive` to make intent explicit in watermark and rights-related UI. Use it wherever the UI communicates content ownership, access restrictions, or watermark branding.

---

### Usage Rules

1. Use these semantic tokens before introducing any new raw hex value. New hex values require a documented token.
2. Never use `--surface-warm` or `--surface-stone` as card backgrounds — reserve them for section fills, hero areas, and alternating layout bands.
3. The amber accent (`--accent`) is for CTAs, download buttons, subscription prompts, and selected/active states only. It is not a general UI color.
4. `--copyright` / `--destructive` is used exclusively for copyright states, watermark UI, failed downloads, and destructive actions. Never repurpose it for general alerts.
5. Keep photography dominant — surfaces should be neutral enough to disappear behind images.

---

## Typography

### Loaded Fonts

| Font | Variable | Usage |
|---|---|---|
| Monument Grotesk | `--font-monument-grotesk` | Body, UI, labels, navigation, captions, admin — **currently loaded and active** |

Monument Grotesk is loaded from `apps/web/public/fonts/Monument_Grotesk` via `apps/web/src/lib/font.ts` and applied to the root layout. `globals.css` maps `body`, `heading`, `brand`, and `sans` tokens to this variable. It handles all UI text reliably.

---

### Recommended Addition — Display / Heading Serif

**Add:** [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) (or [DM Serif Display](https://fonts.google.com/specimen/DM+Serif+Display) as a lighter alternative) via Google Fonts in `apps/web/src/app/layout.tsx`.

**Why:** Monument Grotesk is a strong grotesque but lacks the archival editorial weight needed for display-level headlines — the kind used on homepage heroes, asset detail headers, and major section titles. A serif display font communicates authority, content ownership, and premium positioning in a way that a single-font grotesque system cannot. Getty Images, Reuters Photography, and Alamy all use serif or high-contrast display type for their key editorial moments.

**Token to add in `globals.css`:**

```css
--font-heading: var(--font-playfair-display);
```

**Pair logic:**
- `fc-display`, `fc-heading-1`, `fc-heading-2` → Playfair Display (editorial, authoritative)
- `fc-heading-3`, `fc-body-*`, `fc-label`, `fc-caption`, `fc-brand` → Monument Grotesk (clean, precise UI)

---

### Raleway — Action Required

`globals.css` currently maps `--font-heading: var(--font-raleway)`, but Raleway is **not loaded** in `apps/web/src/app/layout.tsx`. This means all `fc-heading-*` classes silently fall back to the browser default serif.

**Fix:** Either load Raleway in `layout.tsx` or replace the `--font-heading` token with the Playfair Display variable. The Playfair Display path is strongly recommended — Raleway is a display grotesque without the archival serif quality appropriate for this platform.

---

### Typography Classes

Use the existing classes where they fit:

| Class | Role | Font |
|---|---|---|
| `fc-display` | Homepage hero, major landing titles | Playfair Display |
| `fc-heading-1` | Page titles, asset detail headlines | Playfair Display |
| `fc-heading-2` | Section headings | Playfair Display |
| `fc-heading-3` | Sub-section, card titles | Monument Grotesk |
| `fc-body-lg`, `fc-body` | Body copy, captions | Monument Grotesk |
| `fc-label` | UI labels, filter chips, tabs | Monument Grotesk |
| `fc-caption` | Metadata, timestamps, credits | Monument Grotesk |
| `fc-brand` | Brand moments, taglines | Monument Grotesk |

---

## Layout Rules

- Public pages should have a full-width header feel and strong first-screen search/gallery context.
- Use a clean search hero or search band where search is primary.
- Keep trust/value sections compact; do not let them overpower the image archive.
- Home and search pages should use image mosaics or grids.
- Asset cards should stay clean and image-first.
- Metadata density belongs on asset detail pages, admin pages, and account pages.
- Filters should be URL-driven, compact, and shareable.
- Mobile should use collapsible filters or a filter button pattern rather than dense always-open sidebars.
- Detail pages should use a two-column layout where the preview remains the primary visual anchor and metadata/actions are scannable.

---

## Components and Surfaces

- **Public asset cards:** image-first, minimal metadata, safe preview URLs, hover/touch actions where appropriate.
- **Search/filter bar:** keyword input, sort, compact filter entry points, active chips, and URL-backed state.
- **Active filter chips:** clear labels, easy removal, no internal field names.
- **Asset detail:** headline, caption, event/category, date, photographer, Fotokey/ImageCode, copyright, keywords, gated actions, and related imagery.
- **Fotobox:** account grid/list with saved assets, safe previews, empty states, and removal actions.
- **Download history:** date/year filtering, safe thumbnails, status, size, and clear failure handling.
- **Admin tables/forms:** denser operational views for asset metadata, publish state, migration health, users, subscriptions, and audit.
- **Admin media tunnels:** actions should feel controlled and permissioned; never expose storage language beyond high-level status.

---

## Copy Style

- Professional, direct, and licensing-aware.
- Do not promise unwatermarked comps, instant licensing, payment checkout, semantic search, or contributor workflows unless implemented.
- Avoid exposing technical storage language to public users. Use user-facing terms such as preview, image, download, access, subscription, and Fotokey.
- Admin screens may mention R2 mapping or derivative readiness as operational status, but should not reveal object keys or bucket names in browser-visible UI.
- Failed downloads should show understandable inline errors when possible, not raw JSON or internal codes.

---

## UX Invariants

1. No card metadata clutter on search/home grids.
2. Detail page shows headline, caption, event/category, date, Fotokey/ImageCode, copyright, and keywords when available.
3. Subscriber actions clearly show entitlement state.
4. Non-subscribers see upgrade/access messaging, not broken controls.
5. Failed downloads show safe user-facing messages.
6. Public preview images are watermarked derivatives only.
7. Browser-visible URLs and payloads must not expose private storage or internal API details.
8. Admin UI can show operational health, but not private R2 object keys, signed URLs, direct R2 URLs, or internal secrets.