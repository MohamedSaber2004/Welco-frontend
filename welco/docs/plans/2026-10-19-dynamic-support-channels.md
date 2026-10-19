# Dynamic Support Channels (Instagram, Facebook & Social Channels) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable dynamic configuration of Facebook, Instagram, WhatsApp, Phone, and Email support channels in the Admin Dashboard, and dynamically render them across the Home Page, Specialty Landing Pages, Provider Support, and Footer.

**Architecture:** Extend Admin Dashboard support channel controls to include Facebook and Instagram URLs; build a reusable `SupportChannelsSection.vue` component that reactively displays active channels with brand SVG icons and direct actions; embed this section into `HomeView.vue` and `LandingPageView.vue`; extend `ProviderSupportView.vue` with Facebook and Instagram channel cards.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), TypeScript, Vite, TailwindCSS / Vanilla CSS design tokens, Vue Router.

---

### Task 1: Admin Dashboard Support Channels Modal Enhancement

**Files:**
- Modify: `src/views/admin/AdminDashboardView.vue`

- [ ] **Step 1: Update `contactForm` state and `openContactModal`**
In `src/views/admin/AdminDashboardView.vue`, add `facebookUrl` and `instagramUrl` to `contactForm` ref:
```typescript
const contactForm = ref({
  supportEmail: '',
  phoneNumber: '',
  whatsAppNumber: '',
  facebookUrl: '',
  instagramUrl: '',
  workingHours: '',
})
```
And update `openContactModal()`:
```typescript
function openContactModal() {
  const current = services.contentService.supportContact.value
  contactForm.value = {
    supportEmail: current.supportEmail || '',
    phoneNumber: current.phoneNumber || '',
    whatsAppNumber: current.whatsAppNumber || '',
    facebookUrl: current.facebookUrl || '',
    instagramUrl: current.instagramUrl || '',
    workingHours: current.workingHours || '',
  }
  contactError.value = null
  showContactModal.value = true
}
```

- [ ] **Step 2: Update `handleSaveContact()`**
In `src/views/admin/AdminDashboardView.vue`, pass `facebookUrl` and `instagramUrl` (trimmed or undefined) when calling `services.contentService.updateSupportContact(...)`:
```typescript
await services.contentService.updateSupportContact({
  supportEmail: contactForm.value.supportEmail.trim(),
  phoneNumber: contactForm.value.phoneNumber.trim(),
  whatsAppNumber: contactForm.value.whatsAppNumber.trim(),
  facebookUrl: contactForm.value.facebookUrl.trim() || undefined,
  instagramUrl: contactForm.value.instagramUrl.trim() || undefined,
  workingHours: contactForm.value.workingHours.trim() || undefined,
})
```

- [ ] **Step 3: Add Facebook and Instagram inputs to the modal template**
In `showContactModal` form in `AdminDashboardView.vue`, add two `BaseInput` components:
```vue
<div class="modal-grid-2">
  <BaseInput
    v-model="contactForm.facebookUrl"
    :label="t('admin.facebookUrlLabel') || 'Facebook Page URL'"
    placeholder="https://facebook.com/welco"
    :required="false"
  />
  <BaseInput
    v-model="contactForm.instagramUrl"
    :label="t('admin.instagramUrlLabel') || 'Instagram Profile URL'"
    placeholder="https://instagram.com/welco"
    :required="false"
  />
</div>
```

---

### Task 2: Provider Support View Enhancement

**Files:**
- Modify: `src/views/provider/ProviderSupportView.vue`

- [ ] **Step 1: Add Facebook & Instagram computed properties**
In `src/views/provider/ProviderSupportView.vue`:
```typescript
const liveFacebook = computed(() => supportContact.value?.facebookUrl || '')
const liveInstagram = computed(() => supportContact.value?.instagramUrl || '')
```

- [ ] **Step 2: Add Facebook and Instagram Desk Cards to channels grid**
In `src/views/provider/ProviderSupportView.vue`, right after the Email Desk Card:
```vue
<!-- Facebook Channel Card -->
<div v-if="liveFacebook" class="channel-card">
  <div class="channel-icon bg-blue-soft">
    <svg class="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  </div>
  <div class="channel-info">
    <span class="channel-label mono">{{ t('help.facebookChannel') }}</span>
    <strong class="channel-main mono text-sm truncate max-w-[220px]">{{ liveFacebook }}</strong>
    <p class="channel-sub">{{ t('help.facebookChannelNote') }}</p>
  </div>
  <a :href="liveFacebook" target="_blank" rel="noopener noreferrer" class="btn-channel btn-fb mono">
    <span class="material-symbols-outlined text-[16px]">open_in_new</span>
    <span>{{ t('common.open') || 'Visit' }}</span>
  </a>
</div>

<!-- Instagram Channel Card -->
<div v-if="liveInstagram" class="channel-card">
  <div class="channel-icon bg-pink-soft">
    <svg class="w-5 h-5 text-pink-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  </div>
  <div class="channel-info">
    <span class="channel-label mono">{{ t('help.instagramChannel') }}</span>
    <strong class="channel-main mono text-sm truncate max-w-[220px]">{{ liveInstagram }}</strong>
    <p class="channel-sub">{{ t('help.instagramChannelNote') }}</p>
  </div>
  <a :href="liveInstagram" target="_blank" rel="noopener noreferrer" class="btn-channel btn-ig mono">
    <span class="material-symbols-outlined text-[16px]">open_in_new</span>
    <span>{{ t('common.open') || 'Visit' }}</span>
  </a>
</div>
```

---

### Task 3: Create Shared Component `SupportChannelsSection.vue`

**Files:**
- Create: `src/components/support/SupportChannelsSection.vue`

- [ ] **Step 1: Write `SupportChannelsSection.vue`**
Build a sleek, high-tech, accessible component:
- Computes reactive fields from `services.contentService.supportContact.value`:
  - `whatsAppNumber`, `phoneNumber`, `supportEmail`, `facebookUrl`, `instagramUrl`, `workingHours`.
- Has `hasAnyChannel` computed flag so it only renders if at least one channel exists.
- Clean cards with crisp SVG brand icons, direct click links, accessible labels.
- Scoped CSS using Welco design tokens (`--wl-surface`, `--wl-border`, `--wl-primary`, `--wl-ease-spring`, etc.).

---

### Task 4: Integrate `SupportChannelsSection.vue` into Home Page

**Files:**
- Modify: `src/views/HomeView.vue`

- [ ] **Step 1: Import `SupportChannelsSection`**
```typescript
import SupportChannelsSection from '../components/support/SupportChannelsSection.vue'
```
- [ ] **Step 2: Add component to template before the footer**
Mount `<SupportChannelsSection />` right before the price quote modal or after the About section.

---

### Task 5: Integrate `SupportChannelsSection.vue` into Landing Page

**Files:**
- Modify: `src/views/catalog/LandingPageView.vue`

- [ ] **Step 1: Import `SupportChannelsSection`**
```typescript
import SupportChannelsSection from '../../components/support/SupportChannelsSection.vue'
```
- [ ] **Step 2: Add component to template**
Mount `<SupportChannelsSection />` towards the bottom above the footer.

---

### Task 6: Translations Verification

**Files:**
- Modify: `src/i18n/messages.ts`, `src/i18n/en.ts`, `src/i18n/ar.ts`

- [ ] **Step 1: Ensure keys exist for facebookUrlLabel, instagramUrlLabel in admin**
Add `facebookUrlLabel` and `instagramUrlLabel` keys so the Admin form shows localized labels in English and Arabic.

---

### Task 7: Build & Validation

- [ ] **Step 1: Run type checking and tests**
Run `npm run build` or `npx vue-tsc --noEmit` and vitest to guarantee zero regressions.
