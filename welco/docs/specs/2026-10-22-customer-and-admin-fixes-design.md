# Welco Customer & Admin System Enhancements Design Spec

**Date:** 2026-10-22  
**Status:** Approved  
**Scope:** Full-Stack (Frontend: Vue 3 / TypeScript, Backend: .NET 10 Microservices + Gateway)

---

## 1. Executive Summary & Architecture

This document defines the technical design and architectural specifications for eight core fixes across Customer Experience, Marketplace Product Detail, Account Multi-Tenancy, and Admin Management:

1. **Place Order & Order Tracking (Consignment Ref):**
   - Strip leading `#` and whitespace during order tracking lookup.
   - Allow public/unauthenticated access to `/api/v1/orders/track/{orderNumber}` in both Ocelot Gateway and `OrdersController` so users can track by consignment reference without auth hurdles.
   - Standardize consignment reference display across order confirmation and tracking views.

2. **Direct Quote & Currency Flexibility:**
   - Allow customers to freely choose their requested currency from available currencies (USD, EUR, SAR, AED, EGP, GBP, etc.) across the Product Detail page, Cart, and Checkout.
   - Perform real-time currency conversion display via exchange rates.
   - Transmit and persist the chosen `RequestedCurrency` in RFQs and Quotes.

3. **Customer Accounts Data Isolation (Multi-Tenancy):**
   - In `Commerce.Services.API` (`GetOrdersQueryHandler`): Enforce `o.UserId == currentUserId` for `UserType.Client`.
   - In `Sales.Services.API` (`GetRFQsQueryHandler`, `GetQuotesQueryHandler`): Restrict queries for `UserType.Client` to records where `x.UserId == currentUserId` or matching client company.
   - In `Sales.Services.API` (`GetProductInquiriesQueryHandler`): Restrict queries for `UserType.Client` to client-owned inquiries (`UserId == currentUserId || Email == userEmail`).
   - In Frontend `AccountDashboardView.vue`, `OrderDetailView.vue`, `OrderHistoryView.vue`, `QuoteListView.vue`, `RfqListView.vue`, and `InquiryListView.vue`: Ensure data displayed reflects only the logged-in customer's records.

4. **Marketplace Product Detail Specifications:**
   - Display a clean bulleted list directly underneath the product title group containing:
     - General Specification bullets
     - Wire Capacity (optional)
     - Wire cutting capacity (optional)

5. **Marketplace Inspect Instrument (Interactive Zoom):**
   - Upgrade the inspection modal in `ProductDetailView.vue` with interactive zoom-in (`+`), zoom-out (`-`), reset zoom (`100%`), wheel zoom, and drag/pan navigation.

6. **Admin Side - Most Selling Product Control:**
   - Add `IsMostSelling` (boolean) to `Product` entity, DTOs, and commands.
   - Update `GetMostSellingProductsQueryHandler` to select products with actual sales or marked with `IsMostSelling == true`, eliminating automatic backfilling by `CreatedAt DESC`.
   - Add a switch/checkbox in `ProductsAdminView.vue` allowing admins to designate products as Most Selling.

7. **New Product - Specifications Form:**
   - Add input fields in `ProductsAdminView.vue` for:
     - General Specification (bullet items)
     - Wire Capacity (Optional)
     - Wire cutting capacity (Optional)
   - Store these in `Product.Specifications` as structured JSON, maintaining backward compatibility without breaking migrations.

8. **Categories Cascading Deletion:**
   - In `DeleteCategoryCommandHandler.cs`: Soft-delete all products belonging to the category (`p.CategoryId == category.Id && !p.IsDeleted`) when the category is deleted.

---

## 2. Component & API Specifications

### 2.1 Backend Changes
- **Gateway (`Welco.API/Ocelot/ocelot.commerce.*.json`):** Add unauthenticated route for `/api/v1/orders/track/{orderNumber}`.
- **Commerce API (`Commerce.Services.API`):**
  - `OrdersController.cs`: Remove `[RoleAuthorize]` from `Track` action.
  - `TrackOrderQueryHandler.cs`: Sanitize `OrderNumber` by removing `#` and trimming.
  - `GetOrdersQueryHandler.cs`: If caller is `UserType.Client`, filter `query.Where(o => o.UserId == _currentUser.UserId)`.
- **Sales API (`Sales.Services.API`):**
  - `GetRFQsQueryHandler.cs`: If caller is `UserType.Client`, filter `x.UserId == _cur.UserId || (caller.CompanyId.HasValue && x.CompanyId == caller.CompanyId)`.
  - `GetQuotesQueryHandler.cs`: If caller is `UserType.Client`, filter `x.RFQ != null && (x.RFQ.UserId == _cur.UserId || (caller.CompanyId.HasValue && x.RFQ.CompanyId == caller.CompanyId))`.
- **Product API (`Product.Services.API` & `Welco.Shared`):**
  - `Product.cs`, `ProductDto.cs`: Add `public bool IsMostSelling { get; set; } = false;`.
  - `GetMostSellingProductsQueryHandler.cs`: Prioritize products with actual sales or `p.IsMostSelling`, do not sort un-flagged new products into most selling.
  - `DeleteCategoryCommandHandler.cs`: Cascade mark-as-deleted to all active products in the category.

### 2.2 Frontend Changes
- **Order Tracking & Confirmation (`OrderTrackingView.vue`, `OrderConfirmationView.vue`):** Clean input `#`, clarify consignment reference copy/search.
- **Direct Quote & Currency (`ProductDetailView.vue`, `CartView.vue`, `CheckoutView.vue`):** Currency dropdown selector allowing customer selection across all currencies.
- **Product Detail (`ProductDetailView.vue`):**
  - Bulleted specifications underneath title group.
  - Interactive image inspection modal with zoom in/out, pan, and reset.
- **Admin Products (`ProductsAdminView.vue`):**
  - Fields for `Specification`, `Wire Capacity`, and `Wire cutting capacity`.
  - Checkbox / Toggle for `Is Most Selling Product`.
- **Account Pages:** Confirm isolation and scoped query execution for logged-in user.
