# 🏥 Welco Surgical Platform — Full System Architecture, Workflow & UI/UX Specification

> **Target Audience:** ChatGPT / AI Design Assistant  
> **Goal:** Provide complete, comprehensive context of the Welco Medical Platform (Backend Microservices + Vue 3 Frontend) so you can propose, redesign, and generate modern, high-conversion UI components and screens while **strictly preserving the exact brand color palette and elevating it with modern aesthetic polish** (micro-interactions, subtle glassmorphism, elevated hierarchy, crisp medical typography, and tactile states).

---

## 📑 Table of Contents
1. [Company & Business Domain Overview](#1-company--business-domain-overview)
2. [User Personas & Business Roles](#2-user-personas--business-roles)
3. [Backend Architecture & Microservices Implementation](#3-backend-architecture--microservices-implementation)
4. [Frontend Architecture & Technology Stack](#4-frontend-architecture--technology-stack)
5. [The "Clinical Precision" Design System & Color Palette](#5-the-clinical-precision-design-system--color-palette)
6. [Design Elevation Guidelines for ChatGPT](#6-design-elevation-guidelines-for-chatgpt)
7. [Comprehensive Screen Catalog & UX Workflows](#7-comprehensive-screen-catalog--ux-workflows)
   - 7.1 [Public & Discovery Flow](#71-public--discovery-flow)
   - 7.2 [Authentication & Onboarding Flow](#72-authentication--onboarding-flow)
   - 7.3 [Direct Purchase / B2C Flow](#73-direct-purchase--b2c-flow)
   - 7.4 [B2B Quotation Pipeline (RFQ & Quote Flow)](#74-b2b-quotation-pipeline-rfq--quote-flow)
   - 7.5 [Buyer Account & Order Lifecycle Flow](#75-buyer-account--order-lifecycle-flow)
   - 7.6 [Provider / Vendor Portal Flow](#76-provider--vendor-portal-flow)
   - 7.7 [Admin Operations & Control Center Flow](#77-admin-operations--control-center-flow)
   - 7.8 [Support, Quality & Content Flow](#78-support-quality--content-flow)
8. [Existing Frontend Components Catalog](#8-existing-frontend-components-catalog)
9. [Master Prompt Template for ChatGPT Component Generation](#9-master-prompt-template-for-chatgpt-component-generation)

---

## 1. Company & Business Domain Overview

**Welco** is a precision surgical instrument manufacturer founded in **1994** (over 30 years of manufacturing excellence).  
- **Certifications:** Certified under **ISO 13485** (Medical Device Quality Management System), **CE Marking**, and strict international surgical standards.
- **Global Export:** Active in **40+ countries** across Europe, the Middle East, Asia, and the Americas.
- **Product Domain:** High-precision surgical instruments (scissors, forceps, needle holders, retractors, scalpel handles, specialty surgical trays) manufactured with medical-grade stainless steel, tungsten carbide, and titanium.
- **Business Model:** Hybrid **B2C (Direct Storefront)** + **B2B (Institutional Procurement Pipeline)** + **Multi-Provider Ecosystem** (Welco manufacturer + vetted medical distributors/providers offering verified SKUs).

---

## 2. User Personas & Business Roles

The system is strictly governed by 4 distinct roles with tailored workflows, navigation trees, and permissions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER ROLES & SCOPES                            │
├─────────────────┬──────────────────┬───────────────────┬────────────────────┤
│ 1. Guest        │ 2. Client/Buyer  │ 3. Provider/Vendor│ 4. Admin/Staff     │
│ (Anonymous)     │ (B2C & B2B)      │ (Medical Partner) │ (Welco Operations) │
├─────────────────┼──────────────────┼───────────────────┼────────────────────┤
│ • Public Browsing│ • Cart & Checkout│ • Provider Portal │ • Full Dashboard   │
│ • Catalog/Specs │ • Submit RFQ     │ • Review RFQs     │ • Global Catalog   │
│ • Certifications│ • Approve Quotes │ • Issue Quotes    │ • Territory Mgmt   │
│ • Company Search│ • Order Tracking │ • Manage Catalog  │ • Company Approvals│
│ • Guest Cart    │ • Support Tickets│ • Order Shipping  │ • Audit Logs & CMS │
└─────────────────┴──────────────────┴───────────────────┴────────────────────┘
```

1. **Guest / Anonymous User (`UserType.Guest`):**
   - Can explore the landing page, catalog, product details, certifications, about page, and help center.
   - Can add items to a temporary guest cart stored via session identifier.
   - Can apply to become a B2B distributor or register as a standard client.
2. **Client / Buyer (`UserType.Client` / `OrganizationUser` without provider rights):**
   - Institutional buyers (Hospitals, Clinics, Surgical Centers, Importers) or individual surgeons.
   - Can execute instant B2C checkout or submit multi-item B2B RFQs with target price negotiation.
   - Receives official quotes with expiry dates, reviews item breakdowns, approves/declines quotes, and converts approved quotes to formal orders.
   - Manages shipping/billing addresses, views tracking timelines, manages wishlist, and submits support tickets.
3. **Provider / Vendor / Distributor (`BusinessRole.Provider`):**
   - Verified medical equipment providers or regional distributors with an approved company profile.
   - Accesses dedicated Provider Portal (`/provider/*`):
     - Quotes Desk: Reviews incoming buyer RFQs matching their catalog, reviews requested target discounts/notes, generates priced quotes with validity dates.
     - Orders Desk: Monitors incoming client orders, updates fulfillment statuses (Pending → Confirmed → Shipped → Delivered).
     - Catalog Manager: Manages products/SKUs, inventory levels, specifications, multi-currency pricing, and video guides.
4. **Admin / Welco Staff (`BusinessRole.Admin` / `UserType.Admin`, `UserType.WelcoStaff`):**
   - Complete operations suite (`/admin/*`):
     - Dashboard with dynamic throughput activity curve and real-time KPI counts.
     - Territory management (Countries, Cities, Zones).
     - Company & Distributor application review (Approve/Reject with business documentation).
     - Master category tree and certifications registry.
     - Content Management (Landing pages, About page, Help articles, FAQs).
     - Omnichannel support ticketing and immutable system audit logging.

---

## 3. Backend Architecture & Microservices Implementation

- **Technology:** .NET 10 (ASP.NET Core), C# 13, Clean / Onion Architecture, CQRS pattern via MediatR, FluentValidation, Serilog.
- **Database:** Microsoft SQL Server (EF Core Code-First shared schema across bounded contexts).
- **Gateway:** Ocelot API Gateway running at `Welco.API` with JWT Bearer validation, rate limiting, and unified OpenAPI/Scalar docs.

### Microservices Map

| Service Name | Port | Bounded Context & Key Endpoints |
|---|:---:|---|
| **`Welco.API`** | `7166` (HTTPS) | Gateway reverse proxy, unified route distribution, token relay, rate limiting. |
| **`Auth.Services.API`** | `7203` | `POST /api/v1/auth/login`, `register`, `verify-register-otp`, `forgot-password`, `verify-password-otp`, `reset-password`, `refresh-token`, `profile`. |
| **`UserManamgent.Service.API`** | `7204` | Users, Companies (`/api/v1/user-management/companies`), Company Addresses, Geographic Hierarchy (`countries`, `cities`, `zones`), Distributor Applications (`POST`, `approve`, `reject`), Audit Logs. |
| **`Product.Services.API`** | `7054` | Categories (`/api/v1/categories`), Products (`/api/v1/products`), Product Videos, Currencies (`/api/v1/currencies`), Exchange Rates live conversion (`/api/v1/exchange-rates/*`). |
| **`Commerce.Services.API`** | `7045` | Carts (`/api/v1/carts`, session/user cart sync, line items), Orders (`/api/v1/orders`), Status tracking (`/api/v1/orders/track/{orderNumber}`). |
| **`Sales.Services.API`** | `7046` | B2B RFQs (`/api/v1/rfqs`), Quotes (`/api/v1/quotes`, `approve`, `decline`), Product Inquiries (`/api/v1/product-inquiries`). |
| **`Content.Services.API`** | `7047` | Documents (`/api/v1/documents`), Custom Landing Pages by slug (`/api/v1/landing-pages`), Help Categories & Articles (`/api/v1/help/*`), FAQs, Support Tickets (`/api/v1/support/tickets`), OEM Inquiries. |
| **`Certification.Services.API`** | `7101` | Certifications registry (`/api/v1/certifications`), PDF certificate display & metadata. |
| **`Attachment.Services.API`** | `7180` | Secure multipart storage (`POST /files/upload`, `/download`, delete) categorized by place & media type. |

---

## 4. Frontend Architecture & Technology Stack

- **Framework:** Vue 3 (Composition API with `<script setup lang="ts">`), Vue Router 4, Vite 8, TypeScript 6.
- **Styling:** Tailwind CSS 3.4 with custom `@tailwindcss/forms` and `@tailwindcss/container-queries`, alongside the custom "Clinical Precision" CSS design token system.
- **Clean Architecture Layers in Frontend:**
  - `src/domain/`: Pure TypeScript interfaces, DTOs, repository ports, and domain business rules (`business-role.ts`, `sales.ts`, `commerce.ts`, `marketplace.ts`, `company.ts`).
  - `src/application/`: Service classes managing API interactions, state caching, and business workflows (`auth.service.ts`, `commerce.service.ts`, `sales.service.ts`, `company.service.ts`, `exchange-rate.service.ts`).
  - `src/infrastructure/`: HTTP client with auto-refresh JWT interceptor (`http-client.ts`), Token Storage, feedback services (`toast.service.ts`, `confirm.service.ts`, `modal.service.ts`).
  - `src/composables/`: Reusable reactive composition hooks (`useCart.ts`, `useWishlist.ts`, `useAddresses.ts`, `useLocations.ts`, `useUserLookup.ts`, `useAnimation.ts`).
  - `src/di/container.ts`: Dependency injection container providing singleton service instances across Vue components.
  - `src/i18n/`: Bi-directional English/Arabic translation system with dynamic RTL/LTR direction switching and locale-aware number/currency formatting.

---

## 5. The "Clinical Precision" Design System & Color Palette

The Welco aesthetic is designed to feel like a **sterile, high-precision surgical instrument**: surgical steel, deep navy authority, precision cyan calibrations, and clean clinical white surfaces.

### 🎨 Exact Color Palette (Extracted from `design-tokens.css` & `tailwind.config.js`)

| Token Category | Variable Name | Hex Code | Purpose & Semantic Role |
|---|---|:---:|---|
| **Primary Navy** | `--brand` / `--color-brand-600` | `#0F3D56` | Primary brand authority, headers, key buttons, card accents. |
| **Navy Deep** | `--color-brand-900` | `#001D32` | Dark contrast surfaces, footer base, high-density elements. |
| **Steel Teal** | `--secondary` / `--color-brand-500` | `#147D92` | Secondary brand color, interactive links, hover states, callouts. |
| **Surgical Cyan** | `--tertiary` / `--color-cyan-500` | `#28A7A1` | High-precision accents, badges, targets, active indicator pills. |
| **Brand Soft** | `--brand-soft` / `--color-brand-100` | `#E3EFFF` | Button container soft tint, badge backgrounds, selected row fills. |
| **Brand Ice** | `--color-brand-50` | `#EDF4FF` | Table header tints, secondary container backgrounds. |
| **Brand Gradient**| `--brand-gradient` | `linear-gradient(135deg, #0F3D56 0%, #147D92 100%)` | Primary CTAs, hero badges, modal headers. |
| **Canvas Background**| `--bg-app` / `--color-neutral-50` | `#F7F9FB` | The clinical app canvas background (clean, sterile grey-blue tint). |
| **Surface White** | `--bg-surface` / `--color-neutral-0`| `#FFFFFF` | Card surface, table background, modal dialogs, input fills. |
| **Ink Heading** | `--fg-heading` / `--color-neutral-900` | `#102A43` | Highest legibility text for titles, SKU numbers, table headers. |
| **Body Text** | `--fg-body` / `--color-neutral-700` | `#42474D` | Primary readable paragraph text and form label values. |
| **Muted Steel** | `--fg-muted` / `--color-neutral-600` | `#7a90a8` | Metadata, timestamps, helper descriptions (WCAG AA compliant). |
| **Hairline Border**| `--border` / `--color-neutral-200` | `#D9E2EC` | Clean 1px card and table separator hairlines. |
| **Strong Border** | `--border-strong` / `--color-neutral-300` | `#C2C7CD` | Active input boundaries, card dividers. |
| **Focus Boundary**| `--border-focus` / `--color-info-500` | `#0EA5E9` | Laser-focused teal focus rings on inputs and active buttons. |
| **Success / ISO** | `--color-success-500` | `#16A34A` | ISO 13485 & CE verified compliance, approved quotes/orders. |
| **Success Soft** | `--color-success-50` | `#F0FDF4` | Success alert container fill, verified badge background. |
| **Warning / Amber**| `--color-warning-500` | `#D97706` | Regulatory lot-trace warnings, pending status, quote expiry alerts. |
| **Warning Soft** | `--color-warning-50` | `#FFFBEB` | Warning callout background. |
| **Danger / Red** | `--color-danger-500` | `#EF4444` | Critical errors, out-of-stock, rejected applications, delete actions. |
| **Danger Soft** | `--color-danger-50` | `#FEF2F2` | Error alerts and destructive modal warning boxes. |

### 🔤 Typography & Geometric Hierarchy

- **Display & Headings:** `Plus Jakarta Sans`, weights 600, 700, 800 (Clean, modern geometric sans with surgical sharpness).
- **Body & Labels:** `Inter`, weights 400, 500, 600 (High-density readability for medical tables and forms).
- **Data, DIN & SKUs:** `JetBrains Mono` (Monospaced alignment for surgical instrument SKU numbers, LOT numbers, serials, and financial figures).
- **Corner Radii:**
  - Micro Tag / Badge: `4px` (`rounded-sm`)
  - Input & Button: `6px` (`rounded-md`)
  - Card & Container: `8px` (`rounded-lg`)
  - Outer Modal & Hero Card: `12px` - `16px` (`rounded-xl` / `rounded-2xl`)
  - Pill Badges: `9999px` (`rounded-full`)

---

## 6. Design Elevation Guidelines for ChatGPT

When ChatGPT designs or upgrades components for Welco, it must **never use generic colors (no plain purple, neon blue, or arbitrary greens)**. Instead, it must build on the existing palette and apply the following modern aesthetic principles:

1. **Layered Depth & Sterile Glassmorphism:**
   - Use `backdrop-blur-md bg-white/80 border border-[#D9E2EC]/70 shadow-sm` for floating headers, sticky sidebars, and modals.
   - Employ crisp 1px borders rather than heavy shadows to reflect medical instrument precision.
2. **Tactile & Interactive Micro-States:**
   - Buttons should feature smooth hover transitions (`transition-all duration-200 ease-out active:scale-[0.98]`).
   - Cards should implement a subtle top hairline accent on hover (`hover:border-[#147D92] hover:shadow-md hover:-translate-y-0.5`).
3. **Medical Density & Clear Data Hierarchy:**
   - Medical buyers and hospital procurement managers need high information density: use compact tables with subtle zebra striping (`even:bg-[#F7F9FB]/50`), distinct status pills, and monospaced SKU identifiers.
4. **Bilingual RTL/LTR Alignment:**
   - Always ensure styles accommodate Arabic (`dir="rtl"`) without breaking layout grids, icons, or navigation rails.

---

## 7. Comprehensive Screen Catalog & UX Workflows

```
                                 ┌───────────────────────┐
                                 │     Home Page (/)     │
                                 └───────────┬───────────┘
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             ┌───────────────────┐                       ┌───────────────────┐
             │ Public Catalog    │                       │ B2B Application   │
             │ (/marketplace)    │                       │ (/auth/register)  │
             └─────────┬─────────┘                       └─────────┬─────────┘
                       │                                           │
         ┌─────────────┴─────────────┐                             ▼
         ▼                           ▼                   ┌───────────────────┐
   ┌───────────┐               ┌───────────┐             │ Admin Approval    │
   │ Direct    │               │ B2B RFQ   │             │ (/admin/companies)│
   │ Purchase  │               │ Creation  │             └─────────┬─────────┘
   │ (/cart)   │               │ (/cart)   │                       │
   └─────┬─────┘               └─────┬─────┘                       ▼
         │                           │                   ┌───────────────────┐
         ▼                           ▼                   │ Provider Portal   │
   ┌───────────┐               ┌───────────┐             │ (/provider/*)     │
   │ Checkout  │               │ Provider  │             └───────────────────┘
   │ (/check-  │               │ Review &  │
   │  out)     │               │ Quote     │
   └─────┬─────┘               └─────┬─────┘
         │                           │
         ▼                           ▼
   ┌───────────┐               ┌───────────┐
   │ Order     │               │ Buyer     │
   │ Confirmed │               │ Approves  │
   │ & Track   │               │ & Orders  │
   └───────────┘               └───────────┘
```

### 7.1 Public & Discovery Flow
- **`HomeView.vue` (`/`)**:
  - *Components:* Hero section with search bar + quick SKU lookup, ISO 13485 & CE compliance banner, Featured Categories carousel, Most Selling Instruments showcase, Global Providers section, interactive image viewer modal for surgical blueprints.
  - *Next Steps:* Clicking search redirects to `/marketplace?search=...`; clicking category redirects to `/categories` or `/categories/:id/providers`.
- **`CategoriesView.vue` (`/categories`)**:
  - *Components:* Hierarchical category grid with instrument icons, live product counts, and subcategory breadcrumbs.
- **`CategoryProvidersView.vue` (`/categories/:id/providers`)**:
  - *Components:* Directory of medical distributors/providers licensed to supply instruments in this specific category.
- **`CatalogView.vue` (`/marketplace`)**:
  - *Components:* Filter sidebar (Category accordion, Price slider, In-stock toggle, Material filter: Stainless Steel, Titanium, Tungsten Carbide), Search input, Sort dropdown (Popularity, Price low/high, Newest), Product Card Grid with instant "Add to Cart" and "Request Quote" buttons.
- **`ProductDetailView.vue` (`/marketplace/product/:id`)**:
  - *Components:* High-res image gallery with zoom, Technical Specifications sheet (DIN standard, Length in cm, Working ends, Autoclavable rating), Video tab (Sterilization and surgical handling guides), "Offered By" multi-provider selector (allows switching between distributors offering the exact same SKU with comparative pricing), Price negotiation RFQ trigger, and Related Instruments carousel.

### 7.2 Authentication & Onboarding Flow
- **`LoginView.vue` (`/auth/login`)**:
  - Dual-mode login (Standard Email/Password + OTP login options), remember-me toggle, redirect routing according to role.
- **`RegisterView.vue` (`/auth/register`)**:
  - Segmented onboarding: **Client Registration** (Hospitals/Doctors) vs **Distributor Application** (Requires uploading Tax ID, ISO certificates, and company documentation).
- **`VerifyEmailView.vue` (`/auth/verify-email`)**:
  - 6-digit OTP code input with automatic countdown resend timer.
- **`ForgotPasswordView.vue` & `ResetPasswordView.vue` (`/auth/*`)**:
  - Multi-step security verification before granting password reset.

### 7.3 Direct Purchase / B2C Flow
- **`CartView.vue` (`/cart`)**:
  - Dual-action commercial engine:
    1. *Direct Checkout:* Itemized table, quantity steppers, server-side dynamic currency conversion with address detection.
    2. *B2B Negotiation Mode:* Hospitals can toggle **"Enable Price Negotiation"**, propose a target order total, provide negotiation justifications, and request volume discounts.
  - Submits to `/checkout` (Direct) or creates RFQ (B2B).
- **`CheckoutView.vue` (`/checkout`)**:
  - Stepper header (`ChainSteps.vue`): Shipping Address Selection → Incoterms Selection (FOB, CIF, EXW) → Billing Information → Order Summary → Confirm Order.
- **`OrderConfirmationView.vue` (`/checkout/confirmation/:orderNumber`)**:
  - Invoice breakdown, printable PDF download, instant order tracking link.
- **`OrderTrackingView.vue` (`/track-order`)**:
  - Real-time visual timeline (Order Placed → Confirmed → Quality Inspection → Dispatched → Delivered).

### 7.4 B2B Quotation Pipeline (RFQ & Quote Flow)
1. **RFQ Creation:** Buyer adds bulk items from product detail or cart, includes lot specifications, delivery port, and target discount, submitting `POST /api/v1/rfqs`.
2. **Provider / Sales Review:** Provider or Welco Staff sees new RFQ in `/provider/quotes` or `/admin/sales`, inspects requested currency and discount notes, and issues a binding Quote with an expiry date (`validUntil`).
3. **Buyer Decision (`/account/quotes/:id`)**:
   - Buyer reviews unit pricing and total discount.
   - If satisfied: Clicks **"Approve Quote"** → Then clicks **"Convert to Formal Order"** → Order created seamlessly with locked quote pricing!
   - If dissatisfied: Clicks **"Decline Quote"** with feedback notes.

### 7.5 Buyer Account & Order Lifecycle Flow
- **`AccountDashboardView.vue` (`/account`)**:
  - Overview cards: Active RFQs, Pending Quotes, Open Orders, Total Spent.
- **`RfqListView.vue` & `RfqDetailView.vue` (`/account/rfqs/:id`)**:
  - Status tracking pills: `Pending`, `Quoted`, `Ordered`, `Cancelled`.
- **`QuoteListView.vue` & `QuoteDetailView.vue` (`/account/quotes/:id`)**:
  - Validity countdown, item-by-item price comparison, approve/decline actions.
- **`OrderHistoryView.vue` & `OrderDetailView.vue` (`/account/orders/:id`)**:
  - Complete historical log, invoice downloads, re-order button.
- **`AddressesView.vue` & `ProfileView.vue`**:
  - Multi-country shipping and billing address book.

### 7.6 Provider / Vendor Portal Flow
- Layout: `ProviderLayout.vue` wrapping a dedicated collapsible command rail (`DashboardShell.vue`).
- **`ProviderQuotesView.vue` (`/provider/quotes`)**:
  - Dual tabs: "Incoming RFQs" and "Issued Quotes". Includes currency parity calculation (Base vs Requested currency).
- **`ProviderOrdersView.vue` (`/provider/orders`)**:
  - Processing dashboard for fulfilling orders: change status to `Confirmed`, `Shipped` (with tracking number), or `Delivered`.
- **`ProviderCatalogView.vue` (`/provider/catalog`)**:
  - SKU table and card grid: stock counters, out-of-stock alerts, modal to create/update products, upload medical attachments and video links.
- **`ProviderCategoriesView.vue` (`/provider/categories`)**:
  - Provider's category mapping and hierarchy management.
- **`ProviderSupportView.vue` (`/provider/support`)**:
  - Direct communication channel with Welco administrative team.

### 7.7 Admin Operations & Control Center Flow
- Layout: `AdminLayout.vue` with system live status beacon and categorized navigation sections.
- **`AdminDashboardView.vue` (`/admin`)**:
  - Dynamic SVG cubic-bezier activity curve (aggregated monthly order + audit throughput).
  - StatCards for Countries, Cities, Zones, Registered Users, Pending Distributor Applications.
  - Quick action modal for instant Category & Product creation.
- **`SalesAdminView.vue` (`/admin/sales`)**:
  - Global monitor of all RFQs, Quotes, and Product Inquiries across all providers.
- **`OrdersAdminView.vue` (`/admin/orders`)**:
  - Master order monitor with status override controls.
- **`CompaniesAdminView.vue` (`/admin/companies`)**:
  - Review distributor applications: inspect tax registrations, verify compliance, approve or reject applications with custom feedback.
- **`UsersAdminView.vue` (`/admin/users`)**:
  - User directory, role assignment (`Admin`, `WelcoStaff`, `OrganizationUser`, `Client`), password resets.
- **`CountriesAdminView.vue`, `CitiesAdminView.vue`, `ZonesAdminView.vue` (`/admin/*`)**:
  - Geographic territory management supporting shipping zones and currency associations.
- **`AuditLogAdminView.vue` (`/admin/audit-logs`)**:
  - Tamper-evident activity logs capturing user actions, timestamps, and payload diffs.

### 7.8 Support, Quality & Content Flow
- **`CertificationsView.vue` (`/certifications`) & Admin (`/admin/certifications`)**:
  - Public display and administrative upload of ISO 13485 certificates, CE Declarations of Conformity, FDA registration proofs.
- **`HelpCenterView.vue` (`/help`) & `HelpAdminView.vue` (`/admin/help`)**:
  - Categorized knowledge base articles, searchable FAQs, sterilization protocols.
- **`MyTicketsView.vue` (`/help/my-tickets`) & Admin (`/admin/tickets`)**:
  - Real-time customer support ticketing system with message thread replies and ticket closing.
- **`OemView.vue` (`/oem`)**:
  - Specialized landing page for custom surgical instrument manufacturing requests (custom prototyping, logo engraving, custom alloy formulations).

---

## 8. Existing Frontend Components Catalog

| Component Name | File Path | Existing Capabilities | Desired AI Redesign / Elevation |
|---|---|---|---|
| **`BaseButton` / `AppButton`** | `src/components/ui/BaseButton.vue` | Primary, secondary, danger, ghost variants with loading spinner. | Add subtle surgical sheen hover effect, tactile scale press, and refined focus glow. |
| **`BaseInput` / `AppInput`** | `src/components/ui/BaseInput.vue` | Label, error validation, leading/trailing icons. | Elevate with floating label option, crisp `#D9E2EC` border, and smooth `#0EA5E9` focus ring. |
| **`BaseModal`** | `src/components/ui/BaseModal.vue` | Backdrop blur, header with title, body slot, footer actions. | Enhance with smooth zoom-in scale animation, frosted glass header, and clear divider hairlines. |
| **`StatCard`** | `src/components/ui/StatCard.vue` | Metric value, title, icon, trend indicator (+/- %). | Upgrade with ambient background tint, micro-chart sparkline option, and medical navy contrast. |
| **`StatusPill`** | `src/components/ui/StatusPill.vue` | Semantic badges for Order/RFQ/Quote statuses. | Add subtle glowing status beacon (pulsing dot for pending states), refined border tints. |
| **`DataState`** | `src/components/ui/DataState.vue` | Handles Loading, Error, Empty, and Success states. | Ensure seamless skeleton animations with clinical shimmer gradients. |
| **`FileUpload`** | `src/components/ui/FileUpload.vue` | Drag & drop, progress bar, preview thumbnail, place/media configuration. | Modernize dropzone with dashed hairline, file type icons (PDF, PNG, MP4), and validation chips. |
| **`CurrencySelect`** | `src/components/ui/CurrencySelect.vue` | Active currency switcher with flag/symbol display. | Polish dropdown search, keyboard navigation, and address-based auto-detection badges. |
| **`QuantityStepper`** | `src/components/ui/QuantityStepper.vue` | Plus/minus buttons, minimum order quantity enforcement. | Clean industrial buttons with tactile micro-press feedback. |
| **`ChainSteps`** | `src/components/ui/ChainSteps.vue` | Multi-step progress tracker for checkout and RFQ. | Sleek connected step indicators with completed checkmarks and active pulse. |
| **`DashboardShell`** | `src/components/layout/DashboardShell.vue` | Collapsible sidebar, profile widget, live status indicator. | Add refined collapsible rail animation, high-contrast active states, and mobile drawer transitions. |

---

## 9. Master Prompt Template for ChatGPT Component Generation

Copy and paste the prompt below into ChatGPT when asking it to build or redesign any component or screen:

```markdown
You are an expert Principal Frontend Engineer and Medical Design System Architect. 
I am building the frontend for "Welco" (a premier ISO 13485 surgical instruments manufacturing platform).

I need you to design/upgrade the following component or screen:
[INSERT COMPONENT OR SCREEN NAME HERE — e.g. "ProductDetailView" or "B2B Quote Approval Card"]

### 🎨 DESIGN & BRANDING CONSTRAINTS (STRICT):
You MUST strictly follow Welco's "Clinical Precision" design token system:
- Primary Navy: #0F3D56 (Hover: #147D92, Soft container: #E3EFFF)
- Secondary Steel Teal: #147D92 (Hover: #00687A, Soft: #EDF4FF)
- Tertiary Surgical Cyan: #28A7A1 (Soft: #E6FAF8)
- Background Canvas: #F7F9FB (Clean medical canvas)
- Card Surfaces: #FFFFFF (Clean crisp white)
- Headings: #102A43 (High-legibility dark ink)
- Body Text: #42474D
- Hairline Borders: #D9E2EC (Clinical 1px borders)
- Status Colors:
  * Verified Success: #16A34A (Background: #F0FDF4)
  * Regulatory Warning / Amber: #D97706 (Background: #FFFBEB)
  * Critical Danger: #EF4444 (Background: #FEF2F2)
  * Information / Focus Ring: #0EA5E9 (Background: #F0F9FF)
- Fonts: Display: "Plus Jakarta Sans", Body: "Inter", SKUs/DIN: "JetBrains Mono"

### 🚀 AESTHETIC UPGRADES REQUIRED:
1. Do not use generic purple or flat bootstrap blues.
2. Elevate the design with subtle frosted glass (backdrop-blur-md bg-white/90), crisp 1px borders (#D9E2EC), and tactile hover states.
3. Support high medical density with clean hierarchy, responsive layouts, and bilingual RTL/LTR readiness.
4. Provide fully working Vue 3 (<script setup lang="ts">) code with Tailwind CSS 3.4 utility classes and comprehensive TypeScript props/interfaces.
```
