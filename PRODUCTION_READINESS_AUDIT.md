# Al-Arab Restaurant Production Readiness Audit

Audit date: 24 July 2026  
Source reviewed: `main` at `551962ace1db`  
Audit mode: Read-only. No application code, DNS, deployment, dependency, or production-data changes were made.

> **Environment-minimization update — 25 July 2026:** The original audit below
> is retained as the pre-remediation baseline. Sections 18 and 19 record the
> Phase 1 and Phase 2 work. Section 20 records the latest source-backed
> environment audit and supersedes earlier variable requirements where they
> conflict.

## 1. Executive summary

The project has a substantial working foundation: a responsive customer menu, persistent cart, passwordless email OTP design, HTTP-only cookie sessions, backend price recalculation, guarded admin APIs, atomic order-status transitions, secure order-tracking tokens, Razorpay signature/refund logic, health checks, backup scripts, and a buildable Capacitor Android project.

It is not ready for a controlled real-world beta or a public launch in its current checked-out state.

The main reasons are:

1. `npm audit` reports 8 high-severity vulnerabilities, including the installed Next.js version.
2. The local production release gate fails because the web API URL and several required API production settings are not configured or verifiable.
3. Order creation has no idempotency key or other duplicate-submission protection.
4. The promised takeaway flow does not exist, and the current customer menu does not expose spice-level or add-on choices even though the data model supports them.
5. The Android debug APK builds, but the app has no camera/location permissions, no production release target, no release signing, and still uses the default Capacitor icon and splash screen.
6. The admin dashboard has no usable navigation below the `md` breakpoint.
7. Important live integrations and end-to-end flows were not safely testable: real Resend delivery, live MongoDB/Redis behavior, complete checkout/order creation, every admin mutation, Razorpay, refunds, Cloudinary persistence, and deployed-domain behavior.

### Final conclusions

**NOT READY FOR CONTROLLED REAL-WORLD TESTING**

**NOT READY FOR PUBLIC LAUNCH**

## 18. Phase 1 remediation update

### Scope

Only the four requested Phase 1 areas were changed:

1. production environment verification;
2. duplicate-order/idempotency protection;
3. the eight high-severity dependency findings;
4. admin navigation below 768px.

No deployment, DNS change, production-data mutation, real-secret edit, design
redesign, or unrelated business-flow change was performed.

### Current Phase 1 result

| Phase 1 item | Result | Evidence |
|---|---|---|
| Production verification | **Code fixed; real environment still fails** | The web verifier now loads the same production env files as Next, rejects unsafe URLs, and validates image hosts. The API verifier enters production mode itself and does not run startup data maintenance. A safe temporary HTTPS web configuration passed. The actual local release environment still lacks required web/API production values. |
| Duplicate-order protection | **Fixed and tested** | Customer-scoped hashed idempotency key, request fingerprint, unique partial MongoDB index, deterministic retry tracking token, local fallback serialization, HTTP replay response, changed-payload conflict, persisted checkout-attempt key, and disabled repeated submit. |
| Eight high dependency findings | **Fixed** | `npm audit --json` now reports 0 vulnerabilities at every severity. No forced audit fix was used. |
| Admin navigation below 768px | **Implemented; live viewport proof unavailable** | Mobile drawer preserves the desktop sidebar, exposes all ten sections, traps focus, supports Escape/backdrop/close controls, restores focus, locks background scrolling, and uses touch-sized buttons. Lint, TypeScript, and production build pass. The in-app browser surface was unavailable, so the requested five visual viewport runs could not be completed in this remediation session. |

### Root causes and fixes

#### Production verification

The web verifier read only the parent process environment, while Next normally
loads `.env.production.local`, `.env.local`, `.env.production`, and `.env`.
Consequently, the verifier could reject a configuration that Next would load.
The API verifier had the inverse usability problem: it required the caller to
set `NODE_ENV=production` before importing a module that had already evaluated
the environment. Its database connection also used the normal startup path,
which can run legacy maintenance writes and was inappropriate for a read-only
verification command.

Fixes:

- load the standard production web env files before checking values;
- require an explicit public HTTPS API URL with no credentials, query, fragment
  or loopback host;
- validate the production image-host allowlist;
- enforce the same URL gate during `next build`;
- make the API verification command set production mode before dynamically
  importing configuration;
- load API production env files in a deterministic order without overriding
  host-provided environment values;
- validate MongoDB/Redis protocols and require `CLIENT_URL` to be an exact
  public HTTPS origin;
- connect to MongoDB for verification with startup maintenance disabled;
- keep secret entries blank in example files.

The actual release gate still fails for a legitimate configuration reason.
`apps/web` has no local production env file and therefore no
`NEXT_PUBLIC_API_URL`. The current local API production configuration also
fails these checks:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CLIENT_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `REDIS_URL`
- `ALERT_WEBHOOK_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `TRUST_PROXY_HOPS`

No values were inserted because real secrets and production endpoints must be
provided by the deployment owner. Values that already passed validation were
not printed or changed.

#### Duplicate-order protection

The checkout UI already disabled its button while a request was in progress,
but `POST /api/orders` had no idempotency header, stored request key, unique
constraint, replay lookup, or concurrent duplicate handling. A browser retry,
timeout, or sufficiently fast second request could therefore persist two
orders.

The fixed flow is:

1. The checkout creates a cryptographically random key and keeps it in
   `sessionStorage` until the order response is safely stored.
2. The frontend sends it in the standard `Idempotency-Key` header.
3. The authenticated API validates the key and stores only an HMAC hash scoped
   to the customer.
4. A SHA-256 request fingerprint binds the key to the submitted order details.
5. MongoDB enforces a unique partial index on
   `(customer, idempotencyKeyHash)`.
6. A matching retry returns the original order with HTTP 200 and
   `Idempotency-Replayed: true`.
7. Reusing the key for changed details returns HTTP 409.
8. Concurrent MongoDB duplicate-key races resolve by fetching and returning
   the winning order; notifications are not emitted twice.
9. The development local-order fallback serializes same-file writes and has
   the same replay/conflict behavior.
10. A tracking capability is deterministically regenerated from the customer
    and idempotency key using the server secret; neither the raw key nor the
    plain tracking token is stored in MongoDB.

The API route remains `POST /api/orders`; no second checkout or authentication
system was introduced.

#### Dependency advisory remediation

Initial audit: 8 high, 2 moderate, 1 low (11 total).  
Current audit: 0 high, 0 moderate, 0 low (0 total).

| High finding | Dependency type | Installed before | Fixed resolution | Breaking assessment | Affected area |
|---|---|---:|---:|---|---|
| `axios` | Transitive through Razorpay and Twilio | 1.17.0 | 1.18.1 | Compatible minor security update | API provider clients |
| `brace-expansion` | Transitive development dependency | 1.1.15 and 5.0.6 | 1.1.16 and 5.0.8 | Compatible patch updates within each dependency line | ESLint/TypeScript tooling |
| `concurrently` | Direct development dependency | 9.2.3 | 9.2.4 | Patch update | Local root dev orchestration |
| `js-yaml` | Transitive development dependency | 4.2.0 | 4.3.0 | Compatible minor security update | ESLint configuration loading |
| `next` | Direct production dependency | 15.5.20 | 15.5.21 | Patch update | Entire web application |
| `postcss` | Direct tooling plus Next transitive | 8.4.31 vulnerable Next copy | 8.5.23 through the reviewed root resolution | Compatible 8.x update | CSS compilation |
| `sharp` | Optional Next transitive | 0.34.5 | 0.35.0 through the reviewed Next child override | Technically breaking because Sharp is pre-1.0; retained only after the production build passed | Next image optimization |
| `shell-quote` | Transitive through concurrently | 1.8.4 | 1.9.0 | Compatible minor update | Local dev command parsing |

The safe patch set also cleared the non-high findings:

- Mongoose 8.24.0 -> 8.24.1;
- body-parser 1.20.5 -> 1.20.6;
- tar 7.5.20 -> 7.5.22.

No `npm audit fix --force`, destructive force install, or unreviewed major
framework upgrade was used.

#### Admin mobile navigation

The only admin navigation was an `aside` with `hidden md:flex`; there was no
alternative below 768px. The fix leaves that desktop sidebar unchanged and
adds a `md:hidden` menu control and drawer. The drawer:

- contains Dashboard, Live Orders, Menu Management, Table QR Codes, Delivery
  Staff, Customers, Reviews, Support, Reports, and Settings;
- closes from its explicit close button, backdrop, selected destination, or
  Escape;
- uses `role="dialog"`, `aria-modal`, `aria-controls`, `aria-expanded`,
  `aria-current`, and labelled controls;
- moves focus into the drawer, traps Tab/Shift+Tab, and restores focus;
- prevents document-body scrolling while open;
- includes mobile-accessible admin identity and sign-out;
- keeps the compact header within narrow widths by retaining only essential
  mobile controls.

### Files changed by Phase 1

- `PRODUCTION_READINESS_AUDIT.md`
- `package.json`
- `package-lock.json`
- `apps/api/package.json`
- `apps/api/.env.example`
- `apps/api/.env.production.example`
- `apps/api/src/config/db.ts`
- `apps/api/src/config/env.ts`
- `apps/api/src/scripts/verifyProduction.ts`
- `apps/api/src/models/Order.ts`
- `apps/api/src/controllers/orderController.ts`
- `apps/api/src/services/orderIdempotencyService.ts`
- `apps/api/src/services/localOrderStore.ts`
- `apps/api/src/services/orderTrackingService.ts`
- `apps/api/tests/orderIdempotency.test.ts`
- `apps/web/package.json`
- `apps/web/next.config.ts`
- `apps/web/scripts/verify-production.mjs`
- `apps/web/lib/api.ts`
- `apps/web/app/checkout/page.tsx`
- `apps/web/app/admin/page.tsx`

The worktree contained many earlier user changes before Phase 1; they were
preserved and are not claimed as Phase 1 edits.

### Verification performed

| Check | Result |
|---|---|
| Normal reviewed `npm install` | Passed |
| API tests | Passed, 28/28 |
| Repeated idempotent order attempt | Passed; original order returned |
| Simultaneous same-key order attempts | Passed; exactly one order stored |
| Same key with changed order details | Passed; conflict rejected |
| MongoDB unique index metadata | Passed |
| Web lint | Passed with zero warnings |
| Web and API TypeScript checks | Passed |
| Production web/API build | Passed on Next 15.5.21 using a temporary non-secret `https://api.example.com/api` build value |
| Dependency audit | Passed; 0 vulnerabilities |
| Web production verifier with safe temporary HTTPS configuration | Passed |
| Actual root `verify:production` | Failed: real `NEXT_PUBLIC_API_URL` is not configured locally |
| Actual API production verifier | Failed on the missing/invalid production values listed above; it stopped before connecting and did not mutate data |
| Admin 320/360/375/393/412px browser tests | Not completed because the in-app browser was unavailable |
| `git diff --check` | Passed; only existing line-ending warnings were emitted |

The temporary API URL was used only in the process environment for build and
verifier testing. It was not written as a real deployment endpoint or secret.

### Revised scores

| Category | Weight | Controlled beta | Public launch | Phase 1 effect |
|---|---:|---:|---:|---|
| Core customer workflow | 20 | 17 | 14 | Backend duplicate-order protection added |
| Admin and order management | 15 | 12 | 10 | Mobile navigation implemented; live viewport proof still missing |
| Authentication and security | 15 | 14 | 11 | Dependency audit reduced to zero |
| Backend and database reliability | 15 | 13 | 11 | Unique idempotency index, replay and concurrency handling added |
| Deployment and configuration | 10 | 4 | 3 | Verification logic fixed, but the real configuration still fails |
| Mobile responsiveness and Android | 10 | 6 | 3 | Admin drawer added; Android launch blockers remain |
| Error handling and monitoring | 5 | 3 | 2 | No scope change |
| Performance | 5 | 4 | 3 | No scope change |
| Testing and maintainability | 5 | 4 | 3 | Five idempotency tests added and all gates rerun |
| **Total** | **100** | **77/100** | **60/100** | Improved from 66/100 and 50/100 |

### Remaining controlled-beta blockers

1. Supply the real same-site HTTPS web/API configuration and all required
   production secrets/services, then make `npm run verify:production` pass.
2. Run deployed staging smoke tests for health, CORS, cookies, OTP email,
   checkout, admin processing, customer tracking, cancellation, and refresh.
3. Complete the requested live mobile viewport validation of the admin drawer.
4. If Android is included in the beta, resolve the Android permission,
   production target, branding/signing, and physical-device blockers already
   documented in Sections 11 and 15.
5. Either complete or explicitly de-scope the missing takeaway and customer
   spice/add-on selection flows for the controlled beta.

The Phase 1 source fixes materially improve safety, but the real production
configuration gate and staging evidence have not passed. The revised controlled
beta score remains below 80.

**NOT READY FOR CONTROLLED REAL-WORLD TESTING**

## 19. Phase 2 production-configuration preparation and verification

### Scope and result

Phase 1 remediation was preserved. Phase 2 changed only production
configuration, planned-domain handling, verification/reporting, and supporting
runbooks. No deployment, DNS change, production-data write, real-secret edit,
or fake-secret insertion was performed.

| Phase 2 item | Result | Evidence |
|---|---|---|
| Environment inventory/examples | **Prepared** | Complete application, visibility, format, source, placeholder, and environment matrix in `docs/PRODUCTION_CONFIGURATION.md`; secret examples remain blank. |
| Planned customer/admin/API URLs | **Prepared in code; not deployed** | Examples and Render blueprint use the intended origins. API CORS now explicitly allows customer and admin origins. Admin-domain root redirects to `/admin`. |
| Production verification | **Improved; actual gate still fails** | Root verifier runs both workspaces and labels each missing/invalid input with application, visibility, and expected format without displaying values. |
| Mobile viewports | **Not visually verified** | Local web/API responded, but the connected visual browser was unavailable. No visual pass is claimed. Exact manual steps are in `docs/CONTROLLED_BETA_MANUAL_VERIFICATION.md`. |
| Complete beta order | **Not performed** | No staging deployment/test credentials were available, and production-data mutation was prohibited. |

### Current production configuration result

The prepared public structure is:

- customer: `https://al-arabrestaurant.cc.cd`;
- admin: `https://admin.al-arabrestaurant.cc.cd`;
- API origin: `https://api.al-arabrestaurant.cc.cd`;
- API base: `https://api.al-arabrestaurant.cc.cd/api`;
- Android host: `https://al-arabrestaurant.cc.cd`.

Only public values are shown. All credentials remain outside source control.
`CLIENT_URL` remains a development/backward-compatible fallback; production
requires explicit `CUSTOMER_APP_URL` and `ADMIN_APP_URL`.

The actual web/Android production gate currently reports:

- missing `NEXT_PUBLIC_API_URL`;
- missing `CAPACITOR_SERVER_URL`;
- missing `NEXT_PUBLIC_MENU_IMAGE_HOSTS`.

The actual API production gate currently reports:

- missing `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`;
- missing `CUSTOMER_APP_URL`, `ADMIN_APP_URL`, and `API_PUBLIC_URL`;
- missing `ADMIN_EMAIL` and `ADMIN_PASSWORD`;
- missing `REDIS_URL` and `ALERT_WEBHOOK_URL`;
- missing `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
  `CLOUDINARY_API_SECRET`;
- invalid/missing `TRUST_PROXY_HOPS`.

Other locally configured secret values were not printed or changed. Because
configuration validation stops first, production MongoDB/Redis connectivity is
still unverified. Resend inputs pass structural validation, but no real OTP
receipt from the verified sender was performed.

### URL, CORS, health, and Android review

- Credentialed Express and Socket.IO CORS use the two explicit configured
  origins; no wildcard was introduced.
- Web production build rejects missing, non-HTTPS, credentialed, loopback,
  query-bearing, or fragment-bearing API URLs.
- Android verification requires the planned customer HTTPS origin.
  Private-LAN HTTP remains development-only.
- `render.yaml` uses `/api/health/ready` and contains only non-secret planned
  public URLs; credential values remain host-managed.
- The admin-domain root was locally verified as HTTP 307 to `/admin`.
- Remaining localhost strings are development/test fallbacks or URL parsing
  sentinels and are blocked by the production validators.
- `https://al-arab.local` is a non-network base used only to parse internal
  paths/QR payloads.
- No active outdated Render/Vercel API endpoint was found in runtime code.

### OTP and verifier behavior

`hashOtp` now requires the dedicated `OTP_HASH_SECRET`; it no longer falls back
to `AUTH_SECRET`. Production validates both as independent strong values.

`npm run verify:production` now:

1. runs web/Android and API checks even if the first fails;
2. labels issues `MISSING` or `INVALID`;
3. identifies the application and `PUBLIC`, `PRIVATE`, or `SECRET` exposure;
4. supplies the expected format without displaying configured values;
5. checks planned origins, API `/api` path, Android host, image hosts, CORS,
   secret strength, OTP inputs, and `/api/health/ready`;
6. connects read-only to MongoDB and Redis only after configuration passes;
7. never runs startup database maintenance.

It correctly remains failed. No fake values were used to make it pass.

### Mobile and route evidence

The local web server and API liveness endpoint responded. Route probing found:

| Check | Result |
|---|---|
| `/mobile` | Compiled locally; the first HEAD probe timed out during compilation, and the production build later generated the route successfully |
| `/login`, `/checkout`, `/orders`, `/admin/login` | HTTP 200 |
| Admin host `/` | HTTP 307 to `/admin` |
| `/cart` | No standalone route; cart is an in-page panel |
| `/notifications` | No standalone route; notifications are an in-page panel |

Static inspection confirms Escape handling, focus trap/restore, backdrop/close
controls, and body-scroll locking remain in the Phase 1 drawer. That is not
visual/touch proof. No 320, 360, 375, 393, 412, 768, or 1440px result is
recorded.

### Dependency audit change after Phase 1

The full audit, reconfirmed on 30 July 2026, reports a newly published high-severity
`brace-expansion` denial-of-service advisory in nine transitive,
development-only ESLint paths:

- full `npm audit --audit-level=high`: **9 high**;
- runtime `npm audit --omit=dev --audit-level=high`: **0 vulnerabilities**;
- affected line: latest compatible `brace-expansion@1.1.18` via `minimatch@3.1.5`;
- patched `brace-expansion@5.0.9` is installed for the modern line;
- no patched 1.x or compatible minimatch 3.x release is currently available;
- npm suggests a forced breaking ESLint downgrade, which was not applied.

The production runtime remains clear, but the full dependency gate no longer
passes. A reviewed upstream-compatible release is required.

### Phase 2 files changed

- `.env.example`
- `.github/workflows/production-uptime.yml`
- `README.md`
- `package.json`
- `render.yaml`
- `apps/api/.env.example`
- `apps/api/.env.production.example`
- `apps/api/src/config/env.ts`
- `apps/api/src/scripts/verifyProduction.ts`
- `apps/api/src/server.ts`
- `apps/api/src/utils/otp.ts`
- `apps/api/tests/emailOtpAuth.test.ts`
- `apps/api/tests/otp.test.ts`
- `apps/web/.env.example`
- `apps/web/.env.production.example`
- `apps/web/middleware.ts`
- `apps/web/scripts/verify-production.mjs`
- `scripts/smoke-test.mjs`
- `scripts/verify-production.mjs`
- `docs/PRODUCTION_CONFIGURATION.md`
- `docs/CONTROLLED_BETA_MANUAL_VERIFICATION.md`
- `docs/LAUNCH_RUNBOOK.md`
- `PRODUCTION_READINESS_AUDIT.md`

### Final Phase 2 verification

| Check | Result |
|---|---|
| API tests | **Passed, 28/28** |
| Web lint | **Passed, zero warnings** |
| Web/API TypeScript | **Passed** |
| Production web/API build | **Passed** with the intended public API URL supplied only to the build process |
| Full dependency audit | **Failed: 9 high development-only transitive findings** |
| Runtime dependency audit | **Passed: 0 vulnerabilities** |
| Actual production verification | **Failed on the inputs listed above** |
| API health | **Local liveness passed; deployed readiness not tested** |
| Admin responsive automation | **Unavailable; no visual pass claimed** |
| Complete checkout-to-delivered order | **Not performed** |
| Deployment/DNS/production data | **Not changed** |

### Revised scores

| Category | Weight | Controlled beta | Public launch |
|---|---:|---:|---:|
| Core customer workflow | 20 | 17 | 14 |
| Admin and order management | 15 | 12 | 10 |
| Authentication and security | 15 | 13 | 11 |
| Backend and database reliability | 15 | 13 | 11 |
| Deployment and configuration | 10 | 6 | 4 |
| Mobile responsiveness and Android | 10 | 6 | 3 |
| Error handling and monitoring | 5 | 3 | 2 |
| Performance | 5 | 4 | 3 |
| Testing and maintainability | 5 | 4 | 3 |
| **Total** | **100** | **78/100** | **61/100** |

### Remaining controlled-beta blockers

1. Add genuine production values outside Git and make
   `npm run verify:production` pass.
2. Prove production MongoDB/Redis readiness and deployed CORS/cookie behavior
   on customer and admin domains.
3. Receive and verify one real Resend OTP.
4. Complete every visual/device item in
   `docs/CONTROLLED_BETA_MANUAL_VERIFICATION.md`.
5. Complete one controlled staging order from checkout through delivered and
   verify tracking, notifications, persistence, assignment, and payment state.
6. Adopt an upstream-compatible patched ESLint/minimatch chain when available,
   then restore the full zero-vulnerability audit.

**NOT READY FOR CONTROLLED REAL-WORLD TESTING**

There are no confirmed Critical security vulnerabilities in the inspected code. There are unresolved High development-tool findings and several functional/release blockers.

## 20. Production environment minimization audit

### Scope

All application source, package manifests, startup/verification/backup scripts,
hosting files, workflows, and environment examples were searched for
`process.env`, `import.meta.env`, `NEXT_PUBLIC_`, `VITE_`, dotenv loading,
validation, and provider configuration. The complete per-variable result is in
`docs/ENVIRONMENT_VARIABLE_AUDIT.md`.

No `import.meta.env` or `VITE_*` usage exists.

### Configuration decisions

- Removed the legacy `CLIENT_URL` fallback; customer and admin CORS origins now
  come only from `CUSTOMER_APP_URL` and `ADMIN_APP_URL`.
- Removed incomplete Google OAuth code, `GOOGLE_CLIENT_ID`, the
  `google-auth-library` dependency, and unused Google account fields/helpers.
- Removed public admin signup, `ADMIN_SIGNUP_CODE`, and the corresponding web
  page/client method. Administrators are created by the protected seed command.
- Kept Razorpay because payment, webhook, refund, model, support, and reporting
  code still depend on it. Its three values are conditional while checkout is
  COD-only.
- Kept Twilio because order creation still calls the SMS service. Its three
  values are optional and validated as an all-or-none group. The unused
  WhatsApp helper and development logs containing phone/message data were
  removed.
- Made Redis optional for one API instance. It provides shared rate-limit
  counters only; it does not store sessions, carts, orders, or OTP challenges.
  Configured-but-unreachable Redis still fails readiness.
- Made `ALERT_WEBHOOK_URL`, `RELEASE_SHA`, menu/image-host overrides, shutdown
  timeout, and Android remote URL optional.
- Made `ADMIN_EMAIL` and `ADMIN_PASSWORD` one-time seed inputs rather than
  normal runtime requirements. `createAdmin` hashes the password with bcrypt
  cost 12; `passwordHash` is excluded from normal MongoDB queries and selected
  only for login comparison.
- Strengthened `EMAIL_FROM` validation so production accepts only a valid
  address at the intended Resend-verified restaurant domain or its subdomains.
- Kept MongoDB, four independent authentication/OTP secrets, Resend, the three
  planned application URLs, and trust-proxy configuration mandatory. Cloudinary
  is now an all-or-none optional integration: it is required only when persistent
  admin menu-image uploads are enabled, and an unconfigured upload returns 503.

### Credential containment update (30 July 2026)

- Removed live-looking Cloudinary values from an uncommitted malformed
  `render.yaml` working copy and restored the safe `sync: false` declarations.
- Searched the tracked repository and Git history for non-placeholder
  Cloudinary assignments. No matching credential was found in committed history,
  so a history rewrite is not required.
- Revalidated `render.yaml` as valid YAML and confirmed no tracked secret
  assignment remains.
- A broader history scan found an old MongoDB URI with embedded credentials in
  `apps/api/.env.example`. The URI was blanked from every reachable Git commit,
  rewrite backup refs/reflogs were removed, and the rewritten `main` history was
  force-updated. The database password still requires provider-side rotation.
- Provider-side rotation is required for every credential that appeared in
  plaintext. Rotate Cloudinary credentials in Cloudinary and the Atlas database
  password in MongoDB Atlas, then store replacements only in Render's environment
  dashboard.
- Added sanitized MongoDB connection diagnostics so the next Render failure can
  distinguish authentication, DNS, TLS, permissions, and Atlas network/project
  selection problems without printing the MongoDB URI or password.

### Verification

| Check | Result |
|---|---|
| API tests | **Passed, 28/28** |
| Web lint | **Passed, zero warnings** |
| Web/API TypeScript | **Passed** |
| Production web/API build | **Passed** using the intended public API URL only in the build process |
| Runtime dependency audit | **Passed, 0 vulnerabilities** |
| Full dependency audit | **Failed: 9 high development-only transitive `brace-expansion` findings; the suggested forced breaking downgrade was not applied** |
| Production verification | **Correctly failed on genuine missing values only** |
| Obsolete Google dependency check | **Passed: dependency tree is empty** |
| Patch/whitespace check | **Passed** |

The current production verifier no longer fails for intentionally absent Redis,
alert webhook, admin seed credentials, menu-image override, or Capacitor URL.
It still correctly reports missing web API URL, access/refresh secrets, three
planned API-side URLs, and proxy-hop configuration in the current unchecked-in
local production environment. It reports partially configured Cloudinary values
as invalid but permits all three to be absent. Secret values were not printed.

This environment cleanup does not change the Section 19 beta decision. Real
production configuration, live mobile verification, and a complete controlled
order are still outstanding.

## 21. Repository production-readiness remediation (31 July 2026)

### Scope and decision

This pass implemented the remaining safe repository-level recommendations from
the full audit. It did not deploy services, change DNS, mutate production data,
insert fake credentials, rotate provider credentials, publish an Android
release, or claim unavailable visual/device evidence. Existing fonts, colours,
branding and page structure were preserved.

The repository is substantially safer and more operationally complete, but the
release gate remains closed until genuine production configuration and live
end-to-end evidence exist.

### Remediation completed

#### Restaurant workflows and admin operations

- Added explicit delivery, takeaway and dine-in state machines. Delivery uses
  `placed -> accepted -> preparing -> ready -> out_for_delivery -> delivered`;
  takeaway uses `placed -> accepted -> preparing -> ready -> collected ->
  completed`; dine-in uses `pending -> accepted -> preparing -> ready -> served
  -> completed`.
- Prevented reverse, skipped, terminal, cancelled and role-incompatible status
  transitions. Delivery dispatch now requires an assigned rider.
- Added cryptographically generated, collision-retried display order numbers.
- Added persisted COD payment-received handling with an auditable payment row;
  online, refunded and cancelled orders cannot be marked as cash received.
- Added server-side admin search, status/type filters and bounded pagination
  while retaining the legacy list response for existing consumers.
- Released assigned delivery staff only when an order reaches a true terminal
  state. Reporting, reviews, payment and tracking now understand takeaway,
  collected and completed statuses.
- Removed automatic legacy-refund mutation from every API startup. The repair is
  now an explicit one-time `migrate-legacy-refunds` command.

#### Customer ordering, privacy and accessibility

- Implemented customer selection and checkout handling for delivery, takeaway
  and dine-in without changing the visual theme.
- Exposed the existing menu spice-level and add-on data in the customization
  sheet and preserved size, spice and add-ons as distinct cart lines.
- Completed dialog semantics, Escape handling, body-scroll locking, initial
  focus and keyboard focus containment for customization; cart icon controls
  now have accessible names.
- Removed tracking capabilities and customer PII from persistent saved-order
  storage. Tracking tokens are session-scoped, legacy entries migrate into the
  current session, and saved history is bounded. Cart persistence continues to
  contain only non-sensitive order selections.
- Added consistent browser/API timeouts to prevent provider and application
  requests from hanging indefinitely.

#### Backend security, uploads and health

- Authentication middleware now revalidates the account, role and blocked state
  against MongoDB instead of trusting a still-valid JWT after account changes;
  production fails closed when that check cannot be completed.
- Support evidence is validated and uploaded to the existing Cloudinary
  integration instead of storing Base64 blobs in MongoDB. Partial failures are
  rolled back and text-only support remains available without Cloudinary.
- Menu images now retain managed public IDs and safely delete replaced/deleted
  assets only within the approved Al-Arab folders. Switching to an external URL
  clears the obsolete managed ID.
- Readiness now reports intentionally disabled dependencies accurately and
  returns 503 whenever a configured MongoDB or Redis dependency is disconnected.
- Resend and external geocoding calls have bounded timeouts.

#### Android and release engineering

- Added camera and coarse/fine location permissions and disabled Android
  backups to reduce inadvertent WebView data restoration.
- Added environment-driven Android versioning, protected release signing,
  minification and resource shrinking. Keystores and Android IDE/build artifacts
  are ignored.
- Added `android:release`, which validates the production customer URL, version
  and signing inputs before syncing and building an AAB. It does not contain or
  print secret signing values.
- CI now runs the API test suite and the production-runtime dependency audit.
- Added environment, deployment, launch checklist, rollback and operational
  documentation, and tightened the release verifier to require a clean `main`
  commit exactly synchronized with its upstream.

### Files changed

The remediation changed the following source areas:

- release/CI: `.github/workflows/ci.yml`, `.gitignore`, `package.json`,
  `scripts/release-check.mjs`;
- API configuration/scripts: `apps/api/.env.example`,
  `apps/api/.env.production.example`, `apps/api/package.json`,
  `apps/api/src/config/db.ts`, `apps/api/src/config/env.ts`,
  `apps/api/src/server.ts`, `apps/api/src/scripts/verifyProduction.ts`,
  `apps/api/src/scripts/migrateLegacyRefunds.ts`;
- API order/security/storage: the order, menu, payment, report, review and
  support controllers; authentication middleware; Order, MenuItem, Issue and
  SupportMessage models; order routes; local order, pricing, status, tracking,
  Cloudinary and email services; menu migration and workflow tests;
- web: admin, checkout, mobile menu, customer orders, customer landing,
  geocoding routes, location search, API client, saved orders and the new
  order-type session helper;
- Android: `apps/web/android/app/build.gradle`, Android manifest and
  `apps/web/scripts/android-build.mjs`;
- documentation: `README.md`, `docs/ENVIRONMENT_VARIABLES.md`,
  `docs/DEPLOYMENT_GUIDE.md`, `docs/PUBLIC_LAUNCH_CHECKLIST.md`,
  `docs/ROLLBACK_GUIDE.md`, and the existing environment, production,
  controlled-beta and launch-runbook documents.

Exact changed-file inventory (57 files):

```text
.github/workflows/ci.yml
.gitignore
PRODUCTION_READINESS_AUDIT.md
README.md
apps/api/.env.example
apps/api/.env.production.example
apps/api/package.json
apps/api/src/config/db.ts
apps/api/src/config/env.ts
apps/api/src/controllers/menuController.ts
apps/api/src/controllers/orderController.ts
apps/api/src/controllers/paymentController.ts
apps/api/src/controllers/reportController.ts
apps/api/src/controllers/reviewController.ts
apps/api/src/controllers/supportController.ts
apps/api/src/middleware/auth.ts
apps/api/src/models/Issue.ts
apps/api/src/models/MenuItem.ts
apps/api/src/models/Order.ts
apps/api/src/models/SupportMessage.ts
apps/api/src/routes/orderRoutes.ts
apps/api/src/scripts/migrateLegacyRefunds.ts
apps/api/src/scripts/migrateMenuImages.ts
apps/api/src/scripts/verifyProduction.ts
apps/api/src/server.ts
apps/api/src/services/cloudinaryService.ts
apps/api/src/services/emailService.ts
apps/api/src/services/localOrderStore.ts
apps/api/src/services/orderPricingService.ts
apps/api/src/services/orderStatusWorkflow.ts
apps/api/src/services/orderTrackingService.ts
apps/api/tests/orderStatusWorkflow.test.ts
apps/web/android/app/build.gradle
apps/web/android/app/src/main/AndroidManifest.xml
apps/web/app/admin/page.tsx
apps/web/app/api/location-search/route.ts
apps/web/app/api/reverse-geocode/route.ts
apps/web/app/checkout/page.tsx
apps/web/app/mobile/page.tsx
apps/web/app/orders/page.tsx
apps/web/app/page.tsx
apps/web/components/DeliveryLocationSearch.tsx
apps/web/lib/api.ts
apps/web/lib/order-type-session.ts
apps/web/lib/saved-orders.ts
apps/web/package.json
apps/web/scripts/android-build.mjs
docs/CONTROLLED_BETA_MANUAL_VERIFICATION.md
docs/DEPLOYMENT_GUIDE.md
docs/ENVIRONMENT_VARIABLES.md
docs/ENVIRONMENT_VARIABLE_AUDIT.md
docs/LAUNCH_RUNBOOK.md
docs/PRODUCTION_CONFIGURATION.md
docs/PUBLIC_LAUNCH_CHECKLIST.md
docs/ROLLBACK_GUIDE.md
package.json
scripts/release-check.mjs
```

### Final automated verification

| Check | Result |
|---|---|
| Clean dependency installation | **Passed**: `npm ci --no-audit` completed and `npm ls --depth=0` is consistent |
| API tests | **Passed: 29/29**, including OTP, email delivery contract, session cookies, rate/attempt limits, order idempotency/concurrency and all three fulfilment workflows |
| Web lint | **Passed with zero warnings** |
| Web and API TypeScript | **Passed** |
| Production web/API build | **Passed** using the intended public API URL only in the command environment |
| Runtime dependency audit | **Passed: 0 vulnerabilities** |
| Full dependency audit | **Not green: 9 high development-only transitive `brace-expansion` findings in the ESLint chain** |
| Patch integrity | **Passed**: `git diff --check` reported only Windows line-ending notices |
| Android debug build | **Passed**; debug APK generated successfully |
| Android release guard | **Passed as a guard**: refused to build without version, keystore, signing and production server inputs |
| Actual production verification | **Correctly failed**; genuine required values are still absent and no secret values were displayed |
| Responsive visual/device testing | **Not performed**; the connected browser was unavailable and no physical-device session was provided |
| Complete production-like order | **Not performed**; no deployed staging environment or authorization to create external test data was available |

The full audit finding is not a production-runtime package. The currently
installed compatible ESLint/Next dependency line has no safe patched resolution;
npm proposes a forced breaking ESLint change. That force change was deliberately
not applied. Runtime dependencies remain at zero known vulnerabilities.

### Current production-verification blockers

The actual verifier currently reports these missing values without revealing
configured secrets:

- web/Vercel: `NEXT_PUBLIC_API_URL`;
- API/Render: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CUSTOMER_APP_URL`,
  `ADMIN_APP_URL`, `API_PUBLIC_URL`, and `TRUST_PROXY_HOPS`.

Other locally present values passed structural checks, but that is not evidence
that their hosted values or provider integrations work. After the missing
values are entered in the hosting dashboards, the verifier must connect to the
production MongoDB/optional Redis and the deployed smoke test must prove health,
CORS and authentication-cookie behavior.

Android release additionally requires `ANDROID_VERSION_CODE`,
`ANDROID_VERSION_NAME`, `ANDROID_KEYSTORE_PATH`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, and
`CAPACITOR_SERVER_URL` in a protected local/CI release environment. App icon,
splash, Play Console policy declarations and real-device permission/cookie/back
navigation testing remain release-owner tasks.

### Revised evidence-based scores

| Category | Weight | Controlled beta | Public launch |
|---|---:|---:|---:|
| Core customer workflow | 20 | 18 | 16 |
| Admin and order management | 15 | 14 | 12 |
| Authentication and security | 15 | 14 | 12 |
| Backend and database reliability | 15 | 14 | 12 |
| Deployment and configuration | 10 | 6 | 5 |
| Mobile responsiveness and Android | 10 | 7 | 5 |
| Error handling and monitoring | 5 | 4 | 3 |
| Performance | 5 | 4 | 3 |
| Testing and maintainability | 5 | 4 | 3 |
| **Total** | **100** | **85/100** | **71/100** |

The numerical repository score does not override the release gates. Production
configuration, deployed integration proof, the signed viewport/device matrix,
one complete order through each enabled fulfilment flow, backup/restore evidence
and operational monitoring must pass before real customer traffic is accepted.

**NOT READY FOR CONTROLLED REAL-WORLD TESTING**

**NOT READY FOR PUBLIC LAUNCH**

## 2. Evidence labels

- **Tested and passed**: executed during this audit with a reproducible passing result.
- **Tested and failed**: executed during this audit and did not satisfy the gate.
- **Code inspected only**: implementation was traced, but the action was not executed because it would mutate order/business data or require unavailable external services.
- **Not testable**: required credentials, services, deployment, physical device behavior, or production configuration were unavailable.

## 3. Technology stack and project structure

| Area | Actual implementation |
|---|---|
| Frontend | Next.js 15.5.20 App Router, React 19, TypeScript, Tailwind CSS |
| Client state | Zustand with persisted cart/wishlist; TanStack Query |
| Backend | Node.js, Express 4, TypeScript |
| Database | MongoDB through Mongoose 8 |
| Cache/rate-limit store | Redis in production; fail-closed store behavior |
| Authentication | Customer email OTP; admin bcrypt password; JWT access/refresh tokens in HTTP-only cookies |
| OTP/email | Node `crypto` HMAC + secure random OTP; Resend HTTP API |
| Realtime | Socket.IO |
| Images | Cloudinary for production menu images; approved HTTPS host allowlist |
| Payments | COD currently enabled; Razorpay payment/refund code exists but online payment is forced off |
| Maps/location | Browser geolocation and location search/reverse-geocode routes |
| Mobile | Capacitor 8 Android WebView |
| Web hosting | Vercel configuration and runbook |
| API hosting | Render Blueprint plus Redis |
| CI/operations | GitHub Actions CI, uptime smoke test, encrypted MongoDB backup workflow |

### Key entry points

| Purpose | File |
|---|---|
| Customer landing page | `apps/web/app/page.tsx` |
| Main ordering UI | `apps/web/app/mobile/page.tsx` |
| Checkout | `apps/web/app/checkout/page.tsx` |
| Customer orders/tracking | `apps/web/app/orders/page.tsx` |
| Admin UI | `apps/web/app/admin/page.tsx` |
| Backend server | `apps/api/src/server.ts` |
| Database connection | `apps/api/src/config/db.ts` |
| Environment validation | `apps/api/src/config/env.ts` |
| Frontend API client | `apps/web/lib/api.ts` |
| Cart persistence | `apps/web/store/cart-store.ts` |
| Order controller | `apps/api/src/controllers/orderController.ts` |
| Order workflow rules | `apps/api/src/services/orderStatusWorkflow.ts` |
| Capacitor config | `apps/web/capacitor.config.ts` |
| Android app config | `apps/web/android/app/build.gradle` |
| Render configuration | `render.yaml` |
| Vercel configuration | `apps/web/vercel.json` |
| Launch runbook | `docs/LAUNCH_RUNBOOK.md` |

### Environment files

- `apps/api/.env.example`
- `apps/api/.env.production.example`
- `apps/web/.env.example`
- `apps/web/.env.production.example`
- Local `.env` files are excluded by `.gitignore`.
- No tracked `.env`, private key, keystore, or obvious production secret was found by the safe tracked-file scan.
- Secret values were not read into or reproduced in this report.

## 4. Readiness scores

Scores are earned points out of each category's fixed weight.

| Category | Weight | Controlled beta | Public launch | Evidence-based rationale |
|---|---:|---:|---:|---|
| Core customer workflow | 20 | 15 | 13 | Browse/search/cart/checkout guard and server repricing passed. Takeaway, add-ons/spice selection, idempotency, and a complete real order were not complete/proven. |
| Admin and order management | 15 | 11 | 9 | Desktop dashboard and guarded APIs work; workflow rules have tests. Mutating admin actions were inspected only. Mobile navigation, order search/filter/pagination, payment-received, and takeaway are missing. |
| Authentication and security | 15 | 11 | 8 | OTP controls, JWT/cookies, role guards, headers, rate limits, tracking tokens, and upload checks are strong. High dependency advisories and local tracking/PII storage reduce the score. |
| Backend and database reliability | 15 | 11 | 9 | Repricing, indexes, optimistic order updates, webhook/refund idempotency, health and shutdown are present. Order creation is not idempotent; live Mongo/Redis were unavailable; support evidence is stored as Base64. |
| Deployment and configuration | 10 | 3 | 2 | Build/config/runbook assets exist, but both production verification and release checks fail locally. Deployed HTTPS/CORS/domain/Atlas behavior is unproven. |
| Mobile responsiveness and Android | 10 | 5 | 2 | Customer routes are responsive and a debug APK builds. Android lacks required permissions, branding, production target, release signing, and verified WebView workflows. Admin mobile navigation is inaccessible. |
| Error handling and monitoring | 5 | 3 | 2 | Health probes, safe API errors, rate limiting, uptime workflow, and alert webhook support exist. No verified production monitoring, no general frontend request timeout, and no provider/deployment drill were demonstrated. |
| Performance | 5 | 4 | 3 | Reasonable first-load bundles, menu caching, indexes, image optimization and pagination on some modules. No load test; orders load a fixed 100; Base64 evidence can inflate MongoDB. |
| Testing and maintainability | 5 | 3 | 2 | 23 API tests, lint, typecheck and builds pass. No frontend/component/E2E tests; no order/payment integration suite; CI omits API tests; admin page is a large monolith. |
| **Total** | **100** | **66/100** | **50/100** | Both are below the requested 80% threshold. |

### Score decision

- Real-world beta readiness: **66%**
- Public production launch readiness: **50%**
- Is the project at least 80% complete for launch? **No.**
- The most relevant "actual completion" number against the requested production target is **50% public-launch ready**.

## 5. Tests performed

| Check | Result | Evidence/important warning |
|---|---|---|
| `npm.cmd test -w apps/api` | **Tested and passed** | 23/23 tests passed. Covers OTP security/auth routes, Resend message composition, and order-status transition rules. |
| `npm.cmd run lint` | **Tested and passed** | ESLint completed with zero warnings/errors. |
| `npm.cmd run typecheck` | **Tested and passed** | Web and API TypeScript checks passed. |
| `npm.cmd run build` | **Tested and passed** | Next production build generated 27 routes; API TypeScript build passed. |
| `npm.cmd audit --json` | **Tested and failed** | 11 advisories: 8 high, 2 moderate, 1 low, 0 critical. |
| `npm.cmd run verify:production` | **Tested and failed** | Web gate: `NEXT_PUBLIC_API_URL` is missing from the current release environment. |
| API verification with `NODE_ENV=production` | **Tested and failed** | Current local release environment fails JWT, client URL, admin, Redis, alert webhook, Cloudinary and proxy-hop validation. This does not prove the hosted environment is missing them; it proves no passing release evidence is available here. |
| `npm.cmd run release:check` | **Tested and failed** | Worktree is not clean. Many existing modified/untracked files prevent an exact-SHA release check. |
| Compiled API startup on port 5051 | **Tested and passed in development mode** | Server started, health endpoints responded, then shut down gracefully. MongoDB was disconnected and development fallback data was used. |
| `/api/health/live` | **Tested and passed** | HTTP 200. |
| `/api/health/ready` in development | **Tested with warning** | HTTP 200 while reporting MongoDB and Redis disconnected. Production code is stricter, but development readiness can be misleading. |
| Unauthorized API probes | **Tested and passed** | Customer session, admin session, order list/create, and admin review endpoints returned 401. Legacy customer password endpoint returned 404. |
| CORS probe | **Tested and passed locally** | Allowed local origin received ACAO; an unrelated origin did not. |
| Security headers | **Tested and passed locally** | `nosniff`, frame `DENY`, HSTS and strict referrer policy present. |
| Server-side price manipulation probe | **Tested and passed** | Client submitted unit price 0; server returned actual unit price 449 and recalculated totals. |
| Customer browser workflow | **Tested and passed locally** | Category filtering, search, size selection, add/update/remove cart, persisted cart, checkout redirect and return message. |
| Checkout direct access | **Tested and passed locally** | Logged-out `/checkout` redirected to `/login?returnTo=%2Fcheckout` without showing checkout content. |
| Cart refresh persistence | **Tested and passed locally** | Cart survived the login-page refresh after checkout redirect. |
| Responsive routes | **Tested and passed with exceptions** | Customer routes checked at 320, 360, 375, 393, 412, 768 and 1440px. No global horizontal overflow. Category chips intentionally overflow inside their scroll container. |
| Admin local authentication/session | **Tested and passed locally** | Demo-only admin API login and `/auth/me` passed. Admin session was logged out at the end. |
| Admin dashboard rendering | **Tested and passed on desktop/mobile viewport** | Dashboard data and notification panel rendered. Mobile navigation defect documented below. |
| Notification readability | **Tested and passed locally** | Unread light cards had dark readable text and orange dots; read dark cards remained readable. |
| `npm.cmd run android:build` | **Tested and passed** | Debug APK assembled successfully. Gradle emitted deprecated-option and `flatDir` warnings. |
| Physical Android checkout, camera, location, cookies and back button | **Not testable** | No connected device test was performed, and the merged manifest lacks camera/location permissions. |
| Real Resend OTP | **Not testable safely** | Automated tests mock delivery; no real external email was sent during the audit. |
| Live MongoDB/Redis/Cloudinary/Razorpay/refund flow | **Not testable** | Required verified production/staging services were unavailable. |
| Full order/admin lifecycle | **Code inspected only** | Existing local restaurant orders were not mutated during an audit-only pass. Transition unit tests passed, but this is not an end-to-end database test. |

PowerShell initially blocked `npm.ps1` under the host execution policy. Checks were rerun through `npm.cmd`; this was a host-shell issue, not a project failure.

## 6. Customer workflow findings

### Working

- Homepage and `/mobile` load locally.
- Menu loads from the API; the UI has a static fallback when the API is unavailable.
- Category filtering works.
- Search works and displays matching dishes.
- Product images rendered in the audited viewport.
- Size/portion selection works.
- Guest cart add, quantity update, item removal, total animation and local persistence work.
- Guests can browse and use the cart before signing in.
- Checkout is protected without a content flash.
- Safe internal `returnTo` validation prevents open redirects and login loops.
- The cart survives checkout redirection and refresh.
- Backend ignores client prices and recalculates menu prices, options, discounts, tax and fees.
- Deleted/unavailable/changed menu options are rejected by server-side quote logic.
- Delivery location is validated server-side against the restaurant radius.
- Dine-in table tokens are securely generated, resolved and revalidated.
- Order tracking uses a 256-bit random token; only its SHA-256 hash is stored.
- Customer cancellations check ownership/tracking token and use an atomic allowed-status filter.
- Reviews require ownership/tracking capability and a completed order.
- Support routes use customer ownership or the tracking capability.

### Partial

- Email OTP is well implemented and tested, but real Resend delivery/domain configuration was not exercised.
- Session/refresh/logout code is strong, but deployed cross-domain cookie behavior was not proven.
- Successful order confirmation and tracking are implemented, but a new real order was not placed during the audit.
- Dine-in exists, but its admin completion label is `Delivered`, not `Served/Completed`.
- Online payment/refund code exists, but restaurant settings force COD-only and checkout only creates COD orders.
- API errors generally reach UI messages, but API calls have no common client timeout/abort policy.
- Menu API failure silently falls back to bundled demo items. This maintains browsing but can hide an outage or show stale products/prices until checkout.

### Broken or missing

- There is no takeaway order type in the frontend schema, API validation, order model, or status workflow.
- Customer UI does not let a user choose spice level or add-ons. It always chooses the first/default spice level and sends an empty add-on list.
- Order creation has no idempotency key, unique client request ID, or backend replay protection.
- Order numbers use time plus `Math.random()` and rely on the unique database index; duplicate-key retry is absent.

## 7. Authentication and security audit

### Strong controls found

- OTP uses `crypto.randomInt()` and HMAC-SHA256.
- Only OTP hashes are stored; OTPs expire in five minutes.
- OTP resend cooldown, request limits, attempt limits, one-time consumption and older-challenge invalidation are implemented.
- OTP endpoints use generic responses to reduce account enumeration.
- Customer and admin access/refresh tokens have issuer, audience and HS256 algorithm checks.
- Production cookies are `Secure`, HTTP-only, `SameSite=Strict`, path `/`, with `__Host-` names.
- Refresh tokens are rotated and their hashes are stored.
- Customer requests re-check that the account exists and is not blocked.
- Admin, kitchen and customer roles are enforced on API routes.
- Public tracking/support/review access requires an unguessable tracking token.
- Zod validation is used on high-risk inputs.
- CORS is origin-restricted.
- Helmet and explicit web security headers are enabled.
- Request logs redact token/tracking-style query parameters.
- Menu uploads are admin-only, limited to 3 MB, allow only JPEG/PNG/WebP, validate magic bytes, and store through Cloudinary.
- Menu image URLs require HTTPS and an approved hostname.
- Razorpay verification checks HMAC signature, provider state, amount, currency, order ID and captured state.
- Webhook/refund processing includes event/idempotency records.
- Print-receipt HTML escapes dynamic values.

### Findings

| Severity | Affected area | Finding | Why it matters | Recommended fix |
|---|---|---|---|---|
| **High** | `package-lock.json`, `apps/web/package.json`, `apps/api/package.json` | Dependency audit reports 8 high advisories. Directly relevant packages include Next 15.5.20; Mongoose has a moderate prototype-pollution advisory. Axios/sharp advisories are transitive. | Known vulnerable release dependencies are a public-launch blocker and make CI fail. | Upgrade Next to at least the patched 15.5.21 line or a supported newer release, Mongoose to at least 8.24.1, and refresh affected transitives. Review changes and rerun all gates; do not use blind force upgrades. |
| **High, configuration-dependent** | `apps/api/src/services/authCookieService.ts`, `apps/web/lib/api.ts`, deployment domains | `SameSite=Strict` cookies require the frontend and API to be same-site. A Vercel/custom frontend calling a raw `onrender.com` API is cross-site and authentication cookies will not work. | Login can appear successful while protected requests fail, especially in WebView. | Use a same-site API hostname such as `api.al-arabrestaurant.cc.cd`, configure HTTPS/CORS exactly, and verify WebView cookie persistence. Otherwise redesign cookie attributes and CSRF defenses deliberately. |
| **Medium** | `apps/web/app/checkout/page.tsx`, `apps/web/app/orders/page.tsx`, `apps/web/lib/saved-orders.ts` | Full order details, precise coordinates, phone/email/address and the capability tracking token are persisted in localStorage. | Any successful same-origin XSS can read this data; shared devices retain personal order data. | Persist only the minimum order reference, prefer account-backed order history, define expiry/cleanup, and avoid retaining precise coordinates/PII. Treat the tracking capability as sensitive. |
| **Low** | Cookie-authenticated state-changing routes | There is no explicit CSRF token. `SameSite=Strict` plus strict CORS provides meaningful protection. | Defense weakens if cookie/domain settings are relaxed to make cross-site hosting work. | Keep same-site deployment. If `SameSite=None` is ever required, add synchronizer/double-submit CSRF protection and strict Origin validation first. |
| **Low** | `apps/api/src/middleware/auth.ts` | General admin JWT checks do not re-query `isBlocked` on every access request. | A blocked admin access token can remain valid until its short expiry. | Revalidate privileged users or maintain a token/session version for immediate revocation. |
| **Low** | Cart modal controls | Cart close, plus and minus icon buttons have no accessible label. | Screen-reader and voice-control users cannot identify the controls reliably. | Add `aria-label` values without changing design. |

No hard-coded production key/password/database URL, plain OTP storage, customer access to admin APIs, obvious NoSQL injection, unbounded menu upload, unescaped receipt HTML, or backend price trust was found.

## 8. Admin and order-management findings

### Working or strongly implemented

- Admin login endpoint uses bcrypt and production configuration rejects weak/missing admin credentials.
- Admin pages and every sensitive admin API inspected have role guards.
- Dashboard, live order cards, menu management, table QR, delivery staff, customers, reviews, support, reports and settings modules exist.
- Individual review comments are available to the admin with pagination/search/rating filters.
- Status buttons use one normalized API format:
  - `pending`
  - `placed`
  - `accepted`
  - `preparing`
  - `ready`
  - `ready_for_pickup`
  - `out_for_delivery`
  - `served`
  - `delivered`
  - `cancelled`
- Delivery transition unit test:
  - `placed/pending -> accepted -> preparing -> ready -> out_for_delivery -> delivered`
- Invalid jumps and changes after delivered/cancelled are blocked.
- Status changes use an optimistic `findOneAndUpdate` condition on the old status, preventing two admins from silently overwriting each other.
- UI waits for API success before changing local order status and shows backend errors.
- Delivery assignment validates order type and staff availability.
- Delivery staff are returned to available after delivery/cancellation.
- Customer tracking and notifications receive status changes through Socket.IO plus five-second admin polling fallback.
- New-order and customer-cancellation sound detection exists. Browser autoplay is handled by an explicit enable control.
- Receipt values are escaped before `document.write`.

### Missing or incomplete

- There is no separate Reject action; Cancel is the rejection mechanism.
- There is no Mark Payment Received action. COD orders remain `paymentStatus: pending`.
- No takeaway flow exists.
- Dine-in completes as `delivered`; `served` exists in the enum but is not reachable from the admin transition table.
- Live Orders has no search, filters or pagination and loads up to 100 orders.
- No dedicated order-details action exists; all details are expanded in cards.
- Category values are a fixed enum; there is no separate category CRUD module.
- Full status mutation, delivery assignment, menu CRUD, image upload, print, sound and refresh persistence were inspected but not mutated/tested end-to-end during this read-only audit.
- On screens below 768px, the only admin navigation is `hidden md:flex` and there is no mobile menu replacement. Admin users can see the dashboard but cannot navigate to Live Orders or other modules.

## 9. Backend and database audit

### Positive findings

- Production startup fails closed when MongoDB or Redis is unavailable.
- MongoDB selection timeout is 10 seconds.
- Redis-backed rate limiting fails closed on store errors.
- Separate liveness and readiness endpoints exist.
- Graceful SIGTERM/SIGINT shutdown is implemented.
- Request IDs and structured operational alerts are supported.
- JSON body limits vary by route and default to 1 MB.
- Order, user, review, OTP, notification, payment and refund uniqueness/indexes cover important lookups.
- Order totals are server-derived.
- Order status and customer cancellation use atomic conditional updates.
- Payment has a unique `(order, provider)` index.
- Refunds have unique provider and idempotency keys.
- OTP has TTL and a partial unique active-challenge index.
- Admin reviews/support have pagination.
- Backup and destructive restore scripts exist; restore requires an explicit confirmation value.
- GitHub workflow creates encrypted daily logical backups with 14-day artifact retention.

### Risks and gaps

| Severity | Area | Finding | Recommendation | Effort |
|---|---|---|---|---|
| **High** | Order creation | No idempotency/replay key. Repeated submit/network retry can create multiple payable orders. | Require a client-generated idempotency key, store it with a unique customer-scoped index, and return the original response on replay. | Medium |
| **Medium** | Order number | Time suffix plus `Math.random()` can collide; duplicate-key errors are not retried. | Generate with `crypto`/UUID or retry on unique-index conflict. | Small |
| **Medium** | Support evidence | Up to four 1 MB Base64 images can be embedded in Issue and SupportMessage documents. | Upload evidence to Cloudinary/object storage; store URLs and metadata. Keep a strict total request limit. | Medium |
| **Medium** | Data retention/privacy | Orders, support messages, notifications and saved local order data have no documented retention/deletion policy. | Define retention, account deletion/export, notification cleanup, and support-evidence lifecycle. | Medium |
| **Medium** | Production dependencies | Live MongoDB/Redis connection, failover and reconnection were not verified. | Run production verification in staging and perform controlled dependency interruption tests. | Medium |
| **Low** | Development readiness | `/health/ready` returns 200 in development while explicitly reporting DB/Redis disconnected. | Consider 503 whenever required dependencies are absent, or make the development behavior unmistakable to monitors. | Small |
| **Low** | Startup migration | Database connection performs a legacy refund-status quarantine update on startup. | Move one-time data corrections into a versioned migration with audit output. | Small |

### MongoDB Atlas Free assessment

MongoDB Atlas Free is sufficient for a small, controlled test if:

- traffic and order volume are low;
- support Base64 evidence is disabled/moved out of MongoDB;
- logical backups are run and restore-tested;
- connection limits and storage are monitored;
- the beta can tolerate shared-tier latency and no production SLA.

It should not be the sole public-production data strategy. A public launch needs verified backups/restore, monitoring, capacity headroom and a paid tier appropriate to the restaurant's recovery requirements.

## 10. Deployment findings

### Present

- Vercel and Render deployment files.
- HTTPS enforcement in production environment validation.
- Strict CORS origin configuration.
- production-only required secret validation.
- liveness/readiness probes.
- Render Redis resource.
- smoke-test script for API, CORS, protected routes, webhook rejection and web headers.
- launch, backup, rollback and staging runbook.
- CI lint/typecheck/build/audit workflow.
- uptime and encrypted backup workflows.

### Blocking or unverified

- Current web production verification fails because `NEXT_PUBLIC_API_URL` is not configured.
- Current API production verification fails before it can connect to services.
- The worktree is dirty and includes a large untracked Android platform. The release check cannot bind a deployment to a clean commit.
- Deployed web/API URLs were unavailable, so HTTPS, CORS, headers, health, cold starts and custom-domain routing were not tested.
- `NEXT_PUBLIC_API_URL` falls back to `http://localhost:5000/api` locally and to `https://current-host:5000/api` for a non-loopback browser. The production verifier correctly blocks a missing explicit value, but bypassing that gate would break deployment.
- API CORS supports one `CLIENT_URL`. Separate customer and admin origins/subdomains require an explicit origin list or a single shared origin.
- The authentication cookie plan needs a same-site custom API hostname.
- MongoDB Atlas IP allowlisting/network restriction cannot be verified from source.
- Render cold-start behavior is not measured. The configured starter service may sleep or throttle depending on the current plan.
- The runbook says API production verification checks Razorpay credentials, but the script only connects to MongoDB and Redis after validating presence of environment values; it does not call Razorpay.
- README documentation has drift (for example, it mentions Nodemailer while the implementation uses Resend).
- CI does not run `npm test -w apps/api`.

## 11. Android/Capacitor findings

### Internal APK testing

**Debug APK compilation: ready. Complete restaurant workflow: not ready.**

Evidence:

- Capacitor Android debug build passed.
- `INTERNET` permission exists.
- HTTPS production server URLs are accepted; private-LAN HTTP is limited to development.
- Customer web routes have safe-area CSS and no global overflow at audited widths.
- HTTP-only cookies should be compatible with a same-site HTTPS WebView deployment, but persistence was not verified on a physical device.

Blockers:

- The merged manifest contains no `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, or `CAMERA` permission.
- Delivery checkout requires a precise location; table QR scanning requires camera access.
- There is no configured production `CAPACITOR_SERVER_URL`. Without it, the packaged `capacitor-shell/index.html` only displays a development-server-not-configured message.
- Default Capacitor icon and splash assets are still present.
- No physical-device tests for keyboard, back navigation, cookie persistence, file/image behavior or denied permissions were performed.
- There is no native push notification setup or Android 13+ notification permission; the current feature is an in-app/web notification center, not reliable background push.

### Public Play Store release

**Not ready.**

- No release signing configuration or verified keystore process.
- Release build is not minified.
- Version code remains 1 and there is no versioning/release procedure.
- Default Capacitor branding remains.
- Production WebView URL/API/cookie behavior is unverified.
- Required runtime permissions and user flows are missing.
- Store privacy/data-safety declarations and physical-device test matrix are not documented.
- Android generated files are largely untracked in the current worktree; `.idea` is also untracked and should not become release source.

## 12. UI/device findings

### Tested viewports

- 320px
- 360px
- 375px
- 393px
- 412px
- 768px tablet
- 1440px desktop

### Passed

- Customer home/menu, offers, login, register, support, empty orders and admin-login routes had no document-level horizontal overflow at 320/412px.
- Main customer menu had no document-level overflow at all five requested phone widths.
- Category tabs overflow only inside the intended horizontal scroll container.
- Hero title, offer card, header controls and menu action buttons were visible at an accurately emulated 320px viewport.
- Login layout and checkout message fit at 320px.
- Empty orders state fit at 320px.
- Customer routes checked at 768px had no global overflow.
- Admin dashboard and notifications remained readable at 393px.

### Failed/partial

- Admin mobile navigation is missing below 768px.
- Cart icon-only close/quantity buttons lack accessible names.
- Customization picker has no dialog role/focus-management evidence.
- Authenticated checkout, populated order tracking, address modal, support chat, print window and every admin module were not visually tested at every breakpoint.
- Notification "mark read" state changes were not executed because they mutate data; readability and controls were inspected.

## 13. Reliability scenarios

| Scenario | Assessment |
|---|---|
| Slow internet | Loading states exist in major forms. No common fetch timeout means requests can hang until browser/network failure. |
| Backend unavailable | Menu falls back to demo data; admin retains last verified list and shows an error. Checkout/order calls show errors. Fallback menu can hide an outage/stale data. |
| Database unavailable | Production startup/readiness fail closed. Development uses local demo data. |
| API timeout | Cloudinary has a 20-second timeout; general frontend/API calls do not. |
| Repeated checkout click | Frontend disables while placing, but backend has no idempotency. Unsafe against retry/double submission. |
| Refresh during checkout/login | Cart persists. Checkout data/address persistence is mixed between account, session and localStorage and needs E2E coverage. |
| Two browser tabs | Cart/localStorage synchronizes through Zustand persistence behavior, but no explicit multi-tab order idempotency exists. |
| Two admin status updates | Optimistic conditional update returns 409 to the loser. Strong. |
| Customer closes after order | Order is persisted server-side; local confirmation/tracking reference is written after response. Closing between server commit and local write can lose the local tracking reference, although authenticated account history should recover it. |
| Multiple incoming orders | Polling and notification dedupe exist; no load/concurrency test was run. |
| Deleted/changed menu item | Server quote rejects missing, unavailable or changed options. |
| Changed price | Server reprices from the current menu. Tested. |
| Delivery person not assigned | UI shows unassigned; workflow does not require assignment before out-for-delivery. Consider enforcing assignment for delivery dispatch. |
| Location denied | UI error paths exist, but delivery creation requires coordinates. Android permission support is missing. |
| Resend failure | Endpoint returns a safe generic error and invalidates the unsent challenge. Real provider behavior was not tested. |

## 14. Working, partial and broken feature summary

### Working

- Responsive customer browsing/search/category UI
- Menu API and safe static fallback
- Size selection
- Persistent guest cart
- Checkout authentication guard and safe return path
- Secure OTP design and automated coverage
- HTTP-only access/refresh sessions
- Backend price validation
- Delivery-radius validation
- Dine-in QR token security
- Admin API authorization
- Delivery status transition validation
- Atomic admin status/cancellation updates
- Secure tracking/review/support ownership
- In-app notifications and cancellation/new-order sound detection
- Cloudinary menu upload controls
- Razorpay signature/refund architecture
- Production web/API builds
- Android debug build
- Health/shutdown/backup/runbook foundations

### Partial

- Real email OTP
- Complete checkout/order lifecycle
- Dine-in completion semantics
- Online payment/refunds
- Admin button persistence
- Notifications in Android background
- Monitoring/alerts
- production database/cache
- mobile admin
- accessibility
- privacy/data retention

### Broken or missing

- Takeaway workflow
- Customer spice/add-on selection
- Duplicate-order protection
- Mark payment received
- Live-order search/filter/pagination
- Admin navigation below 768px
- Android camera/location permissions
- Android production target/release signing/branding
- Passing dependency security gate
- Passing production/release verification

## 15. Launch blockers

### Must fix before controlled real-world beta

| Severity | Affected component | Problem and impact | Exact recommendation | Effort |
|---|---|---|---|---|
| **High** | Dependencies/CI | 8 high advisories; audit and CI release gate fail. | Upgrade patched dependencies, review lockfile changes, rerun tests/lint/type/build/audit. | Medium |
| **High** | Production configuration | Current web/API production verification does not pass. A real beta cannot be safely deployed from this state. | Configure staging HTTPS web/API, MongoDB, Redis, strong JWT/admin secrets, Resend sender, Cloudinary, alert webhook and proxy hops; run `verify:production` and smoke tests. | Medium |
| **High** | Order creation | No idempotency, so retries can create duplicate restaurant orders. | Add a customer-scoped idempotency key and unique index with replay response. | Medium |
| **High** | Staging evidence | No real OTP -> checkout -> admin workflow -> tracking -> cancel/review/support test was completed. | Execute the launch runbook on staging using test accounts and non-live payment mode. Record results. | Medium |
| **High if Android is in beta** | Android manifest/config | Delivery location and QR camera cannot be relied on; packaged app has no production target. | Add/request least-privilege camera/location permissions, configure HTTPS server/API, sync, and test on real Android versions. | Medium |
| **Medium** | Promised ordering UI | Takeaway is absent; add-ons/spice are not selectable. | Implement or explicitly remove these promises from beta scope. Validate all selections server-side. | Medium |

A tightly controlled **web-only, COD-only** beta could proceed after the first four items and a documented reduction in scope. The current repository itself is not at that point.

### Must fix before public launch

| Severity | Affected component | Problem and impact | Exact recommendation | Effort |
|---|---|---|---|---|
| **High** | Domains/auth/CORS | Same-site cookie and single-origin CORS assumptions are not proven for Vercel/Render/admin domains. | Put API on a same-site HTTPS subdomain, support the exact approved origin set, and run deployed cookie/CORS tests. | Medium |
| **High** | Android release | No signing, required permissions, branding, production target or physical-device proof. | Create protected Play signing process, brand assets, production config and a device/version release test matrix. | Large |
| **High** | Order/payment operations | Takeaway, payment received, admin order pagination/filtering and correct dine-in completion are missing. | Complete and integration-test each restaurant workflow. | Large |
| **High** | Security release gate | Known vulnerable dependencies remain. | Patch and establish automated dependency-update/review policy. | Medium |
| **Medium** | Monitoring/recovery | Workflows exist, but production alerts, encrypted backup success and restore drill are unproven. | Enable monitoring, verify alert delivery, run and document a restore into a temporary database, define RPO/RTO. | Medium |
| **Medium** | Privacy/storage | PII/tracking capabilities remain in localStorage; support images remain Base64 in MongoDB. | Minimize local data, add retention/cleanup, move evidence to object storage, update privacy documentation. | Medium |
| **Medium** | Test automation | No frontend/E2E/order/payment integration coverage; CI omits API tests. | Add API integration plus Playwright-style web E2E and Android smoke tests; run API tests in CI. | Large |
| **Medium** | Release source | Dirty/untracked source prevents reproducible release. | Curate changes, ignore IDE/build artifacts, commit required Android source, pass `release:check`, tag exact SHA. | Small |

### Can fix after launch

Only after all launch blockers are resolved:

- Split the very large admin page into modules.
- Add accessible names and dialog focus management.
- Remove Gradle deprecated options and `flatDir` warnings.
- Remove or justify compatibility routes such as `/cheackout` and `/test`.
- Improve development readiness status semantics.
- Expand performance/load testing and optimize admin order virtualization.
- Correct README/runbook drift.

## 16. Prioritized action plan

1. **Stabilize the release baseline**: commit/curate the intended source, patch dependency advisories, add API tests to CI, and get lint/type/build/audit green.
2. **Make staging production-like**: same-site HTTPS API domain, exact CORS origins, MongoDB/Redis/Resend/Cloudinary/alerts, strong secrets, and passing production verification.
3. **Protect restaurant operations**: add order idempotency and order-number retry; enforce delivery assignment before dispatch if required; add COD payment-received state.
4. **Finish scope**: implement takeaway, spice/add-ons, correct dine-in served/completed status, live-order search/filter/pagination and mobile admin navigation.
5. **Prove the end-to-end workflows**: real OTP, login refresh/logout, delivery/dine-in/takeaway, repeated clicks, two tabs, cancellations, support, review, notifications and refresh persistence.
6. **Finish Android**: required permissions, production URL, same-site cookies, branded icon/splash, back/keyboard behavior, release signing and physical-device matrix.
7. **Operational readiness**: monitoring alerts, uptime, cold-start measurement, encrypted backup and restore drill, retention/privacy policy and incident/rollback exercise.

### What is missing to reach 80%

The fastest credible path from 66% beta readiness to at least 80% is:

- green dependency and production verification gates;
- a real staging deployment with same-site auth;
- backend order idempotency;
- complete staging customer/admin lifecycle proof;
- either fix the Android permission/config blockers or explicitly run a web-only beta;
- resolve or formally de-scope takeaway and customization.

### What is missing to reach 100%

Everything above, plus Play Store release engineering, complete payment/refund proof, automated frontend/API/Android E2E coverage, accessibility, data-retention/privacy controls, backup restore evidence, load/failure tests, reproducible release source and documentation alignment.

## 17. Final 80% decision

- Is the project at least 80% ready for controlled real-world testing? **No — 66%.**
- Is the project at least 80% ready for public production launch? **No — 50%.**
- Top five launch blockers:
  1. High-severity dependency advisories.
  2. Failing/unproven production configuration and deployed-domain auth.
  3. Missing order idempotency.
  4. Missing/incomplete restaurant workflows and insufficient end-to-end proof.
  5. Android permissions, production configuration, signing and branding.
- What should be fixed first? **Patch dependencies and establish a clean, passing staging/release configuration, then add order idempotency before accepting real customer orders.**

**NOT READY FOR CONTROLLED REAL-WORLD TESTING**

**NOT READY FOR PUBLIC LAUNCH**
