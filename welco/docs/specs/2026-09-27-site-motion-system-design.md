# Site-Wide Motion System Design

## 1. Purpose

Apply consistent, restrained motion across all 55 views of the Welco frontend.

The motion vocabulary already exists in `src/assets/design-tokens.css` under the heading
*"Animation Keyframes & Layout Utilities (Clinical Precision Motion)"* but has **zero
adoption** — no view references any of it. This spec closes that gap. It does not invent a
new animation language, and it adds no runtime dependency.

## 2. Current State (measured, not assumed)

| Asset | Location | Status |
|---|---|---|
| Keyframes `wlFadeIn`, `wlFadeInUp`, `wlScaleIn`, `wlSlideInRight`, `wlShimmer`, `wlPulse` | `design-tokens.css:337-383` | defined, unused |
| `.anim-fade-in`, `.anim-fade-in-up`, `.anim-scale-in` | `design-tokens.css:386-396` | defined, unused |
| `.anim-card-hover`, `.interactive-lift` | `design-tokens.css:398-421` | defined, unused |
| Duration tokens `--duration-fast/base/slow` | `design-tokens.css` / `globals.css:241` | in use |
| `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` | token layer | in use |
| RTL mirror var `--flip` | `design-tokens.css:330-332` | in use by `wlSlideInRight` |
| Route transition `name="page" mode="out-in"` | `App.vue:90` + `main.css:189-195` | **live** |
| Button press `translateY(1px)` | `BaseButton.vue:56` | **live** |
| `prefers-reduced-motion` guards | 22 occurrences across `src` | partial |

Adoption measured by grep across all `src/**/*.{vue,ts,css}`:

```
anim-fade-in        0 uses
anim-fade-in-up     0 uses
anim-scale-in       0 uses
anim-card-hover     0 uses
interactive-lift    0 uses
views with any motion:  0 / 55
```

## 3. Confirmed Decisions

1. **Aesthetic: subtle and premium.** Durations 120-280ms, travel 8-16px, ease-out only.
   This matches the existing tokens rather than competing with them.
2. **Rollout: motion layer + systematic application.** A small shared foundation, then
   per-view application in batches.
3. **No new runtime dependency.** `vue` and `vue-router` remain the only runtime deps.
4. **Reuse, do not replace.** The existing vocabulary is the vocabulary.

## 4. Motion Layer (all new code lives here)

Three additions. Nothing outside this section introduces new motion primitives.

### 4.1 `src/motion/reveal.directive.ts`

A `v-reveal` directive backed by a single shared `IntersectionObserver`.

- Binding value is an optional stagger index (number). Absent or `0` means no stagger.
- On first intersection, sets the revealed state and **unobserves the element**. One
  observation per element, ever. No scroll-time cost after reveal.
- `rootMargin` triggers slightly before the element enters the viewport so content is
  already settled by the time it is read.
- If `prefers-reduced-motion: reduce` matches, the directive resolves immediately and
  never hides anything.
- Reuses existing breakpoints; the observer is created lazily on first use.

### 4.2 Motion CSS (appended to `design-tokens.css`)

- `.reveal-pending` — the pre-animation state, applied **only by the directive**:
  `opacity: 0` and `translateY(8px)`.
- `.reveal-pending.is-revealed` — runs the existing `wlFadeInUp` keyframes at
  `--duration-base` with `--ease-out`, then settles.
- Stagger via a `--stagger-i` custom property, read as
  `calc(min(var(--stagger-i, 0), 8) * 40ms)`. The `min()` enforces the cap in CSS, so a
  50-item grid can never develop a visible trailing delay.
- `.anim-move` — the FLIP transition used by `<TransitionGroup>` for layout reflow.

### 4.2.1 Class lifecycle (exact contract)

```
directive mounts      -> adds .reveal-pending          (element now hidden)
first intersection    -> adds .is-revealed             (animates in, then unobserves)
reduced motion active -> adds nothing; element stays visible
directive never runs  -> neither class present; element stays visible
```

Only the directive ever adds `.reveal-pending`. No view, and no default stylesheet rule,
may add it.

### 4.3 Global registration

Registered in `main.ts` alongside the existing global plugins, so no view needs a local
import.

## 5. Critical Safety Requirement

**The hidden state must be applied by the directive, never by default CSS.**

If JS is slow, fails to load, or the directive is not applied, content must render
**fully visible**. Per §4.2.1 this means no stylesheet rule may hide an element
unconditionally; `.reveal-pending` is only ever added by the directive at runtime.
Inverting this is the single highest-risk item in the plan — it produces an invisible
page, which is a far worse outcome than no animation at all.

Two safeguards:

1. The directive sets the pending state at mount; unstyled content is visible by default.
2. A `@media (prefers-reduced-motion: reduce)` block force-restores
   `opacity: 1; transform: none` for any element still pending.

## 6. Behavior Mapping

| # | Behavior | Status | Work |
|---|---|---|---|
| a | Scroll-in reveals | missing | `v-reveal` on card grids, stat rows, section headers, media blocks |
| b | Page/route transitions | **done** | none; visual verification only |
| c | Hover / press lift | partial | apply `.anim-card-hover` and `.interactive-lift` to cards and clickable rows; buttons already handled |
| d | Animated layout reflow | missing | `<TransitionGroup>` + `.anim-move` on grids that add, remove, or reorder items |

### 6.1 Surfaces for layout reflow (d)

Cart line items, wishlist grid, provider catalog grid, category grid, quote line items,
and any list that reorders after a mutation. Vue's `<TransitionGroup>` supplies the FLIP
behavior; `.anim-move` supplies the timing.

### 6.2 Surfaces excluded from reveals

- `DataState` empty, loading, and error states — they own their own motion already
  (`DataState.vue:2024-2026`).
- Modals, drawers, toasts, and dropdowns — 18 `<Transition>` instances already handle
  these; re-animating them would double up.
- Data tables in dense admin lists — motion competes with scanning. Reveals apply to the
  page container and section headers, not to individual rows.

## 7. Accessibility

- `prefers-reduced-motion: reduce` disables `v-reveal` entirely and force-restores any
  pending element. Consistent with the 22 existing guards.
- Only `transform` and `opacity` are animated. Both are compositor-only; neither triggers
  layout or paint.
- Shared elements use `translateY` and `scale`, which are direction-neutral. Any
  horizontal movement reuses `--flip` so it mirrors correctly in Arabic.
- Touch devices: hover effects are wrapped in `@media (hover: hover)` to prevent the
  sticky-hover problem where a tap leaves a card visually "pressed".

## 8. RTL and Bilingual Verification

The site is bilingual (`en` / `ar`) with `dir` switching. Mirroring defects are invisible
in English and obvious in Arabic, so every batch is verified in **both** locales rather
than deferred to the end.

## 9. Rollout Plan

Each batch ends with a green `npm run build`. The `type-check` step in that script is the
Vercel deploy gate, so a red build blocks shipping.

0. **Foundation** — directive, motion CSS, global registration, reduced-motion guard,
   plus a reduced-motion verification pass.
1. **Public / marketing** (10) — Home, About, Catalog, CategoryProviders, Providers, Oem,
   Certifications, LandingPage, MostSellingProducts, ProductDetail.
2. **Auth** (6) — Login, Register, ForgotPassword, ResetPassword, VerifyEmail,
   VerifyPasswordOtp.
3. **Marketplace** (7) — Cart, Checkout, Wishlist, OrderHistory, OrderDetail,
   OrderTracking, OrderConfirmation.
4. **Provider** (6) — ProviderCatalog, ProviderCategories, ProviderOrders, ProviderQuotes,
   ProviderStorefront, ProviderSupport.
5. **Admin** (15) — all 15 `*AdminView.vue` files.
6. **Account and support** (11) — Profile, Addresses, Locations, AccountDashboard,
   HelpCenter, MyTickets, CategoriesView, QuoteDetail, QuoteList, RfqDetail, RfqList.

Batches total 55 views, matching the measured view count.

Batches are ordered by traffic and risk: the public site ships the visible improvement
first, and admin arrives last because it is the most data-dense and least motion-friendly.

## 10. Validation and Acceptance Criteria

Per batch:

- `npm run build` exits 0 (type-check gate).
- No new console errors; no Vue warnings introduced by the directive.
- Desktop (1440px) and mobile (390px) pass.
- **Both `en` and `ar`** pass, with no mirrored or misaligned motion.
- `prefers-reduced-motion: reduce` emulated — content fully visible, no hidden elements.
- No cumulative layout shift regression; reveals do not push content down after paint.

Whole-project:

- Every view has motion applied or is explicitly justified as excluded by §6.2.
- Reduced-motion emulation across the full site leaves zero invisible elements.
- No new entries in `package.json` dependencies.

## 11. Non-Goals

- No new animation library, and no JS animation runtime.
- No parallax, scroll-jacking, or scroll-linked animation.
- No spring or bounce easing; ease-out only.
- No changes to the existing route transition, `DataState`, modal, toast, or drawer
  motion.
- No visual redesign. This spec changes timing and movement only — no color, typography,
  spacing, or layout changes.
- No changes to the two blocked items (provider/company cascade delete, and the
  provider-dashboard catalog container table), which are tracked separately.
