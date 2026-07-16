# Al-Arab Launch Runbook

This runbook is the release gate for the customer website, admin dashboard, and API. Do not point the public domain at a deployment until every required item is complete.

## 1. Managed services

Create these external services before the first staging deployment:

- MongoDB Atlas production cluster with network access restricted to the API host.
- Render Key Value/Redis instance with TLS enabled.
- Razorpay live account and a separate test-mode configuration for staging.
- An HTTPS alert webhook receiver. Sentry, Better Stack, or a small protected webhook endpoint can receive the API alert payload.
- Vercel project for `apps/web` and Render Blueprint for `render.yaml`.

Enable MongoDB Atlas continuous cloud backups in addition to the daily logical backup workflow. Test a restore into a temporary database before launch.

## 2. API deployment on Render

1. Create a Blueprint from `render.yaml`.
2. Fill every `sync: false` environment variable using `apps/api/.env.production.example`.
3. Set `CLIENT_URL` to the final HTTPS customer domain with no trailing slash.
4. Use unique generated values for both JWT secrets. Never reuse the admin password.
5. Keep `TRUST_PROXY_HOPS=1` for Render unless the proxy chain is deliberately changed.
6. Deploy with auto-deploy disabled until staging checks pass.
7. Confirm `/api/health/live` returns `200` and `/api/health/ready` reports MongoDB and Redis as connected.

Run the dependency verification from a protected deployment shell:

```bash
npm run verify:production
```

This command requires `NODE_ENV=production` and verifies MongoDB, Redis, and Razorpay live credentials without creating a payment.

## 3. Web deployment on Vercel

1. Import the repository and set **Root Directory** to `apps/web`.
2. Configure the variables in `apps/web/.env.production.example`.
3. Set `NEXT_PUBLIC_API_URL` to the Render URL ending in `/api`.
4. Keep Preview and Production environments separate.
5. Attach the final domain only after the staging smoke test passes.

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
- `PRODUCTION_API_URL`: API base ending in `/api`.
- `UPTIME_ALERT_WEBHOOK_URL`: HTTPS receiver for failed uptime checks.
- `PRODUCTION_MONGODB_URI`: least-privilege backup connection string.
- `BACKUP_ENCRYPTION_PASSPHRASE`: a unique high-entropy passphrase stored in the password manager.

The uptime workflow runs every five minutes. The logical backup workflow encrypts each archive with AES-256, runs daily, and retains private workflow artifacts for 14 days.

## 6. Staging verification

Run the automated non-destructive smoke test:

```bash
DEPLOYMENT_WEB_URL=https://staging.example.com \
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
