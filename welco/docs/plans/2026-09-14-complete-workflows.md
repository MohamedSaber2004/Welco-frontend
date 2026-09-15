# Complete Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Vue frontend to the real Welco/SNUL gateway contracts so every backend workflow works end-to-end with no mocks and no build breaks.

**Architecture:** Gateway-first HTTP via native fetch envelope client; normalize WelcoStaff/SnulStaff roles and Result/PaginatedResult envelopes once; add silent refresh + server cart sync; align mismatched routes to backend truth.

**Tech Stack:** Vue 3.5, Vue Router 4, Vite 8, TypeScript ~6, Tailwind 3.4, native fetch HttpClient, Ocelot gateways (Welco 7166/5293, SNUL 7266/5393), Vitest for contract tests.

---

## 0. Backend truth (read before coding)

- Gateway only: dev Welco `http://localhost:5293`, prod `https://welco-gateway.runasp.net`; SNUL dev `http://localhost:5393`, prod `https://snul-gateway.runasp.net`. Never call services directly.
- Envelope: `{isSuccess,statusCode,message,errors[],data}` and paged `{pageNumber,pageSize,totalPages,totalCount,data}`. Read `data`, not root. Send `Accept-Language: en|ar`.
- Auth: `POST /api/v1/auth/*` anon; `GET/PUT /api/v1/auth/profile` bearer; access 60m, refresh 30d via `POST /api/v1/auth/refresh-token {refreshToken}`.
- Roles: `Admin=1, OrganizationUser=2, WelcoStaff|SnulStaff=3, Client=4`. Admin bypasses all. Bare auth = any logged-in user.
- UserMgmt prefix is `/api/v1/user-management/*` (users, companies, addresses, countries/cities/zones, distributor-applications, audit-logs).
- Product anon reads; wishlist bearer; carts/orders bearer (guest cart via `sessionId`); RFQ/quote flow Client->Staff->approve->order `quoteId`; product-inquiry + oem-inquiry `POST` anon; support tickets scoped; certifications `GET` anon; attachments `multipart {file,place,fileType}` -> name string -> render `/files/{name}`.
- Integration `/api/integration/*` is server-to-server only. Frontend must not use it.

## 1. Frontend reality (verified)

- `src/config/api.config.ts` route tables; `src/infrastructure/http/http-client.ts` fetch client; `src/di/container.ts` 14 repos + 13 services; `src/router/index.ts` 46 lazy views; no Pinia/Vuex, no axios, no vue-i18n, no tests.
- WIRED: auth OTP chain, profile, users, locations, catalog, wishlist, checkout place-order + RFQ convert, orders/RFQ/quotes/inquiries, distributor/OEM, certs/docs, landing/help/tickets, attachments (partial), audit read, exchange convert.
- MOCKED: cart is `localStorage welco-cart` only; `COMMERCE_ROUTES.carts*` defined with 0 calls.
- MISSING/BROKEN: build fails on `account.tierLevel` + `Company.tierLevel`; `refresh-token` never called (force logout); calls to `/api/v1/oem-services` + `/api/v1/trade-shows` have no backend match (backend is `/api/v1/oem-inquiries`, no trade-shows); product/content/cert reads bypass gateway via `vite.config.ts` + `PRODUCT_API_BASE_URL`; attachments not on tickets/RFQ inputs.

## 2. File structure map

- Fix build: `src/domain/company.ts`, `src/views/AccountDashboardView.vue`, `src/i18n/en.ts`, `src/i18n/ar.ts`, `src/i18n/messages.ts`.
- Test harness: `package.json`, `vite.config.ts`, `src/infrastructure/http/__tests__/envelope.test.ts`, `src/di/__tests__/container.test.ts`.
- HTTP core: `src/infrastructure/http/http-client.ts`, `src/infrastructure/http/token-store.ts`, `src/domain/business-role.ts`, `src/config/api.config.ts`.
- Auth refresh: `src/data/api-auth.repository.ts`, `src/application/auth.service.ts`, `src/infrastructure/http/http-client.ts`.
- Server cart: `src/data/api-commerce.repository.ts`, `src/application/commerce.service.ts`, `src/composables/useCart.ts`, `src/views/CartView.vue`, `src/views/CheckoutView.vue`.
- Route truth: `src/config/api.config.ts`, `src/data/api-content.repository.ts`, `src/data/api-company.repository.ts`, `src/application/content.service.ts`, `src/application/company.service.ts`, `src/views/OemView.vue`, `src/views/HomeView.vue`.
- Attachments: `src/application/attachment.service.ts`, `src/components/FileUpload.vue`, `src/utils/file-url.ts`, ticket/RFQ views.
- Multi-backend: `.env.development`, `.env.test`, `.env.production`, `vite.config.ts`, `vercel.json`, `src/config/api.config.ts`, `src/domain/business-role.ts`.

## 3. Task list (each is independently testable)

- Task 1: Fix build-blocking tierLevel types.
- Task 2: Add Vitest harness + envelope contract test.
- Task 3: Gateway-first HTTP + staff-role normalization.
- Task 4: Silent refresh-token rotation.
- Task 5: Server-synced cart (guest sessionId + auth merge).
- Task 6: Align oem-services/trade-shows/support routes to backend truth.
- Task 7: Attachment coverage for tickets + RFQ.
- Task 8: Welco+SNUL backend target switch.
- Task 9: Full workflow verification matrix + docs.

---

### Task 1: Fix build-blocking tierLevel types

**Files:**
- Modify: `src/domain/company.ts`
- Modify: `src/views/AccountDashboardView.vue`
- Modify: `src/i18n/messages.ts`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/ar.ts`

- [ ] **Step 1: Reproduce the build failure**

Run: `npm run type-check`
Expected: FAIL with `t('account.tierLevel',{tier})` type error + `Company.tierLevel` missing.

- [ ] **Step 2: Add optional tierLevel to Company domain**

In `src/domain/company.ts` add one optional field to the existing interface (keep every other field unchanged):

```ts
export interface Company {
  tierLevel?: string | null;
}
```

- [ ] **Step 3: Fix the dashboard call to pass a real tier value**

In `src/views/AccountDashboardView.vue` replace the bare key call:

```ts
t('account.tierLevel', { tier: myCompany.value?.tierLevel ?? t('account.standardTier') })
```

- [ ] **Step 4: Add the two i18n keys to types + both locales**

In `src/i18n/messages.ts` under `account:` add `tierLevel: string; standardTier: string;`. In `src/i18n/en.ts` add `tierLevel: 'Tier level: {tier}', standardTier: 'Standard',`. In `src/i18n/ar.ts` add `tierLevel: 'مستوى الفئة: {tier}', standardTier: 'قياسي',`.

- [ ] **Step 5: Verify + commit**

Run: `npm run type-check`
Expected: PASS with no errors.

```bash
git add src/domain/company.ts src/views/AccountDashboardView.vue src/i18n/messages.ts src/i18n/en.ts src/i18n/ar.ts
git commit -m "fix: add Company.tierLevel and account i18n keys to unblock build"
```

---

### Task 2: Add Vitest harness + envelope contract test

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/infrastructure/http/__tests__/envelope.test.ts`

- [ ] **Step 1: Write the failing envelope test**

Create `src/infrastructure/http/__tests__/envelope.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeEnvelope } from '../http-client';
describe('normalizeEnvelope', () => {
  it('unwraps Welco Result envelope', () => {
    const out = normalizeEnvelope({ isSuccess: true, statusCode: 200, message: 'ok', errors: [], data: { id: 1 } });
    expect(out).toEqual({ id: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails (no export yet)**

Run: `npm run test -- src/infrastructure/http/__tests__/envelope.test.ts`
Expected: FAIL with "normalizeEnvelope is not exported".

- [ ] **Step 3: Export pure normalizer from http-client**

In `src/infrastructure/http/http-client.ts` add at top-level (no behavior change to class):

```ts
export function normalizeEnvelope<T>(raw: any): T {
  if (raw && typeof raw === 'object' && 'data' in raw && 'isSuccess' in raw) return raw.data as T;
  return raw as T;
}
```

- [ ] **Step 4: Install vitest + verify pass**

Run: `npm i -D vitest`
Run: `npm run test -- src/infrastructure/http/__tests__/envelope.test.ts`
Expected: PASS 1 test. Add script `"test": "vitest run"` to `package.json`.

- [ ] **Step 5: Commit**

```bash
git add package.json vite.config.ts src/infrastructure/http/http-client.ts src/infrastructure/http/__tests__/envelope.test.ts
git commit -m "test: add vitest harness and envelope normalizer contract"
```

---

### Task 3: Gateway-first HTTP + staff-role normalization

**Files:**
- Modify: `src/domain/business-role.ts`
- Modify: `src/config/api.config.ts`
- Modify: `vite.config.ts`
- Test: `src/di/__tests__/container.test.ts`

- [ ] **Step 1: Write failing role test**

Create `src/di/__tests__/container.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isStaffRole } from '../../domain/business-role';
describe('isStaffRole', () => {
  it('treats WelcoStaff and SnulStaff identically', () => {
    expect(isStaffRole('WelcoStaff')).toBe(true);
    expect(isStaffRole('SnulStaff')).toBe(true);
    expect(isStaffRole('Client')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm run test -- src/di/__tests__/container.test.ts`
Expected: FAIL "isStaffRole is not exported".

- [ ] **Step 3: Implement normalizer (minimal)**

In `src/domain/business-role.ts` add:

```ts
export function isStaffRole(role: string | null | undefined): boolean {
  return role === 'WelcoStaff' || role === 'SnulStaff';
}
```

Replace every `role === 'WelcoStaff'` check in `src/application/auth.service.ts` and `src/router/index.ts` with `isStaffRole(role)`. Keep `Admin` bypass logic untouched.

- [ ] **Step 4: Make gateway the single base (keep one fallback)**

In `src/config/api.config.ts` keep `API_BASE_URL` as primary for all calls. In `vite.config.ts` keep proxy `/api -> gateway` but delete direct `/api/v1/products,categories,currencies,exchange-rates -> welco-product` entries so reads go through gateway. Keep `PRODUCT_API_BASE_URL` fallback only inside `marketplace` + `exchange-rate` repos on gateway 404/502.

Run: `npm run test -- src/di/__tests__/container.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/business-role.ts src/config/api.config.ts vite.config.ts src/application/auth.service.ts src/router/index.ts src/di/__tests__/container.test.ts
git commit -m "feat: gateway-first http with WelcoStaff/SnulStaff normalization"
```

---

### Task 4: Silent refresh-token rotation

**Files:**
- Modify: `src/infrastructure/http/token-store.ts`
- Modify: `src/infrastructure/http/http-client.ts`
- Modify: `src/data/api-auth.repository.ts`
- Modify: `src/application/auth.service.ts`
- Test: `src/infrastructure/http/__tests__/refresh.test.ts`

- [ ] **Step 1: Write failing refresh test**

Create `src/infrastructure/http/__tests__/refresh.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { TokenStore } from '../token-store';
describe('TokenStore refresh', () => {
  it('reports expiring token within 5 min window', () => {
    const s = new TokenStore();
    const exp = Math.floor(Date.now() / 1000) + 120;
    expect(s.isExpiringSoon(exp, 300)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm run test -- src/infrastructure/http/__tests__/refresh.test.ts`
Expected: FAIL "isExpiringSoon does not exist".

- [ ] **Step 3: Add expiry helper + single-flight refresh**

In `src/infrastructure/http/token-store.ts` add:

```ts
isExpiringSoon(exp: number, windowSec = 300): boolean {
  return exp - Math.floor(Date.now() / 1000) < windowSec;
}
```

In `src/data/api-auth.repository.ts` ensure method exists:

```ts
refresh(refreshToken: string): Promise<AuthResponse> {
  return this.http.post<AuthResponse>('/api/v1/auth/refresh-token', { refreshToken });
}
```

- [ ] **Step 4: Hook 401 retry + proactive check in http-client**

In `src/infrastructure/http/http-client.ts` on 401 with stored `refreshToken`: call `authRepository.refresh`, persist new `accessToken/refreshToken`, retry original request once with single-flight promise. In `src/application/auth.service.ts` before `ensureValidSession` force-logout, try refresh if `isExpiringSoon(jwtExp)`.

Run: `npm run test -- src/infrastructure/http/__tests__/refresh.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/http/token-store.ts src/infrastructure/http/http-client.ts src/data/api-auth.repository.ts src/application/auth.service.ts src/infrastructure/http/__tests__/refresh.test.ts
git commit -m "feat: silent refresh-token rotation with single-flight 401 retry"
```

---

### Task 5: Server-synced cart (guest sessionId + auth merge)

**Files:**
- Modify: `src/data/api-commerce.repository.ts`
- Modify: `src/application/commerce.service.ts`
- Modify: `src/composables/useCart.ts`
- Modify: `src/views/CartView.vue`
- Modify: `src/views/CheckoutView.vue`
- Test: `src/application/__tests__/cart-sync.test.ts`

- [ ] **Step 1: Write failing cart-sync test**

Create `src/application/__tests__/cart-sync.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildCreateCartPayload } from '../commerce.service';
describe('buildCreateCartPayload', () => {
  it('uses sessionId for guests, userId for auth', () => {
    expect(buildCreateCartPayload(null, 'sess-1', 'cur-1')).toEqual({ sessionId: 'sess-1', currencyId: 'cur-1' });
    expect(buildCreateCartPayload('u-1', 'sess-1', 'cur-1')).toEqual({ userId: 'u-1', currencyId: 'cur-1' });
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm run test -- src/application/__tests__/cart-sync.test.ts`
Expected: FAIL "buildCreateCartPayload is not exported".

- [ ] **Step 3: Add cart endpoints to repository (skeleton first)**

In `src/data/api-commerce.repository.ts` add methods using existing `COMMERCE_ROUTES`:

```ts
createCart(body: { userId?: string; sessionId?: string; currencyId?: string }) {
  return this.http.post('/api/v1/carts', body);
}
addItem(cartId: string, body: { productId: string; quantity: number; unitPriceSnapshot: number }) {
  return this.http.post(`/api/v1/carts/${cartId}/items`, body);
}
getBySession(sessionId: string) {
  return this.http.get(`/api/v1/carts/session/${sessionId}`);
}
```

- [ ] **Step 4: Add payload helper + sync composable, keep local fallback**

In `src/application/commerce.service.ts` add:

```ts
export function buildCreateCartPayload(userId: string | null, sessionId: string, currencyId?: string) {
  return userId ? { userId, currencyId } : { sessionId, currencyId };
}
```

In `src/composables/useCart.ts`: on load, if logged in call `createCart`/`getBySession` then `addItem` per local line with `unitPriceSnapshot` from product detail; keep `localStorage welco-cart` as offline fallback and clear server cart via `POST /api/v1/carts/{id}/clear` after order. `CartView`/`CheckoutView` show server error via existing toast, never block checkout on cart-sync failure.

Run: `npm run test -- src/application/__tests__/cart-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/api-commerce.repository.ts src/application/commerce.service.ts src/composables/useCart.ts src/views/CartView.vue src/views/CheckoutView.vue src/application/__tests__/cart-sync.test.ts
git commit -m "feat: server-synced cart with guest session and local fallback"
```

---

### Task 6: Align oem-services / trade-shows / support routes to backend truth

**Files:**
- Modify: `src/config/api.config.ts`
- Modify: `src/data/api-company.repository.ts`
- Modify: `src/data/api-content.repository.ts`
- Modify: `src/views/OemView.vue`
- Modify: `src/views/HomeView.vue`

- [ ] **Step 1: Write failing route-truth test**

Create `src/config/__tests__/routes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { COMPANY_ROUTES } from '../api.config';
describe('route truth', () => {
  it('points OEM to oem-inquiries', () => {
    expect(COMPANY_ROUTES.oemInquiries).toBe('/api/v1/oem-inquiries');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm run test -- src/config/__tests__/routes.test.ts`
Expected: FAIL if key is `oemServices` or path is `/api/v1/oem-services`.

- [ ] **Step 3: Fix route tables to backend truth**

In `src/config/api.config.ts`: set `oemInquiries: '/api/v1/oem-inquiries'`, keep `oemServices` deleted. Confirm `productInquiries: '/api/v1/product-inquiries'`, `tickets: '/api/v1/support/tickets'`, `ticketsMy: '/api/v1/support/tickets/my'`. No `trade-shows` table — backend has no such endpoint.

- [ ] **Step 4: Point callers at truth + landing fallback**

In `src/data/api-company.repository.ts` change submit/list/delete to `/api/v1/oem-inquiries`. In `src/data/api-content.repository.ts` change `getTradeShows()` to `GET /api/v1/landing-pages?type=tradeshow` with empty-array fallback. Update `OemView` + `HomeView` imports accordingly.

Run: `npm run test -- src/config/__tests__/routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/api.config.ts src/data/api-company.repository.ts src/data/api-content.repository.ts src/views/OemView.vue src/views/HomeView.vue src/config/__tests__/routes.test.ts
git commit -m "fix: align OEM and trade-shows routes to backend contracts"
```

---

### Task 7: Attachment coverage for tickets + RFQ

**Files:**
- Modify: `src/application/attachment.service.ts`
- Modify: `src/components/FileUpload.vue`
- Modify: `src/views/MyTicketsView.vue`
- Modify: `src/views/RfqDetailView.vue`
- Modify: `src/utils/file-url.ts`

- [ ] **Step 1: Write failing place-mapping test**

Create `src/application/__tests__/attachment.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toUploadPlace } from '../attachment.service';
describe('toUploadPlace', () => {
  it('maps ticket context to place 1', () => {
    expect(toUploadPlace('ticket')).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm run test -- src/application/__tests__/attachment.test.ts`
Expected: FAIL "toUploadPlace is not exported".

- [ ] **Step 3: Add typed upload helper**

In `src/application/attachment.service.ts` add:

```ts
export function toUploadPlace(ctx: 'avatar' | 'product' | 'ticket' | 'rfq'): number {
  return ctx === 'avatar' ? 0 : ctx === 'product' ? 2 : 1;
}
export function toMediaType(kind: string): number {
  return kind.startsWith('image/') ? 0 : kind.startsWith('video/') ? 1 : kind.startsWith('audio/') ? 2 : 3;
}
```

Upload via `POST /api/v1/attachments/upload` as `FormData {file, place, fileType}`; render via existing `resolveFileUrl(name)` -> `GET /files/{name}`.

- [ ] **Step 4: Wire FileUpload into ticket + RFQ views**

In `MyTicketsView` + `RfqDetailView` embed existing `<FileUpload>` with `:place="toUploadPlace('ticket')"` and store returned name on the ticket/RFQ message payload. Keep avatar/product usages unchanged.

Run: `npm run test -- src/application/__tests__/attachment.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/attachment.service.ts src/components/FileUpload.vue src/views/MyTicketsView.vue src/views/RfqDetailView.vue src/utils/file-url.ts src/application/__tests__/attachment.test.ts
git commit -m "feat: attachment upload for tickets and RFQ with place mapping"
```

---

### Task 8: Welco + SNUL backend target switch

**Files:**
- Modify: `.env.development`
- Modify: `.env.test`
- Modify: `.env.production`
- Modify: `src/config/api.config.ts`
- Modify: `vite.config.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Write failing target test**

Create `src/config/__tests__/target.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveGateway } from '../api.config';
describe('resolveGateway', () => {
  it('defaults to Welco gateway', () => {
    expect(resolveGateway('')).toContain('welco-gateway');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm run test -- src/config/__tests__/target.test.ts`
Expected: FAIL "resolveGateway is not exported".

- [ ] **Step 3: Add gateway resolver (no behavior change by default)**

In `src/config/api.config.ts` add:

```ts
const WELCO_GW = 'https://welco-gateway.runasp.net';
const SNUL_GW = 'https://snul-gateway.runasp.net';
export function resolveGateway(target: string | undefined): string {
  if (target === 'snul') return SNUL_GW;
  return (import.meta.env.VITE_API_BASE_URL as string) || WELCO_GW;
}
```

Set `.env.development`: `VITE_API_BASE_URL=` + `VITE_BACKEND_TARGET=welco`; `.env.test`: `VITE_BACKEND_TARGET=snul` + `VITE_API_BASE_URL=https://snul-gateway.runasp.net`; `.env.production`: keep Welco default. Both gateways share `/api/v1/*` paths so no caller changes.

- [ ] **Step 4: Update proxy + deploy rewrites**

In `vite.config.ts` set proxy target from `VITE_PROXY_TARGET` (dev Welco `https://welco-gateway.runasp.net`, test SNUL). In `vercel.json` keep `/api/:path* -> gateway` rewrite parameterized by env, plus `/files/:path*`.

Run: `npm run test -- src/config/__tests__/target.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .env.development .env.test .env.production src/config/api.config.ts vite.config.ts vercel.json src/config/__tests__/target.test.ts
git commit -m "feat: switchable Welco SNUL gateway target"
```

---

### Task 9: Full workflow verification matrix + docs

**Files:**
- Modify: `docs/plans/2026-09-14-complete-workflows.md`
- Modify: `README.md`
- Test: manual matrix below (no new code)

- [ ] **Step 1: Run full type + unit gate**

Run: `npm run type-check`
Expected: PASS. Run: `npm run test`
Expected: PASS all 7 test files (envelope, container, refresh, cart-sync, routes, attachment, target).

- [ ] **Step 2: Run gateway smoke matrix (dev proxy)**

Run: `npm run dev` then verify each row returns 2xx or localized envelope (not 404/CORS):

```bash
curl -i http://localhost:56304/api/v1/products?pageNumber=1&pageSize=1
curl -i http://localhost:56304/api/v1/categories?pageNumber=1&pageSize=1
curl -i http://localhost:56304/api/v1/certifications?pageNumber=1&pageSize=1
curl -i -X POST http://localhost:56304/api/v1/product-inquiries -H "Content-Type: application/json" -d "{\"productId\":\"00000000-0000-0000-0000-000000000000\",\"name\":\"t\",\"organization\":\"o\",\"message\":\"m\"}"
```

- [ ] **Step 3: Click-through auth + commerce + B2B chain**

Login -> profile update -> wishlist toggle -> guest cart add -> login merge -> checkout place-order -> track `orderNumber` -> RFQ create -> staff quote -> approve -> order with `quoteId` -> distributor apply -> OEM inquiry -> ticket create/reply/close -> admin users/companies/orders/tickets/audit.

- [ ] **Step 4: Document out-of-scope cuts (YAGNI)**

Payment (Stripe/PayPal), invoice PDF, push/email notifications, analytics: no backend endpoints exist, explicitly not built. `refresh-token` now wired; persistent cart now server-synced; `/api/integration/*` remains server-only.

- [ ] **Step 5: Commit docs**

```bash
git add docs/plans/2026-09-14-complete-workflows.md README.md
git commit -m "docs: complete workflows verification matrix and scope cuts"
```

---

## Self-review

1. Spec coverage: Welco contract -> Tasks 3-7; SNUL parity (SnulStaff + gateway) -> Tasks 3,8; frontend gaps (build, cart mock, refresh, route mismatch, attachments, direct-bypass) -> Tasks 1,4-7; verification -> Task 9. No orphan requirement.
2. Placeholder scan: no TBD/TODO/later/fill-in; every code step shows exact file + compilable snippet; every test step has exact `npm` command + expected output; no "similar to Task N".
3. Type consistency: `Company.tierLevel?: string|null` used identically in Task 1 steps; `isStaffRole(string)->boolean` same in Task 3; `normalizeEnvelope<T>(raw:any)->T` same in Task 2; `buildCreateCartPayload(userId|null,sessionId,currencyId?)->{userId|sessionId,currencyId}` same in Task 5; `toUploadPlace(ctx)->number`, `toMediaType(kind)->number`, `resolveGateway(target)->string` signatures reused verbatim in later steps.









