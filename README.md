# Al-Arab Restaurant

A full-stack online food delivery application for a single restaurant, with separate customer and admin/kitchen interfaces.

## Tech Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, ShadCN-style UI components, React Query, Zustand persistent cart
- Backend: Node.js, Express, TypeScript, MongoDB Atlas, JWT auth, refresh tokens, Google OAuth-ready routes
- Payments: Razorpay test-mode order creation plus cash on delivery
- Notifications: Nodemailer plus SMS/WhatsApp service placeholders
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

## Current Features

- Restaurant hero with rating, delivery time, delivery fee and restaurant branding
- Searchable and filterable menu with categories, images, availability, reviews and customization options
- Persistent shopping cart with quantity controls, tax, delivery fee and promo code calculation
- Checkout form for address, delivery time, special instructions and payment method
- Razorpay/COD selection and order confirmation flow
- Order tracking timeline, map placeholder, delivery ETA, rider contact and review area
- Account feature surface for login, saved addresses, favorites, history and reorder workflows
- Admin orders management, kitchen display, menu management, settings, analytics, customer management and notifications
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

Copy `.env.example` files in each app before connecting MongoDB, Razorpay, email, SMS, and Google OAuth.
