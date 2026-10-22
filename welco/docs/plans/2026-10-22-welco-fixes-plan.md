# Welco Customer & Admin System Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full-stack fixes across Welco customer side (consignment tracking, direct quote currency, account data isolation, product specifications list, inspect instrument zoom) and admin side (most selling product toggle, bulleted specs, and category cascade deletion).

**Architecture:** .NET 10 modular backend services (`Commerce.Services.API`, `Sales.Services.API`, `Product.Services.API`, `Welco.API`, `Welco.Shared`) coupled with Vue 3 TypeScript Tailwind frontend. Changes ensure strict multi-tenant customer isolation, backward compatibility via structured JSON specifications, and rich user experience.

**Tech Stack:** C# .NET 10, Entity Framework Core, MediatR, Ocelot API Gateway, Vue 3, TypeScript, TailwindCSS, Vitest.

---

### Task 1: Backend Commerce - Public Order Tracking & Consignment Sanitization

**Files:**
- Modify: `E:\Welco Site\Welco\Commerce.Services.API\Controllers\OrdersController.cs`
- Modify: `E:\Welco Site\Welco\Commerce.Services.API\Features\Orders\Queries\TrackOrder\TrackOrderQueryHandler.cs`
- Modify: `E:\Welco Site\Welco\Welco.API\Ocelot\ocelot.commerce.Development.json`
- Modify: `E:\Welco Site\Welco\Welco.API\Ocelot\ocelot.commerce.Production.json`
- Modify: `E:\Welco Site\Welco\Welco.API\Ocelot\ocelot.commerce.Test.json`

- [ ] **Step 1: Update TrackOrderQueryHandler to sanitize `#` and whitespace**
In `TrackOrderQueryHandler.cs`, sanitize `request.OrderNumber` by removing any leading `#` and trimming whitespace so searches matching `#ORD-...` or `ORD-...` resolve successfully.

- [ ] **Step 2: Allow anonymous access to Track in OrdersController.cs**
Remove `[RoleAuthorize]` from `public async Task<IActionResult> Track(...)` in `OrdersController.cs` (or add `[AllowAnonymous]`) so customers and guests can track orders using their consignment reference without requiring a login session.

- [ ] **Step 3: Update Ocelot Gateway routes for track endpoint**
In `ocelot.commerce.*.json`, add a dedicated upstream/downstream route for `/api/v1/orders/track/{orderNumber}` WITHOUT `AuthenticationOptions`, placed before `/api/v1/orders/{everything}`, so that tracking requests are routed without requiring Bearer authentication.

- [ ] **Step 4: Verify build of Commerce.Services.API and Welco.API**
Run `dotnet build` on Commerce and Welco.API to ensure compile success.

---

### Task 2: Backend Commerce & Sales - Account Data Isolation (Client Scoping)

**Files:**
- Modify: `E:\Welco Site\Welco\Commerce.Services.API\Features\Orders\Queries\GetOrders\GetOrdersQueryHandler.cs`
- Modify: `E:\Welco Site\Welco\Sales.Services.API\Features\RFQs\Queries\GetRFQs\GetRFQsQueryHandler.cs`
- Modify: `E:\Welco Site\Welco\Sales.Services.API\Features\Quotes\Queries\GetQuotes\GetQuotesQueryHandler.cs`
- Modify: `E:\Welco Site\Welco\Sales.Services.API\Features\Shared\BuyerScope.cs`

- [ ] **Step 1: Enforce Client isolation in GetOrdersQueryHandler.cs**
Update `GetOrdersQueryHandler.cs`: If `user.UserType == UserType.Client`, filter `query = query.Where(o => o.UserId == user.Id)`.

- [ ] **Step 2: Enhance BuyerScope.cs to recognize Client users**
Update `BuyerScope.cs` to return `IsClient` or caller user type details so handlers can differentiate `Client` from `Admin` / `WelcoStaff`.

- [ ] **Step 3: Enforce Client isolation in GetRFQsQueryHandler.cs**
Update `GetRFQsQueryHandler.cs`: If caller is a `Client`, restrict queries so they only see their own RFQs (`x.UserId == _cur.UserId || (caller.CompanyId.HasValue && x.CompanyId == caller.CompanyId)`).

- [ ] **Step 4: Enforce Client isolation in GetQuotesQueryHandler.cs**
Update `GetQuotesQueryHandler.cs`: If caller is a `Client`, restrict queries to quotes linked to their RFQs or company.

- [ ] **Step 5: Verify build of Commerce.Services.API and Sales.Services.API**
Run `dotnet build` on both projects.

---

### Task 3: Backend Product - Category Cascade Soft-Delete & Most Selling Flag

**Files:**
- Modify: `E:\Welco Site\Welco\Welco.Shared\Domain\Models\Product.cs`
- Modify: `E:\Welco Site\Welco\Welco.Shared\Common\DTOs\Products\ProductDto.cs`
- Modify: `E:\Welco Site\Welco\Product.Services.API\Common\ProductDtoMapper.cs`
- Modify: `E:\Welco Site\Welco\Product.Services.API\Features\Products\Commands\CreateProduct\CreateProductCommand.cs`
- Modify: `E:\Welco Site\Welco\Product.Services.API\Features\Products\Commands\CreateProduct\CreateProductCommandHandler.cs`
- Modify: `E:\Welco Site\Welco\Product.Services.API\Features\Products\Commands\UpdateProduct\UpdateProductCommand.cs`
- Modify: `E:\Welco Site\Welco\Product.Services.API\Features\Products\Commands\UpdateProduct\UpdateProductCommandHandler.cs`
- Modify: `E:\Welco Site\Welco\Product.Services.API\Features\Products\Queries\GetMostSellingProducts\GetMostSellingProductsQueryHandler.cs`
- Modify: `E:\Welco Site\Welco\Product.Services.API\Features\Categories\Commands\DeleteCategory\DeleteCategoryCommandHandler.cs`

- [ ] **Step 1: Add IsMostSelling to Product model and DTOs**
Add `public bool IsMostSelling { get; set; } = false;` to `Product.cs`, `ProductDto.cs`, `CreateProductCommand.cs`, `UpdateProductCommand.cs`, and `ProductDtoMapper.cs`.

- [ ] **Step 2: Update CreateProductCommandHandler and UpdateProductCommandHandler**
Set `product.IsMostSelling = request.IsMostSelling;` during product creation and updating.

- [ ] **Step 3: Update GetMostSellingProductsQueryHandler.cs**
Modify `GetMostSellingProductsQueryHandler.cs` so products marked `p.IsMostSelling == true` (along with top sold products) are selected. Eliminate automatic ordering by `p.CreatedAt DESC` which forced all new products into most selling.

- [ ] **Step 4: Cascade soft-delete products in DeleteCategoryCommandHandler.cs**
Update `DeleteCategoryCommandHandler.cs`: Fetch all active products in the category (`p.CategoryId == category.Id && !p.IsDeleted`) and call `p.MarkAsDeleted(currentUserId)` before `SaveChangesAsync`.

- [ ] **Step 5: Verify build of Product.Services.API and Welco.Shared**
Run `dotnet build` to ensure clean compilation.

---

### Task 4: Frontend Commerce - Order Tracking & Consignment Ref Normalization

**Files:**
- Modify: `src/views/marketplace/OrderTrackingView.vue`
- Modify: `src/views/marketplace/OrderConfirmationView.vue`

- [ ] **Step 1: Sanitize tracking search query in OrderTrackingView.vue**
Strip leading `#` and extra spaces when submitting `trackOrder(query.value.trim().replace(/^#/, ''))`.

- [ ] **Step 2: Add one-click copy and tracking link in OrderConfirmationView.vue**
Ensure the Consignment Ref `#{{ order.orderNumber }}` can be easily copied or tracked directly via a link to `/track-order?ref=...`.

- [ ] **Step 3: Support query param prefill in OrderTrackingView.vue**
If route query has `?ref=...`, automatically populate `query` and trigger `track()`.

---

### Task 5: Frontend Marketplace - Inspect Instrument Interactive Zoom

**Files:**
- Modify: `src/views/marketplace/ProductDetailView.vue`

- [ ] **Step 1: Add zoom state and controls to Inspect Instrument modal**
In `ProductDetailView.vue`, add state for `zoomLevel` (1.0 to 3.5), `panX`, `panY`, and `isDragging`.

- [ ] **Step 2: Implement Zoom In, Zoom Out, Reset, and Pan handlers**
Add floating toolbar with Zoom In (`+`), Zoom Out (`-`), and Reset (`100%`) buttons, mouse wheel zoom, and drag-to-pan when zoomed in.

- [ ] **Step 3: Style the interactive inspection viewport**
Add modern cursor styles (`grab`/`grabbing`/`zoom-in`), smooth transitions, and reset on modal close.

---

### Task 6: Frontend Marketplace - Product Specifications Bulleted List

**Files:**
- Modify: `src/views/marketplace/ProductDetailView.vue`
- Modify: `src/domain/models/marketplace.ts`

- [ ] **Step 1: Extend ProductDto interface in frontend**
Add optional fields for `isMostSelling?: boolean; wireCapacity?: string; wireCuttingCapacity?: string; specificationsList?: string[];` to `ProductDto`.

- [ ] **Step 2: Parse specifications list and capacities in ProductDetailView.vue**
Implement a computed property that parses `product.specifications` (whether JSON object or bullet lines) into:
- General Specifications (bullet list)
- Wire Capacity
- Wire cutting capacity

- [ ] **Step 3: Render bulleted specifications list directly below product title group**
Insert a structured specifications bullet card under `pdp-title-group` with distinct icons for specifications, wire capacity, and wire cutting capacity.

---

### Task 7: Frontend Admin - New Product Specifications & Most Selling Control

**Files:**
- Modify: `src/views/admin/ProductsAdminView.vue`
- Modify: `src/domain/models/marketplace.ts`

- [ ] **Step 1: Add specifications & Most Selling fields to emptyForm()**
In `ProductsAdminView.vue`, add:
- `isMostSelling: false`
- `specificationText: ''`
- `wireCapacity: ''`
- `wireCuttingCapacity: ''`

- [ ] **Step 2: Add form UI inputs in product create/edit modal**
Add:
- Toggle / Checkbox for "Most Selling Product (الأكثر مبيعاً)"
- Textarea for "Specification / Bullet Points (مواصفات نقطية)"
- Input for "Wire Capacity (سعة السلك - اختياري)"
- Input for "Wire Cutting Capacity (سعة قطع السلك - اختياري)"

- [ ] **Step 3: Serialize and deserialize specifications payload in submit() & openEdit()**
On submit, serialize `specificationText`, `wireCapacity`, and `wireCuttingCapacity` into `specifications` JSON and send `isMostSelling`. In `openEdit()`, unpack them into form fields.

---

### Task 8: Frontend Commerce - Direct Quote Currency Flexibility

**Files:**
- Modify: `src/views/marketplace/ProductDetailView.vue`
- Modify: `src/views/marketplace/CheckoutView.vue`
- Modify: `src/views/marketplace/CartView.vue`

- [ ] **Step 1: Add Currency Selector on Product Detail Page (PDP)**
Add currency dropdown on PDP allowing customers to switch product price display to any supported currency with real-time conversion.

- [ ] **Step 2: Unify currency selector in CheckoutView.vue**
Allow customers to select from all available marketplace currencies, not just saved address currencies, so Direct Quote and Place Order can use the customer's selected currency.

- [ ] **Step 3: Ensure RFQ and Quote payloads carry the chosen target currency**
Verify `createRfq` and `placeOrder` pass the user's selected `currencyCode` and `currencyId`.

---

### Task 9: Frontend Accounts - Customer Data Isolation Verification

**Files:**
- Review/Verify: `src/views/account/AccountDashboardView.vue`
- Review/Verify: `src/views/account/OrderHistoryView.vue`
- Review/Verify: `src/views/account/QuoteListView.vue`
- Review/Verify: `src/views/account/RfqListView.vue`
- Review/Verify: `src/views/account/InquiryListView.vue`

- [ ] **Step 1: Ensure account views filter client-side if needed as extra guard**
Verify that all account views properly bind to the authenticated user and display only their specific items.

---

### Task 10: Verification & Build Validation

- [ ] **Step 1: Run frontend type-check & lint**
Run `npm run type-check` and `npm run test` in frontend.

- [ ] **Step 2: Run backend dotnet build**
Run `dotnet build` across all modified .NET microservices.
