# Welco Frontend Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the Welco frontend under the consolidated Navy Classic design system by removing token sprawl, fixing contrast, enforcing component states, and standardizing UX flows across all routes.

**Architecture:** Single-pass design-system refactor: consolidate tokens first, then components, then view-by-view copy/contrast/state audits. No backend changes. No new features. All changes are CSS, shared component, and view-layer edits.

**Tech Stack:** Vue 3 + TypeScript + Vite, Tailwind CSS, custom CSS variable token system, Material Symbols Outlined.

**Spec:** `docs/specs/2026-09-15-welco-frontend-design-system-design.md`

**Plan file:** `docs/plans/2026-09-15-welco-frontend-design-system.md`

---

## File Structure

### Create
- `docs/plans/2026-09-15-welco-frontend-design-system.md` — this plan

### Modify
- `src/assets/tokens.css` — consolidate to canonical tokens, remove 20+ aliases
- `src/assets/base.css` — update component rules to use canonical tokens, remove duplicate radius/shadow definitions
- `src/assets/main.css` — remove Tailwind override sprawl, keep only necessary remaps
- `src/components/ui/AppButton.vue` — ensure all 5 states, unify sizing
- `src/components/ui/DataState.vue` — new unified empty/loading/error component
- `src/components/ui/EmptyState.vue` — migrate to DataState
- `src/components/ui/ErrorState.vue` — migrate to DataState
- `src/components/ui/SkeletonLoader.vue` — migrate to DataState
- `src/views/**/*.vue` — contrast audit, spacing audit, copy pass (batch by feature area)

### Testing
- Visual inspection at 1440px and 390px viewport widths
- Contrast audit using browser devtools or axe-core
- Keyboard navigation test for all interactive elements
- RTL layout test for EN/AR switching

---

## Task 1: Token Consolidation — Core Tokens

**Files:**
- Modify: `src/assets/tokens.css`

- [ ] **Step 1: Replace :root token block with canonical set**

Edit `src/assets/tokens.css` — replace the existing `:root` block (lines 10-290) with the canonical token block from the spec. Remove all alias definitions (e.g., `--wl-indigo`, `--wl-violet`, `--wl-teal`, `--wl-brass`, `--wl-amber`, `--wl-obsidian`, `--wl-stone`, `--wl-radius-lg`, `--wl-radius-xl`, etc.). Keep only the canonical tokens defined in Section 5 of the spec.

```css
:root {
  color-scheme: dark;

  /* TYPE — one ratio: 1.250 major third */
  --wl-font-display: 'Plus Jakarta Sans', 'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --wl-font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --wl-font-mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
  --step--1: 0.84rem; --step-0: 1rem; --step-1: 1.25rem;
  --step-2: 1.563rem; --step-3: 1.953rem; --step-4: 2.441rem;

  /* SPACE — 4px harmonic base */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --space-12: 48px; --space-16: 64px;

  /* COLOR — one ramp, one accent */
  --base: #061328;
  --surface: #071A38;
  --surface-soft: #0B274F;
  --ink: #d8e8ff;
  --ink-strong: #f4f8ff;
  --ink-soft: #bfcfe8;
  --muted: #93a5bd;
  --line: rgba(116, 169, 255, 0.24);
  --line-strong: rgba(151, 190, 255, 0.42);
  --primary: #69a9ff;
  --primary-hover: #8abcff;
  --primary-soft: rgba(105, 169, 255, 0.14);
  --accent: #d8e8ff;
  --gold: #FFD166;
  --success: #3ed7b4;
  --danger: #f26d6d;
  --warning: #f8c15d;

  /* RADIUS — three values only */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-pill: 999px;

  /* SHADOW — two only */
  --shadow-card: 0 0 0 1px rgba(116, 169, 255, 0.1), 0 10px 30px rgba(0, 10, 25, 0.5);
  --shadow-hover: 0 4px 16px -2px rgba(0, 10, 25, 0.5), 0 10px 24px -4px rgba(105, 169, 255, 0.12);
}
```

- [ ] **Step 2: Update :root.dark / [data-theme='dark'] block**

Edit `src/assets/tokens.css` — replace the duplicate `:root.dark, :root[data-theme='dark'], :root[data-theme='light']` block (lines 294-387) with a lightweight block that only overrides what actually differs. Most values are identical to `:root` now that aliases are gone.

```css
:root.dark, :root[data-theme='dark'], :root[data-theme='light'] {
  color-scheme: dark;
  /* All canonical tokens inherit from :root. No duplicate definitions needed
     unless a specific theme variant requires a different value. */
}
```

- [ ] **Step 3: Update RTL typography block**

Edit `src/assets/tokens.css` — update the `[dir="rtl"]` block (lines 390-397) to reference canonical tokens only. Remove any references to deleted aliases.

```css
[dir="rtl"], [lang="ar"], html[lang="ar"], html[dir="rtl"] {
  --wl-font-display: 'Alexandria', 'IBM Plex Sans Arabic', 'Plus Jakarta Sans', system-ui, sans-serif;
  --wl-font-body: 'IBM Plex Sans Arabic', 'Alexandria', 'Inter', system-ui, sans-serif;
  --wl-leading-body: 1.68;
}
```

- [ ] **Step 4: Update responsive token overrides**

Edit `src/assets/tokens.css` — update the `@media` blocks (lines 399-446) to use canonical `--space-*` tokens. Remove any references to deleted aliases. Verify spacing values match the token scale.

- [ ] **Step 5: Fix --muted contrast**

Edit `src/assets/tokens.css` — change `--muted: #93a5bd` to `--muted: #9db5d0` (approx 5.0:1 against `--surface`). This is a 1-step lightness increase.

- [ ] **Step 6: Verify and commit**

Run visual inspection. Check that the page renders correctly with the new token set. Commit.

```bash
git add src/assets/tokens.css
git commit -m "design-system: consolidate tokens, remove 20+ aliases, fix muted contrast"
```

---

## Task 2: Token Consolidation — Backward-Compatible Aliases

**Files:**
- Modify: `src/assets/tokens.css`

- [ ] **Step 1: Add compatibility alias block**

Edit `src/assets/tokens.css` — add a backward-compatible alias block AFTER the canonical tokens. This block maps legacy names to canonical values. This prevents breaking existing views during the incremental migration.

```css
/* ── Backward-compatible aliases ──
 * Legacy names resolve to canonical tokens. These will be removed
 * after all views/components are migrated. DO NOT add new references
 * to these aliases — use canonical names instead. */
--wl-primary: var(--primary);
--wl-primary-hover: var(--primary-hover);
--wl-primary-soft: var(--primary-soft);
--wl-primary-rgb: 105, 169, 255;
--wl-accent: var(--accent);
--wl-accent-hover: var(--accent-hover);
--wl-accent-soft: var(--accent-soft);
--wl-accent-rgb: 216, 232, 255;
--wl-gold-rgb: 255, 209, 102;
--wl-danger-rgb: 242, 109, 109;
--wl-success-rgb: 62, 215, 180;
--wl-warning-rgb: 248, 193, 93;
--wl-info-rgb: 105, 169, 255;
--wl-paper-rgb: 6, 19, 40;
--wl-surface-rgb: 7, 26, 56;
--wl-ink-rgb: 216, 232, 255;
--wl-ink-strong-rgb: 244, 248, 255;
--wl-ink-soft-rgb: 191, 207, 232;
--wl-muted-rgb: 157, 181, 208;
--wl-indigo: var(--primary);
--wl-indigo-hover: var(--primary-hover);
--wl-indigo-soft: var(--primary-soft);
--wl-indigo-rgb: var(--primary-rgb);
--wl-violet: var(--primary);
--wl-violet-soft: var(--primary-soft);
--wl-teal: var(--primary);
--wl-teal-hover: var(--primary-hover);
--wl-teal-soft: var(--primary-soft);
--wl-teal-faint: var(--primary-soft);
--wl-teal-ring: var(--primary-ring);
--wl-teal-rgb: var(--primary-rgb);
--wl-amber-rgb: var(--accent-rgb);
--wl-amber: var(--accent);
--wl-amber-soft: var(--accent-soft);
--wl-brass: var(--accent);
--wl-brass-soft: var(--accent-soft);
--wl-medical-blue-soft: var(--primary-soft);
--wl-medical-blue-faint: var(--primary-soft);
--wl-steril-amber-soft: var(--accent-soft);
--wl-steril-amber-strong: var(--accent);
--bg-surface: var(--surface);
--bg-surface-soft: var(--surface-soft);
--border-color: var(--line);
--wl-obsidian: var(--ink-strong);
--wl-stone: var(--base);
--wl-radius-lg: var(--radius-md);
--wl-radius-xl: var(--radius-md);
```

- [ ] **Step 2: Verify and commit**

Run visual inspection. Check that all views still render correctly. Commit.

```bash
git add src/assets/tokens.css
git commit -m "design-system: add backward-compatible alias layer"
```

---

## Task 3: Component State Standardization

**Files:**
- Modify: `src/components/ui/AppButton.vue`
- Modify: `src/components/ui/BaseButton.vue`
- Modify: `src/components/ui/BaseInput.vue`
- Modify: `src/components/ui/BaseModal.vue`
- Modify: `src/components/ui/BasePagination.vue`

- [ ] **Step 1: Audit AppButton.vue for missing states**

Read `src/components/ui/AppButton.vue`. Verify it has all 5 states: hover, active, focus-visible, disabled, aria-busy. If any are missing, add them.

- [ ] **Step 2: Audit BaseButton.vue for missing states**

Read `src/components/ui/BaseButton.vue`. Verify it has all 5 states. Add any missing states.

- [ ] **Step 3: Audit BaseInput.vue for missing states**

Read `src/components/ui/BaseInput.vue`. Verify it has all 5 states: hover, focus-visible, disabled, aria-invalid, and aria-busy for loading. Add any missing states.

- [ ] **Step 4: Audit BaseModal.vue for missing states**

Read `src/components/ui/BaseModal.vue`. Verify it has focus trap, escape key handling, and visible close button. Add any missing states.

- [ ] **Step 5: Audit BasePagination.vue for missing states**

Read `src/components/ui/BasePagination.vue`. Verify it has all 5 states on page buttons. Add any missing states.

- [ ] **Step 6: Verify and commit**

Run visual inspection. Test keyboard navigation. Commit.

```bash
git add src/components/ui/AppButton.vue src/components/ui/BaseButton.vue src/components/ui/BaseInput.vue src/components/ui/BaseModal.vue src/components/ui/BasePagination.vue
git commit -m "design-system: ensure all 5 states on core UI components"
```

---

## Task 4: Unified DataState Component

**Files:**
- Create: `src/components/ui/DataState.vue`
- Modify: `src/components/ui/EmptyState.vue`
- Modify: `src/components/ui/ErrorState.vue`
- Modify: `src/components/ui/SkeletonLoader.vue`

- [ ] **Step 1: Create DataState.vue skeleton**

Create `src/components/ui/DataState.vue` with props interface and three state slots.

```vue
<script setup lang="ts">
import type { Component } from 'vue'

defineOptions({ name: 'DataState' })

interface Props {
  state: 'loading' | 'empty' | 'error' | 'success'
  /** For loading: delay in ms before showing skeleton (default 200) */
  loadingDelay?: number
  /** For empty: variant */
  emptyVariant?: 'first-use' | 'no-results' | 'cleared'
  /** For error: whether it's recoverable */
  errorRecoverable?: boolean
  /** Retry callback for recoverable errors */
  onRetry?: () => void
  /** Icon component for empty/error states */
  icon?: Component
}

const props = withDefaults(defineProps<Props>(), {
  loadingDelay: 200,
  emptyVariant: 'first-use',
  errorRecoverable: true,
})
</script>

<template>
  <div class="data-state" :class="`data-state--${state}`">
    <!-- State-specific content rendered by parent or slots -->
  </div>
</template>

<style scoped>
.data-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  text-align: center;
  gap: var(--space-4);
}
.data-state__icon {
  width: 48px;
  height: 48px;
  color: var(--muted);
}
.data-state__title {
  font-family: var(--wl-font-display);
  font-size: var(--step-1);
  font-weight: 700;
  color: var(--ink-strong);
}
.data-state__description {
  font-size: var(--step-0);
  color: var(--ink-soft);
  max-width: 480px;
  line-height: 1.6;
}
.data-state__action {
  margin-top: var(--space-3);
}
</style>
```

- [ ] **Step 2: Migrate EmptyState.vue to DataState**

Read `src/components/ui/EmptyState.vue`. Migrate its template and logic into `DataState.vue` under the `empty` state. Add emptyVariant-specific copy.

- [ ] **Step 3: Migrate ErrorState.vue to DataState**

Read `src/components/ui/ErrorState.vue`. Migrate its template and logic into `DataState.vue` under the `error` state. Add errorRecoverable-specific copy and retry button.

- [ ] **Step 4: Migrate SkeletonLoader.vue to DataState**

Read `src/components/ui/SkeletonLoader.vue`. Migrate its template and logic into `DataState.vue` under the `loading` state. Add loadingDelay support.

- [ ] **Step 5: Add DataState to barrel export**

Add `DataState.vue` to `src/components/ui/index.ts` or equivalent barrel file.

- [ ] **Step 6: Verify and commit**

Run visual inspection. Check that all existing views using EmptyState, ErrorState, and SkeletonLoader still render correctly. Commit.

```bash
git add src/components/ui/DataState.vue src/components/ui/EmptyState.vue src/components/ui/ErrorState.vue src/components/ui/SkeletonLoader.vue
git commit -m "feat: unify EmptyState/ErrorState/SkeletonLoader into DataState"
```

---

## Task 5: Base CSS — Remove Duplicate Radius/Shadow Definitions

**Files:**
- Modify: `src/assets/base.css`

- [ ] **Step 1: Replace radius variables**

Edit `src/assets/base.css` — replace all `--radius-xs`, `--radius-sm`, `--radius-lg`, `--radius-xl`, `--radius-2xl` references with the canonical `--radius-sm`, `--radius-md`, `--radius-pill` from the spec.

Affected selectors: `.card`, `.panel`, `.toolbar`, `.badge`, `.pill`, `.btn`, `.search-bar`, `.input`, `.select`, `.modal-card`, `.row-action-btn`.

- [ ] **Step 2: Replace shadow variables**

Edit `src/assets/base.css` — replace all `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl` references with `--shadow-card` and `--shadow-hover` from the spec.

Affected selectors: `.card`, `.panel`, `.table-card`, `.toolbar`, `.btn`, `.search-bar`, `.input`, `.modal`.

- [ ] **Step 3: Verify and commit**

Run visual inspection. Check hover states, card elevations, and modal shadows. Commit.

```bash
git add src/assets/base.css
git commit -m "design-system: replace legacy radius/shadow vars with canonical tokens"
```

---

## Task 6: Main CSS — Remove Tailwind Override Sprawl

**Files:**
- Modify: `src/assets/main.css`

- [ ] **Step 1: Audit Tailwind override block**

Read `src/assets/main.css` lines 267-766. Identify which overrides are still necessary after token consolidation. Remove overrides for colors that now resolve correctly through canonical tokens.

- [ ] **Step 2: Simplify color overrides**

Edit `src/assets/main.css` — remove the large block of `.text-slate-*`, `.text-indigo-*`, `.text-emerald-*`, `.text-amber-*` overrides (lines 267-298). These are no longer needed if Tailwind config uses the canonical token colors.

- [ ] **Step 3: Simplify font enforcement**

Edit `src/assets/main.css` — consolidate the font-family overrides (lines 360-543). Remove duplicate selector groups. Keep only the essential enforcement for display, body, and mono roles.

- [ ] **Step 4: Simplify shadow enforcement**

Edit `src/assets/main.css` — consolidate the shadow overrides (lines 619-765). Remove duplicate selector groups. Keep only the essential enforcement.

- [ ] **Step 5: Verify and commit**

Run visual inspection. Check that fonts, colors, and shadows render correctly across views. Commit.

```bash
git add src/assets/main.css
git commit -m "design-system: simplify Tailwind override layer"
```

---

## Task 7: View Audit — Home, About, Locations

**Files:**
- Modify: `src/views/HomeView.vue`
- Modify: `src/views/AboutView.vue`
- Modify: `src/views/LocationsView.vue`

- [ ] **Step 1: Audit HomeView.vue**

Read `src/views/HomeView.vue`. Check for:
- Arbitrary spacing values not in `--space-*` tokens
- Arbitrary font sizes not in `--step-*` scale
- Mixed radius values
- Missing hover/active/focus states on interactive elements
- Button labels that name the action
- Gold title treatment applied

Fix all issues found.

- [ ] **Step 2: Audit AboutView.vue**

Read `src/views/AboutView.vue`. Same checks as HomeView. Fix all issues found.

- [ ] **Step 3: Audit LocationsView.vue**

Read `src/views/LocationsView.vue`. Same checks. Additionally:
- Ensure country/city/district columns are keyboard navigable (arrow keys)
- Ensure selected state is visually distinct

Fix all issues found.

- [ ] **Step 4: Verify and commit**

Run visual inspection at 1440px and 390px. Test keyboard navigation in LocationsView. Commit.

```bash
git add src/views/HomeView.vue src/views/AboutView.vue src/views/LocationsView.vue
git commit -m "design-system: audit Home, About, Locations views"
```

---

## Task 8: View Audit — Auth Flow

**Files:**
- Modify: `src/views/auth/LoginView.vue`
- Modify: `src/views/auth/RegisterView.vue`
- Modify: `src/views/auth/ForgotPasswordView.vue`
- Modify: `src/views/auth/VerifyEmailView.vue`

- [ ] **Step 1: Audit LoginView.vue**

Read `src/views/auth/LoginView.vue`. Check for:
- Input sizing matches `--control-md` (44px desktop, 42px mobile)
- Button labels name the action
- Error messages say what happened and what to do
- Empty states are informative
- Loading state shows skeleton or spinner, doesn't blank the form

Fix all issues found.

- [ ] **Step 2: Audit RegisterView.vue**

Same checks as LoginView. Fix all issues found.

- [ ] **Step 3: Audit ForgotPasswordView.vue**

Same checks. Fix all issues found.

- [ ] **Step 4: Audit VerifyEmailView.vue**

Same checks. Additionally:
- Ensure OTP input uses `inputmode="numeric"` not `type="number"`
- Ensure error state on invalid OTP is clear and recoverable

Fix all issues found.

- [ ] **Step 5: Verify and commit**

Run visual inspection. Test form validation flow. Commit.

```bash
git add src/views/auth/LoginView.vue src/views/auth/RegisterView.vue src/views/auth/ForgotPasswordView.vue src/views/auth/VerifyEmailView.vue
git commit -m "design-system: audit auth flow views"
```

---

## Task 9: View Audit — Account & Profile

**Files:**
- Modify: `src/views/account/AccountDashboardView.vue`
- Modify: `src/views/profile/ProfileView.vue`
- Modify: `src/views/account/AddressesView.vue`

- [ ] **Step 1: Audit AccountDashboardView.vue**

Read `src/views/account/AccountDashboardView.vue`. Check for:
- Stat cards use gold text treatment
- Order list has all states (loading, empty, error, success)
- Action buttons name their action
- Touch targets ≥ 44px

Fix all issues found.

- [ ] **Step 2: Audit ProfileView.vue**

Read `src/views/profile/ProfileView.vue`. Check for:
- Form fields have labels above inputs (not placeholder-as-label)
- Inline validation on blur, not on keystroke
- Submit disabled only while submitting
- Success state acknowledged after save

Fix all issues found.

- [ ] **Step 3: Audit AddressesView.vue**

Read `src/views/account/AddressesView.vue`. Check for:
- CRUD actions have undo or confirmation
- Empty state invites adding first address
- Delete confirms with specific consequence

Fix all issues found.

- [ ] **Step 4: Verify and commit**

Run visual inspection. Test form submission flow. Commit.

```bash
git add src/views/account/AccountDashboardView.vue src/views/profile/ProfileView.vue src/views/account/AddressesView.vue
git commit -m "design-system: audit account and profile views"
```

---

## Task 10: View Audit — Marketplace & Cart

**Files:**
- Modify: `src/views/marketplace/CatalogView.vue`
- Modify: `src/views/marketplace/ProductDetailView.vue`
- Modify: `src/views/marketplace/CartView.vue`
- Modify: `src/views/marketplace/CheckoutView.vue`

- [ ] **Step 1: Audit CatalogView.vue**

Read `src/views/marketplace/CatalogView.vue`. Check for:
- Product cards have consistent hover treatment
- Category filters use pill styling
- Empty state for no results echoes query
- Loading state shows skeleton matching card layout

Fix all issues found.

- [ ] **Step 2: Audit ProductDetailView.vue**

Read `src/views/marketplace/ProductDetailView.vue`. Check for:
- Image has dimensions (no layout shift)
- Add-to-cart button is prominent and accessible
- Related products section has consistent card treatment
- Error state for failed image load shows fallback

Fix all issues found.

- [ ] **Step 3: Audit CartView.vue**

Read `src/views/marketplace/CartView.vue`. Check for:
- Quantity stepper has min/max and accessible labels
- Remove item has undo toast
- Empty state invites browsing catalog
- Summary row has clear total

Fix all issues found.

- [ ] **Step 4: Audit CheckoutView.vue**

Read `src/views/marketplace/CheckoutView.vue`. Check for:
- Form fields have proper labels and input types
- Address selection is clear
- Submit button names the action
- Error state for failed order is recoverable

Fix all issues found.

- [ ] **Step 5: Verify and commit**

Run visual inspection. Test cart and checkout flows. Commit.

```bash
git add src/views/marketplace/CatalogView.vue src/views/marketplace/ProductDetailView.vue src/views/marketplace/CartView.vue src/views/marketplace/CheckoutView.vue
git commit -m "design-system: audit marketplace and cart views"
```

---

## Task 11: View Audit — Admin & Management

**Files:**
- Modify: `src/views/admin/*.vue` (all admin views)
- Modify: `src/views/management/*.vue` (all management views)

- [ ] **Step 1: Audit admin views for consistency**

Read all files in `src/views/admin/`. Check for:
- Table headers use mono font and uppercase
- Row action buttons have consistent sizing (32px)
- Status badges use canonical badge classes
- Modal forms use canonical input/button styling
- Gold title treatment on page headings

Fix all issues found.

- [ ] **Step 2: Audit management views for consistency**

Read all files in `src/views/management/`. Same checks as admin views. Fix all issues found.

- [ ] **Step 3: Verify and commit**

Run visual inspection. Test CRUD flows. Commit.

```bash
git add src/views/admin/ src/views/management/
git commit -m "design-system: audit admin and management views"
```

---

## Task 12: View Audit — Support, Trade, Quality, Help

**Files:**
- Modify: `src/views/support/*.vue`
- Modify: `src/views/trade/*.vue`
- Modify: `src/views/quality/*.vue`
- Modify: `src/views/help/*.vue`

- [ ] **Step 1: Audit support views**

Read all files in `src/views/support/`. Check for:
- Ticket list has all states
- Form fields have proper labels
- Status badges are consistent
- Action buttons name their action

Fix all issues found.

- [ ] **Step 2: Audit trade views**

Read all files in `src/views/trade/`. Same checks. Additionally:
- Provider cards have consistent hover treatment
- Rfq form has clear sections

Fix all issues found.

- [ ] **Step 3: Audit quality views**

Read all files in `src/views/quality/`. Same checks. Fix all issues found.

- [ ] **Step 4: Audit help views**

Read all files in `src/views/help/`. Same checks. Fix all issues found.

- [ ] **Step 5: Verify and commit**

Run visual inspection. Commit.

```bash
git add src/views/support/ src/views/trade/ src/views/quality/ src/views/help/
git commit -m "design-system: audit support, trade, quality, and help views"
```

---

## Task 13: Copy Pass — Buttons, Errors, Empty States

**Files:**
- Modify: All `src/views/**/*.vue` files
- Modify: All `src/components/ui/*.vue` files

- [ ] **Step 1: Button label audit**

Search all Vue files for button text. Ensure every button names its action in plain terms. Replace weak labels:
- "Submit" → specific action name
- "OK" → specific action name
- "Yes/No" → "Discard changes / Keep editing"
- "Continue" → specific next step

- [ ] **Step 2: Error message audit**

Search all Vue files for error displays. Ensure every error:
- Says what happened
- Says why (if user-caused)
- Says what to do next
- Has a retry control if recoverable

Replace generic messages like "Error: invalid input" with specific, actionable copy.

- [ ] **Step 3: Empty state audit**

Search all Vue files for empty states. Ensure every empty state:
- Explains the feature (first-use)
- Echoes the query (no-results)
- Acknowledges completion (cleared)
- Offers a primary action

Replace "No data" with context-specific copy.

- [ ] **Step 4: Verify and commit**

Run visual inspection. Check copy tone across all views. Commit.

```bash
git add -A
git commit -m "design-system: copy pass — buttons, errors, empty states"
```

---

## Task 14: Mobile Touch Target Audit

**Files:**
- Modify: `src/assets/base.css`
- Modify: All `src/views/**/*.vue` files

- [ ] **Step 1: Enforce 44px minimum in base.css**

Edit `src/assets/base.css` — ensure `.btn`, `.page-btn`, `.row-action-btn`, `.pill`, `.search-bar`, `input`, `select`, `textarea` all have `min-height: 44px` on touch devices (`@media (max-width: 640px)`).

- [ ] **Step 2: Audit views for small touch targets**

Search all Vue files for elements with explicit `height`, `min-height`, `padding` that might result in < 44px touch targets. Fix any violations.

- [ ] **Step 3: Verify and commit**

Run visual inspection on mobile viewport (390px). Test touch target sizes. Commit.

```bash
git add src/assets/base.css
git commit -m "design-system: enforce 44px touch targets on mobile"
```

---

## Task 15: RTL & Accessibility Verification

**Files:**
- Modify: `src/assets/base.css`
- Modify: All `src/views/**/*.vue` files

- [ ] **Step 1: RTL layout audit**

Switch locale to AR. Verify:
- All layouts mirror correctly
- Input alignment is correct (LTR for email/phone, RTL for text)
- Icon directionality works
- No horizontal overflow

Fix any RTL violations.

- [ ] **Step 2: Keyboard navigation audit**

Test all views with keyboard only:
- Tab order is logical
- Focus-visible is always visible
- Escape closes modals
- Arrow keys work in cascading selects (LocationsView)
- Enter/Space activate buttons

Fix any keyboard navigation issues.

- [ ] **Step 3: Screen reader audit**

Test with a screen reader or axe-core:
- All images have alt text
- All inputs have labels
- All interactive elements have accessible names
- Error messages are announced
- Live regions for dynamic updates

Fix any accessibility issues.

- [ ] **Step 4: Verify and commit**

Run full accessibility audit. Commit.

```bash
git add -A
git commit -m "design-system: RTL and accessibility verification"
```

---

## Task 16: Final Verification & Cleanup

**Files:**
- Modify: `src/assets/tokens.css`
- Modify: `src/assets/base.css`
- Modify: `src/assets/main.css`

- [ ] **Step 1: Remove deprecated aliases**

After all views/components are migrated to canonical tokens, remove the backward-compatible alias block from `src/assets/tokens.css`.

- [ ] **Step 2: Final contrast audit**

Run contrast audit on all views. Verify all text meets WCAG AA (4.5:1 body, 3:1 large).

- [ ] **Step 3: Final spacing audit**

Verify all spacing values use `--space-*` tokens. No raw `px` or `rem` values remain in CSS.

- [ ] **Step 4: Final radius audit**

Verify only `--radius-sm`, `--radius-md`, `--radius-pill` are used. No arbitrary radius values remain.

- [ ] **Step 5: Final state audit**

Verify all interactive elements have all 5 states. No missing states remain.

- [ ] **Step 6: Verify and commit**

Run full visual inspection at 1440px and 390px. Commit.

```bash
git add -A
git commit -m "design-system: final verification and cleanup"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-09-15-welco-frontend-design-system.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh sub-agent per task using the `task` tool, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints for review

**Which approach?**
