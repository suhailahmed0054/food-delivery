# Public Launch Checklist

## Source and automation

- [ ] `npm ci`, tests, lint, TypeScript, production build, and runtime audit pass.
- [ ] CI is green on the exact `main` commit.
- [ ] `npm run release:check` confirms local `main` equals `origin/main`.
- [ ] Previous healthy Render and Vercel deployments are recorded for rollback.

## External production configuration

- [ ] Provider credentials exposed during development have been rotated.
- [ ] Render variables match `ENVIRONMENT_VARIABLES.md` and production
      verification passes without fake values.
- [ ] Atlas network access includes the active Render outbound ranges; a
      least-privilege database user connects successfully.
- [ ] Customer/admin origins pass exact CORS and HTTP-only cookie tests.
- [ ] A real OTP arrives from the verified Resend sender.
- [ ] Cloudinary menu upload, replacement, deletion, and support evidence work.
- [ ] Monitoring, uptime alert delivery, encrypted backup, and restore drill pass.

## Restaurant workflows

- [ ] Delivery: placed -> accepted -> preparing -> ready -> out for delivery -> delivered.
- [ ] Takeaway: placed -> accepted -> preparing -> ready -> collected -> completed.
- [ ] Dine-in: pending -> accepted -> preparing -> ready -> served -> completed.
- [ ] Duplicate/retried checkout returns one order.
- [ ] Invalid transitions and dispatch without a rider are rejected.
- [ ] COD payment-received state persists and prints correctly.
- [ ] Customer tracking, notifications, reviews, support, filters, pagination,
      refresh, cancellation, and history are verified.

## Web and Android

- [ ] Manual checklist passes at 320, 360, 375, 393, 412, 768, and 1440 px.
- [ ] Physical Android camera, location, cookie persistence, keyboard, back
      navigation, denied permissions, and slow-network retries pass.
- [ ] Approved icon/splash assets replace any default Capacitor artwork.
- [ ] Signed AAB uses an incremented version and protected Play App Signing.
- [ ] Play Console privacy policy and data-safety declarations are complete.

Public launch remains blocked until every unchecked item has dated evidence.
