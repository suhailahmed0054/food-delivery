# Deployment Guide

## Release order

1. Create a staging MongoDB database and least-privilege database user.
2. Verify the Resend domain and sender. Configure Cloudinary if image uploads
   are in beta scope.
3. Create the Render API from `render.yaml`; enter secrets in Render only.
4. Confirm `https://api.al-arabrestaurant.cc.cd/api/health/ready` returns 200.
5. Create the Vercel project with root directory `apps/web`; set
   `NEXT_PUBLIC_API_URL=https://api.al-arabrestaurant.cc.cd/api`.
6. Run `npm run verify:production` and the deployed smoke test.
7. Complete the manual viewport/device and full-order checklist.
8. Run `npm ci`, `npm run verify`, commit, push, then run
   `npm run release:check` against the exact release SHA.

The API must be deployed before the web build. Do not enable public traffic
until readiness, CORS, cookies, OTP delivery, and one complete order have been
verified on the planned domains.

## Repository commands

```powershell
npm ci
npm run verify
npm run verify:production
npm run smoke
npm run android:build
```

Run the one-time legacy migration only from a protected API shell:

```powershell
npm run migrate-legacy-refunds -w apps/api
npm run migrate-menu-images -w apps/api
```

For the provider-specific steps and evidence requirements, follow
`PRODUCTION_CONFIGURATION.md`, `LAUNCH_RUNBOOK.md`, and
`PUBLIC_LAUNCH_CHECKLIST.md`.
