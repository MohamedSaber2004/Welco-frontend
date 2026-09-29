# Welco Role and Operations Console Redesign

Date: 2026-09-22
Status: Approved
Author: Kilo

## 1. Purpose

Remove the Sales/Welco Staff operating role, transfer commercial work to provider-scoped workflows, make Admin the platform bridge between clients and providers, and merge the existing Admin and Provider dashboard experiences into one consistent operations console.

The change covers authentication, authorization, data ownership, backend APIs, frontend routes, navigation, visual design, support routing, migration, and verification across:

- Frontend: `E:\Welco Frontend Site\Welco\welco`
- Backend: `E:\Welco Site\Welco`

## 2. Confirmed Product Decisions

- The Sales/Welco Staff role is removed from active login, navigation, permissions, dashboards, and new authorization rules.
- Existing Welco Staff accounts are converted to Admin accounts.
- RFQs, quotations, orders, product inquiries, and related commercial work are handled by the related Provider.
- Providers only see and act on records tied to their approved company, products, or assigned work.
- Admin has platform-wide visibility and can monitor, reassign, escalate, intervene, and audit any record.
- Client support is routed according to context:
  - General or platform issues go to Admin.
  - Product, RFQ, quote, order, or provider-company issues go to the related Provider.
  - Admin can reassign or escalate any ticket.
- The current Welco navy/teal visual identity is refined rather than replaced.
- The change is delivered incrementally while preserving existing URLs and avoiding breaking changes to existing client APIs.

## 3. Role Model

### Active roles

| Role | Identity | Access |
|---|---|---|
| Admin | Platform operator | All clients, providers, companies, commercial records, support, content, and audit data |
| Provider | Approved `OrganizationUser` linked to a provider company | Own company catalog, commercial queues, related support, and company profile |
| Client | End buyer | Own marketplace, account, RFQs, quotes, orders, and support |

### Removed role

`WelcoStaff` / Sales is no longer issued to new users and is not used by active frontend or backend authorization paths.

For database compatibility, the historical enum value and legacy records may remain during migration. They must not grant access or appear in active role selection, navigation, or dashboard logic.

### Account migration

1. Identify users whose `UserType` is `WelcoStaff` or whose role names identify Sales/Staff.
2. Convert those users to `Admin`.
3. Preserve their user ID, profile, audit history, and existing session behavior where safe.
4. Reassign or retain legacy records in an Admin-owned backlog until provider ownership is resolved.
5. Remove Sales/Staff from seed data and registration paths.

## 4. Data Ownership and Authorization

### Provider scope

A Provider may access a record only when at least one of these conditions is true:

- The record belongs to the Provider's linked company.
- The record references a product owned by the Provider's linked company.
- The record is explicitly assigned to the Provider's linked company.
- The record is a support ticket routed to the Provider by a related transaction or Admin assignment.

Provider access is always filtered server-side. Frontend route guards are a usability layer and are not a security boundary.

### Admin scope

Admin can access all records and can:

- View all providers and clients.
- View all RFQs, quotes, orders, inquiries, carts, and support tickets.
- Assign or reassign work to a provider company.
- Escalate or de-escalate support.
- Intervene in a commercial record.
- View audit history and operational metrics.

### Client scope

Clients retain access only to their own account, RFQs, quotes, orders, and support tickets. Provider or Admin visibility does not expose client data to other clients.

## 5. Commercial Workflow

### RFQs and product inquiries

1. A Client creates an RFQ or product inquiry.
2. The backend resolves the related provider company from the product, company, or explicit assignment.
3. The request appears in that Provider's scoped queue.
4. The Provider reviews the request and creates or updates a quotation where applicable.
5. The Client sees the request and quotation status in their account.
6. Admin can view, reassign, escalate, or intervene at any point.

If no provider can be resolved, the request enters an Admin-owned unassigned backlog. Admin must be able to assign it before it becomes provider work.

### Quotes

- Providers create and manage quotes for RFQs they own or are assigned.
- Clients approve or decline their own quotes.
- Admin can view all quotes and intervene when necessary.
- Legacy quotes created by Sales are retained and attributed to the historical actor for audit purposes; their active operational owner is migrated to the resolved provider or Admin backlog.

### Orders

- Providers see orders containing products owned by their company.
- Clients see their own orders.
- Admin sees all orders.
- Provider order-status actions are limited to the Provider's own order lines and company scope.
- Admin can reassign or override workflow state with an audit entry.

## 6. Support Workflow

### Routing rules

| Request context | Initial owner |
|---|---|
| Account, platform, payment, or general help | Admin |
| Product question | Related Provider |
| RFQ or quote question | Related Provider |
| Order or fulfillment issue | Related Provider |
| Provider-company issue | Related Provider |
| Escalation or unresolved provider ticket | Admin |

### Support capabilities

- Providers can read and reply only to tickets routed to their company.
- Admin can read and reply to every ticket.
- Admin can reassign a ticket and record the reason.
- Ticket detail shows routing source, current owner, history, related entity, and escalation state.
- Clients see their own tickets and status updates without seeing internal assignment details they should not access.

## 7. Backend Architecture

### Incremental compatibility

The existing Sales service and API routes remain physically present during the first implementation phase to avoid a large breaking migration. Their behavior changes as follows:

- Add Provider authorization to commercial read/write operations.
- Add server-side company and product ownership filters.
- Preserve Admin-wide access.
- Remove Sales/Staff from active authorization attributes and role resolution.
- Add provider assignment/ownership fields where ownership cannot be derived safely.
- Add routing metadata to support tickets.
- Add migration-safe handling for legacy Sales-assigned records.

### Required backend changes

- Update `UserType` usage and role seeding without prematurely destroying historical data.
- Update Auth profile/registration responses so Sales/Staff is not an active choice.
- Update Sales, Commerce, Content, Product, Attachment, and User Management authorization attributes and handlers.
- Add provider-scoped query predicates to RFQ, quote, order, inquiry, and ticket handlers.
- Add Admin assignment/reassignment endpoints where no safe existing endpoint exists.
- Add migration logic for existing Staff users and legacy commercial records.
- Add tests for cross-company access denial, Admin oversight, unassigned backlog behavior, and support routing.

### Data migration rules

- Never delete historical Sales records during the first release.
- Preserve historical actor IDs and audit timestamps.
- Infer provider ownership from product/company relationships where deterministic.
- Put ambiguous records into an Admin backlog with a visible reason.
- Make migration idempotent and auditable.
- Provide a rollback or dry-run report before applying the migration to shared environments.

## 8. Frontend Architecture

### Shared operations console

Replace the separate Admin and Provider dashboard structures with one shared, role-aware operations shell.

- Keep `/admin` and `/provider` route prefixes during migration.
- Use shared layout, navigation, cards, filters, queue rows, status pills, detail drawers, empty states, and feedback components.
- Render role-specific sections from a single navigation configuration.
- Keep client marketplace and account routes separate.
- Remove `/admin/sales`, Sales navigation, Sales metrics, and Sales-only dashboard branches.

### Admin navigation

- Overview
- Providers
- Clients
- RFQs and inquiries
- Quotes
- Orders
- Support and escalations
- Companies
- Users
- Catalog and categories
- Certifications and documents
- Audit logs

### Provider navigation

- Overview
- Catalog
- Categories
- RFQs and inquiries
- Quotes
- Orders
- Support

### Route and guard behavior

- Admin routes require Admin authorization.
- Provider routes require an approved Provider company.
- A user with no approved company is sent to the pending-company flow.
- Cross-role routes redirect to the user's valid dashboard.
- Unauthorized API responses are handled consistently without exposing other users' data.
- Existing public and client routes remain unchanged unless required by the new workflow.

## 9. Visual System

The merged console refines the current Welco identity:

- Deep navy surfaces and headers
- Teal primary actions and status accents
- White and light-gray work surfaces
- Restrained red, amber, and green state colors
- Clear numeric and table hierarchy
- Compact operational cards and queue rows
- Responsive sidebar with mobile bottom navigation
- Consistent spacing, borders, radius, focus, and feedback states

The design must remain bilingual and RTL-safe.

## 10. Screen State Requirements

Every dashboard section must define:

- First-use or empty state with a role-appropriate action
- Loading skeleton with stable layout
- Error state with retry and support path
- Permission-denied state that does not leak data
- Slow-connection state that preserves filters and shows refresh progress
- Partial-data state that distinguishes unavailable metrics from zero
- Mobile layout that prioritizes primary actions

Status changes that affect another party require confirmation. Reassignment records the previous owner, new owner, actor, timestamp, and reason.

## 11. Validation and Acceptance Criteria

### Backend

- No Sales/Staff role is issued to new users.
- Existing Staff users are converted to Admin by an idempotent migration.
- Providers cannot read or mutate another provider's or client's records.
- Admin can access and reassign all operational records.
- Unresolved commercial records appear in the Admin backlog.
- Support routing follows the confirmed context rules.
- Migration and authorization tests pass.

### Frontend

- Sales role, Sales navigation, and Sales dashboard branches are absent.
- Admin and Provider use the shared operations shell.
- Provider data is visibly and technically scoped to the linked company.
- Admin oversight, reassignment, and escalation actions are available.
- Client flows remain usable and unchanged in scope.
- Loading, empty, error, permission, partial-data, and mobile states are present.
- Type-check, lint, build, and relevant Vitest suites pass.

### End-to-end scenarios

1. Client creates an RFQ -> related Provider sees it -> Provider quotes -> Client approves -> both see the order.
2. Provider handles a product/order support ticket -> Admin can monitor or escalate it.
3. Admin reassigns an unassigned RFQ -> the new Provider sees it and the prior owner loses access.
4. A Provider attempts to access another Provider's record -> request is denied.
5. A migrated Staff user signs in as Admin and retains platform oversight.

## 12. Rollout Plan

1. Add backend ownership and authorization tests around current behavior.
2. Add migration-safe provider ownership and support routing fields.
3. Migrate Staff users and legacy records in a controlled release.
4. Add Provider access to commercial workflows and scoped queries.
5. Introduce the shared frontend operations shell behind role-aware navigation.
6. Remove Sales UI and active role resolution.
7. Run backend tests, frontend type-check/lint/build/tests, and end-to-end scenarios.
8. Deploy backend compatibility changes before or with the frontend release.
9. Monitor unassigned backlog, authorization failures, and support-routing errors after release.

## 13. Non-Goals

- Do not delete historical Sales data in the first release.
- Do not redesign the client marketplace or client account experience beyond integration points required by the new workflows.
- Do not give Providers platform-wide visibility.
- Do not make frontend-only role checks the security boundary.
- Do not introduce a new visual brand.
