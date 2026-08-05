# Rollback Guide

## Application rollback

1. Stop new releases and record the incident time, affected release SHA, and
   symptoms without copying customer data into the incident channel.
2. In Render, redeploy the last healthy API SHA. In Vercel, promote the last
   healthy production deployment.
3. Verify API liveness/readiness, customer/admin CORS, login, menu, and a
   non-mutating protected-route probe.
4. Keep the failed release available for log inspection; do not delete evidence.

## Database safety

- Application rollback does not imply database rollback.
- Never run the destructive restore command against production during a normal
  code rollback.
- If a migration caused corruption, disable writes, take a fresh backup, obtain
  explicit incident approval, and restore first into a temporary database.
- Compare counts and representative records before any production cutover.

## Provider rollback

- Revoke a compromised credential before issuing its replacement.
- Restore prior CORS/DNS/provider settings only when they are known safe.
- For Android, halt the staged Play rollout or publish a higher-version fixed
  bundle; installed version codes cannot be rolled backward through Play.

After recovery, run the smoke test, complete one controlled order, document the
root cause, and add a regression check before reopening deployment.
