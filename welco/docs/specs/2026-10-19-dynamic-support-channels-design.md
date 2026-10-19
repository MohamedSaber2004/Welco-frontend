# Dynamic Support Channels (Instagram, Facebook & Social Channels) Architecture & Design

## 1. Overview & Objective
Enable dynamic administration, canonical defaults, and reactive public display of support channels across the Welco platform:
- Support channels include: Email, Phone, WhatsApp, Facebook, Instagram, and Working Hours.
- **Canonical Defaults:** In absence of admin customization (or when backend returns `null`), the system falls back to official verified brand handles:
  - Facebook: `https://facebook.com/welcosurgical`
  - Instagram: `https://instagram.com/welcosurgical`
  - WhatsApp: `+971 50 000 0000`
  - Phone: `+971 4 800 9352`
  - Email: `support@welco.health`
- **Dynamic Admin Management:** Admins can configure these channels dynamically from both `AdminDashboardView` (Quick Support Channels Modal) and `HelpAdminView` (Help Center Settings).
- **Public Visitor Touchpoints:**
  - Home Page (`HomeView.vue`)
  - Specialty Landing Pages (`LandingPageView.vue`)
  - Main Footer (`AppFooter.vue`)
  - Help Center (`HelpCenterView.vue`)
  - Provider Support Hub (`ProviderSupportView.vue`)
- **Instant Reactive Synchronization:** Changes made in Admin instantly update all mounted components across tabs and sessions via reactive state, `localStorage`, and custom window events.

## 2. Architecture & Data Flow

```
+-----------------------------------------------------------+
|                      Admin Interfaces                     |
|  - AdminDashboardView.vue (Quick Support Channels Modal)  |
|  - HelpAdminView.vue (Help Center Management)             |
+-----------------------------+-----------------------------+
                              |
                              | updateSupportContact(payload)
                              v
+-----------------------------------------------------------+
|                   ContentService & Repo                   |
|  - Fallback to Canonical Defaults (welcosurgical)         |
|  - API PUT /api/v1/support/contact                        |
|  - LocalStorage Cache ('welco_social_contacts')           |
|  - Custom Event ('welco:support-contact-updated')         |
+-----------------------------+-----------------------------+
                              |
       +----------------------+----------------------+
       |                      |                      |
       v                      v                      v
+--------------+      +----------------+     +---------------+
| HomeView.vue |      | LandingPage.vue|     | AppFooter.vue |
| (Support     |      | (Support       |     | & Help Center |
|  Channels)   |      |  Channels)     |     | & Provider    |
+--------------+      +----------------+     +---------------+
```

### Data Contract (`SupportContactDto` / `UpdateSupportContactPayload`)
```typescript
export interface SupportContactDto {
  id?: string
  supportEmail: string
  phoneNumber: string
  whatsAppNumber: string
  facebookUrl?: string
  instagramUrl?: string
  workingHours?: string
  updatedAt?: string
}
```

## 3. UI/UX Design Specifications

### Component: `src/components/support/SupportChannelsSection.vue`
- **Container**: Contained in standard page layout container (`max-width: var(--wl-max-width)`), matching Welco design tokens.
- **Self-Sufficiency**: Calls `contentService.loadSupportContact()` upon `onMounted` to ensure immediate data fetch even on direct entry to landing pages.
- **Header**:
  - Eyebrow: `t('help.channelsTitle')` with active status pulse indicator.
  - Title & Subtitle: Highlighting multi-channel clinical & operations assistance.
  - Badge: Dynamic working hours pill displaying `displayWorkingHours`.
- **Channel Cards Grid**:
  - Responsive grid: 1 column on mobile, 2 on tablet, up to 4-5 on desktop.
  - Card elements:
    1. **WhatsApp**: Custom WhatsApp SVG icon, formatted phone number, subtitle `help.channelWaNote`, link `https://wa.me/...`.
    2. **Telephone**: Call icon, international phone number, subtitle `help.channelPhoneNote`, link `tel:...`.
    3. **Email**: Mail icon, verified email address, subtitle `help.channelEmailNote`, link `mailto:...`.
    4. **Facebook**: Official Facebook brand SVG icon, title `help.facebookChannel`, subtitle `help.facebookChannelNote`, link `{facebookUrl}` (target `_blank`, `rel="noopener noreferrer"`).
    5. **Instagram**: Official Instagram gradient/brand SVG icon, title `help.instagramChannel`, subtitle `help.instagramChannelNote`, link `{instagramUrl}` (target `_blank`, `rel="noopener noreferrer"`).
  - Micro-interactions: Subtle lift on hover, glowing gradient border accent on active focus, smooth CSS transitions.
  - Accessibility: WCAG AA compliant contrast, proper `aria-label`s, directional arrow support for RTL and LTR.

### Repository Fallback & Live Event Broadcasting
- When `getSupportContact()` is executed:
  - Check API response. If `facebookUrl` is missing or null, check `localStorage['welco_social_contacts']`.
  - If still missing, apply canonical default `https://facebook.com/welcosurgical`.
  - Same for `instagramUrl` (`https://instagram.com/welcosurgical`).
- When `updateSupportContact()` is executed:
  - Save to `localStorage['welco_social_contacts']`.
  - Execute API PUT call.
  - Dispatch `window.dispatchEvent(new CustomEvent('welco:support-contact-updated', { detail: updated }))`.
  - `contentService` and `App.vue` listen to `storage` and `welco:support-contact-updated` to reflect changes live across all open views without page reloads.

### Verification & Testing Criteria
1. When Facebook and Instagram URLs are configured in `AdminDashboardView` or `HelpAdminView`, the saved values persist to the repository and reactive state.
2. `HomeView.vue` and `LandingPageView.vue` display the Support Channels section showing the configured channels (or official defaults).
3. Clicking Facebook or Instagram cards opens the respective URL in a new tab securely (`noopener noreferrer`).
4. Design respects RTL / LTR locale switches and mobile responsive breakpoints.
