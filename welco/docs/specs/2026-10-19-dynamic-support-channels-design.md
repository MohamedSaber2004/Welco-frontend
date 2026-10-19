# Dynamic Support Channels (Instagram, Facebook & Social Channels) Architecture & Design

## 1. Overview & Objective
Enable dynamic administration and public display of support channels across Welco platform:
- Support channels include: Email, Phone, WhatsApp, Facebook, Instagram, and Working Hours.
- Admins can configure these channels dynamically from both `AdminDashboardView` (Quick Support Channels Modal) and `HelpAdminView` (Help Center Settings).
- Public visitor touchpoints (Home Page, Specialty Landing Pages, Footer, Help Center, and Provider Support) dynamically render these channels reactively via `contentService.supportContact`.
- Inactive / empty channels are conditionally hidden so only configured channels are displayed.

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
|  - ContentService.supportContact (reactive ref)           |
|  - ApiContentRepository: API PUT + LocalStorage Cache     |
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

### Admin Modal Enhancement (`AdminDashboardView.vue`)
- Add form fields in `showContactModal`:
  - Facebook Page URL (`contactForm.facebookUrl`)
  - Instagram Profile URL (`contactForm.instagramUrl`)
- Update `openContactModal()` to populate `facebookUrl` and `instagramUrl` from `contentService.supportContact.value`.
- Update `handleSaveContact()` to submit `facebookUrl` and `instagramUrl` alongside existing fields.

### Provider Support Hub Enhancement (`ProviderSupportView.vue`)
- In addition to existing WhatsApp, Phone, and Email cards, dynamically render Facebook and Instagram channel cards if configured.

### Translations (`en.ts`, `ar.ts`, `messages.ts`)
- Ensure keys for Facebook and Instagram labels, notes, placeholders, and support section headers are available and synchronized.

## 4. Verification & Testing Criteria
1. When Facebook and Instagram URLs are configured in `AdminDashboardView` or `HelpAdminView`, the saved values persist to the repository and reactive state.
2. `HomeView.vue` and `LandingPageView.vue` display the new Support Channels section showing the configured channels.
3. If Facebook or Instagram URL is cleared/empty, the respective card is cleanly hidden without leaving layout gaps.
4. Clicking Facebook or Instagram cards opens the respective URL in a new tab securely (`noopener noreferrer`).
5. Design respects RTL / LTR locale switches and mobile responsive breakpoints.
