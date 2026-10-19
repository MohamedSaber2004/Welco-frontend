# Welco Platform — Admin Side Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement comprehensive Admin-side enhancements across Welco surgical platform: (1) Vector PDF exports for single orders, all orders, and official invoices; (2) Company directory PDF export; (3) Optional product price/stock/Arabic name plus strictly enforced 3+ product images and video support; (4) Contact Us social channels (Email, Phone, Facebook, Instagram) management and public rendering.

**Architecture:** Full Clean Architecture alignment: TypeScript / Vue 3 Composition API frontend with `jspdf` & `jspdf-autotable` in `src/utils/pdf-export.ts`; .NET 10 MediatR CQRS microservices (`Product.Services.API`, `Content.Services.API`, `Welco.Shared`) preserving shared schemas and `ProductMedias`.

**Tech Stack:** Vue 3, Vite, TypeScript, Tailwind CSS, jsPDF, jsPDF-AutoTable, ASP.NET Core 10, C# 13, EF Core, MediatR, FluentValidation.

---

## File Structure & Responsibilities

- **`src/utils/pdf-export.ts`**: Dedicated clinical vector PDF generation engine for orders, orders summary reports, tax invoices, and company directories.
- **`src/utils/__tests__/pdf-export.test.ts`**: Unit test suite for PDF generation functions, data transformation, and formatting.
- **`src/views/admin/OrdersAdminView.vue`**: UI integration for exporting single order PDF, bulk orders list PDF, and invoice PDF.
- **`src/views/admin/CompaniesAdminView.vue`**: UI integration for exporting verified companies directory PDF.
- **`src/domain/models/marketplace.ts`**: Domain model updates for optional price, stock, Arabic name, multiple images, and video.
- **`src/views/admin/ProductsAdminView.vue`**: Form UI with relaxed optional fields, multi-image slot uploader (strictly requiring >= 3 images), and video input with preview.
- **`E:\welco site\Welco\Product.Services.API\Features\Products\Commands\CreateProduct\*`**: Backend command, validator, and handler for optional fields, multi-images, and video.
- **`E:\welco site\Welco\Product.Services.API\Features\Products\Commands\UpdateProduct\*`**: Backend command, validator, and handler for updating products with multi-images and video.
- **`E:\welco site\Welco\Welco.Shared\Common\DTOs\Products\ProductDto.cs`**: DTO extensions for product images list and video.
- **`E:\welco site\Welco\Content.Services.API\Features\SupportContact\*`**: Support for Facebook and Instagram channels in backend.
- **`src/domain/models/content.ts`**: Frontend DTO updates for `SupportContactDto` (Facebook, Instagram).
- **`src/views/admin/HelpAdminView.vue`**: Admin interface for updating contact email, phone, Facebook, and Instagram.
- **`src/components/layout/AppFooter.vue`**: Public website footer rendering email, phone, Facebook, and Instagram.

---

### Task 1: Clinical PDF Export Utility (`src/utils/pdf-export.ts`)

**Files:**
- Create: `src/utils/pdf-export.ts`
- Test: `src/utils/__tests__/pdf-export.test.ts`

- [x] **Step 1: Write the failing unit test for PDF export utilities**
  Create `src/utils/__tests__/pdf-export.test.ts` verifying that `exportOrderPdf`, `exportOrdersReportPdf`, `exportInvoicePdf`, and `exportCompaniesReportPdf` generate valid documents and don't throw on edge cases.
- [x] **Step 2: Run test to verify it fails**
  Run: `npm run test -- src/utils/__tests__/pdf-export.test.ts`
  Expected: FAIL with missing module `pdf-export`.
- [x] **Step 3: Implement `src/utils/pdf-export.ts`**
  Implement high-precision vector PDF generators using `jspdf` and `jspdf-autotable`, applying Welco brand colors (`#0F3D56`, `#147D92`), ISO 13485 & CE declarations, and clean tabular formatting.
- [x] **Step 4: Run test to verify it passes**
  Run: `npm run test -- src/utils/__tests__/pdf-export.test.ts`
  Expected: PASS.
- [x] **Step 5: Commit**
  Run: `git add src/utils/pdf-export.ts src/utils/__tests__/pdf-export.test.ts && git commit -m "feat: add clinical vector PDF export utilities for orders, invoices, and companies"`

---

### Task 2: Orders PDF Actions in Admin (`OrdersAdminView.vue`)

**Files:**
- Modify: `src/views/admin/OrdersAdminView.vue`

- [x] **Step 1: Add "Export Orders (PDF)" toolbar button**
  In `OrdersAdminView.vue` header actions, add a secondary button `exportOrdersReportPdf(filteredOrders, providerMap)`.
- [x] **Step 2: Add single order PDF and Invoice PDF actions**
  In the orders table rows and inside the Order Details modal, add:
  - "Download Order PDF" (`exportOrderPdf(selectedOrder)`)
  - "Download Invoice PDF" (`exportInvoicePdf(selectedOrder)`)
- [x] **Step 3: Verify TypeScript typing and build**
  Run: `npm run type-check`
  Expected: PASS with 0 errors.
- [x] **Step 4: Commit**
  Run: `git add src/views/admin/OrdersAdminView.vue && git commit -m "feat(admin): add order PDF, orders report PDF, and tax invoice PDF export"`

---

### Task 3: Companies PDF Action in Admin (`CompaniesAdminView.vue`)

**Files:**
- Modify: `src/views/admin/CompaniesAdminView.vue`

- [x] **Step 1: Add "Export Directory (PDF)" button**
  In `CompaniesAdminView.vue` toolbar, add a button to export all companies via `exportCompaniesReportPdf(filteredCompanies)`.
- [x] **Step 2: Verify TypeScript typing and test**
  Run: `npm run type-check`
  Expected: PASS with 0 errors.
- [x] **Step 3: Commit**
  Run: `git add src/views/admin/CompaniesAdminView.vue && git commit -m "feat(admin): add companies directory PDF export"`

---

### Task 4: Product Backend Updates (Optional Fields, Multi-Images, Video)

**Files:**
- Modify: `E:\welco site\Welco\Product.Services.API\Features\Products\Commands\CreateProduct\CreateProductCommand.cs`
- Modify: `E:\welco site\Welco\Product.Services.API\Features\Products\Commands\CreateProduct\CreateProductCommandValidator.cs`
- Modify: `E:\welco site\Welco\Product.Services.API\Features\Products\Commands\CreateProduct\CreateProductCommandHandler.cs`
- Modify: `E:\welco site\Welco\Product.Services.API\Features\Products\Commands\UpdateProduct\UpdateProductCommand.cs`
- Modify: `E:\welco site\Welco\Product.Services.API\Features\Products\Commands\UpdateProduct\UpdateProductCommandValidator.cs`
- Modify: `E:\welco site\Welco\Product.Services.API\Features\Products\Commands\UpdateProduct\UpdateProductCommandHandler.cs`
- Modify: `E:\welco site\Welco\Welco.Shared\Common\DTOs\Products\ProductDto.cs`
- Modify: `E:\welco site\Welco\Product.Services.API\Common\ProductDtoMapper.cs`

- [x] **Step 1: Update `CreateProductCommand` & `CreateProductCommandValidator`**
  Make `NameAr`, `Price`, and `Stock` optional. Add `List<string>? Images` and `string? VideoUrl`.
- [x] **Step 2: Update `CreateProductCommandHandler`**
  Safely fallback `NameAr = string.IsNullOrWhiteSpace(cmd.NameAr) ? cmd.NameEn : cmd.NameAr`. Default `Price` to `0` and `Stock` to `0`. Store primary image in `Product.ImageName` and add all images + video to `ProductMedias`.
- [x] **Step 3: Update `UpdateProductCommand` & Validator & Handler**
  Apply matching optional logic and sync `ProductMedias` on update.
- [x] **Step 4: Update `ProductDto` and mapping**
  Include `Images` and `VideoUrl` in DTO.
- [x] **Step 5: Verify backend build**
  Run: `dotnet build "E:\welco site\Welco\Product.Services.API"`
  Expected: Build succeeded with 0 errors.
- [x] **Step 6: Commit backend changes**
  Run: `git -C "E:\welco site\Welco" add -A && git -C "E:\welco site\Welco" commit -m "feat(product): make price, stock, and Arabic name optional; support multi-images and video"`

---

### Task 5: Product Frontend Updates (`ProductsAdminView.vue` & Models)

**Files:**
- Modify: `src/domain/models/marketplace.ts`
- Modify: `src/views/admin/ProductsAdminView.vue`
- Modify: `src/views/provider/ProviderCatalogView.vue`

- [x] **Step 1: Update frontend domain payloads in `marketplace.ts`**
  Make `price`, `stock`, `nameAr` optional in `CreateProductPayload` and `UpdateProductPayload`, and add `images?: string[]`, `videoUrl?: string`.
- [x] **Step 2: Update `ProductsAdminView.vue` validation and fields**
  - Remove mandatory requirements for Price, Stock, Arabic name.
  - Implement multi-image slots: Image 1 (Cover), Image 2, Image 3, with "+ Add Image" button.
  - Strictly enforce validation: require at least 3 uploaded images before form submit is allowed (`if (images.length < 3) { formError = 'Minimum 3 images required'; return; }`).
  - Add Product Video input field (attachment / URL) with live video preview.
- [x] **Step 3: Sync `ProviderCatalogView.vue`**
  Ensure provider catalog form also allows optional Price, Stock, NameAr.
- [x] **Step 4: Verify type-check & tests**
  Run: `npm run type-check && npm run test`
  Expected: PASS with 0 errors.
- [x] **Step 5: Commit**
  Run: `git add src/domain/models/marketplace.ts src/views/admin/ProductsAdminView.vue src/views/provider/ProviderCatalogView.vue && git commit -m "feat(admin): make price/stock/nameAr optional, enforce strict min 3 images and video"`

---

### Task 6: Contact Us Social Channels (Backend & Frontend)

**Files:**
- Backend:
  - Modify: `E:\welco site\Welco\Welco.Shared\Common\DTOs\Content\SupportContactDto.cs`
  - Modify: `E:\welco site\Welco\Content.Services.API\Features\SupportContact\Commands\UpdateSupportContact\UpdateSupportContactCommand.cs`
  - Modify: `E:\welco site\Welco\Content.Services.API\Features\SupportContact\Commands\UpdateSupportContact\UpdateSupportContactCommandHandler.cs`
- Frontend:
  - Modify: `src/domain/models/content.ts`
  - Modify: `src/data/repositories/api-content.repository.ts`
  - Modify: `src/views/admin/HelpAdminView.vue`
  - Modify: `src/components/layout/AppFooter.vue`
  - Modify: `src/views/support/HelpCenterView.vue`

- [x] **Step 1: Extend backend `SupportContactDto` and command**
  Add `FacebookUrl` and `InstagramUrl` to `SupportContactDto` and `UpdateSupportContactCommand`.
- [x] **Step 2: Verify backend build**
  Run: `dotnet build "E:\welco site\Welco\Content.Services.API"`
  Expected: Build succeeded with 0 errors.
- [x] **Step 3: Update frontend models and API repository**
  Extend `SupportContactDto` and `UpdateSupportContactPayload` with `facebookUrl?: string`, `instagramUrl?: string`.
- [x] **Step 4: Add Contact Channels Card in `HelpAdminView.vue`**
  Add full interactive configuration card for Support Email, Phone, WhatsApp, Facebook URL, Instagram URL, and Working Hours.
- [x] **Step 5: Render Facebook and Instagram in `AppFooter.vue` & `HelpCenterView.vue`**
  Add clean SVG brand icons and external links for Facebook and Instagram.
- [x] **Step 6: Verify type-check & tests**
  Run: `npm run type-check && npm run test`
  Expected: PASS with 0 errors.
- [x] **Step 7: Commit**
  Run: `git add src/ && git commit -m "feat: add Facebook and Instagram contact channels to admin and public site"`

---

### Task 7: Full System Verification

- [x] **Step 1: Run complete frontend verification**
  Run: `npm run type-check && npm run test`
- [x] **Step 2: Run complete backend verification**
  Run: `dotnet build "E:\welco site\Welco\Welco.sln"`
- [x] **Step 3: Final sanity check and commit**
