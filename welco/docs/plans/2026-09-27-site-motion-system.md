# Site-Wide Motion System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the already-designed but entirely unused motion vocabulary across the Welco frontend, starting with a tested `v-reveal` directive and the 10 highest-traffic public views.

**Architecture:** A single new module, `src/motion/reveal.ts`, provides a `v-reveal` Vue directive backed by one shared `IntersectionObserver`. It adds a pending class at mount and a revealed class on first intersection, then unobserves. The pre-animation hidden state is applied *only* by the directive at runtime — no stylesheet rule hides an element unconditionally — so a JS failure degrades to fully visible content. CSS extends the existing `design-tokens.css` motion section; no new dependency is added.

**Tech Stack:** Vue 3.5 (`<script setup>`, custom directives), TypeScript 6, Vite 8, Tailwind 3, Vitest 4 + jsdom. No `@vue/test-utils` — tests mount with `createApp` + `h`, following `src/components/ui/__tests__/BaseButton.spec.ts`.

**Spec:** `docs/specs/2026-09-27-site-motion-system-design.md`

---

## Scope of this plan

This plan delivers the **motion layer (batch 0)** and **batch 1, the 10 public/marketing views**. Batches 2-6 (auth, marketplace, provider, admin, account) are listed with their audit rows in Task 8 and become follow-up plans using the identical Task 5/6 pattern. That split is deliberate and matches §9 of the spec: each plan yields working, verifiable software on its own.

**Out of scope:** page/route transitions (already live at `App.vue:90` + `main.css:189-195`), `DataState`, modals, toasts, drawers, and any visual redesign.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/motion/reveal.ts` | **Create** | The `v-reveal` directive, the shared `IntersectionObserver`, reduced-motion guard. Exports the class-name constants so CSS and tests agree. |
| `src/motion/__tests__/reveal.test.ts` | **Create** | Directive unit tests with a stubbed `IntersectionObserver`. |
| `src/assets/design-tokens.css` | **Modify** (§13, after line 421) | Append `.reveal-pending`, `.is-revealed`, `.anim-move`, reduced-motion safety net. Wrap the existing `.anim-card-hover:hover` in `@media (hover: hover)`. |
| `src/main.ts` | **Modify** (after line 17) | Register the directive globally. |
| `src/views/HomeView.vue` etc. (10 files) | **Modify** | Apply `v-reveal` and existing motion classes. |

`src/motion/reveal.ts` is the only new source file. It stays under 60 lines and has no imports beyond `vue`'s `Directive` type.

---

## Task 1: Build the `v-reveal` directive

**Files:**
- Create: `src/motion/reveal.ts`
- Test: `src/motion/__tests__/reveal.test.ts`

- [ ] **Step 1: Write the test skeleton with a stubbed IntersectionObserver**

jsdom does not implement `IntersectionObserver`, and `window.matchMedia` is absent, so both are stubbed. Create `src/motion/__tests__/reveal.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApp, h, nextTick, withDirectives, type App } from 'vue'
import { vReveal, REVEAL_PENDING, REVEAL_DONE, __setObserver } from '../reveal'

class StubObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: readonly number[] = []
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = () => [] as IntersectionObserverEntry[]
  private callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  /** Fire a synthetic intersection for the given element. */
  enter(el: Element) {
    this.callback(
      [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
}

let reduced = false
let app: App | null = null
let host: HTMLDivElement | null = null
let observer: StubObserver | null = null

const mountReveal = async (value?: number): Promise<HTMLElement> => {
  observer = new StubObserver(() => {})
  __setObserver(observer as unknown as IntersectionObserver)
  host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp({
    // Directives must be applied with withDirectives(); a 'v-reveal' prop in a
    // render function is silently ignored and would make every test pass vacuously.
    render: () => withDirectives(h('div', { class: 'target' }, 'content'), [[vReveal, value]]),
  })
  app.mount(host)
  await nextTick()
  return host.querySelector('.target') as HTMLElement
}

beforeEach(() => {
  reduced = false
  vi.stubGlobal('IntersectionObserver', StubObserver)
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduced,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
})

afterEach(() => {
  app?.unmount()
  host?.remove()
  __setObserver(null)
  app = null
  host = null
  vi.unstubAllGlobals()
})
```

- [ ] **Step 2: Add the first failing test — pending class is applied on mount**

Append to the same file:

```ts
describe('vReveal', () => {
  it('adds the pending class on mount', async () => {
    const el = await mountReveal()
    expect(el.classList.contains(REVEAL_PENDING)).toBe(true)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/motion/__tests__/reveal.test.ts`
Expected: FAIL — cannot resolve `../reveal`, because the module does not exist yet.

- [ ] **Step 4: Create the directive with only the mount-time behaviour**

Create `src/motion/reveal.ts`:

```ts
import type { Directive } from 'vue'

export const REVEAL_PENDING = 'reveal-pending'
export const REVEAL_DONE = 'is-revealed'
export const STAGGER_PROP = '--stagger-i'

let observer: IntersectionObserver | null = null

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getObserver(): IntersectionObserver {
  if (observer) return observer
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target as HTMLElement
        el.classList.add(REVEAL_DONE)
        observer?.unobserve(el)
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
  )
  return observer
}

export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    if (prefersReducedMotion()) return
    el.classList.add(REVEAL_PENDING)
    const index = binding.value ?? 0
    if (index > 0) el.style.setProperty(STAGGER_PROP, String(index))
    getObserver().observe(el)
  },
  unmounted(el) {
    observer?.unobserve(el)
  },
}

/** Test seam: inject or clear the shared observer. */
export function __setObserver(next: IntersectionObserver | null): void {
  observer = next
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/motion/__tests__/reveal.test.ts`
Expected: PASS — 1 passed.

- [ ] **Step 6: Add the reduced-motion test — content must never be hidden**

```ts
  it('does NOT add the pending class when reduced motion is preferred', async () => {
    reduced = true
    const el = await mountReveal()
    expect(el.classList.contains(REVEAL_PENDING)).toBe(false)
  })
```

- [ ] **Step 7: Run the test**

Run: `npx vitest run src/motion/__tests__/reveal.test.ts`
Expected: PASS — 2 passed. This test guards spec §5; it must never be deleted or weakened.

- [ ] **Step 8: Add the reveal-on-intersection test**

```ts
  it('adds the revealed class and unobserves on first intersection', async () => {
    const el = await mountReveal()
    expect(el.classList.contains(REVEAL_DONE)).toBe(false)
    observer!.enter(el)
    expect(el.classList.contains(REVEAL_DONE)).toBe(true)
    expect(observer!.unobserve).toHaveBeenCalledWith(el)
  })
```

- [ ] **Step 9: Add the stagger tests**

```ts
  it('sets the stagger custom property from the binding value', async () => {
    const el = await mountReveal(3)
    expect(el.style.getPropertyValue('--stagger-i')).toBe('3')
  })

  it('omits the stagger custom property when the value is zero', async () => {
    const el = await mountReveal(0)
    expect(el.style.getPropertyValue('--stagger-i')).toBe('')
  })
```

- [ ] **Step 10: Run the full test file**

Run: `npx vitest run src/motion/__tests__/reveal.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 11: Type-check**

Run: `npm run type-check`
Expected: exit 0, no output. `vue-tsc` must stay clean because it gates the Vercel deploy.

- [ ] **Step 12: Commit**

```bash
git add src/motion/reveal.ts src/motion/__tests__/reveal.test.ts
git commit -m "feat(motion): add v-reveal directive with reduced-motion guard"
```

---

## Task 2: Add the motion CSS layer

**Files:**
- Modify: `src/assets/design-tokens.css` (append after line 421, the `.interactive-lift:active` rule)

The CSS cannot be unit-tested in jsdom — jsdom does not evaluate animations or
`@media (hover: hover)`. It is verified visually in Task 7. What *is* asserted here is
that the directive's class names and the stylesheet agree, via a source-level test in
Task 2 Step 4.

- [ ] **Step 1: Append the reveal, reflow, and safety-net rules**

Add at the end of `src/assets/design-tokens.css`:

```css
/* --------------------------------------------------------------------------
   14. Motion Layer (v-reveal + layout reflow)
   -------------------------------------------------------------------------- */

/* The hidden state is applied ONLY by the directive at runtime. No rule here may
   hide an element unconditionally, or a JS failure yields an invisible page.
   See docs/specs/2026-09-27-site-motion-system-design.md section 5. */
.reveal-pending {
  opacity: 0;
  transform: translateY(8px);
}

.reveal-pending.is-revealed {
  animation: wlFadeInUp var(--duration-base, 180ms) var(--ease-out) forwards;
  animation-delay: calc(min(var(--stagger-i, 0), 8) * 40ms);
}

/* FLIP timing for <TransitionGroup>; Vue supplies the measurement. */
.anim-move {
  transition: transform var(--duration-base, 180ms) var(--ease-out);
}

/* Safety net: never leave content hidden when motion is reduced. */
@media (prefers-reduced-motion: reduce) {
  .reveal-pending {
    opacity: 1 !important;
    transform: none !important;
    animation: none !important;
  }
}
```

- [ ] **Step 2: Confirm the build still passes**

Run: `npm run build`
Expected: exit 0. CSS is not type-checked, so this only proves nothing else broke.

- [ ] **Step 3: Confirm the keyframes this rule depends on already exist**

Run: `Select-String -Path src/assets/design-tokens.css -Pattern "@keyframes wlFadeInUp"`
Expected: one match, at or before line 342. The rule references `wlFadeInUp` and must
not redefine it.

- [ ] **Step 4: Add a test asserting directive and stylesheet agree**

Append to `src/motion/__tests__/reveal.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { STAGGER_PROP } from '../reveal'

describe('motion stylesheet contract', () => {
  const css = readFileSync(
    fileURLToPath(new URL('../../assets/design-tokens.css', import.meta.url)),
    'utf8',
  )

  it('styles the exact class the directive adds', () => {
    expect(css).toContain(`.${REVEAL_PENDING} {`)
    expect(css).toContain(`.${REVEAL_PENDING}.${REVEAL_DONE} {`)
  })

  it('caps the stagger delay in CSS', () => {
    expect(css).toContain('min(var(--stagger-i, 0), 8)')
  })

  it('uses the same stagger property name as the directive', () => {
    // Closes the loop between the TS constant and the stylesheet literal. If
    // STAGGER_PROP is ever renamed without updating the CSS, this fails.
    expect(css).toContain(`var(${STAGGER_PROP}, 0)`)
  })

  it('force-restores visibility under reduced motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.reveal-pending[\s\S]*?opacity: 1 !important/)
  })
})
```

This test is the guard against the one silent failure mode in the whole feature: the
directive and the stylesheet drifting apart, which would leave every revealed element
permanently invisible with no error anywhere.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/motion/__tests__/reveal.test.ts`
Expected: PASS — 9 passed (5 directive + 4 contract).

- [ ] **Step 6: Commit**

```bash
git add src/assets/design-tokens.css src/motion/__tests__/reveal.test.ts
git commit -m "feat(motion): add reveal, reflow, and reduced-motion CSS layer"
```

---

## Task 3: Guard hover effects against touch devices

**Files:**
- Modify: `src/assets/design-tokens.css:398-421`

`.anim-card-hover:hover` currently applies on any hover-capable input. On touch, a tap
leaves the card visually lifted until the user taps elsewhere. Spec §7 requires the
hover rule be gated on `hover: hover`.

- [ ] **Step 1: Wrap the existing hover rule**

In `src/assets/design-tokens.css`, replace **only** the `.anim-card-hover:hover { ... }`
block currently at lines 404-408 with the following. Leave the `.anim-card-hover` base
rule at lines 398-402 exactly as it is — do not re-add it, or the base transition will be
declared twice.

```css
/* Gated so a tap on a touch device does not leave the card visually lifted. */
@media (hover: hover) {
  .anim-card-hover:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: color-mix(in srgb, var(--brand, #0F3D56) 30%, var(--border));
  }
}
```

Leave `.interactive-lift` and its `:hover` / `:active` rules at lines 410-421 unchanged:
`:active` is a press state that is correct on touch, and its `translateY(-1px)` hover is
subtle enough not to stick noticeably.

- [ ] **Step 2: Verify the replacement did not orphan the transition rule**

Run: `Select-String -Path src/assets/design-tokens.css -Pattern "anim-card-hover|@media \(hover: hover\)"`
Expected: the base `.anim-card-hover` rule appears once, the `:hover` variant once, and
one `@media (hover: hover)` wrapper. No duplicate base rule.

- [ ] **Step 3: Commit**

```bash
git add src/assets/design-tokens.css
git commit -m "fix(motion): gate card hover lift behind hover:hover media query"
```

---

## Task 4: Register the directive globally

**Files:**
- Modify: `src/main.ts` (after line 17)

Registered globally so no view needs a local import, matching how `AppImage` is
registered at `main.ts:17`.

- [ ] **Step 1: Add the import**

In `src/main.ts`, after the `import AppImage from './components/ui/AppImage.vue'` line,
add:

```ts
import { vReveal } from './motion/reveal'
```

- [ ] **Step 2: Register it on the app**

After the existing `app.component('AppImage', AppImage)` line, add:

```ts
app.directive('reveal', vReveal)
```

The resulting block reads:

```ts
const app = createApp(App)
app.component('AppImage', AppImage)
app.directive('reveal', vReveal)
app.use(router)
app.mount('#app')
```

- [ ] **Step 3: Type-check and build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(motion): register v-reveal directive globally"
```

---

## Task 5: Apply motion to the 10 public views (part A)

**Files:**
- Modify: `src/views/HomeView.vue`, `src/views/AboutView.vue`, `src/views/CatalogView.vue`, `src/views/CategoryProvidersView.vue`

The pattern, identical in every view below:

1. Add `v-reveal` to each **card** in a grid, with `:data-index`-style stagger via the
   directive's numeric binding, capped by the CSS `min()`.
2. Add the existing `anim-card-hover` class to the same cards.
3. Leave grid **containers** unanimated. Animating both parent and child compounds the
   movement and reads as jitter.

Stagger uses the loop index, so the cap in CSS is what protects long lists:

```vue
<article
  v-for="(item, i) in items"
  :key="item.id"
  v-reveal="i"
  class="product-card anim-card-hover"
>
```

- [ ] **Step 1: HomeView — `src/views/HomeView.vue`**

| Grid container | Card to animate |
|---|---|
| `.product-grid` | `.product-card` |
| `.cat-grid` | `.cat-card` |
| `.home-certs-grid` | `.home-cert-card` |
| `.providers-strip-grid` | `.provider-tile` |

For each of the four, add `v-reveal="i"` and the `anim-card-hover` class to the `v-for`
element. Leave the `.product-card__*` child elements untouched.

- [ ] **Step 2: AboutView — `src/views/AboutView.vue`**

| Grid container | Card |
|---|---|
| `.cross-grid` | `.cross-card` |
| `.pillars-grid` | `.pillar-card` |
| (story section) | `.story-card` |

- [ ] **Step 3: CatalogView — `src/views/CatalogView.vue`**

| Grid container | Card |
|---|---|
| `.products-grid` | `.catalog-card` |
| `.catalog-grid-layout` | `.catalog-card` |

This is the highest-value view in the batch — the public product catalog. Also wrap the
`.products-grid` `v-for` element in `<TransitionGroup name="anim-move" tag="div"
class="products-grid">` so filtering the catalog animates rows instead of jumping. Confirm
the existing element already carries `class="products-grid"`; if the tag is not a `div`,
use the real tag rather than forcing one.

- [ ] **Step 4: CategoryProvidersView — `src/views/CategoryProvidersView.vue`**

| Grid container | Card |
|---|---|
| `.prov-grid` | `.prov-card` |
| `.category-products-grid` | `.category-product-card` |

- [ ] **Step 5: Build and type-check the batch**

Run: `npm run build`
Expected: exit 0. A `v-reveal` on an element that Vue cannot resolve fails at compile
time, so this catches typos in directive registration.

- [ ] **Step 6: Commit**

```bash
git add src/views/HomeView.vue src/views/AboutView.vue src/views/CatalogView.vue src/views/CategoryProvidersView.vue
git commit -m "feat(motion): apply reveals and hover lift to public views part A"
```

---

## Task 6: Apply motion to the 10 public views (part B)

**Files:**
- Modify: `src/views/ProvidersView.vue`, `src/views/OemView.vue`, `src/views/CertificationsView.vue`, `src/views/LandingPageView.vue`, `src/views/MostSellingProductsView.vue`, `src/views/ProductDetailView.vue`

Same pattern as Task 5: `v-reveal="i"` plus `anim-card-hover` on cards only, never on
grid containers.

- [ ] **Step 1: ProvidersView — `src/views/ProvidersView.vue`**

`.providers-grid` → `.provider-card`

- [ ] **Step 2: OemView — `src/views/OemView.vue`**

`.services-grid` → `.service-card`; `.inquiry-grid` → `.perk-card`. The `.hud-card` is a
single hero panel, not a repeated grid item, so give it `anim-card-hover` only.

- [ ] **Step 3: CertificationsView — `src/views/CertificationsView.vue`**

`.cert-grid` → `.cert-card`

- [ ] **Step 4: LandingPageView — `src/views/LandingPageView.vue`**

`.product-grid` → `.product-card`; `.related-grid` → `.related-card`

- [ ] **Step 5: MostSellingProductsView — `src/views/MostSellingProductsView.vue`**

`.product-grid` → `.product-card`

- [ ] **Step 6: ProductDetailView — `src/views/ProductDetailView.vue`**

`.related-grid` → `.rel-card`; `.offered-grid` → `.offer-card`; `.video-grid` →
`.video-card`

Do not animate `.pdp-main-grid` or `.spec-row`. The PDP is a single-product page where
the buy box and spec table must be readable immediately; revealing them delays the
primary content for no benefit.

- [ ] **Step 7: Build and type-check**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including the 9 motion tests and the 4 pre-existing suites.

- [ ] **Step 9: Commit**

```bash
git add src/views/ProvidersView.vue src/views/OemView.vue src/views/CertificationsView.vue src/views/LandingPageView.vue src/views/MostSellingProductsView.vue src/views/ProductDetailView.vue
git commit -m "feat(motion): apply reveals and hover lift to public views part B"
```

---

## Task 7: Verify in the browser

Automated tests cannot see any of this. Every check below is manual or tool-driven
against a running dev server.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server on `http://localhost:56304`.

- [ ] **Step 2: Verify reveals fire on scroll, in English**

Load `/`, scroll slowly. Cards should fade and rise 8px as they enter the viewport, in
staggered order, settling within ~500ms. Then visit `/catalog` and `/providers`.

- [ ] **Step 3: Verify in Arabic (RTL)**

Switch the language toggle to Arabic and repeat Step 2 on `/` and `/catalog`. Elements
must rise identically — `translateY` is direction-neutral, so any horizontal drift or
mirrored offset is a defect. Spec §8 requires this per batch, not once at the end.

- [ ] **Step 4: Verify reduced motion leaves nothing hidden**

Emulate `prefers-reduced-motion: reduce`, then load `/` and `/catalog`. Every card must
be visible immediately with no fade and no scroll dependency. This is the check that
catches the §5 failure mode; do not skip it.

- [ ] **Step 5: Verify hover does not stick on touch**

Emulate a touch device, tap a catalog card, then tap empty space. The card must not stay
lifted.

- [ ] **Step 6: Verify no layout shift**

Watch for content jumping after paint as reveals resolve. Each reveal must reserve its
final space.

- [ ] **Step 7: Verify catalog filtering animates**

On `/catalog`, apply a category filter. Rows should transition rather than snap, via the
`<TransitionGroup>` from Task 5 Step 3.

- [ ] **Step 8: Commit any fixes found**

```bash
git add -A
git commit -m "fix(motion): correct reveal issues found in browser verification"
```

---

## Task 8: Remaining batches handoff

Batches 2-6 are **not** in this plan. Each becomes its own plan using the Task 5/6
pattern, with its own `npm run build` gate and its own §7 verification pass including
the Arabic and reduced-motion checks.

| Batch | Views | Notes |
|---|---|---|
| 2 — Auth (6) | Login, Register, ForgotPassword, ResetPassword, VerifyEmail, VerifyPasswordOtp | Forms; reveal the card, not individual fields. Revealing fields staggers the form and delays first input. |
| 3 — Marketplace (7) | Cart, Checkout, Wishlist, OrderHistory, OrderDetail, OrderTracking, OrderConfirmation | Cart and Wishlist get `<TransitionGroup>` for add/remove. Do not reveal Checkout's summary panel. |
| 4 — Provider (6) | ProviderCatalog, ProviderCategories, ProviderOrders, ProviderQuotes, ProviderStorefront, ProviderSupport | ProviderCatalog and ProviderCategories get `<TransitionGroup>` on their grids. Per spec §6.2, reveal the page container and section headers, **not** individual table rows. |
| 5 — Admin (15) | All 15 `*AdminView.vue` | Heaviest data density. Reveal page containers and stat cards only. |
| 6 — Account (11) | Profile, Addresses, Locations, AccountDashboard, HelpCenter, MyTickets, CategoriesView, QuoteDetail, QuoteList, RfqDetail, RfqList | Addresses and QuoteList get reflow on add/remove. |

**Completion criterion for the project** (spec §10): every one of the 55 views has motion
applied or a documented exclusion from §6.2, and a reduced-motion pass across the whole
site leaves zero invisible elements.

Before starting batch 2, confirm batch 1 survived a real deploy — the `type-check` step in
`npm run build` is the same gate that was failing the Vercel build, so a green local
build is necessary but not sufficient evidence that CI will pass.
