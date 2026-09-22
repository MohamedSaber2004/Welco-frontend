# Plan: Clinical Precision Landing Pages & Dashboards — UX Redesign

**Date:** 2026-09-22
**Status:** Draft
**Objective:** Produce professional landing pages and dashboards using the Clinical Precision color palette found in the project, applied consistently across **all pages, components, layouts, UI components, and reusable components** — considering the HTML, CSS, and JS in each.

---

## Phase 1 — Full Audit & Inventory (Week 1)

### 1.1 Pages Inventory (55+ views across 9 route groups)

#### Landing Pages (public & marketing)
- `src/views/HomeView.vue` — Public landing (hero, providers, categories, certifications, about)
- `src/views/catalog/LandingPageView.vue` — Dynamic catalog landing pages
- `src/views/AboutView.vue` — About page
- `src/views/LocationsView.vue` — Locations/territories page
- `src/views/quality/CertificationsView.vue` — Certifications listing
- `src/views/trade/ProvidersView.vue` — Provider directory (trade)
- `src/views/trade/OemView.vue` — OEM/contract manufacturing page
- `src/views/trade/ProviderStorefrontView.vue` — Provider storefront detail

#### Category & Marketplace Pages
- `src/views/catalog/CategoriesView.vue` — Category listing
- `src/views/catalog/CategoryProvidersView.vue` — Providers per category
- `src/views/marketplace/CatalogView.vue` — Product catalog
- `src/views/marketplace/ProductDetailView.vue` — Product detail
- `src/views/marketplace/CartView.vue` — Shopping cart
- `src/views/marketplace/WishlistView.vue` — Wishlist
- `src/views/marketplace/CheckoutView.vue` — Checkout flow
- `src/views/marketplace/OrderConfirmationView.vue` — Order confirmation
- `src/views/marketplace/OrderTrackingView.vue` — Order tracking
- `src/views/marketplace/SearchResultsView.vue` — Search results (if exists)

#### Account Dashboard Pages (buyer/organization)
- `src/views/account/AccountDashboardView.vue` — Client portal dashboard
- `src/views/account/OrderHistoryView.vue` — Order history
- `src/views/account/OrderDetailView.vue` — Order detail
- `src/views/account/QuoteListView.vue` — Quote list
- `src/views/account/QuoteDetailView.vue` — Quote detail
- `src/views/account/RfqListView.vue` — RFQ list
- `src/views/account/RfqDetailView.vue` — RFQ detail
- `src/views/AddressesView.vue` — Address management
- `src/views/ProfileView.vue` — User profile

#### Admin Dashboard Pages (staff/admin)
- `src/views/admin/AdminDashboardView.vue` — Admin overview (KPIs, charts, audit)
- `src/views/admin/SalesAdminView.vue` — Sales admin
- `src/views/admin/OrdersAdminView.vue` — Orders admin
- `src/views/admin/UsersAdminView.vue` — User management
- `src/views/admin/CompaniesAdminView.vue` — Company management
- `src/views/admin/CategoriesAdminView.vue` — Category management
- `src/views/admin/CertificationsAdminView.vue` — Certification admin
- `src/views/admin/CitiesAdminView.vue` — City management
- `src/views/admin/CountriesAdminView.vue` — Country management
- `src/views/admin/ZonesAdminView.vue` — Zone management
- `src/views/admin/PagesAdminView.vue` — CMS pages
- `src/views/admin/TicketsAdminView.vue` — Support tickets
- `src/views/admin/HelpAdminView.vue` — Help center admin
- `src/views/admin/AuditLogAdminView.vue` — Audit logs

#### Auth Pages
- `src/views/auth/LoginView.vue` — Login
- `src/views/auth/RegisterView.vue` — Registration
- `src/views/auth/ForgotPasswordView.vue` — Forgot password
- `src/views/auth/ResetPasswordView.vue` — Reset password
- `src/views/auth/VerifyEmailView.vue` — Email verification
- `src/views/auth/VerifyPasswordOtpView.vue` — OTP verification

#### Support & Help
- `src/views/support/HelpCenterView.vue` — Help center
- `src/views/support/MyTicketsView.vue` — My tickets

#### Utility / System
- `src/views/ErrorView.vue` — Error page
- `src/views/NotFoundView.vue` — 404
- `src/views/MaintenanceView.vue` — Maintenance mode

### 1.2 Layout Components (6 shells)
- `src/components/layout/AppHeader.vue` — Global sticky header (819 lines, ~40 CSS variables used)
- `src/components/layout/AppFooter.vue` — Global footer (262 lines, ~20 CSS variables used)
- `src/components/layout/AppMobileNav.vue` — Mobile bottom nav + bottom sheet (973 lines, ~25 CSS variables used)
- `src/components/layout/DashboardShell.vue` — Dashboard sidebar/rail shell (494 lines, ~30 CSS variables used)
- `src/components/layout/AdminLayout.vue` — Admin layout wrapper (90 lines, passes to DashboardShell)
- `src/components/layout/ProviderLayout.vue` — Provider layout wrapper (37 lines, passes to DashboardShell)

### 1.3 UI Components (30+ in `src/components/ui/`)
- `src/components/ui/BaseButton.vue` — Button variants (primary, secondary, ghost, outline, danger, gold)
- `src/components/ui/BaseCard.vue` — Card container (hover, padding variants)
- `src/components/ui/BaseInput.vue` — Form input
- `src/components/ui/AppInput.vue` — Enhanced input
- `src/components/ui/BaseModal.vue` — Modal dialog
- `src/components/ui/AppButton.vue` — App-styled button
- `src/components/ui/StatCard.vue` — KPI stat tile (274 lines, 8 tone variants)
- `src/components/ui/StatusPill.vue` — Status indicator pill
- `src/components/ui/ToastContainer.vue` — Toast notifications
- `src/components/ui/WhatsAppFab.vue` — WhatsApp floating action button
- `src/components/ui/SkeletonLoader.vue` — Loading skeleton
- `src/components/ui/GlobalLoader.vue` — Global loading indicator
- `src/components/ui/GlobalLoading.vue` — Global loading overlay
- `src/components/ui/LoadingBar.vue` — Progress bar
- `src/components/ui/DataState.vue` — Loading/empty/error state wrapper
- `src/components/ui/EmptyState.vue` — Empty state illustration
- `src/components/ui/ErrorState.vue` — Error state illustration
- `src/components/ui/BackButton.vue` — Back navigation button
- `src/components/ui/AppImage.vue` — Image with placeholder
- `src/components/ui/CurrencySelect.vue` — Currency selector
- `src/components/ui/PhoneInput.vue` — Phone number input
- `src/components/ui/QuantityStepper.vue` — Quantity increment/decrement
- `src/components/ui/FileUpload.vue` — File upload component
- `src/components/ui/ConfirmDialog.vue` — Confirmation dialog
- `src/components/ui/ResultModal.vue` — Result modal
- `src/components/ui/SocialMediaIcons.vue` — Social icons
- `src/components/ui/ChainSteps.vue` — Step/timeline component
- `src/components/ui/Pagination.vue` — Pagination (if exists)

### 1.4 Shared & Account Components
- `src/components/account/AccountNav.vue` — Account sidebar navigation
- `src/components/auth/AuthShell.vue` — Auth page layout wrapper

### 1.5 Design Token Audit Findings

#### Tokens defined in design-tokens.css (source of truth):
Raw palette: `--color-brand-50` through `--color-brand-900`, `--color-neutral-0` through `--color-neutral-900`, `--color-teal-*`, `--color-cyan-*`, `--color-amber-*`, `--color-rose-*`, `--color-orange-*`, `--color-green-*`, `--color-violet-*`, `--color-success-*`, `--color-warning-*`, `--color-danger-*`, `--color-info-*`, `--chart-*`

Semantic tokens: `--bg-app`, `--bg-surface`, `--bg-sidebar`, `--bg-subtle`, `--bg-hover`, `--bg-overlay`, `--fg-heading`, `--fg-body`, `--fg-muted`, `--fg-subtle`, `--fg-placeholder`, `--fg-on-brand`, `--fg-link`, `--brand`, `--brand-hover`, `--brand-soft`, `--brand-gradient`, `--secondary`, `--secondary-hover`, `--secondary-soft`, `--tertiary`, `--tertiary-hover`, `--border`, `--border-strong`, `--border-focus`, `--fg-success`, `--fg-warning`, `--fg-danger`, `--fg-info`, font/spacing/radius/elevation/motion/z-index tokens.

#### Tokens bridge in tokens.css:
Maps legacy `--wl-*` tokens to Clinical Precision semantic tokens. All `--wl-*` tokens defined here have valid mappings.

#### Critical Token Issues Found:

**HomeView.vue (2103 lines):**
- Line 723: `hero h1 em` uses `--wl-gradient-gold` (gold gradient) → Should use `--brand-gradient` (Navy→Teal)
- Line 727: `filter: var(--wl-gold-text-filter)` → Remove or set to `none`
- Line 1459: `.section__eyebrow` uses `--wl-gold` (amber) → Should use `--brand` (Navy #0F3D56)
- Line 1464: `text-shadow: var(--wl-gold-text-shadow)` → Remove (no text shadow needed)
- Line 1472: `.section-title` uses `--wl-gold-text` → Should use `--fg-heading` (#102A43)
- Line 1473: `text-shadow: var(--wl-gold-text-shadow)` → Remove
- Line 1148: `.provider-tile__badge` uses `rgba(87, 242, 135, 0.35)` → Should use `--color-success-100`
- Line 1447: `.home-cert-card__title` uses `--wl-text` → Should use `--fg-heading`

**AdminDashboardView.vue (2348 lines):**
- Line 1222: `.dash-eyebrow` uses `--wl-gold` → Should use `--brand`
- Line 1227: `text-shadow: var(--wl-gold-text-shadow)` → Remove
- Line 1237: `.dash-title` uses `--wl-gradient-gold` → Should use `--brand-gradient`
- Line 1241: `filter: var(--wl-gold-text-filter)` → Remove
- Line 1325: `.chart-eyebrow` uses `--wl-gold` → Should use `--brand`
- Line 1331: `text-shadow: var(--wl-gold-text-shadow)` → Remove
- Line 1339: `.chart-title` uses `--wl-gold-text` → Should use `--fg-heading`
- Line 1341: `text-shadow: var(--wl-gold-text-shadow)` → Remove
- Line 144: `territoryData` uses `var(--wl-primary-light)` → **UNDEFINED** in tokens.css, should be `--color-brand-400` or `--chart-1`
- Line 145: `territoryData` uses `var(--wl-primary-active)` → **UNDEFINED** in tokens.css, should be `--brand-hover` or `--secondary-hover`
- Line 163-166: `platformData` uses `var(--wl-primary-light)`, `var(--wl-primary-active)`, `var(--wl-success)`, `var(--wl-warning)` → `--wl-primary-light` and `--wl-primary-active` are undefined
- Line 1881: `.queue-icon--amber` uses `rgba(245, 158, 11, 0.12)` → Should use `--color-warning-100`
- Line 1886: `.queue-icon--indigo` uses `rgba(105, 169, 255, 0.12)` → Should use `--brand-soft`
- Line 1929: `.priority-chip` uses `rgba(245, 158, 11, 0.12)` → Should use `--color-warning-100`
- Line 1989-1990: `.role-badge--admin` uses `rgba(105, 169, 255, 0.12)` → Should use `--brand-soft`
- Line 2099: `.role-badge--admin` (duplicate section) uses `rgba(105, 169, 255, 0.12)` → Should use `--brand-soft`
- Line 2111: `.role-badge--org` uses `rgba(245, 158, 11, 0.12)` → Should use `--color-warning-100`
- Line 2151: `.badge--red` uses `rgba(239, 68, 68, 0.12)` → Should use `--color-danger-100`
- Line 2332: `.modal-error-banner` uses `rgba(237, 66, 69, 0.35)` → Should use `--color-danger-100`
- Line 1592: `.lineage-fill` uses `rgba(105, 169, 255, 0.25)` hardcoded shadow → Should use `--shadow-brand`
- Line 1646: `.donut-segment:hover` uses `rgba(105, 169, 255, 0.35)` → Should use `--brand-soft`
- Line 2078: `.entity-chip` uses `--wl-radius-technical` → **UNDEFINED** token, should be `--radius-xs`

#### Token Health Summary:
- ✅ Correctly used tokens: `--brand`, `--brand-hover`, `--brand-soft`, `--fg-heading`, `--fg-body`, `--fg-muted`, `--fg-on-brand`, `--bg-surface`, `--bg-subtle`, `--bg-hover`, `--border`, `--border-strong`, `--border-focus`, `--color-success-*`, `--color-danger-*`, `--color-warning-*`, `--color-brand-*`, `--chart-*`, `--shadow-brand`, `--ring-focus`
- ⚠️ Legacy tokens with valid aliases: `--wl-primary` (→`--brand`), `--wl-primary-hover` (→`--brand-hover`), `--wl-primary-soft` (→`--brand-soft`), `--wl-secondary` (→`--secondary`), `--wl-success` (→`--fg-success`), `--wl-danger` (→`--fg-danger`), `--wl-warning` (→`--fg-warning`), `--wl-surface` (→`--bg-surface`), etc.
- ❌ **UNDEFINED tokens** (no fallback): `--wl-primary-light` (used in AdminDashboardView), `--wl-primary-active` (used in AdminDashboardView), `--wl-radius-technical` (used in AdminDashboardView)
- ❌ **Hardcoded colors** to replace: `rgba(105, 169, 255, ...)` (appears 6+ times, should be `--brand-soft`/`--color-brand-200`), `rgba(245, 158, 11, ...)` (appears 4+ times, should be `--color-warning-100`), `rgba(239, 68, 68, ...)` (should be `--color-danger-100`), `rgba(87, 242, 135, ...)` (should be `--color-success-100`), `rgba(237, 66, 69, ...)` (should be `--color-danger-100`)

### 1.6 Output
- `docs/plans/2026-09-22-audit-report.md` — complete inventory with per-page/component token health status, color usage analysis, and specific issue locations

---

## Phase 2 — Landing Page Production (Week 2)

### 2.1 HomeView (Public Landing) — Priority: Critical
Fix token issues (lines 723, 727, 1459, 1464, 1472, 1473, 1148, 1447):
- Hero H1 accent: Replace gold gradient/trim with `--brand-gradient` (Navy→Teal)
- Section eyebrow: Replace amber `--wl-gold` with Navy `--brand`
- Section title: Replace gold text with `--fg-heading` (#102A43), remove gold text shadow
- Provider badge: Replace hardcoded green rgba with `--color-success-100`
- Cert title: Replace `--wl-text` with `--fg-heading`

After fixes, verify:
- Hero CTAs: Primary button = Navy bg + white text, Secondary = White surface + Navy border
- Provider cards: White surface, precision border, hover lift with Navy border
- Category cards: White surface, hover effect, Navy text, Teal count label
- About section: Navy heading text, Canvas background, Teal CTA accents

### 2.2 LandingPageView (Catalog) — Priority: High
- Verify all sections use Clinical Precision tokens
- Dynamic page layout consistency check across all slugs
- CTA buttons: Navy primary, Teal secondary
- Data tables: White surface, precision borders, Teal hover

### 2.3 Trade Pages — ProvidersView, OemView, ProviderStorefrontView — Priority: High
- Navy sidebar via AdminLayout for admin-staff views
- Steel Teal accent borders on product/company cards
- Data tables with Clinical Precision striping
- StatCard components with proper tone mapping (emerald=success, amber=warning, slate=neutral)

### 2.4 Content Pages — AboutView, LocationsView, CertificationsView, CategoryProvidersView — Priority: Medium
- Uniform header/footer via AppHeader/AppFooter
- Navy H2 headings, Teal links, Cyan accent highlights
- Form inputs with clinical focus ring (`--border-focus: #147D92`)

---

## Phase 3 — Dashboard Production (Week 3)

### 3.1 AdminDashboardView — Priority: Critical
Fix all token issues (lines 1222, 1227, 1237, 1241, 1325, 1331, 1339, 1341, 144, 145, 163-166, 1881, 1886, 1929, 1989, 2099, 2111, 2151, 2332, 1592, 1646, 2078):
- Dashboard eyebrow & chart titles: Replace gold with Navy
- Dashboard title: Replace gold gradient with Navy→Teal brand gradient
- Chart telemetry: Replace undefined `--wl-primary-light`/`--wl-primary-active` with `--color-brand-400`/`--brand-hover`
- Queue icons: Replace hardcoded rgba with Clinical Precision soft tokens
- Role badges: Replace hardcoded rgba with `--brand-soft`, `--color-warning-100`, `--color-danger-100`
- Donut chart hover: Replace hardcoded rgba with `--brand-soft`
- Entity chip: Replace undefined `--wl-radius-technical` with `--radius-xs`

### 3.2 AccountDashboardView — Priority: High
- Verify all sections use Clinical Precision tokens
- Account nav (AccountNav.vue) styling audit
- Order/quote/RFQ tables with proper token usage
- Status pills (StatusPill.vue) — verify color mapping

### 3.3 Admin Sub-Pages (SalesAdminView, OrdersAdminView, UsersAdminView, CompaniesAdminView, CategoriesAdminView, CertificationsAdminView, CitiesAdminView, CountriesAdminView, ZonesAdminView, PagesAdminView, TicketsAdminView, HelpAdminView, AuditLogAdminView) — Priority: Medium
- Each page uses AdminLayout → DashboardShell (consistent navy rail, white content)
- Verify StatCard tone usage across all pages
- Verify data table styling consistency

### 3.4 Auth Pages (LoginView, RegisterView, ForgotPasswordView, ResetPasswordView, VerifyEmailView, VerifyPasswordOtpView) — Priority: Medium
- Use AuthShell layout
- Clinical Precision form styling (Navy labels, Teal focus, white cards)
- Primary button = Navy, Secondary = White + Navy border

### 3.5 Support Pages (HelpCenterView, MyTicketsView) — Priority: Low
- Consistent with content pages
- Ticket status pills using Clinical Precision colors

---

## Phase 4 — Component Standardization (Week 4)

### 4.1 Layout Components — Priority: Critical (foundational)
- **AppHeader**: Already compliant — uses `--brand`, `--brand-hover`, `--fg-on-brand`, `--border`, `--bg-surface`, `--bg-subtle`, `--ring-focus`, `--shadow-brand`. Verify mobile nav drawer styling consistency.
- **AppFooter**: Already compliant — uses `--brand`, `--brand-soft`, `--fg-success`, `--fg-success-soft`. Verify link hover colors use `--brand`.
- **AppMobileNav**: Already compliant — uses `--wl-primary` (alias ✅), `--wl-success`, `--wl-warning`, `--wl-danger`, `--wl-accent`. Verify sheet items use `--color-warning-100` not hardcoded rgba for amber backgrounds.
- **DashboardShell**: Already compliant — uses `--brand` for active nav, `--bg-hover` for hover, `--shadow-brand` for active item. Verify collapsed rail styling.
- **AdminLayout** / **ProviderLayout**: Pass-through wrappers. Verify slot content receives correct token context.

### 4.2 UI Components — Priority: High
- **BaseButton**: Already compliant — primary=`--brand`, secondary=`--bg-surface`, danger=`--color-danger-500`. Verify `--variant: 'gold'` (line 84-92) uses `--brand-soft` instead of legacy gold meaning.
- **BaseCard**: Already compliant — `--bg-surface`, `--border`, `--radius-lg`, `--shadow-sm`.
- **StatCard**: Already compliant — uses `--color-rose-100`, `--color-green-100`, `--color-orange-100`, `--brand-soft`, `--fg-success`, `--fg-danger`, `--fg-warning`. Verify tone prop mappings are consistent across all call sites.
- **BaseModal**, **BaseInput**, **AppInput**: Audit for Clinical Precision token usage.
- **StatusPill**: Audit color mapping — should use `--fg-success`, `--fg-warning`, `--fg-danger`, `--fg-info` with corresponding soft backgrounds.
- **ToastContainer**: Verify toast colors use Clinical Precision feedback tokens.
- **SkeletonLoader**, **GlobalLoader**, **LoadingBar**: Verify neutral tones use `--fg-muted` not hardcoded greys.
- **DataState**, **EmptyState**, **ErrorState**: Verify illustration and text colors.
- **AppImage**, **BackButton**, **CurrencySelect**, **PhoneInput**, **QuantityStepper**, **FileUpload**, **ConfirmDialog**, **ResultModal**: Per-component audit.

### 4.3 Account & Auth Components
- **AccountNav**: Audit sidebar navigation tokens (should match DashboardShell pattern)
- **AuthShell**: Verify auth page layout uses Clinical Precision cards and form styling

### 4.4 Hardcoded Color Migration
Replace all hardcoded rgba values with Clinical Precision token equivalents:
| Hardcoded | Token Replacement |
|-----------|------------------|
| `rgba(105, 169, 255, 0.12)` | `--brand-soft` (#E3EFFF) |
| `rgba(105, 169, 255, 0.25)` | `--color-brand-200` (#C8E6FF) or `--shadow-brand` |
| `rgba(105, 169, 255, 0.35)` | `--color-brand-300` (#A3CBEA) |
| `rgba(245, 158, 11, 0.12)` | `--color-warning-100` (#FEF3C7) |
| `rgba(245, 158, 11, 0.25)` | `--color-warning-100` with opacity border |
| `rgba(239, 68, 68, 0.12)` | `--color-danger-100` (#FFDAD6) |
| `rgba(237, 66, 69, 0.35)` | `--color-danger-100` |
| `rgba(87, 242, 135, 0.35)` | `--color-success-100` (#DCFCE7) |
| `rgba(100, 116, 139, 0.12)` | `--bg-subtle` (#EDF4FF) |
| `rgba(0, 10, 25, 0.06)` | `--shadow-xs` |
| `rgba(0, 10, 25, 0.02)` | `--shadow-xs` |
| `rgba(0, 0, 0, 0.1)` | `--shadow-xs` |
| `#627D98` | `--fg-muted` |
| `#42474D` | `--fg-body` |
| `#102A43` | `--fg-heading` |
| `#0F3D56` | `--brand` |
| `#147D92` | `--secondary` / `--brand-hover` |
| `#E3EFFF` | `--brand-soft` / `--bg-hover` |

---

## Phase 5 — Integration & QA (Week 5)

### 5.1 Token Migration Verification
- [ ] Run CSS variable coverage check: every `--wl-*` token used in codebase must resolve via tokens.css
- [ ] Zero undefined token references (`--wl-primary-light`, `--wl-primary-active`, `--wl-radius-technical`)
- [ ] Zero hardcoded rgba hex values in scoped styles (except `rgba(0, 10, 25, ...)` for shadows/overlays)
- [ ] All `filter: var(--wl-gold-text-filter)` removed or set to `none`
- [ ] All gold/amber accent colors (eyebrows, titles) replaced with Navy/Teal Clinical Precision colors

### 5.2 Cross-Browser/Device Testing
- Responsive: mobile nav (AppMobileNav 768px breakpoint), tablet grid, desktop sidebar (DashboardShell 900px breakpoint)
- Accessibility: contrast ratios (Navy on White = 12.6:1 ✓, Steel Teal on White = 4.5:1 ✓, White on Navy = 12.6:1 ✓)
- Keyboard navigation: focus indicators `--ring-focus` on all interactive elements
- RTL support: verify `[dir="rtl"]` styles in AppHeader, AppMobileNav, DashboardShell

### 5.3 Visual Regression
- Screenshot all 55+ pages (landing, dashboard, auth, utility)
- Compare against Clinical Precision palette reference
- Flag any page using gold/amber text accents or undefined tokens

### 5.4 Test Coverage
- Vitest tests for interactive components (BaseButton variants, StatCard tones, BaseModal open/close)
- Playwright tests for critical user flows (landing → catalog → cart → checkout)
- Dashboard tests (admin sidebar toggle, chart hover, stat card interactions)

---

## Phase 6 — Pages with HTML/CSS/JS Coverage Check

### 6.1 Per-Page Audit Checklist (all 55+ views)
Each view must be verified for:
- [ ] HTML structure uses semantic elements (`<header>`, `<section>`, `<nav>`, `<main>`, `<footer>`)
- [ ] CSS uses Clinical Precision tokens only (no hardcoded colors, no undefined tokens)
- [ ] JS has proper loading/error states (DataState integration)
- [ ] Responsive breakpoints tested (mobile < 768px, tablet 768-1024px, desktop > 1024px)
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation works (focus-visible with `--ring-focus`)

### 6.2 Per-Component Audit Checklist (all 30+ UI components)
Each component must be verified for:
- [ ] Props/Events/Slots documented
- [ ] CSS scoped styles use token variables
- [ ] Focus-visible states defined
- [ ] Disabled/hover/active states styled
- [ ] Composes with other components (e.g., BaseInput inside BaseModal)

---

## Acceptance Criteria

1. **All 55+ views** use Clinical Precision tokens — zero undefined token references, zero hardcoded legacy colors
2. **All 6 layout components** share consistent header/footer/sidebar patterns with token-based styling
3. **All 30+ UI components** follow the token system with proper variant/state styling
4. **Landing pages** have professional hero sections with Navy/Teal/Cyan palette (no gold/amber accents)
5. **Dashboards** have KPI cards, data tables, and charts in Clinical Precision palette (Navy headers, Teal accents, status colors)
6. **Zero hardcoded rgba values** in component styles (except shadow/overlay rgba which map to `--shadow-*` and `--bg-overlay`)
7. **Zero undefined tokens** (`--wl-primary-light`, `--wl-primary-active`, `--wl-radius-technical`) in production code
8. **Contrast ratios** meet WCAG AA (4.5:1 for body text, 3:1 for large text, 4.5:1 for UI components)
9. **Responsive** on mobile/tablet/desktop with tested breakpoints
10. **No console errors** or 404s on any page
11. **Vitest + Playwright** tests pass for critical user flows
12. **All reusable components** (DataTable, SearchBar, Pagination, Filters) standardized with token-based styling
