# Al-Arab Delivery Platform Implementation Phases

## Document Status

**Version:** 1.0
**Status:** Planned delivery roadmap
**Related documents:** [PRD.md](./PRD.md), [Architecture.md](./Architecture.md), [rules.md](./rules.md)

## 1. Roadmap Principles

- Preserve working customer and restaurant functionality.
- Extend the existing `apps/web` and `apps/api` monorepo instead of creating replacement `client` and `server` applications.
- Implement complex features one logical file at a time, verify the file, and wait for confirmation before continuing.
- Keep the repository runnable at each phase gate.
- Enforce authentication, authorization, restaurant tenancy, pricing, and payment rules in the API.
- Complete database migrations before making dependent features authoritative.
- Do not move to the next phase while critical exit criteria remain incomplete.

## 2. Existing Baseline

The repository is not an empty project. The roadmap must build on these existing capabilities:

- Next.js and Express npm-workspace monorepo.
- TypeScript frontend and backend.
- Tailwind-based customer and administrator interfaces.
- JWT authentication and refresh-token foundations.
- MongoDB/Mongoose models with local JSON demo stores.
- Single-restaurant menu, cart, checkout, dine-in QR, orders, and customer account flows.
- Razorpay and Cash on Delivery foundations.
- Socket.IO order and support events.
- Restaurant order queue, kitchen, menu, table, customer, staff, settings, report, and support modules.
- Leaflet/OpenStreetMap location selection and delivery-radius validation.

Existing code must be audited, reused, migrated, or hardened. It should not be duplicated in parallel modules without a clear migration purpose.

## 3. Current Gap Summary

| Phase | Existing foundation | Main remaining work |
| --- | --- | --- |
| Phase 1 | Monorepo, JWT foundations, customer and admin layouts | PostgreSQL, Prisma, role and restaurant tenancy, complete sessions |
| Phase 2 | Single-restaurant menu CRUD and customer menu | Tenant-aware restaurant CRUD, discovery, filtering, owner profile management |
| Phase 3 | Zustand cart, checkout, Razorpay, delivery validation | Restaurant-scoped cart, Stripe adapter, PostgreSQL order transaction |
| Phase 4 | Socket.IO and restaurant order queue | Authenticated event rooms, dedicated driver portal, assignment lifecycle |
| Phase 5 | Map pinning, tracking status, reports, support | Live driver map and ETA, verified reviews, platform-wide admin, deployment |

---

## Phase 1: Foundation and Authentication

### Objective

Establish the relational, tenant-aware, and secure foundation required by every later phase.

### 1.1 Monorepo Foundation

- Retain root npm workspaces with `apps/web` and `apps/api`.
- Confirm shared development, type-check, build, and test commands.
- Add `packages/contracts` for shared Zod schemas and DTO types when the first cross-app contract is migrated.
- Add consistent TypeScript, linting, formatting, and test configuration.
- Keep web on port `3000` and API on port `5000` for local development.
- Preserve private-LAN API and Socket.IO URL resolution for phone testing.
- Add synchronized root and application `.env.example` files.

### 1.2 PostgreSQL and Prisma

- Provision local, test, staging, and production PostgreSQL databases.
- Install and configure Prisma in `apps/api`.
- Create the initial Prisma migration.
- Add deterministic seed data for development and tests.
- Add database health and migration checks to deployment.

Initial Prisma entities:

- User
- AuthSession or RefreshToken
- OAuthAccount
- Restaurant
- RestaurantMembership
- RestaurantSettings
- AuditLog

Initial roles:

- `CUSTOMER`
- `DRIVER`
- `PLATFORM_ADMIN`
- Restaurant membership roles: `OWNER`, `MANAGER`, `KITCHEN`, `ORDER_STAFF`

### 1.3 Authentication

- Customer, driver, restaurant staff, and administrator signup where permitted.
- Email or phone and password login.
- Google OAuth login through an API-owned identity exchange.
- Secure logout from the current session.
- Logout from all devices.
- Short-lived JWT access tokens.
- Rotating refresh tokens stored in secure, HTTP-only cookies.
- Refresh-token reuse detection and revocation.
- Password reset and account-verification flows.
- Disabled, blocked, and suspended account enforcement.
- Rate limits for signup, login, refresh, verification, and password reset.

### 1.4 Role-Based Access Control

- Central API authorization middleware.
- Restaurant membership and ownership checks.
- Customer resource ownership checks.
- Driver assignment checks.
- Platform-admin permission checks.
- Role-aware frontend route guards and navigation.
- Unauthorized API requests return `401` or `403` without leaking protected data.
- Sensitive actions create audit events.

### 1.5 Shared Layouts

- Public and customer navigation and footer.
- Customer account layout.
- Restaurant dashboard shell with sidebar and header.
- Driver dashboard shell.
- Platform-admin shell.
- Responsive behavior from 320 px through desktop.
- Loading, unauthorized, offline, and unexpected-error boundaries.

### Phase 1 Data Migration

- Import or map existing users into PostgreSQL.
- Create the first Restaurant record for Al-Arab.
- Attach existing administrator and staff users through RestaurantMembership.
- Preserve password hashes only when compatible and secure; otherwise require password reset.
- Keep MongoDB reads available until migrated authentication is verified.
- Do not introduce long-term dual writes.

### Phase 1 Deliverables

- PostgreSQL and Prisma configuration.
- Initial migrations and seed process.
- Working multi-role authentication and session management.
- API-enforced RBAC and basic restaurant tenancy.
- Role-aware frontend layouts.
- Authentication and authorization test suite.

### Phase 1 Exit Criteria

- [ ] A clean database can be created using Prisma migrations and seed data.
- [ ] Customer, restaurant staff, driver, and platform-admin test users can log in and log out.
- [ ] Access tokens expire and refresh-token rotation works.
- [ ] Revoked refresh tokens cannot create new sessions.
- [ ] Each role can access only its approved routes and API resources.
- [ ] Restaurant users cannot access another restaurant's protected data.
- [ ] Mobile and desktop role layouts render without inaccessible controls.
- [ ] Type checking, builds, authentication tests, and tenant-boundary tests pass.

---

## Phase 2: Restaurant and Menu Management

### Objective

Introduce tenant-aware restaurant management and public restaurant discovery while migrating existing menu functionality to PostgreSQL.

### 2.1 Restaurant Backend

- Create restaurant CRUD services and APIs.
- Add restaurant profile, slug, logo, cover image, cuisines, description, contact, address, coordinates, service modes, operating hours, and status.
- Add delivery fee, minimum order, tax, estimated preparation time, and delivery-radius settings.
- Restrict create, edit, suspend, and delete operations by role.
- Use soft deletion or archived status for restaurants with historical orders.
- Add platform-admin approval and suspension controls.

Suggested API surface:

```text
GET    /api/v1/restaurants
GET    /api/v1/restaurants/:restaurantId
POST   /api/v1/restaurants
PATCH  /api/v1/restaurants/:restaurantId
PATCH  /api/v1/restaurants/:restaurantId/status
DELETE /api/v1/restaurants/:restaurantId
```

### 2.2 Menu Backend

- Migrate categories, menu items, sizes, customizations, add-ons, images, prices, and availability to Prisma.
- Attach every category and menu item to one restaurant.
- Add tenant-scoped menu CRUD APIs.
- Validate monetary values as integer minor units.
- Prevent customer access to unpublished or archived items.
- Preserve historical order item snapshots when a menu item changes.

Suggested API surface:

```text
GET    /api/v1/restaurants/:restaurantId/menu
POST   /api/v1/restaurants/:restaurantId/categories
PATCH  /api/v1/restaurants/:restaurantId/categories/:categoryId
DELETE /api/v1/restaurants/:restaurantId/categories/:categoryId
POST   /api/v1/restaurants/:restaurantId/menu-items
PATCH  /api/v1/restaurants/:restaurantId/menu-items/:itemId
DELETE /api/v1/restaurants/:restaurantId/menu-items/:itemId
```

### 2.3 Restaurant Dashboard

- Restaurant profile editor.
- Opening hours and service settings.
- Menu category management.
- Menu item create and edit forms.
- Image upload with validation and preview.
- Size, price, customization, and add-on controls.
- Availability and sold-out controls.
- Clear loading, success, validation, empty, and failure feedback.
- Preserve the existing dashboard shell and visual language.

### 2.4 Customer Restaurant Discovery

- Public restaurant listing page.
- Search by restaurant, cuisine, dish, and keyword.
- Filter by cuisine, rating, delivery time, delivery fee, and open status.
- Sort by relevance, rating, fastest delivery, and fee.
- Restaurant cards show image, cuisines, rating, ETA, fee, distance, and status.
- Individual restaurant page with profile, menu, offers, service modes, and reviews summary.
- Closed and out-of-radius restaurants remain viewable but cannot accept delivery checkout.
- Preserve selected location and restaurant across navigation.

### Phase 2 Data Migration

- Import Al-Arab menu, categories, customizations, tables, and restaurant settings.
- Compare old and new menu responses before switching production reads.
- Remove production dependency on local JSON menu data after successful verification.

### Phase 2 Deliverables

- Prisma restaurant and menu schema.
- Tenant-aware restaurant and menu APIs.
- Restaurant profile and menu dashboard.
- Customer restaurant listing and restaurant menu routes.
- Restaurant discovery search and filters.

### Phase 2 Exit Criteria

- [ ] A platform admin can create and approve a restaurant.
- [ ] A restaurant owner can update only their own restaurant.
- [ ] Restaurant staff can manage menu data according to membership role.
- [ ] Customer discovery supports cuisine, rating, and delivery-time filtering.
- [ ] A restaurant menu never includes another restaurant's private or draft items.
- [ ] Menu price and availability changes are reflected promptly in customer views.
- [ ] Existing Al-Arab menu data is migrated and reconciled.
- [ ] Restaurant and menu integration tests pass.

---

## Phase 3: Customer Journey and Checkout

### Objective

Complete the multi-restaurant customer ordering flow with server-authoritative pricing and secure Stripe payments.

### 3.1 Restaurant-Scoped Cart

- Keep Zustand as the global cart store.
- Associate the cart with exactly one restaurant.
- Add, remove, and update quantities.
- Store item customizations and add-ons.
- Persist safe cart state between refreshes.
- Confirm before clearing the cart when changing restaurants.
- Revalidate item availability, configuration, and price before checkout.
- Do not use browser cart totals as authoritative values.

### 3.2 Checkout Experience

- Customer contact information.
- Saved address selection.
- Interactive map pin and high-accuracy current location.
- Reverse-geocoded address details.
- Restaurant-specific delivery-radius validation.
- Delivery, pickup, and dine-in modes where enabled.
- Delivery-time selection and instructions.
- Server-generated order summary and price quote.
- Promo, tax, fee, discount, and total breakdown.
- Mobile usability at 320 px width.
- Duplicate-submit prevention.

### 3.3 Stripe Integration

- Implement `StripePaymentProvider` behind the payment-provider interface.
- Create Stripe PaymentIntents on the API.
- Use Stripe-hosted payment fields or Elements in the browser.
- Never send secret keys to the browser.
- Verify signed Stripe webhooks using the raw request body.
- Make webhook processing idempotent.
- Store provider references and payment state in PostgreSQL.
- Support Cash on Delivery where enabled.
- Keep Razorpay behind its provider adapter until migration or removal is explicitly approved.

### 3.4 Order Persistence

- Create Order, OrderItem, OrderStatusEvent, Payment, AddressSnapshot, and pricing snapshot models.
- Store money in integer minor units.
- Create orders and order items in a Prisma transaction.
- New confirmed orders start in the appropriate pending state.
- Online orders are not marked paid until provider verification succeeds.
- Require an idempotency key for order and payment creation.
- Preserve restaurant, item, customer, address, and total snapshots.
- Create secure customer tracking credentials.

### 3.5 Customer Confirmation

- Unique order number.
- Order type and restaurant details.
- Item and price summary.
- Payment status.
- Initial status timeline.
- Receipt view.
- Order history and reorder compatibility.

### Phase 3 Deliverables

- Restaurant-scoped Zustand cart.
- Server quote endpoint.
- Delivery-address and checkout flow.
- Stripe test-mode integration and webhooks.
- Transactional PostgreSQL order creation.
- Confirmation, history, and receipt updates.

### Phase 3 Exit Criteria

- [ ] A customer cannot mix items from different restaurants in one cart.
- [ ] Checkout recalculates every price and fee on the server.
- [ ] An out-of-radius delivery is rejected by the browser and API.
- [ ] Stripe success is accepted only after server verification.
- [ ] Replayed checkout and webhook requests do not duplicate orders or payments.
- [ ] Cash and Stripe test orders create correct PostgreSQL records.
- [ ] A successful order appears in customer history and the restaurant queue.
- [ ] Checkout works at 320 px mobile width and common desktop widths.
- [ ] Critical cart, quote, payment, and order tests pass.

---

## Phase 4: Order Management and Driver Flow

### Objective

Connect restaurants, drivers, and customers through secure real-time order operations.

### 4.1 Socket.IO Foundation

- Authenticate every Socket.IO connection.
- Authorize room joins.
- Add user, restaurant, order, driver, support, and platform-admin rooms.
- Publish events only after database changes commit.
- Re-fetch authoritative state after reconnect.
- Keep polling fallback for active operational screens.
- Add request and event correlation IDs.

Core events:

```text
order.created
order.status.updated
order.assignment.updated
driver.location.updated
payment.updated
restaurant.status.updated
```

### 4.2 Restaurant Active Order Queue

- New-order audible and visual notifications.
- Delivery, pickup, and dine-in labels.
- Customer, table or address, items, instructions, payment, total, and elapsed time.
- Valid status-transition controls.
- Delivery flow: Placed, Accepted, Preparing, Ready for Pickup, Out for Delivery, Delivered.
- Pickup flow: Placed, Accepted, Preparing, Ready for Pickup, Collected.
- Dine-in flow: Pending, Preparing, Ready, Served.
- Bill and receipt printing.
- Search and filtering for completed and cancelled orders.

### 4.3 Driver Management

- Delivery driver profile and availability states: Available, Busy, Offline.
- Restaurant or platform driver assignment policies.
- Driver assignment service with transaction-safe acceptance.
- Prevent two drivers from accepting the same assignment.
- Reassignment and cancellation behavior.
- WhatsApp or in-app handoff notification where configured.

### 4.4 Driver Dashboard

- Driver authentication and protected layout.
- Available delivery list according to assignment policy.
- Assigned current deliveries.
- Restaurant pickup details.
- Customer address, map link, phone, instructions, payment type, and total.
- Accept, Arrived at Restaurant, Picked Up, Arrived at Customer, Delivered, and Unable to Deliver actions.
- Confirmation before final completion.
- Completed-delivery history.
- Access only to the driver's eligible or assigned deliveries.

### 4.5 Customer Status Updates

- Live order status timeline.
- Restaurant preparation progress.
- Assigned driver identity and contact controls where allowed.
- Polling fallback during socket failure.
- Clear last-update time.

### Phase 4 Deliverables

- Authenticated and authorized Socket.IO rooms.
- Transactional order-status and assignment services.
- Restaurant live order queue.
- Delivery-driver management and dashboard.
- Customer real-time order status updates.

### Phase 4 Exit Criteria

- [ ] Restaurant staff receive new orders without manual refresh under normal socket conditions.
- [ ] Socket users cannot join unauthorized order or restaurant rooms.
- [ ] Invalid order status transitions are rejected by the API.
- [ ] Only one driver can accept an assignment.
- [ ] Drivers cannot view or update another driver's assigned delivery.
- [ ] Customer tracking updates after restaurant and driver actions.
- [ ] Polling restores current state after socket interruption.
- [ ] Restaurant bills and receipts print correctly.
- [ ] Real-time, assignment, and state-machine tests pass.

---

## Phase 5: Real-Time Tracking, Reviews, Administration, and Launch

### Objective

Complete live delivery visibility, customer trust features, platform oversight, and production readiness.

### 5.1 Google Maps and Driver Tracking

- Add Google Maps through the map-provider abstraction.
- Keep Leaflet/OpenStreetMap available where appropriate.
- Driver explicitly enables location sharing for an active assignment.
- Send coordinates, accuracy, heading, speed, and timestamp at a controlled interval.
- Validate driver identity, assignment, coordinate range, freshness, and update frequency.
- Customer map displays restaurant, driver, route, destination, and last-update time.
- Calculate ETA using the configured routing provider.
- Fall back to status-only tracking when location or routing is unavailable.
- Stop accepting and exposing driver coordinates after delivery, cancellation, or reassignment.
- Retain only the tracking history required for support and policy compliance.

### 5.2 Reviews and Ratings

- Allow reviews only for completed orders.
- Separate food and delivery ratings from 1 to 5 stars.
- Optional written review and approved image upload.
- One customer review per completed order.
- Restaurant rating aggregates.
- Restaurant response to reviews.
- Platform moderation, reporting, hiding, and audit actions.
- Do not allow restaurants to alter customer ratings.

### 5.3 Platform Admin Dashboard

- Platform overview of restaurants, customers, drivers, orders, payments, and support.
- Restaurant approval, suspension, and reactivation.
- User and role administration.
- Payment failure, refund, and reconciliation visibility.
- Support ticket assignment, priority, notes, and resolution.
- Cross-restaurant revenue and operational reports.
- Audit-log search for privileged actions.
- Strict platform-admin API authorization.

### 5.4 Performance and Reliability

- Optimize images and heavy client modules.
- Cache public restaurant and menu data with safe invalidation.
- Add database indexes based on measured query plans.
- Add structured logs, request IDs, metrics, and production error tracking.
- Add health, readiness, and dependency checks.
- Test socket reconnection and provider failures.
- Add database backups and restoration procedures.
- Conduct accessibility and reduced-motion review.
- Test customer and operational pages on real mobile devices.

### 5.5 Deployment

- Deploy Next.js to Vercel.
- Deploy Express and Socket.IO to Render or AWS with persistent connection support.
- Deploy workers separately when background jobs require it.
- Use managed PostgreSQL with encrypted connections and automated backups.
- Configure production Stripe webhooks and Google Maps restrictions.
- Configure HTTPS, strict CORS, secure cookies, and managed secrets.
- Run Prisma migrations as a controlled release step.
- Add staging smoke tests and production rollback instructions.

### Phase 5 Deliverables

- Live driver route and ETA tracking.
- Verified food and delivery review system.
- Platform-admin dashboard.
- Production observability and operational runbooks.
- Staging and production deployments.

### Phase 5 Exit Criteria

- [ ] Customers can see current permitted driver location and ETA during an active delivery.
- [ ] Driver location sharing stops at every terminal or unassigned state.
- [ ] Only customers with completed orders can submit a review.
- [ ] Review aggregates update correctly and moderation is audited.
- [ ] Platform admins can oversee restaurants, users, payments, support, and analytics.
- [ ] Critical customer, restaurant, driver, and admin flows pass end-to-end tests.
- [ ] Performance, accessibility, security, backup, and rollback checks pass.
- [ ] Production Stripe webhooks and Google Maps keys are restricted and verified.
- [ ] Production deployment passes smoke tests.

---

## 4. Cross-Phase Quality Gates

Every phase must satisfy these checks before approval:

- TypeScript type checking passes for web and API.
- New application styling uses Tailwind utilities.
- API input is validated and errors use the standard envelope.
- Authentication, RBAC, and restaurant tenancy are tested where relevant.
- Loading, empty, validation, error, and retry states are implemented.
- Mobile layouts are checked at 320 px and desktop layouts at common widths.
- No direct database access exists in frontend code.
- No secrets are exposed through public environment variables.
- Database migrations are reversible or have a documented recovery procedure.
- Existing Al-Arab customer, dine-in QR, checkout, admin, and LAN/mobile flows remain functional unless an approved phase replaces them.
- Documentation and `.env.example` files are synchronized.

## 5. Recommended Delivery Order Within Each Phase

Follow this sequence for each complex feature:

1. Shared contract or validation schema.
2. Prisma schema and migration when required.
3. Backend repository.
4. Backend service and business rules.
5. Controller and route.
6. Backend tests.
7. Frontend API client.
8. Frontend state or hook.
9. Frontend component or page.
10. End-to-end verification and documentation.

Under `rules.md`, implement and verify one logical file at a time and wait for confirmation before moving to the next implementation file.

## 6. Final Definition of Launch Ready

The platform is ready for launch only when:

- All Phase 1 through Phase 5 exit criteria are approved.
- Production database migrations and seed requirements are documented.
- Payment and refund reconciliation succeeds in test and production-safe validation modes.
- Customer, restaurant, driver, and platform-admin permissions are independently verified.
- Critical order workflows remain correct through network interruption and retry.
- Monitoring, backups, incident response, and rollback procedures are operational.
- The deployed mobile customer flow works over real HTTPS and production APIs.
