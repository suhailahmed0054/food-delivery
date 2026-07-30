# Al-Arab Environment Variable Audit

Audit date: 25 July 2026

Scope: all application source, startup/verification/backup scripts, environment
examples, hosting configuration, workflows, authentication, MongoDB, Redis,
Cloudinary, Resend, Capacitor, Razorpay, Twilio, and the package manifests.

No `import.meta.env` or `VITE_*` access exists. The frontend is Next.js, so its
only browser-exposed variables use `NEXT_PUBLIC_*`.

## Production API variables

The “remove” column answers whether a variable can be deleted without removing
or changing a supported feature.

| Variable | Used? File and function | Requiredness and environment | Exposure | Obsolete / safe to remove |
|---|---|---|---|---|
| `NODE_ENV` | Yes. `config/env.ts` selects env files and production validation; `server.ts`, auth middleware/routes, cookie service, local stores, and Next config use it for production-safe behavior. | Production must be `production`; development/test are framework-managed. | Private, non-secret. | Active; no. |
| `PORT` | Yes. `config/env.ts:numericEnv`; `server.ts:startServer`. | Optional in both; defaults to `5000` and is normally host-injected. | Private, non-secret. | Active; may be omitted when the host injects it. |
| `CUSTOMER_APP_URL` | Yes. `config/env.ts` builds `allowedClientOrigins`; `server.ts:isAllowedCorsOrigin`; production verifier. | Required in production; optional locally with localhost default. | Public URL, server-side config. | Active; no. |
| `ADMIN_APP_URL` | Yes. Same CORS and verifier path as `CUSTOMER_APP_URL`. | Required in production; optional locally. | Public URL, server-side config. | Active; no. |
| `API_PUBLIC_URL` | Yes. `scripts/verifyProduction.ts:main` validates the planned origin and readiness path. | Required by the production release gate; not used to serve requests. | Public URL. | Verification-only but active; keep while the planned-domain gate is required. |
| `MONGODB_URI` | Yes. `config/db.ts:connectDatabase`; create-admin, backup, and restore scripts. | Mandatory production runtime and persistent local development. | Secret because it includes database credentials. | Active; no. |
| `MONGODB_DATABASE` | Yes. `connectDatabase`, create-admin script. | Optional; defaults to `alarab`. | Private, non-secret. | Active override; safely omit when using the default. |
| `REDIS_URL` | Yes. `redisService:getRedisClient/createRateLimitStore`; rate-limit middleware; readiness checks. | Optional. Without it, rate limits use process-local memory. Recommended/operationally required when running multiple API instances because counters otherwise are not shared and reset on restart. | Secret connection URL. | Active conditional feature; do not remove if distributed limits are wanted. |
| `JWT_ACCESS_SECRET` | Yes. `tokenService:signAccessToken/verifyAccessToken`. | Mandatory production; development fallback only. | Secret. | Active; no. |
| `JWT_REFRESH_SECRET` | Yes. `tokenService:signRefreshToken/verifyRefreshToken`. | Mandatory production; must differ from access secret. | Secret. | Active; no. |
| `AUTH_SECRET` | Yes. `orderIdempotencyService` HMACs idempotency and deterministic tracking material. | Mandatory production. | Secret. | Active despite its broad name; no rename was made. |
| `OTP_HASH_SECRET` | Yes. `utils/otp.ts:hashOtp`. | Mandatory wherever email OTP is used; mandatory production. | Secret. | Active; no. |
| `RESEND_API_KEY` | Yes. `emailService:sendWithResend`. | Mandatory production because customer authentication is email OTP. | Secret. | Active; no. |
| `EMAIL_FROM` | Yes. `emailService:sendWithResend`. | Mandatory production. Must be an address at the Resend-verified `al-arabrestaurant.cc.cd` domain or a verified subdomain. | Private configuration, not a credential. | Active; no. |
| `ADMIN_EMAIL` | Yes. `scripts/createAdmin.ts:createAdmin` and development-only local admin fallback in `authRoutes`. | Optional during normal production runtime; required only for the one-time seed command. | Private identifier. | Active seed input; remove it from the runtime dashboard after seeding. |
| `ADMIN_PASSWORD` | Yes. `createAdmin` hashes it with bcrypt cost 12; development fallback compares it only when MongoDB is unavailable outside production. | Optional normal runtime; required only for one-time seed/local override. | Secret. | Active seed input; remove it from runtime after seeding. Never stored as plaintext in MongoDB. |
| `ADMIN_SIGNUP_CODE` | No after audit. The public admin registration route/UI was removed. | None. | Former secret. | Obsolete and removed everywhere. |
| `GOOGLE_CLIENT_ID` | No after audit. There was a backend token endpoint but no frontend Google login or client-ID delivery. | None. | Former public identifier. | Incomplete/dead integration; removed with its dependency and model/local-store fields. |
| `RAZORPAY_KEY_ID` | Yes. `razorpayService:getRazorpayClient`; `paymentController:createRazorpayOrder`. | Optional while checkout is COD-only. Mandatory with the other two Razorpay values if online payment is re-enabled. | Public/provider identifier returned to an authenticated checkout. | Active dormant integration; not safe to remove without deleting payment/refund support. |
| `RAZORPAY_KEY_SECRET` | Yes. Razorpay client and `paymentController:paymentSignature`. | Conditional, all-or-none with Razorpay key ID and webhook secret. | Secret. | Active; no. |
| `RAZORPAY_WEBHOOK_SECRET` | Yes. `paymentController:verifyRazorpayWebhook`. | Conditional with Razorpay integration. | Secret. | Active; no. |
| `TRUST_PROXY_HOPS` | Yes. `server.ts` passes it to Express `trust proxy`, affecting secure cookies, IPs, and rate limits. | Required positive integer in production; `0` locally. | Private, non-secret. | Active; no. |
| `MENU_IMAGE_HOSTS` | Yes. `menuController:isApprovedImageUrl` and menu create/update validation. | Optional; defaults to Unsplash and Cloudinary. | Public allow-list. | Active override; safely omit when defaults are correct. |
| `CLOUDINARY_CLOUD_NAME` | Yes. `cloudinaryService:uploadMenuImageToCloudinary`. | Optional integration; required with the other two values when admin menu-image upload is enabled. | Public account identifier. | Active; safely omit only when menu uploads are intentionally disabled. |
| `CLOUDINARY_API_KEY` | Yes. Same upload function. | Optional integration; all three Cloudinary values are validated as a group. | Secret server credential. | Active; safely omit only when menu uploads are intentionally disabled. |
| `CLOUDINARY_API_SECRET` | Yes. Signs Cloudinary uploads. | Optional integration; all three Cloudinary values are validated as a group. | Secret. | Active; safely omit only when menu uploads are intentionally disabled. |
| `RELEASE_SHA` | Yes. `env.releaseSha`; health responses and operational alerts. | Optional; falls back to host `RENDER_GIT_COMMIT`, then `development`. | Public build metadata. | Active optional metadata; safely omit on Render. |
| `SHUTDOWN_TIMEOUT_MS` | Yes. `server.ts:shutdown`. | Optional; defaults to `10000`. | Private, non-secret. | Active override; safely omit. |
| `ALERT_WEBHOOK_URL` | Yes. `operationalAlertService:reportOperationalAlert`. | Optional. Missing value disables outbound operational alerts and no longer fails production validation. | Secret URL/token. | Active optional integration; safely omit when external alerting is intentionally disabled. |
| `TWILIO_ACCOUNT_SID` | Yes. `notificationService:sendSms`, called after order creation. | Optional; all three Twilio values or none. | Secret/account identifier kept server-side. | Active conditional SMS; no. |
| `TWILIO_AUTH_TOKEN` | Yes. Same SMS function. | Conditional with the Twilio group. | Secret. | Active; no. |
| `TWILIO_FROM` | Yes. Same SMS function. | Conditional with the Twilio group. | Private sender number. | Active; no. |

## Web, Android, scripts, and platform variables

| Variable | Used? File and function | Requiredness and environment | Exposure | Obsolete / safe to remove |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes. `web/lib/api.ts:getApiBaseUrl`, Next build validation, web production verifier. | Mandatory production web build; optional local fallback. | Public/browser-exposed. | Active; no. |
| `NEXT_PUBLIC_MENU_IMAGE_HOSTS` | Yes. `next.config.ts:images.remotePatterns`; web verifier. | Optional; defaults include Unsplash and Cloudinary. | Public/browser build config. | Active override; safely omit when defaults are correct. |
| `CAPACITOR_SERVER_URL` | Yes. Capacitor config and `capacitor-dev.mjs`. | Optional for web deployment; required when the Android wrapper must load a remote production/development site. | Public URL. | Active Android-only value; safely omit from Vercel if Android is built elsewhere. |
| `MONGODB_DNS_SERVERS` | Yes. `mongoDns.ts:configureMongoDns`. | Optional DNS workaround; no production default. | Private, non-secret network config. | Active workaround; omit unless required by the host. |
| `RENDER_GIT_COMMIT` | Yes. Host-provided fallback for `RELEASE_SHA`. | Optional and Render-managed. | Public build metadata. | Active host integration; do not manually set. |
| `LOCAL_ACCOUNT_DATA_FILE` | Yes. `localAccountStore` module initialization; tests. | Development/test only. | Private local path. | Active test override; never production. |
| `LOCAL_ORDER_DATA_FILE` | Yes. `localOrderStore:localOrderDataFile`; tests. | Development/test only. | Private local path. | Active test override; never production. |
| `BACKUP_DIR` | Yes. `backupDatabase.ts:main`. | Optional backup command override. | Private local path. | Active tooling; omit for default. |
| `BACKUP_RETENTION_DAYS` | Yes. `backupDatabase.ts:main`. | Optional; defaults to 14. | Private, non-secret. | Active tooling; omit for default. |
| `CONFIRM_RESTORE` | Yes. `restoreDatabase.ts:main` destructive-operation guard. | Required only when intentionally restoring. | Private confirmation token, not a credential. | Active safety guard; no. |
| `DEPLOYMENT_WEB_URL` | Yes. `scripts/smoke-test.mjs:main`. | Required only for deployed smoke tests. | Public URL. | Active verification input. |
| `DEPLOYMENT_ADMIN_URL` | Yes. Same smoke test. | Required only for deployed smoke tests. | Public URL. | Active verification input. |
| `DEPLOYMENT_API_URL` | Yes. Same smoke test. | Required only for deployed smoke tests. | Public URL. | Active verification input. |
| `ALLOW_HTTP_SMOKE_TEST` | Yes. Smoke test protocol policy. | Optional; local testing only and must be absent/false for production checks. | Private, non-secret. | Active test override. |
| `PRODUCTION_WEB_URL`, `PRODUCTION_ADMIN_URL`, `PRODUCTION_API_URL` | Yes. GitHub uptime workflow maps them to deployment inputs. | Required only for that workflow. | Public values stored in Actions configuration. | Active CI inputs. |
| `UPTIME_ALERT_WEBHOOK_URL` | Yes. GitHub uptime failure notification. | Optional workflow integration. | Secret. | Active optional CI integration. |
| `PRODUCTION_MONGODB_URI` | Yes. GitHub backup workflow. | Required only for automated production backup. | Secret. | Active CI secret. |
| `BACKUP_ENCRYPTION_PASSPHRASE` | Yes. GitHub backup encryption. | Required only for automated backup. | Secret. | Active CI secret. |
| `JAVA_HOME` | Yes. `android-build.mjs:firstExisting`. | Optional if Android Studio JBR is auto-detected; Android build machine only. | Private machine path. | Active tooling. |
| `ANDROID_HOME`, `ANDROID_SDK_ROOT` | Yes. Android build SDK discovery. | Optional if SDK is auto-detected; Android build machine only. | Private machine path. | Active tooling. |
| `LOCALAPPDATA`, `ComSpec`, `PWD` | Yes, indirectly in Windows build/root scripts or workflow shell. | OS/runner-provided; never application configuration. | Private machine/runtime metadata. | Do not add to env examples. |

## Removed or confirmed obsolete names

| Variable | Decision |
|---|---|
| `CLIENT_URL` | Removed legacy fallback. Production and development now use the explicit customer/admin origins. |
| `ADMIN_SIGNUP_CODE` | Removed with public admin signup. Admins are seeded through the protected command. |
| `GOOGLE_CLIENT_ID` | Removed because the project had no usable frontend Google sign-in flow. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Not referenced anywhere. Obsolete values may be deleted from ignored local `.env` files; Resend is the implemented mail provider. |
| `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_MAPS_PROVIDER`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Never implemented; removed from stale architecture documentation. Socket.IO uses the origin derived from `NEXT_PUBLIC_API_URL`. |
| `DATABASE_URL`, `DIRECT_DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MAPS_PROVIDER`, `GOOGLE_MAPS_SERVER_KEY` | Future/illustrative architecture names, never runtime configuration; removed from the implemented-env documentation. |

## Provider decisions

### Razorpay

Razorpay is implemented end to end in backend payment creation, capture
verification, signed webhooks, refunds, refund reconciliation, order/payment
models, API client methods, tracking, support, and reporting. Customer checkout
currently sends only `cash_on_delivery`, and settings force online payments off.
The dependency and three variables remain conditional so checkout is not
changed and the dormant implementation is not destroyed.

### Google OAuth

Only a backend `/api/auth/google` endpoint existed. No frontend component loaded
Google Identity Services, obtained an ID token, or called the endpoint. The
endpoint, dependency, config field, local-store helper, and `googleId` schema
field were dead/incomplete and were removed.

### Twilio

`sendSms` is called by `orderController:createOrder` after order creation.
Twilio therefore remains a real optional integration. The unused WhatsApp
function was removed, and missing Twilio configuration no longer logs customer
phone/message content.

### Redis

Redis provides a shared store for all Express rate limits, including OTP,
admin-login, payment, and global API limits. It does not store sessions, carts,
orders, or OTP challenges. Without Redis the same rate-limit middleware uses
process-local memory. This is acceptable for one controlled API instance, but
not equivalent under horizontal scaling. Production startup, readiness, smoke,
and verification now accept the explicit disabled state; a configured but
unreachable Redis instance still fails safely.

### Admin credentials and signup

Public admin signup is removed. Create or rotate an administrator using:

```powershell
npm run create-admin -w apps/api
```

For that one command, provide `MONGODB_URI`, `ADMIN_EMAIL`, and
`ADMIN_PASSWORD` in a protected environment. `createAdmin` hashes the password
with bcrypt cost 12 before MongoDB storage. The schema stores only
`passwordHash`, now excluded from queries by default; login explicitly selects
the hash and uses `bcrypt.compare`. Remove the plaintext seed variables from
the normal runtime dashboard after the command completes.

### Resend sender

Resend requires the `from` address to belong to a verified domain. Once a
domain is verified, Resend permits any address at that domain; a separate
mailbox is not technically required. The validator now accepts only a
syntactically valid address at `al-arabrestaurant.cc.cd` or one of its
subdomains and rejects malformed display-name forms. Dashboard verification
status cannot be proven from an environment string, so it remains a deployment
check. See the official Resend documentation:

- https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend
- https://resend.com/docs/dashboard/domains/introduction

## Minimum recommended production environment

### API runtime

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

To enable persistent admin menu-image uploads, additionally configure
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`
together. When all three are absent, the API starts normally and the protected
upload endpoint returns `503 Image uploads are not configured`.

### Web runtime/build

```dotenv
NEXT_PUBLIC_API_URL=https://api.al-arabrestaurant.cc.cd/api
```

Add Redis, Razorpay, Twilio, alerting, image-host overrides, release metadata,
or Android variables only when those optional capabilities are enabled.
