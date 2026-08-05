# Al-Arab Restaurant

A full-stack online food delivery application for a single restaurant, with separate customer and admin/kitchen interfaces.

## Tech Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, ShadCN-style UI components, React Query, Zustand persistent cart
- Backend: Node.js, Express, TypeScript, MongoDB Atlas, email-OTP customer auth, bcrypt admin auth, JWT access/refresh cookies
- Payments: Cash on delivery checkout, with dormant Razorpay payment/refund infrastructure available for controlled re-enablement
- Notifications: In-app notifications, Resend email, and optional Twilio order SMS
- Real-time: Socket.io order status events
- Security: Helmet, JWT role middleware, password hashing, API rate limiting, webhook signature verification

## Interfaces

Customer website:

```text
http://localhost:3000
```

Admin and kitchen dashboard:

```text
http://localhost:3000/admin
```

Backend health check:

```text
http://localhost:5000/api/health
```

Temporary local menu database:

```text
apps/api/data/menu-items.json
```

When `MONGODB_URI` is not set, the API also persists table QR tokens and orders in `apps/api/data/tables.json` and `apps/api/data/orders.json`.

## Current Features

- Restaurant hero with rating, delivery time, delivery fee and restaurant branding
- Searchable and filterable menu with categories, images, availability, reviews, sizes, spice levels, and add-ons
- Persistent shopping cart with quantity controls, tax, delivery fee and promo code calculation
- Checkout form for address, delivery time, special instructions and payment method
- Delivery checkout with an address, restaurant takeaway, and address-free dine-in checkout from verified table QR codes
- Ten persistent table records with private QR tokens, pause/activate controls, and token rotation
- Printable SVG QR codes in Admin → Table QR Codes; each opens `/menu?t=<private-token>`
- API-backed paginated/searchable live orders with delivery, takeaway and dine-in workflows
- Cash-on-delivery order confirmation flow
- Order tracking timeline, map placeholder, delivery ETA, rider contact and review area
- Account feature surface for login, saved addresses, favorites, history and reorder workflows
- Admin orders management, kitchen display, menu management, settings, analytics, customer management and notifications
- Persistent menu/support image uploads with Cloudinary replacement and deletion tracking
- MongoDB schemas for users, menu items, orders, payments and reviews

## Run Locally

Install dependencies:

```bash
npm.cmd install
```

Run both apps:

```bash
npm.cmd run dev
```

Or run separately:

```bash
npm.cmd run dev:web
npm.cmd run dev:api
```

Copy the `.env.example` files before connecting MongoDB, Resend, Cloudinary,
optional Redis, optional Razorpay, or optional Twilio SMS.

To create the first administrator, configure the server-only
`ADMIN_SIGNUP_CODE` in `apps/api/.env`, open `/admin/login`, and select
**Create profile**. The API permits this setup only while no administrator
exists. Never expose the code through a `NEXT_PUBLIC_` variable.

## Table QR ordering

1. Open `http://localhost:3000/admin` and select **Table QR Codes**.
2. Download the QR for each table and print it for that table only.
3. A scan opens the normal menu, for example `http://localhost:3000/menu?t=<private-token>`.
4. The API validates the token, stores the resolved table in the browser session, and validates it again when the order is placed.
5. The Admin **Live Orders** screen receives the order as `Dine-in`, shows `Table N`, and uses `Pending → Preparing → Ready → Served`.

In production, table-list, rotate, activate/pause, order-list, and status routes require an admin or kitchen access token. The public resolve route never returns a table’s private token.

## Production launch

Production deployment assets are included for a Vercel web project and a Render API/Redis Blueprint. The API exposes separate liveness and dependency readiness probes, supports graceful shutdown, reports sanitized operational failures to an optional HTTPS alert webhook, and includes Razorpay webhook replay protection.

Run the complete local quality gate with a production-safe `NEXT_PUBLIC_API_URL` configured:

```bash
npm run verify
```

Use [docs/ENVIRONMENT_VARIABLE_AUDIT.md](docs/ENVIRONMENT_VARIABLE_AUDIT.md)
for the full usage/removal analysis,
[docs/PRODUCTION_CONFIGURATION.md](docs/PRODUCTION_CONFIGURATION.md) for the
minimal deployment values, and
[docs/LAUNCH_RUNBOOK.md](docs/LAUNCH_RUNBOOK.md) for managed service setup,
staging validation, Razorpay events, automated uptime checks, backups, restore
drills, release tagging, and rollback. Public launch also requires every item in
[docs/PUBLIC_LAUNCH_CHECKLIST.md](docs/PUBLIC_LAUNCH_CHECKLIST.md).
