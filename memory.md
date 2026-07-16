# Project Memory

## Current Project State

**Project:** Al-Arab Food Ordering and Delivery Platform
**Active phase:** Phase 1 - Foundation and Authentication
**Current working file:** None
**Last updated:** 2026-07-13
**Status:** Existing application operational; PostgreSQL and Prisma migration not started

## Important Correction to the Initial Plan

Project initialization is not pending. This repository already contains a working TypeScript monorepo:

- `apps/web`: Next.js customer and administrator application.
- `apps/api`: Node.js and Express API.
- Root npm workspaces coordinate both applications.
- Existing development commands start both applications together.

Do not initialize replacement `client` or `server` projects. Continue using `apps/web` and `apps/api` as specified in `Architecture.md`.

## Completed Documentation

- [x] Product requirements defined in `PRD.md`.
- [x] Target architecture selected in `Architecture.md`.
- [x] Repository and AI coding rules established in `rules.md`.
- [x] Five-phase implementation roadmap defined in `phases.md`.
- [x] UI and UX design system defined in `design.md`.

## Existing Technical Foundation

- [x] npm workspace monorepo initialized.
- [x] Next.js frontend application created.
- [x] Node.js and Express backend created.
- [x] Strict TypeScript configuration exists for web and API.
- [x] Tailwind CSS configured.
- [x] Zustand cart store exists.
- [x] React Query API state management exists.
- [x] JWT and refresh-token authentication foundations exist.
- [x] Google OAuth-ready authentication routes exist.
- [x] Socket.IO server and client foundations exist.
- [x] MongoDB and Mongoose persistence exists.
- [x] Local JSON demo persistence exists when MongoDB is unavailable.
- [x] Razorpay and Cash on Delivery foundations exist.
- [x] Leaflet and OpenStreetMap location selection exists.
- [x] Customer and restaurant-administrator interfaces exist.

## Existing Product Features to Preserve

- Customer welcome and menu routes.
- Searchable menu and category filters.
- Item customization and cart quantity controls.
- Delivery checkout and server-side delivery-radius validation.
- Interactive delivery-address map and current-location selection.
- Cash on Delivery and Razorpay flows.
- Customer profile, saved addresses, orders, reorder, tracking, and support.
- Dine-in table QR ordering and private table-token validation.
- Restaurant online and offline control.
- Live orders, kitchen display, menu management, customers, delivery staff, reports, settings, and support.
- Order sound notification and elapsed-time display.
- Bill and receipt printing controls.
- Socket.IO order tracking and support chat foundations.
- Phone access through private-LAN development URLs.

Do not remove or rewrite these flows while introducing the Phase 1 foundation.

## Current Persistence State

### Current

- MongoDB through Mongoose.
- Local JSON fallback stores for development and demo mode.
- No PostgreSQL dependency is currently configured.
- No Prisma schema or migration currently exists.

### Target

- PostgreSQL as the authoritative relational database.
- Prisma ORM in `apps/api`.
- Tenant-aware User, Restaurant, Membership, Session, and AuditLog models first.
- Incremental domain migration following `Architecture.md`.
- No long-term MongoDB and PostgreSQL dual writes.

## Immediate Next Steps

Follow the one-file-at-a-time workflow in `rules.md`.

- [ ] Confirm local or managed PostgreSQL connection details.
- [ ] Add Prisma dependencies and scripts to `apps/api/package.json`.
- [ ] Add `apps/api/prisma/schema.prisma` with the Phase 1 foundation models.
- [ ] Add PostgreSQL variables to API environment examples.
- [ ] Create and apply the initial Prisma migration.
- [ ] Add deterministic Phase 1 seed data.
- [ ] Add Prisma client lifecycle and database readiness handling.
- [ ] Add User, AuthSession or RefreshToken, OAuthAccount, Restaurant, RestaurantMembership, RestaurantSettings, and AuditLog models.
- [ ] Add shared authentication and role DTO contracts.
- [ ] Migrate authentication reads and writes to PostgreSQL.
- [ ] Add API-enforced restaurant tenancy and role checks.
- [ ] Add customer, restaurant, driver, and platform-admin route guards.
- [ ] Verify authentication, refresh rotation, logout, revocation, and tenant isolation.

## Recommended First Implementation File

Under the approved one-file-at-a-time workflow, begin with:

```text
apps/api/package.json
```

Purpose:

- Add Prisma CLI and Prisma Client dependencies.
- Add database generation, migration, seed, and validation scripts.

Wait for confirmation before creating `apps/api/prisma/schema.prisma`.

## Current Runtime Information

Default local services:

```text
Customer web:  http://localhost:3000
Admin web:     http://localhost:3000/admin
API health:    http://localhost:5000/api/health
```

Start the full project with:

```powershell
npm.cmd run dev
```

Use `npm.cmd` rather than `npm` in Windows PowerShell when script execution policy interferes with `npm.ps1`.

The current Wi-Fi IP can change. Always query the active IPv4 address before giving a phone URL. Do not assume an older LAN address is still valid.

## Environment Notes

- `MONGODB_URI is not set. API will run with demo responses.` is expected in demo mode.
- Browser geolocation requires HTTPS or localhost; phone testing over plain private-LAN HTTP may have browser-specific limitations.
- The web API client derives the API host for private-LAN access.
- Development CORS permits approved localhost and private-LAN origins.
- Socket.IO URL resolution must remain consistent with the shared API URL behavior.
- Do not expose database, JWT, payment, OAuth, or server-side map secrets through `NEXT_PUBLIC_*` variables.

## Current Design Decision

The target design system is documented in `design.md`:

- Primary coral: `#FF5A5F`.
- Secondary amber: `#FFC107`.
- Light background: `#F9FAFB`.
- Primary text: `#111827`.
- Muted text: `#6B7280`.
- Heading font: Poppins.
- Body font: Inter.

The current application has not been fully migrated to this palette. Apply the design incrementally, one confirmed file at a time. Do not perform a global restyle while Phase 1 database and authentication work is in progress unless explicitly requested.

## Architecture Decisions to Preserve

- Use REST for Phase 1.
- Keep Express as the primary API and Socket.IO server.
- Keep one Next.js web application with role-based routing.
- Use server-owned JWT authentication with rotating refresh tokens.
- Use PostgreSQL and Prisma as the target persistence layer.
- Use provider interfaces for Stripe, Razorpay, maps, and notifications.
- Keep server pricing and payment verification authoritative.
- Enforce restaurant tenancy in API services and repositories.
- Store money as integer minor units.
- Persist database changes before publishing real-time events.
- Keep polling fallback for critical active-order views.

## Coding Rules to Remember

- TypeScript only.
- Do not use `any`.
- Functional React components and hooks only.
- Zustand for global client state and React Query for API state.
- Tailwind utilities for new application styling.
- No direct database access from frontend code.
- Validate API input with Zod.
- Forward backend failures to centralized Express error handling.
- Display frontend API failures through the shared toast system.
- Do not delete or rewrite working functions without an explicit requirement.
- Add brief comments only above complex business rules, transactions, or queries.
- Implement complex features one logical file at a time and wait for confirmation.

## Verification Requirements

Before marking a logical step complete:

- Run targeted tests for the changed behavior.
- Run `npm.cmd run typecheck` when source code changes.
- Run production builds for routing, bundling, or deployment changes.
- Verify API authorization and validation when backend behavior changes.
- Verify 320 px mobile and desktop layouts when UI changes.
- Confirm live routes, listeners, and logs for runtime fixes.
- Report anything that could not be tested.

## Active Bugs or Blockers

No new active bug was provided while this file was created.

Known Phase 1 blocker:

- PostgreSQL connection details and environment values are not yet configured.

## Update Instructions

Update this file after every confirmed implementation step:

1. Set the current working file.
2. Move completed items into the completed section.
3. Record any migration, API, environment, or manual setup changes.
4. Record active bugs with reproduction steps and evidence.
5. Keep only the immediate next approved implementation step at the top of the pending queue.
6. Do not mark a task complete based only on code changes; include its verification result.
