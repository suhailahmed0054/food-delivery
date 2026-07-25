# Al-Arab Launch Runbook

This runbook is the release gate for the customer website, admin dashboard, and API. Do not point the public domain at a deployment until every required item is complete.

## 1. Managed services

Create these external services before the first staging deployment:

- MongoDB Atlas production cluster with network access restricted to the API host.
- Render Key Value/Redis instance with TLS enabled when running more than one
  API instance or when shared rate-limit counters are required.
- Cloudinary account for persistent menu image storage.
- Razorpay live/test accounts only when online payment is enabled. Current
  customer checkout is COD-only.
- Optional HTTPS alert webhook receiver. Sentry, Better Stack, or a protected
  webhook endpoint can receive API alert payloads.
- Vercel project for `apps/web` and Render Blueprint for `render.yaml`.

Enable MongoDB Atlas continuous cloud backups in addition to the daily logical backup workflow. Test a restore into a temporary database before launch.

## 2. API deployment on Render

1. Create a Blueprint from `render.yaml`.
2. Fill the required `sync: false` variables using
   `apps/api/.env.production.example`.
3. Confirm `CUSTOMER_APP_URL`, `ADMIN_APP_URL`, and `API_PUBLIC_URL` match the
   three planned HTTPS origins in `docs/PRODUCTION_CONFIGURATION.md`.
4. Use unique generated values for the access, refresh, authentication, and OTP
   hash secrets. Never reuse the admin password.
5. Keep `TRUST_PROXY_HOPS=1` for Render unless the proxy chain is deliberately changed.
6. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` from the Cloudinary API Keys page.
7. Seed the first administrator from a protected shell using temporary
   `ADMIN_EMAIL` and `ADMIN_PASSWORD` values:

   ```bash
   npm run create-admin -w apps/api
   ```

   Remove those two plaintext seed inputs from the normal runtime environment
   after the command succeeds.
8. Before the first deployment, migrate any menu records created by the old local uploader:

   ```bash
   npm run migrate-menu-images -w apps/api
   ```

9. Deploy with auto-deploy disabled until staging checks pass.
10. Confirm `/api/health/live` returns `200` and `/api/health/ready` reports
    MongoDB connected. Redis may report connected or intentionally disabled.

Run the dependency verification from a protected deployment shell:

```bash
npm run verify:production
```

This command enters production verification mode, validates all required
web/API inputs and performs a read-only MongoDB readiness connection. Redis is
checked only when configured. Razorpay credentials and webhook behavior must
still be verified in the controlled staging payment flow when online payment
is enabled.

## 3. Web deployment on Vercel

1. Import the repository and set **Root Directory** to `apps/web`.
2. Configure the variables in `apps/web/.env.production.example`.
3. Set `NEXT_PUBLIC_API_URL` to
   `https://api.al-arabrestaurant.cc.cd/api`.
4. The default image-host allow-list already includes `res.cloudinary.com`;
   set `NEXT_PUBLIC_MENU_IMAGE_HOSTS` only to override it.
5. Set `CAPACITOR_SERVER_URL` to `https://al-arabrestaurant.cc.cd` only before
   synchronizing the production Android project.
6. Attach both the customer and admin domains to this Next.js project. The
   admin-domain root redirects to `/admin`.
7. Keep Preview and Production environments separate.
8. Attach the final domains only after the staging smoke test passes.

## 4. Razorpay

Create a Razorpay webhook pointing to:

```text
https://API_DOMAIN/api/payments/webhook
```

Subscribe to:

- `payment.captured`
- `payment.failed`
- `refund.created`
- `refund.processed`
- `refund.failed`

Store the exact webhook secret as `RAZORPAY_WEBHOOK_SECRET`. The API verifies the raw request signature and deduplicates events by Razorpay event ID or a body hash fallback.

## 5. GitHub repository secrets

Set these Actions secrets:

- `PRODUCTION_WEB_URL`: final customer origin, for example `https://order.example.com`.
- `PRODUCTION_ADMIN_URL`: final admin origin.
- `PRODUCTION_API_URL`: API base ending in `/api`.
- `UPTIME_ALERT_WEBHOOK_URL`: HTTPS receiver for failed uptime checks.
- `PRODUCTION_MONGODB_URI`: least-privilege backup connection string.
- `BACKUP_ENCRYPTION_PASSPHRASE`: a unique high-entropy passphrase stored in the password manager.

The uptime workflow runs every five minutes. The logical backup workflow encrypts each archive with AES-256, runs daily, and retains private workflow artifacts for 14 days.

## 6. Staging verification

Run the automated non-destructive smoke test:

```bash
DEPLOYMENT_WEB_URL=https://staging.example.com \
DEPLOYMENT_ADMIN_URL=https://staging-admin.example.com \
DEPLOYMENT_API_URL=https://staging-api.example.com/api \
npm run smoke
```

Then perform one manual order from a real phone over mobile data:

1. Register and sign in.
2. Select a precise map pin and verify the delivery-radius result.
3. Add customized menu items and confirm cart totals.
4. Complete one Razorpay test payment and confirm the admin receives it once.
5. Move the order through preparing, dispatch, delivery, and receipt printing.
6. Verify customer notifications, order tracking, review submission, and refund processing.
7. Complete one COD order and one table QR dine-in order.
8. Confirm a failed payment cannot mark an order as paid.
9. Upload a menu photo from Admin, reload the customer menu, and verify the Cloudinary image remains available after redeploying both services.

## 7. Backups and restore drill

For an on-demand backup on a machine with MongoDB Database Tools installed:

```bash
npm run backup -w apps/api
```

Restore only into a temporary drill database first:

```bash
CONFIRM_RESTORE=RESTORE_AL_ARAB npm run restore -w apps/api -- backups/archive-name.archive.gz
```

The restore command uses `--drop`. Never point it at production during a drill.

Decrypt a CI archive before the restore drill:

```bash
gpg --decrypt --output al-arab.archive.gz al-arab.archive.gz.gpg
```

## 8. Release and rollback

Before deploying production:

```bash
npm ci
npm run verify
npm run release:check
```

Tag the verified commit and deploy that exact SHA. To roll back, redeploy the previous healthy API and Vercel deployment; do not restore the database unless a confirmed data migration requires it.

After launch, check the customer home page, admin login, API readiness, one menu response, and one non-charge Razorpay credential verification. Keep the previous deployment available until the first production order is completed successfully.
