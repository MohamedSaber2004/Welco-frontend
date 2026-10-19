# Dynamic Support Channels (Instagram, Facebook & Social Channels) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable dynamic configuration and canonical defaults for Facebook, Instagram, WhatsApp, Phone, and Email support channels in the Admin Dashboard, with instant reactive synchronization across the Home Page, Specialty Landing Pages, Provider Support Hub, Help Center, and Footer.

**Architecture:** Define canonical brand defaults in `api-content.repository.ts`; extend `updateSupportContact` to persist to `localStorage` and broadcast custom events (`welco:support-contact-updated`); configure `content.service.ts` to listen for cross-tab and cross-component updates; make `SupportChannelsSection.vue` self-loading on mount; ensure Provider Support, Help Center, and Footer display the active channels dynamically.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), TypeScript, Vite, TailwindCSS & Vanilla CSS design tokens, Pinia / Service DI pattern, Vue Router.

---

### Task 1: Canonical Defaults and Live Event Broadcast in Content Repository

**Files:**
- Modify: `src/data/repositories/api-content.repository.ts`
- Test: `src/__tests__/App.test.ts` (or add unit test)

- [ ] **Step 1: Define `CANONICAL_SUPPORT_CONTACT` and update `toSupportContact`**
In `src/data/repositories/api-content.repository.ts`:
Define default fallback URLs:
```typescript
export const CANONICAL_SUPPORT_DEFAULTS = {
  supportEmail: 'support@welco.health',
  phoneNumber: '+971 4 800 9352',
  whatsAppNumber: '+971500000000',
  facebookUrl: 'https://facebook.com/welcosurgical',
  instagramUrl: 'https://instagram.com/welcosurgical',
  workingHours: 'Mon - Fri: 8:00 AM - 6:00 PM (GST)',
} as const
```
Update `toSupportContact(raw)` to fall back to `localSocial.facebookUrl || CANONICAL_SUPPORT_DEFAULTS.facebookUrl` if the backend returns empty or null, ensuring cards are never blank.

- [ ] **Step 2: Update `updateSupportContact` to broadcast window event**
In `src/data/repositories/api-content.repository.ts`:
When saving:
1. Save `facebookUrl` and `instagramUrl` to `localStorage['welco_social_contacts']`.
2. Perform `PUT` request to `/api/v1/support/contact`.
3. Normalize response with `toSupportContact(res)`.
4. Dispatch `window.dispatchEvent(new CustomEvent('welco:support-contact-updated', { detail: updated }))` to notify all views immediately.
5. Return normalized DTO.

---

### Task 2: Reactive State and Event Listening in Content Service

**Files:**
- Modify: `src/application/content.service.ts`

- [ ] **Step 1: Initialize `supportContact` with canonical defaults**
In `src/application/content.service.ts`, initialize `this.supportContact` with `CANONICAL_SUPPORT_DEFAULTS` so views render immediately before the API responds.

- [ ] **Step 2: Listen for storage and broadcast events**
In `src/application/content.service.ts` constructor or setup method:
Add event listeners for:
- `window.addEventListener('welco:support-contact-updated', ...)`
- `window.addEventListener('storage', ...)`
When triggered, reload or re-assign `this.supportContact.value = event.detail || await this.repo.getSupportContact()`.

---

### Task 3: Self-Loading and Robust Card Rendering in `SupportChannelsSection.vue`

**Files:**
- Modify: `src/components/support/SupportChannelsSection.vue`

- [ ] **Step 1: Add `onMounted` hook in `SupportChannelsSection.vue`**
Import `onMounted` from `vue` and trigger:
```typescript
onMounted(() => {
  void services.contentService.loadSupportContact()
})
```
This guarantees that whenever `SupportChannelsSection` mounts (such as on direct navigation to a landing page `/landing/:slug`), the support channels data is loaded and rendered.

- [ ] **Step 2: Verify Facebook and Instagram cards**
Ensure Facebook and Instagram cards display clean URLs, responsive grid layouts, SVG icons, and valid external links (`target="_blank" rel="noopener noreferrer"`).

---

### Task 4: Integrate and Verify Home Page and Landing Page

**Files:**
- Verify: `src/views/HomeView.vue`
- Verify: `src/views/catalog/LandingPageView.vue`

- [ ] **Step 1: Verify `<SupportChannelsSection />` in `HomeView.vue`**
Confirm `<SupportChannelsSection />` is properly mounted above the footer and rendered on desktop and mobile.

- [ ] **Step 2: Verify `<SupportChannelsSection />` in `LandingPageView.vue`**
Confirm `<SupportChannelsSection />` is properly mounted inside the landing page container.

---

### Task 5: Verify Provider Support, Help Center, and App Footer

**Files:**
- Verify/Modify: `src/views/provider/ProviderSupportView.vue`
- Verify/Modify: `src/views/support/HelpCenterView.vue`
- Verify/Modify: `src/components/layout/AppFooter.vue`

- [ ] **Step 1: Verify Facebook & Instagram Desk Cards in `ProviderSupportView.vue`**
Ensure `liveFacebook` and `liveInstagram` use the reactive `supportContact` and render with official SVG icons and links.

- [ ] **Step 2: Verify Help Center cards in `HelpCenterView.vue`**
Ensure Facebook and Instagram cards render in the channels grid and open the URLs.

- [ ] **Step 3: Verify Footer in `AppFooter.vue`**
Ensure Facebook and Instagram links are rendered in the footer social section.

---

### Task 6: Admin Dashboard & Help Admin Live Verification

**Files:**
- Verify: `src/views/admin/AdminDashboardView.vue`
- Verify: `src/views/admin/HelpAdminView.vue`

- [ ] **Step 1: Verify form inputs and saving in Admin Dashboard**
Confirm Facebook and Instagram URL fields in the Quick Support Modal submit without error.

- [ ] **Step 2: Verify Help Admin Tab 4 (Support Channels)**
Confirm saving updates both the backend and localStorage, triggering the broadcast event.

---

### Task 7: Build, Typecheck, and Tests

- [ ] **Step 1: Run type checking**
Run `npx vue-tsc --noEmit` to verify 0 TypeScript compiler errors.

- [ ] **Step 2: Run test suite**
Run `npm test` or `npx vitest run` to ensure all tests pass.
