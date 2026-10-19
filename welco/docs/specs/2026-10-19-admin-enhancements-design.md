# Welco Platform — Admin Side Enhancements & Architecture Specification

**Date:** 2026-10-19  
**Target Modules:** Frontend (`welco`) & Backend (`Welco.sln`: `Product.Services.API`, `Commerce.Services.API`, `Content.Services.API`, `Welco.Shared`)  
**Architecture:** Clean / Onion Architecture, CQRS (MediatR), Vue 3 Composition API, TypeScript, Clinical Precision Design Tokens.

---

## 1. Executive Summary & Requirements Scope

Based on the requirements from Welco Surgical management, the platform requires 4 core functional enhancements on the Admin side, harmonizing frontend and backend:

1. **Orders (Admin Side):**
   - PDF export of each individual order (comprehensive single order dispatch sheet).
   - PDF export of the complete list of orders (filtered / paginated tabular executive report).
   - PDF export of an official Commercial Tax Invoice for the order.
2. **Companies (Admin Side):**
   - PDF export of the company directory (listing verified providers, distributors, hospitals, and clients with compliance details).
3. **Products (Catalog Management - Admin Side):**
   - Make `Price`, `Stock Quantity`, and `Arabic Name (NameAr)` **optional** (relaxing validation on both frontend and backend).
   - Enforce a strict minimum of **three (3) product images** and support for **product video** (upload / URL) during product creation and editing.
4. **Contact Us Configuration (Admin Side & Public Display):**
   - Admin management of official contact channels: Email, Phone / Contact, Facebook URL, and Instagram URL.
   - Public rendering in `AppFooter`, `HelpCenter`, and support channels.

---

## 2. Technical Architecture & System Design

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VUE 3 FRONTEND (welco)                         │
├─────────────────────┬───────────────────┬──────────────────────────────┤
│ OrdersAdminView     │ CompaniesAdminView│ ProductsAdminView            │
│ • Export Order PDF  │ • Export Directory│ • Optional NameAr, Price, Qty│
│ • Export All Orders │   PDF             │ • Strict Min 3 Images + Video│
│ • Export Invoice PDF│                   │ • Multi-image Slot Uploader  │
├─────────────────────┴───────────────────┴──────────────────────────────┤
│ Admin Contact Us Management (HelpAdminView / AdminDashboardView)       │
│ • Support Email, Phone, Facebook Link, Instagram Link                  │
├────────────────────────────────────────────────────────────────────────┤
│ PDF Generation Engine: jsPDF + jsPDF-AutoTable (Clinical Precision)    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ HTTP REST (JWT Bearer)
┌──────────────────────────────────▼─────────────────────────────────────┐
│                    .NET 10 BACKEND (Welco.sln)                         │
├───────────────────────┬──────────────────────┬─────────────────────────┤
│ Product.Services.API  │ Content.Services.API │ Commerce.Services.API   │
│ • Relax Validators    │ • SupportContactDto  │ • Order & Invoice DTO   │
│   (NameAr/Price/Stock)│   (Email, Phone,     │   compatibility         │
│ • Support multi-images│    Facebook, Insta)  │                         │
│   & Video in Media    │ • Persist & Seed     │                         │
└───────────────────────┴──────────────────────┴─────────────────────────┘
```

---

## 3. Detailed Component & Implementation Plan

### 3.1 Orders PDF System (`OrdersAdminView.vue`)
- **Engine:** Client-side vector PDF rendering using `jspdf` and `jspdf-autotable`.
- **Styling:** "Clinical Precision" medical design tokens:
  - Header: `#0F3D56` (Welco Deep Navy), `#147D92` (Steel Teal accent).
  - Clean monospaced table font for SKUs, order references, quantities, and pricing.
  - Verification badges: ISO 13485:2016 & CE Medical Device certification marks.
- **Three PDF Outputs:**
  1. `exportSingleOrderPdf(order: OrderDto)`: Detailed order sheet with customer reference, shipping details, itemized table of instruments, unit prices, applied negotiated discount, logistics freight, and grand total.
  2. `exportOrdersListPdf(orders: OrderDto[], filterInfo?: string)`: Executive tabular overview of all orders currently loaded/filtered, summarizing total turnover, count by status (Pending, Confirmed, Shipped, Delivered), and timestamp.
  3. `exportOrderInvoicePdf(order: OrderDto)`: Commercial tax invoice format containing:
     - Document Title: **COMMERCIAL INVOICE / TAX INVOICE**
     - Invoice Number: `INV-{OrderNumber}`
     - Invoice Date & Due Date
     - Consignee / Bill To & Manufacturer / Provider
     - Detailed instrument line items with HS / DIN standards (if available)
     - Subtotal, Tax/VAT, Freight charges, Grand Total
     - Bank details & authorized signatory placeholder.

### 3.2 Companies PDF System (`CompaniesAdminView.vue`)
- Button added to toolbar: **"Export Directory (PDF)"** / **"تصدير الشركات (PDF)"**.
- Generates a multi-page executive medical directory report:
  - Columns: Company Name, Type (Manufacturer, Distributor, Hospital/Clinic, Provider), Status (Verified, Active, Pending), Country / City, Email, Phone.
  - Header with Welco Medical Group branding and total registered companies KPI.

### 3.3 Product Creation & Modification (`ProductsAdminView.vue` & Backend `Product.Services.API`)

#### Backend (`Product.Services.API`):
1. **`CreateProductCommandValidator` & `UpdateProductCommandValidator`:**
   - Remove `.NotEmpty()` from `NameAr`. Keep `.MaximumLength(200)`.
   - Change `Price`: when specified, must be `>= 0` (price can be 0 or optional for B2B RFQ "Price on Request").
   - Change `Stock`: when specified, must be `>= 0` (can be 0 or optional).
2. **`CreateProductCommand` & `UpdateProductCommand`:**
   - Add `public List<string>? Images { get; set; }`
   - Add `public string? VideoUrl { get; set; }`
   - Make `NameAr`, `Price`, and `Stock` nullable in commands (`decimal? Price`, `int? Stock`, `string? NameAr`).
3. **`CreateProductCommandHandler` & `UpdateProductCommandHandler`:**
   - Fallback `NameAr = string.IsNullOrWhiteSpace(request.NameAr) ? request.NameEn : request.NameAr` to ensure database NOT NULL constraint compatibility without breaking changes.
   - Default `Price = request.Price ?? 0m` and `Stock = request.Stock ?? 0`.
   - Store primary image (`Images[0]`) in `Product.ImageName` for backward-compatible card grids.
   - Store all uploaded images in `ProductMedia` with `ProductMediaType.Image` and order index.
   - Store video in `ProductMedia` with `ProductMediaType.Video`.

#### Frontend (`ProductsAdminView.vue`):
1. **Form Labels & Inputs:**
   - Remove `<span class="req">*</span>` from `NameAr`, `Price`, and `Stock`.
   - Remove `required` HTML attributes and validation blocks from `NameAr`, `Price`, and `Stock`.
2. **Strict Minimum 3 Images Enforcement:**
   - Image slot gallery supporting Image 1 (Cover / Main), Image 2, Image 3, and "+ Add Image".
   - Client-side validation: Admin **cannot** submit the product form unless at least 3 images have been uploaded/provided.
   - Visual counter & warning indicator: e.g. "3 of 3 images uploaded ✓" or "Please upload at least 3 images (current: X)".
3. **Product Video Support:**
   - Dedicated Product Video input field (supports video upload via existing attachment service or external URL / MP4 link) with live preview player.

### 3.4 Contact Us Channels (Admin & Public)

#### Backend (`Content.Services.API` & `Welco.Shared`):
1. **`SupportContact` entity & DTO:**
   - Extend `SupportContactDto` and `UpdateSupportContactPayload` to include `FacebookUrl?: string` and `InstagramUrl?: string`.
   - Update `UpdateSupportContactCommand` and handler to persist and return Facebook and Instagram links.
2. **Backward-Compatible Storage:**
   - Provide seamless storage for `FacebookUrl` and `InstagramUrl`.

#### Frontend (`welco`):
1. **Admin Control:**
   - Add Contact Channels configuration card/modal in `HelpAdminView.vue` and `AdminDashboardView.vue`:
     - Email (Mail)
     - Phone / Contact
     - WhatsApp Number
     - Facebook URL
     - Instagram URL
     - Working Hours
2. **Public Website Display:**
   - `AppFooter.vue`:
     - Email link with mail icon.
     - Phone link with call icon.
     - Facebook icon + link (with clean SVG brand icon).
     - Instagram icon + link (with clean SVG brand icon).
   - `HelpCenterView.vue`:
     - Display active Facebook and Instagram support channels alongside Email and Phone.

---

## 4. Verification & Testing Strategy

1. **Frontend Type & Unit Testing:**
   - `npm run type-check` (vue-tsc verification).
   - `npm run test` (Vitest test suite for all layout and commerce components).
2. **Backend Compilation & Tests:**
   - `dotnet build Welco.sln` to guarantee 0 errors.
   - `dotnet test Welco.Tests` to verify CQRS handlers.
3. **End-to-End Visual Verification:**
   - Test PDF download for single order, all orders list, and invoice.
   - Test PDF download for companies list.
   - Test product creation with blank Price, blank Stock, and blank Arabic name (should succeed).
   - Test product creation with < 3 images (should be blocked by validation) and >= 3 images + video (should succeed).
   - Test saving Contact Us with Facebook & Instagram and verify display in footer.
