# Arctic Frost Full-Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Arctic Frost visual system to every tracked Vue view under `src/views/`, with consistent shared shells, accessible states, responsive behavior, and preserved business logic.

**Architecture:** Establish semantic Arctic Frost tokens and shared public/operations/auth primitives first. Then migrate each route family against those primitives in isolated tasks. Keep data loading, routing, guards, API calls, and domain behavior unchanged unless a visual defect directly depends on them.

**Tech Stack:** Vue 3, TypeScript, Vue Router, Vite, Tailwind CSS 3, CSS custom properties, Vitest.

---

## Task 1: Arctic Frost Foundation and Shared Shells

**Files:**
- Modify: `src/assets/design-tokens.css`
- Modify: `src/assets/base.css`
- Modify: `src/assets/components.css`
- Modify: `src/assets/main.css`
- Modify: `src/App.vue`
- Modify: `src/components/layout/AppHeader.vue`
- Modify: `src/components/layout/AppFooter.vue`
- Modify: `src/components/layout/AppMobileNav.vue`
- Modify: `src/components/layout/DashboardShell.vue`
- Modify: `src/components/layout/AdminLayout.vue`
- Modify: `src/components/layout/ProviderLayout.vue`
- Modify: `src/components/auth/AuthShell.vue`
- Test: existing layout tests and add focused token/focus tests where needed

- [ ] Replace the raw brand/status palette with the approved Arctic Frost values while preserving backward-compatible semantic aliases used by existing views.
- [ ] Add the approved display/body/mono font stack and ensure body text uses the accessible ink ramp.
- [ ] Add one radius scale, two elevation levels, one focus ring, and reduced-motion behavior.
- [ ] Standardize page-shell, page-header, section-header, card, table, toolbar, breadcrumb, and action-bar primitives.
- [ ] Ensure public and operations shells have visible skip-link/focus behavior, semantic landmarks, and no hover-only interactions.
- [ ] Run `npm run type-check`, `npm test`, `npm run lint`, and `npm run build`; expected result: all commands exit successfully.

## Task 2: Public and Content Views

**Files:**
- Modify: `src/views/HomeView.vue`
- Modify: `src/views/AboutView.vue`
- Modify: `src/views/LocationsView.vue`
- Modify: `src/views/quality/CertificationsView.vue`
- Modify: `src/views/catalog/CategoriesView.vue`
- Modify: `src/views/catalog/CategoryProvidersView.vue`
- Modify: `src/views/catalog/LandingPageView.vue`
- Modify: `src/views/trade/ProvidersView.vue`
- Modify: `src/views/trade/OemView.vue`
- Modify: `src/views/trade/ProviderStorefrontView.vue`

- [ ] Replace gold/amber decorative heading treatments with Arctic Frost ink/accent treatments.
- [ ] Standardize hero, context strip, section rhythm, CTA hierarchy, provider/category lists, and footer transitions.
- [ ] Preserve all existing links, route params, data calls, locale behavior, and dynamic landing-page content.
- [ ] Add or preserve meaningful loading, empty, error, and no-results states for data-backed sections.
- [ ] Verify at 320px, 768px, 1024px, and 1440px with no horizontal overflow.
- [ ] Run `npm run type-check`, `npm test`, `npm run lint`, and `npm run build`; expected result: all commands exit successfully.

## Task 3: Marketplace Views

**Files:**
- Modify: `src/views/marketplace/CatalogView.vue`
- Modify: `src/views/marketplace/ProductDetailView.vue`
- Modify: `src/views/marketplace/CartView.vue`
- Modify: `src/views/marketplace/WishlistView.vue`
- Modify: `src/views/marketplace/CheckoutView.vue`
- Modify: `src/views/marketplace/OrderConfirmationView.vue`
- Modify: `src/views/marketplace/OrderTrackingView.vue`

- [ ] Standardize catalog toolbar, filters, product cards, price/MOQ metadata, wishlist/cart controls, and responsive grid behavior.
- [ ] Standardize product detail identity, supplier/stock status, quantity/inquiry actions, specifications, media, and related products.
- [ ] Standardize cart/checkout summaries, form controls, progress, confirmation, tracking, empty, error, and success states.
- [ ] Preserve cart, wishlist, checkout, inquiry, order, tracking, and route behavior exactly.
- [ ] Ensure all icon-only controls have accessible names and all forms have visible labels/error associations.
- [ ] Run `npm run type-check`, `npm test`, `npm run lint`, and `npm run build`; expected result: all commands exit successfully.

## Task 4: Account and Authentication Views

**Files:**
- Modify: `src/views/account/AccountDashboardView.vue`
- Modify: `src/views/account/RfqListView.vue`
- Modify: `src/views/account/RfqDetailView.vue`
- Modify: `src/views/account/QuoteListView.vue`
- Modify: `src/views/account/QuoteDetailView.vue`
- Modify: `src/views/account/OrderHistoryView.vue`
- Modify: `src/views/account/OrderDetailView.vue`
- Modify: `src/views/auth/LoginView.vue`
- Modify: `src/views/auth/RegisterView.vue`
- Modify: `src/views/auth/ForgotPasswordView.vue`
- Modify: `src/views/auth/VerifyEmailView.vue`
- Modify: `src/views/auth/VerifyPasswordOtpView.vue`
- Modify: `src/views/auth/ResetPasswordView.vue`
- Modify: `src/views/ProfileView.vue`
- Modify: `src/views/AddressesView.vue`

- [ ] Turn the account dashboard into a clear operations overview with KPI tiles, pipeline status, action queues, and direct navigation.
- [ ] Standardize account list/detail headers, filters, tables/lists, status labels, back actions, and empty/error states.
- [ ] Apply the AuthShell consistently to all authentication views with visible labels, correct input types/autocomplete, field errors, and keyboard-safe actions.
- [ ] Preserve authentication, profile, address, RFQ, quote, and order data flows.
- [ ] Ensure destructive or irreversible actions have explicit wording and safe focus behavior.
- [ ] Run `npm run type-check`, `npm test`, `npm run lint`, and `npm run build`; expected result: all commands exit successfully.

## Task 5: Admin, Provider, and Support Views

**Files:**
- Modify: `src/views/admin/AdminDashboardView.vue`
- Modify: `src/views/admin/SalesAdminView.vue`
- Modify: `src/views/admin/OrdersAdminView.vue`
- Modify: `src/views/admin/UsersAdminView.vue`
- Modify: `src/views/admin/CompaniesAdminView.vue`
- Modify: `src/views/admin/CategoriesAdminView.vue`
- Modify: `src/views/admin/CertificationsAdminView.vue`
- Modify: `src/views/admin/CitiesAdminView.vue`
- Modify: `src/views/admin/CountriesAdminView.vue`
- Modify: `src/views/admin/ZonesAdminView.vue`
- Modify: `src/views/admin/PagesAdminView.vue`
- Modify: `src/views/admin/TicketsAdminView.vue`
- Modify: `src/views/admin/HelpAdminView.vue`
- Modify: `src/views/admin/AuditLogAdminView.vue`
- Modify: `src/views/provider/ProviderCatalogView.vue`
- Modify: `src/views/provider/ProviderCategoriesView.vue`
- Modify: `src/views/support/HelpCenterView.vue`
- Modify: `src/views/support/MyTicketsView.vue`

- [ ] Standardize the operations shell, page context strip, action bar, dense tables, status indicators, and responsive overflow behavior.
- [ ] Replace undefined legacy tokens and hardcoded rgba/color values in scoped styles with semantic Arctic Frost tokens.
- [ ] Standardize admin/provider/support list, detail, filter, empty, error, and success states without changing permissions or API behavior.
- [ ] Ensure tables use semantic headers, visible focus, logical keyboard order, and text labels alongside status color.
- [ ] Run `npm run type-check`, `npm test`, `npm run lint`, and `npm run build`; expected result: all commands exit successfully.

## Task 6: Cross-Page Audit and Final Verification

**Files:**
- Modify only files required to resolve findings from this task.
- Test: existing Vitest suite plus targeted visual/accessibility checks

- [ ] Search all `src/views`, `src/components`, and `src/assets` for undefined `--wl-*` references, gold/amber decorative treatments, hardcoded colors, and inconsistent focus styles.
- [ ] Confirm every tracked view under `src/views/` has a consistent page shell, heading hierarchy, and responsive behavior.
- [ ] Run `npm run type-check`, `npm test`, `npm run lint`, and `npm run build` in this worktree; expected result: all commands exit successfully.
- [ ] Run a local dev server and inspect representative routes at desktop and mobile widths: `/`, `/marketplace`, `/marketplace/product/:id`, `/account`, `/admin`, `/auth/login`, `/help`, and one provider route.
- [ ] Confirm no console errors, no horizontal page overflow, visible focus indicators, and no contrast violations in representative screenshots.
- [ ] Record any unavoidable pre-existing functional limitations separately from visual redesign findings.

---

## Execution Rules

- Work in the isolated worktree `C:\Users\ALQasem\.config\kilo\worktrees\welco\clinical-precision-2026-09-22`.
- Do not modify the user's dirty files in the main workspace.
- Do not commit unless the user explicitly requests a commit.
- Preserve existing business logic, API calls, route guards, locale behavior, and data contracts.
- Use semantic tokens rather than raw hex in component/view styles.
- Use native HTML controls where possible; do not add ARIA to replace native semantics.
- After each task, run the specified verification commands before marking it complete.
