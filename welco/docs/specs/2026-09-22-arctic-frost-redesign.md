# Welco Arctic Frost Redesign Specification

> **Status:** Approved direction for implementation
> **Date:** 2026-09-22
> **Scope:** All Vue views under `src/views/`, shared shells, reusable UI components, and responsive/accessibility foundations

## 1. Design Brief

- **Purpose:** Make every Welco page feel like one precise clinical-operations product: easy to scan, trustworthy, and fast to use.
- **Audience:** Buyers, providers, procurement teams, administrators, support staff, and first-time visitors on mobile, tablet, and desktop.
- **Tone:** Arctic Frost — cold clarity, clinical precision, winter light.
- **Reference:** Hospital wayfinding, surgical-instrument catalogs, and compliance reporting.
- **Palette:** Pale blue-white canvas, white surfaces, steel ink, one deep-blue accent, semantic status colors.
- **Type:** Jura for Latin display headings, IBM Plex Sans for body text, JetBrains Mono for identifiers and metrics.
- **Memorable:** Every page has a clear context strip, status marker, and one primary action.
- **Restraint:** No heading gradients, decorative card stacks, excessive shadows, mixed radii, or dark mode in the first release.

## 2. Visual System

```css
:root {
  --base: #f4f8fc;
  --surface: #ffffff;
  --surface-soft: #edf4ff;
  --line: #d8e4f0;
  --line-strong: #b8c9da;
  --ink: #0f1b28;
  --ink-2: #42576b;
  --ink-3: #67809a;
  --accent: #15588f;
  --accent-hover: #0f4777;
  --accent-soft: #e3eef8;
  --accent-ink: #f0f7ff;
  --success: #166534;
  --success-soft: #dcfce7;
  --warning: #92400e;
  --warning-soft: #fef3c7;
  --danger: #b91c1c;
  --danger-soft: #fee2e2;
  --info: #0369a1;
  --info-soft: #e0f2fe;
  --font-display: "Jura", "Trebuchet MS", sans-serif;
  --font-text: "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --radius: 6px;
  --shadow-near: 0 1px 2px rgba(15, 27, 40, 0.06);
  --shadow-far: 0 12px 28px -12px rgba(15, 27, 40, 0.18);
  --focus: 0 0 0 3px rgba(21, 88, 143, 0.16), 0 0 0 5px #15588f;
}
```

The existing semantic aliases (`--brand`, `--bg-app`, `--fg-heading`, `--wl-*`) remain available during migration and resolve to the Arctic Frost tokens. Raw hex values are confined to the root token layer.

## 3. Shared Architecture

1. **Global shell:** `App.vue`, `AppHeader.vue`, `AppFooter.vue`, `AppMobileNav.vue`, and the skip-link/focus behavior establish one public chrome.
2. **Operations shell:** `DashboardShell.vue`, `AdminLayout.vue`, and `ProviderLayout.vue` establish one dense sidebar/content pattern for admin, staff, and provider routes.
3. **Authentication shell:** `AuthShell.vue` establishes a centered, accessible form canvas with a clear Welco identity panel.
4. **Page primitives:** standardize page headers, breadcrumbs, section headers, cards, tables, filters, empty/error/loading states, and action bars through shared CSS classes and existing UI components.
5. **Route families:** public/content, marketplace, account/auth, admin/provider, and support pages are redesigned against the same primitives without changing business logic or data contracts.

## 4. Page-Family Requirements

### Public and Content

- Home, catalog landing pages, About, Locations, Certifications, Providers, OEM, and Provider Storefront pages use a restrained editorial rhythm rather than repeated promotional card stacks.
- Hero sections have one clear value statement, one primary action, and a secondary path.
- Category/provider lists use scannable rows or compact cards with consistent metadata and hover/focus states.
- Certification and compliance content prioritizes trust markers, document status, and clear next actions.

### Marketplace

- Catalog uses a stable filter/search toolbar, responsive product grid, clear price/MOQ metadata, and distinct wishlist/cart actions.
- Product detail separates product identity, supplier/stock status, quantity/inquiry actions, specifications, media, and related items.
- Cart, checkout, confirmation, tracking, and wishlist preserve current flows while using consistent tables, summaries, progress, empty, error, and success states.

### Account and Authentication

- Account dashboard becomes an operations overview with KPI tiles, pipeline status, action queues, and direct links to RFQs, quotes, orders, certifications, wishlist, and addresses.
- List/detail pages use one page header, filters where useful, semantic tables/lists, status labels with text, and clear back/navigation paths.
- Login, registration, recovery, reset, email verification, and OTP pages use one AuthShell, visible labels, correct input types/autocomplete, field-level errors, and keyboard-safe actions.

### Admin, Provider, and Support

- Admin pages use the operations shell with a compact sidebar, page title/context strip, action bar, semantic tables, and responsive overflow behavior.
- Provider catalog/categories use the same dense data patterns, with clear publishing/status states.
- Help Center and My Tickets use readable article/ticket lists, status filters, empty states, and clear escalation actions.

## 5. State and Interaction Coverage

Every data-bearing view must account for:

- First-load skeleton or loading state.
- Empty first-use state with a primary action.
- No-results state that echoes filters and offers reset.
- Recoverable error state with retry.
- Partial data state where applicable.
- Permission/denied state without exposing raw errors.
- Success confirmation that explains what changed.
- Disabled, hover, active, focus-visible, and loading states for interactive controls.

Filters, tabs, and meaningful modal state should remain understandable after refresh where the existing route supports it. No destructive action is represented by color alone.

## 6. Accessibility and Responsive Requirements

- Target WCAG 2.2 Level AA.
- One `main` landmark, logical heading order, labeled navigation, and a visible skip link.
- Native buttons, links, inputs, selects, tables, and dialogs are preferred over custom ARIA widgets.
- Every icon-only control has an accessible name; decorative icons are hidden from assistive technology.
- Focus is visible on every interactive element and is never removed without an equivalent ring.
- Body text uses `--ink` or `--ink-2`; `--ink-3` is limited to metadata/captions.
- Touch targets are at least 44px on mobile; no interaction depends on hover.
- Test at 320px, 768px, 1024px, and 1440px; no horizontal page overflow.
- Respect `prefers-reduced-motion`.

## 7. Implementation Order

1. Arctic Frost token layer, global base styles, focus states, and shared shell primitives.
2. Public/content page family.
3. Marketplace page family.
4. Account and authentication page family.
5. Admin, provider, and support page family.
6. Cross-page token audit, responsive visual review, accessibility review, tests, typecheck, lint, and production build.

## 8. Acceptance Criteria

- All tracked views under `src/views/` use the Arctic Frost semantic token layer.
- Shared public, operations, and authentication shells are visually consistent.
- No gold/amber decorative heading treatment remains.
- No undefined `--wl-*` token references remain in production views or shared components.
- Hardcoded colors in scoped styles are removed except for explicitly approved token definitions.
- All interactive controls have visible focus and complete state styling.
- Critical flows remain functionally intact.
- `npm run type-check`, `npm test`, `npm run lint`, and `npm run build` pass after implementation.
