# Welco Platform — Business Requirements & .NET Domain Blueprint

*Source: `welco_ui_redesign.html` (uploaded prototype) — a static click-through mockup, not a working app.*

## What this file actually is

The upload is a single HTML file with a JS tab switcher (`.proto-tab`) that flips between 9 page mockups plus a 10th "Priority Roadmap" page — the designer's own ranked list of what to build first. For **Welco**, a surgical-instrument manufacturer (est. 1994, ISO 13485 certified, CE marked, exporting to 40+ countries), the concept is a **hybrid B2B + B2C** commerce platform: everyday buyers add-to-cart and check out directly, while hospitals and distributors request quotes (RFQ), get approvals, and manage bulk trade through a dedicated dashboard.

Below: the business needs implied by every page, a full entity model you could hand straight to EF Core, and the roles that follow from them.

---

## 1. Business Needs

### 1.1 Public storefront & navigation
- Global header: search, wishlist, cart, and a separate **Distributor Login**
- Trust strip: years in business, ISO certification, export country count, OEM availability, quote turnaround time
- Homepage category grid across 6 specialties: Dental, Orthopedic, Spine, Plastic Surgery, CMF, ENT
- Export-market showcase and a trade-show calendar (upcoming vs. past events) — *Roadmap #9*
- Guest **order tracking** by order number (topline link, no login required)
- Currency (USD) and language (EN) switchers in the topline

### 1.2 Catalog search & filtering — *Roadmap #8*
- Full-text search by instrument name, SKU, or procedure
- Facets: specialty, instrument type, material, length range, CE-certified toggle, price range, availability
- Sort by relevance / price / newest, with live per-facet result counts

### 1.3 Product detail — dual purchase path
- Direct purchase: quantity stepper, **Add to Cart**, live price and stock badge
- B2B path on the same page: **Request Quote**, **Add to RFQ List**
- Supporting actions: datasheet PDF download (*Roadmap #6*), compare, wishlist, WhatsApp inquiry (*Roadmap #7*)
- Structured spec table (material, dimensions, sterilization, certification) and procedure tags
- Tabs for videos, applications, compare, documents
- No-account-needed "request more information" inquiry form

### 1.4 RFQ → Quote workflow — *Roadmap #1, the core B2B need*
- Explicit flow stated in the prototype: **product page → RFQ basket → submit inquiry → sales team**
- Sales converts an RFQ into a priced, time-limited **Quote**
- Buyer approves/declines the quote from their dashboard
- Checkout runs in reverse too — a cart can become an RFQ via "Convert to Quote Request"

### 1.5 Cart, checkout & international trade
- Multi-currency totals (USD/EUR/GBP shown, extensible)
- Shipping calculator by destination country + method (air express / sea standard), returning cost and lead time
- **Incoterm** selection (EXW / FOB / CIF / DDP)
- Order summary with duties & taxes explicitly deferred to customs, not calculated in-app
- Two exits from cart: **Proceed to Checkout** or **Convert to Quote Request**

### 1.6 B2B account dashboard — *Roadmap #10*
- Stat cards: open RFQs, quotes awaiting approval, active orders, YTD order value
- RFQ history with status (Pending / Quoted / Ordered)
- Quote approvals with inline Approve/Decline
- Order history, invoice downloads, bulk-order tools, saved addresses, wishlist, recently viewed

### 1.7 OEM / private-label manufacturing — *Roadmap #2*
- Five services showcased: private label, custom development, laser marking (incl. traceability codes), packaging, branding
- **Gap:** shown as static cards with no lead-capture form — worth adding an OEM inquiry CTA, since the roadmap tags this section "Revenue"

### 1.8 Distributor partner program — *Roadmap #3*
- Perks messaging: tiered pricing, dedicated account manager, marketing support, priority production
- Application form (company, country, sales-volume band, category interest, website, contact) feeding an approval queue before distributor-tier access is granted

### 1.9 Quality, compliance & document center — *Roadmap #4, #5*
- Org-level certification showcase: ISO 13485, CE, FDA registration, GMP
- Central download library: catalog, brochures, IFU, CE/ISO certificates, sterilization guide — each with size/version metadata

### 1.10 Help center & support
- Searchable articles grouped by topic: ordering, shipping/Incoterms, returns/RMA, sterilization, FAQ, warranty
- Sitewide floating WhatsApp entry point

### 1.11 SEO / content marketing — three page templates, not one-offs
- **Brand pages** (`/brands/orthopedic-instruments`) — owned-brand collections
- **Specialty pages** (`/orthopedic-instruments`) — category hubs, cross-linked to related specialties
- **Procedure pages** (`/procedures/rhinoplasty`) — instrument kits by surgical procedure, called out as a high-intent organic-traffic source
- All three need to be data-driven templates so marketing can launch new ones without a developer

### 1.12 Gaps worth resolving before you model `User`
- **Payments** — no method or gateway appears at checkout; needs a decision (Stripe, a regional processor, bank transfer for B2B, etc.)
- **Direct-buyer auth** — only "Distributor Login" is visible; there's no visible sign-up for everyday buyers. The closing note ("keeping direct add-to-cart purchasing as the primary path") suggests guest checkout for that segment, with full accounts reserved for B2B — confirm this before designing `ApplicationUser`
- **Multi-language** — only "EN" is shown despite the 40+-country footprint; treat as a later consideration, not confirmed v1 scope

---

## 2. Domain Entities

Grouped by bounded context — a reasonable way to split this into separate folders/projects in a Clean Architecture solution.

### A — Identity, Access & Organizations

| Entity | Purpose | Key fields | Relationships |
|---|---|---|---|
| `ApplicationUser` | Anyone who can log in | Email, FullName, Phone, UserType, CompanyId, IsActive | N–N `Role`; N–1 `Company` |
| `Role` | ASP.NET Core Identity role | Name, Description | N–N `ApplicationUser` |
| `Company` | A B2B account: hospital, distributor, clinic, importer | Name, Type, CountryId, TierLevel, Status, AccountManagerId | 1–N Users, Addresses, Orders, RFQs |
| `Address` | Billing/shipping address | OwnerId, Line1/2, City, CountryId, Type, IsDefault | N–1 `Company` or `ApplicationUser` |
| `Country` | Reference list; flags export markets | Name, ISOCode, IsExportMarket | referenced by Address, ShippingRate, DistributorApplication |

### B — Catalog

| Entity | Purpose | Key fields | Relationships |
|---|---|---|---|
| `Category` | Specialty / instrument-type taxonomy | Name, ParentCategoryId, Slug, Icon | self-referencing tree |
| `Product` | A sellable instrument | SKU, Name, Slug, CategoryId, Price, Material, LengthCm, StockStatus, StockQty | N–1 Category; 1–N Media/Specs |
| `ProductSpecification` | Attribute/value pairs for the spec table | ProductId, AttrName, AttrValue | N–1 Product |
| `ProductMedia` | Images, diagrams, videos | ProductId, Type, Url, SortOrder | N–1 Product |
| `Certification` | Master list: ISO 13485, CE, FDA, GMP | Name, IssuingBody, Description | N–N `Product` via join table; also drives the org-level Certs page |
| `ProductProcedureTag` | "Used in: Spine Surgery" labels | ProductId, Label | N–1 Product |
| `UserProductInteraction` | Unifies wishlist, recently-viewed, and compare-list (discriminated by `Type`) | UserId, ProductId, Type, Timestamp | N–1 User, N–1 Product |

### C — Direct Commerce

| Entity | Purpose | Key fields | Relationships |
|---|---|---|---|
| `Cart` | Pre-checkout basket | UserId/SessionId, CurrencyCode | 1–N `CartItem` |
| `CartItem` | Line item in a cart | CartId, ProductId, Qty, UnitPriceSnapshot | N–1 Cart, N–1 Product |
| `Order` | Confirmed purchase | OrderNumber, Status, IncotermId, CurrencyCode, QuoteId (nullable), Totals | 1–N `OrderItem`; N–1 Company/User; N–1 Quote if converted |
| `OrderItem` | Line item in an order | OrderId, ProductId, Qty, UnitPrice | N–1 Order, N–1 Product |
| `ShippingMethod` | Freight option (air express, sea standard) | Name, ETA range | 1–N `ShippingRate` |
| `ShippingRate` | Price for a method + destination | ShippingMethodId, DestinationCountryId, BaseRate | N–1 ShippingMethod, N–1 Country |
| `Incoterm` | EXW / FOB / CIF / DDP lookup | Code, Name, Description | referenced by Order |
| `Currency` | USD/EUR/GBP + live rate | Code, Symbol, ExchangeRateToBase | referenced by Cart, Order, Quote |
| `Invoice` | Billing document per order | InvoiceNumber, OrderId, Amount, Status, FileUrl | N–1 Order |

### D — B2B Sales Pipeline

| Entity | Purpose | Key fields | Relationships |
|---|---|---|---|
| `RFQ` | Buyer-initiated quote request | RFQNumber, CompanyId, Status, AssignedSalesRepId | 1–N `RFQItem` |
| `RFQItem` | Requested line item | RFQId, ProductId, Qty, Notes | N–1 RFQ, N–1 Product |
| `Quote` | Sales-generated priced response | QuoteNumber, RFQId (nullable), Amount, ValidUntil, Status, CreatedBySalesRepId | 1–N `QuoteItem`; N–1 RFQ |
| `QuoteItem` | Priced line item | QuoteId, ProductId, Qty, UnitPrice | N–1 Quote, N–1 Product |
| `ProductInquiry` | Lightweight "request info" form, lighter than an RFQ | ProductId, Name, Organization, Message | N–1 Product |
| `DistributorApplication` | Partner-program intake | CompanyName, CountryId, SalesVolumeBand, Website, ContactPerson, Status | approval promotes a `Company` to distributor tier |
| `OEMServiceInquiry` | OEM lead capture (recommended addition — see gap in §1.7) | ContactInfo, ServiceType, Message, Status | references `OEMService` lookup (the 5 services) |

### E — Content, Marketing & Support

| Entity | Purpose | Key fields | Relationships |
|---|---|---|---|
| `Document` | Any downloadable file — catalog, brochure, IFU, certificate, per-product datasheet | Title, DocType, FileUrl, FileSizeKB, ProductId (nullable), PublishedDate | N–1 Product when product-specific |
| `LandingPage` | Data-driven Brand / Specialty / Procedure page | Type, Slug, HeroTitle, HeroBody, ContentBlock | N–N Product or Category |
| `HelpCategory` | Grouping for help content | Name, Icon | 1–N `HelpArticle` |
| `HelpArticle` | A single guide | CategoryId, Title, Body, Slug | N–1 HelpCategory |
| `FAQItem` | Short Q&A pair | Question, Answer, SortOrder | — |
| `TradeShowEvent` | Expo calendar entry | Name, Location, StartDate, EndDate | — |
| `BlogPost` | Footer-linked blog content | Title, Body, PublishedDate | — |

### F — Cross-cutting

| Entity | Purpose | Key fields | Relationships |
|---|---|---|---|
| `Notification` | "Quote ready", "RFQ status changed" alerts | UserId, Type, Message, IsRead | N–1 `ApplicationUser` |
| `AuditLog` | Who changed what, when — useful given ISO 13485 traceability expectations | EntityName, EntityId, Action, PerformedBy, Timestamp | polymorphic, references any entity by Id |

---

## 3. Project Roles Required

*Replacing the in-app user roles (Distributor, Sales Rep, etc.) from the earlier version with what you actually asked for: the people needed to build this, and how they map onto the .NET solution structure.*

### 3.1 Roles on the build team

| Role | Responsibility | Primarily works in |
|---|---|---|
| Solution Architect / Tech Lead | Owns the layering, technology choices, coding standards, and how projects reference each other | Whole solution — sets up the structure in §3.2 |
| Business Analyst / Product Owner | Turns the business needs in §1 into concrete stories, resolves the open gaps in §1.12, prioritizes the backlog | Feeds `Domain` and `Application` design, not code |
| Backend Developer (.NET/C#) | Implements entities, business rules, use cases (CQRS), and data access | `Domain`, `Application`, `Infrastructure` |
| API Developer | Exposes the application layer over HTTP: controllers, auth wiring, versioning, OpenAPI docs | `API` |
| Frontend Developer | Builds the actual pages the prototype mocked up — Home, PDP, Search, Checkout, Dashboard, OEM, etc. | `Web` (Blazor, MVC/Razor, or a separate SPA) |
| Database Developer / DBA | Designs the physical schema, writes/reviews EF Core migrations, indexing, performance | `Infrastructure/Persistence` |
| DevOps / Infrastructure Engineer | CI/CD pipelines, hosting, environment config, logging/monitoring, background-job infra (Hangfire) | Repo root, CI/CD workflows, cloud resources |
| QA / Test Engineer | Unit tests on Domain/Application, integration tests on the API, end-to-end tests on the RFQ→Quote and Checkout flows | `tests/` |
| UI/UX Designer | Owns the visual design — effectively the source of the prototype you uploaded — and iterates on it with the frontend dev | Design files → `Web` |
| Security / Compliance Reviewer | Reviews auth design, audit logging, and document handling against ISO 13485/FDA obligations | Cuts across `Infrastructure` (AuditLog) and `API` (auth policies) |
| Project Manager / Scrum Lead | Owns timeline and priority — the human equivalent of the prototype's own "Priority Roadmap" page | Cuts across everything |

On a small team, one person often covers several of these (Backend + API + DBA is a common combo); the table splits them by *responsibility*, not headcount.

### 3.2 How those roles map onto the solution structure

```
Welco.sln
│
├── src/
│   ├── Welco.Domain/                 ← Backend Developer
│   │   ├── Entities/                  (Product, Order, RFQ, Quote, Company...)
│   │   ├── Enums/
│   │   └── Interfaces/                (repository contracts)
│   │
│   ├── Welco.Application/            ← Backend Developer + Business Analyst input
│   │   ├── Features/
│   │   │   ├── Products/
│   │   │   ├── RFQs/
│   │   │   ├── Quotes/
│   │   │   ├── Orders/
│   │   │   └── Distributors/
│   │   ├── DTOs/
│   │   └── Common/                    (validation, mapping)
│   │
│   ├── Welco.Infrastructure/         ← Backend Developer + DBA
│   │   ├── Persistence/
│   │   │   ├── WelcoDbContext.cs
│   │   │   └── Migrations/
│   │   ├── Repositories/
│   │   └── ExternalServices/          (currency rates, email, WhatsApp)
│   │
│   ├── Welco.API/                    ← API Developer + Security Reviewer
│   │   ├── Controllers/
│   │   ├── Middleware/                (auth, error handling)
│   │   └── Program.cs
│   │
│   └── Welco.Web/                    ← Frontend Developer + UI/UX Designer
│       ├── Pages/
│       │   ├── Home/  ProductDetail/  Search/
│       │   ├── Checkout/  Dashboard/  OEM/
│       │   └── ...
│       └── Shared/
│
├── tests/                            ← QA / Test Engineer
│   ├── Welco.Domain.Tests/
│   ├── Welco.Application.Tests/
│   └── Welco.API.IntegrationTests/
│
└── .github/workflows/                ← DevOps Engineer
```

Each folder is effectively owned by one or two roles above — a backend developer can move through `Domain` → `Application` → `Infrastructure` without touching what the frontend developer is doing in `Web`, and the two only meet at the `API` contract in between.

---

## 4. .NET Implementation Notes
- **Architecture:** Clean/Onion layering — `Domain` (the entities above), `Application` (CQRS via MediatR), `Infrastructure` (EF Core + SQL Server or PostgreSQL), `API` (ASP.NET Core Web API)
- **Auth:** ASP.NET Core Identity for the Role table, backed by policy-based authorization for granular permissions (e.g. `CanApproveQuote`)
- **Frontend:** Blazor if you want one C# codebase end-to-end; MVC/Razor Pages is the safer pick for the largely content-driven public pages, since the SEO landing pages benefit from server-rendered HTML
- **Background jobs:** Hangfire (or a hosted service) for exchange-rate refresh, quote-expiry checks, notification dispatch
- **Real-time:** SignalR for live dashboard updates (RFQ status changes, new quotes)
- **File storage:** Azure Blob Storage (or S3-compatible) for datasheets, certificates, catalogs
- **Search:** EF Core + SQL full-text search to start; move to Elasticsearch/Azure AI Search only if catalog size or filter complexity grows
