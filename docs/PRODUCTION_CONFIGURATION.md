# Al-Arab Production Configuration

The complete usage and removal analysis is in
[`ENVIRONMENT_VARIABLE_AUDIT.md`](ENVIRONMENT_VARIABLE_AUDIT.md). This file is
the short deployment checklist.

## Planned URLs

- Customer: `https://al-arabrestaurant.cc.cd`
- Admin: `https://admin.al-arabrestaurant.cc.cd`
- API origin: `https://api.al-arabrestaurant.cc.cd`
- API base: `https://api.al-arabrestaurant.cc.cd/api`
- Readiness: `https://api.al-arabrestaurant.cc.cd/api/health/ready`

## Minimum API runtime

Copy `apps/api/.env.production.example` into an ignored
`apps/api/.env.production.local` only for local production verification. In
hosting, enter these values in the API service environment dashboard:

```dotenv
NODE_ENV=production
CUSTOMER_APP_URL=https://al-arabrestaurant.cc.cd
ADMIN_APP_URL=https://admin.al-arabrestaurant.cc.cd
API_PUBLIC_URL=https://api.al-arabrestaurant.cc.cd
MONGODB_URI=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
AUTH_SECRET=
OTP_HASH_SECRET=
RESEND_API_KEY=
EMAIL_FROM=Al-Arab Restaurant <login@al-arabrestaurant.cc.cd>
TRUST_PROXY_HOPS=1
```

Generate every signing/HMAC secret independently. Never expose API, database,
JWT, OTP, Cloudinary, Razorpay, Twilio, or webhook credentials through a
`NEXT_PUBLIC_*` variable.

## Minimum web build

```dotenv
NEXT_PUBLIC_API_URL=https://api.al-arabrestaurant.cc.cd/api
```

`NEXT_PUBLIC_MENU_IMAGE_HOSTS` is optional because the reviewed default already
allows Unsplash and Cloudinary. `CAPACITOR_SERVER_URL` is Android-only and is
not required in the normal Vercel web environment.

## Optional integrations

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET`: configure all three to enable persistent admin menu
  image uploads. If all three are omitted, API startup remains available and
  the upload endpoint reports that storage is not configured.
- `REDIS_URL`: shared rate-limit counters. Omit only for a single API instance.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
  `RAZORPAY_WEBHOOK_SECRET`: configure all three when online payment is enabled.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`: configure all three
  when order SMS is enabled.
- `ALERT_WEBHOOK_URL`: operational alert delivery.
- `RELEASE_SHA`: health/alert build metadata; Render supplies
  `RENDER_GIT_COMMIT` automatically.
- `MONGODB_DATABASE`, `MENU_IMAGE_HOSTS`, `SHUTDOWN_TIMEOUT_MS`: optional
  overrides with reviewed defaults.

## Secure admin seeding

There is no public admin-signup route. Temporarily provide `ADMIN_EMAIL` and
`ADMIN_PASSWORD` with the production MongoDB connection, then run:

```powershell
npm run create-admin -w apps/api
```

The command bcrypt-hashes the password before storage. Remove the plaintext
seed inputs from the normal runtime environment after it completes.

## Verification

```powershell
npm run verify:production
```

The command does not print secret values. It connects to MongoDB read-only after
configuration validation. Redis is checked when configured and reported as
intentionally disabled otherwise.
