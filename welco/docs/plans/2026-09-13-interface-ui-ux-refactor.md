# Full Interface UI/UX Design System & Experience Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul and unify the entire Welco frontend user interface, aesthetic design system, interactive states, and user experience flows across all 46 views and 32 shared components using the `designing-frontend-interfaces` design philosophy with full bilingual (EN/AR RTL) support, strict token constraints, and WCAG AA accessibility.

**Architecture:** Lock a unified Navy Classic design system token foundation with calibrated Gold and Electric Blue accents, refactor shared UI primitives with 5-state interactive coverage and robust UX fallbacks (loading, empty, error, skeleton), reconstruct responsive shell layouts with precision mobile navigation, and refactor public, marketplace, customer portal, auth, and admin views systematically in discrete, verified domains.

**Tech Stack:** Vue 3 (Composition API / `<script setup>`), TypeScript, Tailwind CSS 3.4, Vue Router 4, PostCSS, `@tailwindcss/forms`, `@tailwindcss/container-queries`.

---

## Design Brief

```text
Purpose:    Comprehensive B2B medical equipment, procurement, and clinical marketplace platform
Audience:   Hospital procurement directors, clinical specialists, B2B vendors, and operations admins (desktop dense control rooms + mobile on-call clinicians)
Tone:       Precision Navy Classic — deep architectural navy surfaces, luminous clinical gold headers, crisp cyan-blue actions
Reference:  High-end medical telemetry workstations and Bloomberg terminal density meets modern Swiss typographic clarity
Palette:    Base: #061328 (deep navy) / Surface: #071A38 (panel) / Ink: #F4F8FF (stark light) / Accent: #FFD166 (gold) & #69A9FF (action blue)
Type:       Plus Jakarta Sans & Sora (Display/EN), Alexandria & IBM Plex Sans Arabic (AR RTL), Inter (Body), JetBrains Mono (Data/SKU)
Memorable:  Luminous gold header elevation badges and glass-etched tabular telemetry with instant responsive keyboard actions
Restraint:  No arbitrary border-radii, no muddy slate text on dark navy, no raw px spacing, no missing hover/focus/active/disabled states
```

---

## File Structure & Subsystem Breakdown

### 1. Design Tokens & Global Foundations
- `src/assets/tokens.css`: Core design tokens (color ramp, font scales, 4px spacing harmonic grid, unified navy shadows, micro-radii, motion curves).
- `src/assets/main.css`: Global baseline, RTL overrides, typography defaults, accessibility focus rings, table & grid rules.
- `tailwind.config.js`: Tailwind theme extension mapping semantic color variables, font families, and container queries.

### 2. Core UI Component Primitives (`src/components/ui/`)
- `AppButton.vue` & `BaseButton.vue`: Standardized buttons with all 5 states (rest, hover, active, focus-visible, disabled/loading).
- `AppInput.vue` & `BaseInput.vue`: Form controls with floating labels, error messages, prefix/suffix slots, and keyboard accessibility.
- `BaseCard.vue` & `StatCard.vue`: Card surfaces with elevated hierarchy, hover micro-interactions, and KPI metric formatting.
- `BaseModal.vue`, `ConfirmDialog.vue`, `ResultModal.vue`: Accessible focus-trapped dialogs with backdrop blur and fluid transitions.
- `StatusPill.vue`: Standardized state badges with semantic status colors (active, pending, completed, cancelled, warning).
- `EmptyState.vue`, `ErrorState.vue`, `DataState.vue`, `SkeletonLoader.vue`, `LoadingBar.vue`: Cohesive UX async lifecycle handlers.
- `AppPagination.vue` & `BasePagination.vue`: Precision tabular navigation with quick-jump and items-per-page controls.
- `ChainSteps.vue`, `FileUpload.vue`, `PhoneInput.vue`, `QuantityStepper.vue`, `CurrencySelect.vue`, `WhatsAppFab.vue`, `ToastContainer.vue`.

### 3. Layouts & Navigation Shells (`src/components/layout/` & `src/components/account/`)
- `AppHeader.vue`: Global header with category mega-menus, search bar, language/currency switcher, and notification badges.
- `AppFooter.vue`: Structured multi-column navigation, compliance seals, certifications, and localization footer.
- `AppMobileNav.vue`: Bottom dock with active state indicators, thumb-reach action zone, and badge counter.
- `AdminLayout.vue`: Collapsible operational rail with nested section grouping, breadcrumb bar, and system status indicator.
- `AccountNav.vue`: Customer portal navigation sidebar with status progress and sub-route badges.

### 4. Public, Marketing & Quality Views
- `src/views/HomeView.vue`: Hero thesis, category grid, OEM highlights, trust badges, live RFQ ticker, and verified testimonials.
- `src/views/AboutView.vue`: Company history, executive leadership, clinical advisory board, and corporate governance.
- `src/views/LocationsView.vue`: Interactive regional hub directory, warehouse logistics map, and service centers.
- `src/views/quality/CertificationsView.vue`: ISO/CE compliance registry, accreditation downloads, and audit verification.
- `src/views/trade/OemView.vue` & `src/views/trade/ProvidersView.vue`: Verified supplier network, B2B partner onboarding, and tier tiers.

### 5. Catalog & Marketplace Views
- `src/views/catalog/CategoriesView.vue`: Hierarchical category browser with visual taxonomy.
- `src/views/catalog/LandingPageView.vue`: Marketing campaign pages with dynamic feature grids.
- `src/views/marketplace/CatalogView.vue`: Faceted search catalog with multi-filter sidebar, sort dropdown, and dual view modes (grid/table).
- `src/views/marketplace/ProductDetailView.vue`: Product specifications, image gallery with zoom, tier pricing, datasheet downloads, RFQ trigger.
- `src/views/marketplace/CartView.vue`: Itemized order calculator with bulk discount alerts, shipping estimator, and checkout CTA.
- `src/views/marketplace/CheckoutView.vue`: Multi-step checkout wizard (address -> shipping -> payment/PO -> review).
- `src/views/marketplace/OrderConfirmationView.vue`: Post-purchase confirmation, receipt download, and tracking link.
- `src/views/marketplace/OrderTrackingView.vue`: Visual milestone timeline for freight and customs clearance.
- `src/views/marketplace/WishlistView.vue`: Saved items and procurement lists with 1-click requisition.

### 6. Customer Account & Portal Views (`src/views/account/`, `src/views/support/`, `src/views/AddressesView.vue`, `src/views/ProfileView.vue`)
- `AccountDashboardView.vue`: Metric KPI cards, recent orders, quick actions, and procurement tier status.
- `OrderHistoryView.vue` & `OrderDetailView.vue`: Interactive order log with line-item detail, invoices, and reorder flow.
- `QuoteListView.vue` & `QuoteDetailView.vue`: Formal quote proposals with validity expiration and 1-click acceptance.
- `RfqListView.vue` & `RfqDetailView.vue`: Custom Request for Quotation tracker with vendor submission comparison.
- `ProfileView.vue` & `AddressesView.vue`: Organization profile, tax identification, multi-warehouse delivery addresses.
- `HelpCenterView.vue` & `MyTicketsView.vue`: Interactive knowledge base, SLA status tracker, and ticket communication thread.

### 7. Authentication Flow Views (`src/views/auth/`)
- `AuthShell.vue`: Branded authentication layout with security badges and compliance seals.
- `LoginView.vue`, `RegisterView.vue`, `ForgotPasswordView.vue`, `ResetPasswordView.vue`, `VerifyEmailView.vue`, `VerifyPasswordOtpView.vue`.

### 8. Admin Operations & Control Panels (`src/views/admin/`)
- `AdminDashboardView.vue`: Real-time operational KPI telemetry, sales breakdown, system alert feed.
- `OrdersAdminView.vue`, `SalesAdminView.vue`, `CatalogAdminView.vue`, `UsersAdminView.vue`, `CompaniesAdminView.vue`.
- `TicketsAdminView.vue`, `HelpAdminView.vue`, `AuditLogAdminView.vue`, `CertificationsAdminView.vue`.
- `CountriesAdminView.vue`, `CitiesAdminView.vue`, `ZonesAdminView.vue`, `PagesAdminView.vue`.

---

## Incremental Task Plan

### Task 1: Lock Global Design Tokens & Typography Scale

**Files:**
- Modify: `src/assets/tokens.css`
- Modify: `src/assets/main.css`
- Modify: `tailwind.config.js`

- [x] **Step 1: Update design tokens with strict type and spacing scales**

Ensure `src/assets/tokens.css` has complete tokens for:
- Font scales: `--wl-text-display`, `--wl-text-h1`, `--wl-text-h2`, `--wl-text-h3`, `--wl-text-h4`, `--wl-text-body`, `--wl-text-small`, `--wl-text-caption`.
- Unified dark navy backgrounds: `--wl-paper` (#061328), `--wl-surface` (#071A38), `--wl-card` (#0A2248), `--wl-surface-soft` (#0B274F).
- Action & accent colors: `--wl-primary` (#69A9FF), `--wl-gold` (#FFD166), `--wl-success` (#3ED7B4), `--wl-danger` (#F26D6D), `--wl-warning` (#F8C15D).
- Harmonic 4px spacing: `--space-1` (4px) to `--space-24` (96px).
- Strict radii: `--radius-xs` (3px), `--radius-sm` (5px), `--radius-md` (6px), `--radius-lg` (8px), `--radius-xl` (12px), `--radius-full` (999px).
- Navy diffusion box shadows: `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`.

- [x] **Step 2: Update global utilities and accessibility rules in `src/assets/main.css`**

Add high-contrast focus rings (`:focus-visible`), standardized table header and cell padding, and RTL typography alignments.

- [x] **Step 3: Run type and build checks**

Run: `npm run type-check`
Expected: PASS with 0 errors

- [x] **Step 4: Commit**

```bash
git add src/assets/tokens.css src/assets/main.css tailwind.config.js
git commit -m "style: standardize navy classic design tokens and typography scale"
```

---

### Task 2: Refactor Core UI Primitives & Button Systems

**Files:**
- Modify: `src/components/ui/AppButton.vue`
- Modify: `src/components/ui/BaseButton.vue`
- Modify: `src/components/ui/StatusPill.vue`
- Modify: `src/components/ui/StatCard.vue`
- Modify: `src/components/ui/BaseCard.vue`

- [x] **Step 1: Refactor `AppButton.vue` and `BaseButton.vue` to support all 5 states**

Ensure buttons support variants: `primary`, `secondary`, `gold`, `danger`, `ghost`, `outline`.
Add visual states: default, hover (brightness/glow), active (scale transform 0.98), focus-visible (2px solid outline with offset), disabled (opacity 0.45, cursor not-allowed), loading (`aria-busy="true"` with spinner).

- [x] **Step 2: Refactor `StatusPill.vue` and `StatCard.vue`**

Ensure `StatusPill.vue` cleanly maps status strings to semantic classes with glowing indicator dots.
Ensure `StatCard.vue` formats numeric KPI values in tabular JetBrains Mono font with gold gradient highlights and trend badges.

- [x] **Step 3: Run type check**

Run: `npm run type-check`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add src/components/ui/AppButton.vue src/components/ui/BaseButton.vue src/components/ui/StatusPill.vue src/components/ui/StatCard.vue src/components/ui/BaseCard.vue
git commit -m "feat(ui): refactor button states, status pills, and stat card primitives"
```

---

### Task 3: Refactor Input, Form & Feedback Primitives

**Files:**
- Modify: `src/components/ui/AppInput.vue`
- Modify: `src/components/ui/BaseInput.vue`
- Modify: `src/components/ui/PhoneInput.vue`
- Modify: `src/components/ui/CurrencySelect.vue`
- Modify: `src/components/ui/QuantityStepper.vue`
- Modify: `src/components/ui/FileUpload.vue`
- Modify: `src/components/ui/EmptyState.vue`
- Modify: `src/components/ui/ErrorState.vue`
- Modify: `src/components/ui/DataState.vue`
- Modify: `src/components/ui/SkeletonLoader.vue`

- [x] **Step 1: Refactor form input components with floating labels and error states**

Implement accessible ARIA attributes (`aria-invalid`, `aria-describedby`), clearable icon slots, password show/hide toggles, and RTL-safe input direction handling.

- [x] **Step 2: Standardize async data states (Empty, Error, Loading, Skeleton)**

Ensure `DataState.vue` and `SkeletonLoader.vue` handle loading shimmers with pulse effects without layout shifts.

- [x] **Step 3: Run type check**

Run: `npm run type-check`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add src/components/ui/AppInput.vue src/components/ui/BaseInput.vue src/components/ui/PhoneInput.vue src/components/ui/CurrencySelect.vue src/components/ui/QuantityStepper.vue src/components/ui/FileUpload.vue src/components/ui/EmptyState.vue src/components/ui/ErrorState.vue src/components/ui/DataState.vue src/components/ui/SkeletonLoader.vue
git commit -m "feat(ui): upgrade form controls and async data state primitives"
```

---

### Task 4: Refactor Modal, Dialog & Notification Primitives

**Files:**
- Modify: `src/components/ui/BaseModal.vue`
- Modify: `src/components/ui/ConfirmDialog.vue`
- Modify: `src/components/ui/ResultModal.vue`
- Modify: `src/components/ui/ToastContainer.vue`
- Modify: `src/components/ui/WhatsAppFab.vue`

- [x] **Step 1: Refactor dialog modals with focus trap and keyboard ESC dismissal**

Ensure `BaseModal.vue` uses `Teleport to="body"`, backdrop blur (`backdrop-blur-md`), accessible `role="dialog"`, `aria-modal="true"`, and spring enter/leave transitions.

- [x] **Step 2: Refactor `ToastContainer.vue` and `WhatsAppFab.vue`**

Ensure toasts render with distinct severity icons (success, error, warning, info), progress auto-dismiss timers, and dismiss actions.
Ensure `WhatsAppFab.vue` floats above mobile navbars with pulse glow without obscuring primary submit buttons.

- [x] **Step 3: Run type check**

Run: `npm run type-check`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add src/components/ui/BaseModal.vue src/components/ui/ConfirmDialog.vue src/components/ui/ResultModal.vue src/components/ui/ToastContainer.vue src/components/ui/WhatsAppFab.vue
git commit -m "feat(ui): refine modals, confirm dialogs, and toast notifications"
```

---

### Task 5: Refactor Navigation & Layout Shells

**Files:**
- Modify: `src/components/layout/AppHeader.vue`
- Modify: `src/components/layout/AppFooter.vue`
- Modify: `src/components/layout/AppMobileNav.vue`
- Modify: `src/components/layout/AdminLayout.vue`
- Modify: `src/components/account/AccountNav.vue`

- [x] **Step 1: Refactor `AppHeader.vue` with responsive search and mega navigation**

Optimize header height (56px desktop, 52px mobile), search expansion dropdown with keyboard navigation (`ArrowDown`, `Enter`, `Escape`), language switcher (EN/AR), currency selector, cart badge counter, and authenticated user menu dropdown.

- [x] **Step 2: Refactor `AppMobileNav.vue` and `AppFooter.vue`**

Mobile nav fixed at bottom with 44px minimum touch targets, haptic-style active indicator, and safe-area padding (`env(safe-area-inset-bottom)`).
Footer with high-contrast link groups, ISO compliance markers, and newsletter subscription form.

- [x] **Step 3: Refactor `AdminLayout.vue` and `AccountNav.vue`**

Collapsible side rail (240px expanded -> 64px icon-only), sticky breadcrumb bar, active section glow, and notification indicator.

- [x] **Step 4: Run type check**

Run: `npm run type-check`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/layout/AppHeader.vue src/components/layout/AppFooter.vue src/components/layout/AppMobileNav.vue src/components/layout/AdminLayout.vue src/components/account/AccountNav.vue
git commit -m "feat(layout): overhaul header, mobile navigation, and admin/account sidebars"
```

---

### Task 6: Refactor Public & Brand Views (Home, About, Locations, Certifications, OEM, Providers)

**Files:**
- Modify: `src/views/HomeView.vue`
- Modify: `src/views/AboutView.vue`
- Modify: `src/views/LocationsView.vue`
- Modify: `src/views/quality/CertificationsView.vue`
- Modify: `src/views/trade/OemView.vue`
- Modify: `src/views/trade/ProvidersView.vue`

- [x] **Step 1: Refactor `HomeView.vue`**

Add high-impact hero thesis with gold gradient display heading, quick category slider, live procurement ticker, featured B2B medical equipment showcase with hover elevation, and trust metrics.

- [x] **Step 2: Refactor `AboutView.vue` and `LocationsView.vue`**

Structure company milestones timeline, executive team cards, and regional distribution hub cards with interactive location contact details.

- [x] **Step 3: Refactor `CertificationsView.vue`, `OemView.vue`, and `ProvidersView.vue`**

Implement verified certificate card downloads, OEM partnership tier comparison cards, and clinical provider onboarding requisition forms.

- [x] **Step 4: Run type check**

Run: `npm run type-check`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/views/HomeView.vue src/views/AboutView.vue src/views/LocationsView.vue src/views/quality/CertificationsView.vue src/views/trade/OemView.vue src/views/trade/ProvidersView.vue
git commit -m "feat(views): refactor public landing, about, locations, and trade partner views"
```

---

### Task 7: Refactor Catalog & Marketplace Views (Catalog, ProductDetail, Cart, Checkout, OrderTracking, Wishlist)

**Files:**
- Modify: `src/views/marketplace/CatalogView.vue`
- Modify: `src/views/marketplace/ProductDetailView.vue`
- Modify: `src/views/marketplace/CartView.vue`
- Modify: `src/views/marketplace/CheckoutView.vue`
- Modify: `src/views/marketplace/OrderConfirmationView.vue`
- Modify: `src/views/marketplace/OrderTrackingView.vue`
- Modify: `src/views/marketplace/WishlistView.vue`
- Modify: `src/views/catalog/CategoriesView.vue`
- Modify: `src/views/catalog/LandingPageView.vue`

- [x] **Step 1: Refactor `CatalogView.vue` and `ProductDetailView.vue`**

Faceted filter sidebar (price slider, manufacturer checkboxes, certifications, availability), view switcher (grid / dense list), product card with instant RFQ quote trigger, high-resolution image gallery with thumbnails, datasheet PDF download button, and tiered wholesale pricing table.

- [x] **Step 2: Refactor `CartView.vue`, `CheckoutView.vue`, and `OrderConfirmationView.vue`**

Itemized summary with quantity stepper, shipping method selector, currency conversion breakdown, 3-step checkout wizard with validation, and order confirmation receipt with print styling.

- [x] **Step 3: Refactor `OrderTrackingView.vue` and `WishlistView.vue`**

Interactive timeline with milestone pulse indicators, carrier tracking code copy-to-clipboard, and procurement list requisition actions.

- [x] **Step 4: Run type check**

Run: `npm run type-check`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/views/marketplace/CatalogView.vue src/views/marketplace/ProductDetailView.vue src/views/marketplace/CartView.vue src/views/marketplace/CheckoutView.vue src/views/marketplace/OrderConfirmationView.vue src/views/marketplace/OrderTrackingView.vue src/views/marketplace/WishlistView.vue src/views/catalog/CategoriesView.vue src/views/catalog/LandingPageView.vue
git commit -m "feat(views): refactor catalog, product detail, checkout, and tracking flows"
```

---

### Task 8: Refactor Customer Account & Portal Views (Dashboard, Orders, Quotes, RFQs, Profile, Addresses, Support)

**Files:**
- Modify: `src/views/account/AccountDashboardView.vue`
- Modify: `src/views/account/OrderHistoryView.vue`
- Modify: `src/views/account/OrderDetailView.vue`
- Modify: `src/views/account/QuoteListView.vue`
- Modify: `src/views/account/QuoteDetailView.vue`
- Modify: `src/views/account/RfqListView.vue`
- Modify: `src/views/account/RfqDetailView.vue`
- Modify: `src/views/ProfileView.vue`
- Modify: `src/views/AddressesView.vue`
- Modify: `src/views/support/HelpCenterView.vue`
- Modify: `src/views/support/MyTicketsView.vue`

- [x] **Step 1: Refactor `AccountDashboardView.vue` and Customer KPI overview**

Fix all tier-level typography bindings, display gold metric cards for pending quotes, active orders, and support tickets, and quick-action launcher.

- [x] **Step 2: Refactor Orders, Quotes, and RFQ management views**

Dense tabular layouts with sorting, status filtering, export to CSV/PDF, quote acceptance modal, and vendor quotation comparison view.

- [x] **Step 3: Refactor Profile, Addresses, and Support Ticket views**

Organization settings form, address book card grid with "Default Delivery" badges, accordion FAQ browser, and ticket messaging thread with attachment upload.

- [x] **Step 4: Run type check**

Run: `npm run type-check`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/views/account/AccountDashboardView.vue src/views/account/OrderHistoryView.vue src/views/account/OrderDetailView.vue src/views/account/QuoteListView.vue src/views/account/QuoteDetailView.vue src/views/account/RfqListView.vue src/views/account/RfqDetailView.vue src/views/ProfileView.vue src/views/AddressesView.vue src/views/support/HelpCenterView.vue src/views/support/MyTicketsView.vue
git commit -m "feat(views): refactor customer account portal, orders, quotes, and support"
```

---

### Task 9: Refactor Authentication Flow Views

**Files:**
- Modify: `src/components/auth/AuthShell.vue`
- Modify: `src/views/auth/LoginView.vue`
- Modify: `src/views/auth/RegisterView.vue`
- Modify: `src/views/auth/ForgotPasswordView.vue`
- Modify: `src/views/auth/ResetPasswordView.vue`
- Modify: `src/views/auth/VerifyEmailView.vue`
- Modify: `src/views/auth/VerifyPasswordOtpView.vue`

- [x] **Step 1: Refactor `AuthShell.vue` and security layout**

Card elevation with ambient gold glow, medical security assurance badge, language switch toggle, and branded welcome copy.

- [x] **Step 2: Refactor form fields, validation states, and OTP inputs**

Interactive password strength meter on register, segmented 6-digit OTP code input with auto-advance and countdown resend timer.

- [x] **Step 3: Run type check**

Run: `npm run type-check`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add src/components/auth/AuthShell.vue src/views/auth/LoginView.vue src/views/auth/RegisterView.vue src/views/auth/ForgotPasswordView.vue src/views/auth/ResetPasswordView.vue src/views/auth/VerifyEmailView.vue src/views/auth/VerifyPasswordOtpView.vue
git commit -m "feat(views): refactor authentication screens and OTP verification flows"
```

---

### Task 10: Refactor Admin Operations & Control Panels

**Files:**
- Modify: `src/views/admin/AdminDashboardView.vue`
- Modify: `src/views/admin/OrdersAdminView.vue`
- Modify: `src/views/admin/SalesAdminView.vue`
- Modify: `src/views/admin/CatalogAdminView.vue`
- Modify: `src/views/admin/UsersAdminView.vue`
- Modify: `src/views/admin/CompaniesAdminView.vue`
- Modify: `src/views/admin/TicketsAdminView.vue`
- Modify: `src/views/admin/HelpAdminView.vue`
- Modify: `src/views/admin/AuditLogAdminView.vue`
- Modify: `src/views/admin/CertificationsAdminView.vue`
- Modify: `src/views/admin/CountriesAdminView.vue`
- Modify: `src/views/admin/CitiesAdminView.vue`
- Modify: `src/views/admin/ZonesAdminView.vue`
- Modify: `src/views/admin/PagesAdminView.vue`

- [x] **Step 1: Refactor `AdminDashboardView.vue` with real-time operations feed**

Telemetry stat widgets with gold metric values, revenue chart placeholders, urgent ticket queue, and recent audit log events.

- [x] **Step 2: Unify Admin Data Tables across all 13 management views**

Standardize table headers (sticky on scroll, uppercase mono labels, sorting icons), row action button toolbars (view, edit, toggle status, delete), search/filter toolbars, bulk selection bars, and create/edit modal forms with two-column responsive grids.

- [x] **Step 3: Run type check & build verification**

Run: `npm run build`
Expected: PASS with 0 build errors

- [x] **Step 4: Commit**

```bash
git add src/views/admin/*.vue
git commit -m "feat(admin): refactor admin control panels and data management tables"
```

---

### Task 11: End-to-End Visual Verification & Accessibility Audit

**Files:**
- Verify across all responsive breakpoints: Desktop (1440px), Tablet (768px), Mobile (390px, 360px).
- Verify both English (LTR) and Arabic (RTL) typography.

- [x] **Step 1: Run linter and type check suite**

Run: `npm run lint` and `npm run type-check`
Expected: 0 lint errors, 0 type errors.

- [x] **Step 2: Run production build verification**

Run: `npm run build`
Expected: Successful production build in `dist/`.

- [x] **Step 3: Verify all checklist items from `designing-frontend-interfaces`**

- Spacing derived solely from `--space-*` tokens.
- Exactly one unified radius scale.
- Gold title gradients and crisp action blue accents.
- All 5 states present on all buttons and inputs.
- Arabic typography uses Alexandria / IBM Plex Sans Arabic.
- Zero horizontal overflow on mobile viewports.

- [x] **Step 4: Final commit**

```bash
git commit -m "chore: complete full UI/UX design refactor verification"
```

