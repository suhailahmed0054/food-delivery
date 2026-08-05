# Production Environment Variables

Never commit real values. Put web values in Vercel, API values in Render, and
Android signing values only in the protected release machine or CI secret
store. The exhaustive source audit is in `ENVIRONMENT_VARIABLE_AUDIT.md`.

## Required web build values

| Variable | Visibility | Production value/format |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Public | `https://api.al-arabrestaurant.cc.cd/api` |

`NEXT_PUBLIC_MENU_IMAGE_HOSTS` is optional. `CAPACITOR_SERVER_URL` is required
only while synchronizing a production Android build and must be
`https://al-arabrestaurant.cc.cd`.

## Required API runtime values

| Variable | Visibility | Format/source |
|---|---|---|
| `NODE_ENV` | Private | `production` |
| `CUSTOMER_APP_URL` | Public | `https://al-arabrestaurant.cc.cd` |
| `ADMIN_APP_URL` | Public | `https://admin.al-arabrestaurant.cc.cd` |
| `API_PUBLIC_URL` | Public | `https://api.al-arabrestaurant.cc.cd` |
| `MONGODB_URI` | Secret | Atlas `mongodb+srv://` URI for a least-privilege user |
| `JWT_ACCESS_SECRET` | Secret | Independent random value, at least 32 characters |
| `JWT_REFRESH_SECRET` | Secret | Independent random value, at least 32 characters |
| `AUTH_SECRET` | Secret | Independent random value, at least 32 characters |
| `OTP_HASH_SECRET` | Secret | Independent random value, at least 32 characters |
| `ADMIN_SIGNUP_CODE` | Secret | Independent random first-admin setup code, at least 32 characters |
| `RESEND_API_KEY` | Secret | Resend key beginning with `re_` |
| `EMAIL_FROM` | Private | Verified sender at `al-arabrestaurant.cc.cd` |
| `TRUST_PROXY_HOPS` | Private | Positive integer; `1` for the current Render topology |

## Conditional integrations

Configure every value in a group or leave the entire group empty:

- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET`. Required for menu and support image uploads.
- Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
  `RAZORPAY_WEBHOOK_SECRET`. Keep empty while checkout is COD-only.
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`.
- Android signing: `ANDROID_VERSION_CODE`, `ANDROID_VERSION_NAME`,
  `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD`.

Optional single values include `REDIS_URL`, `ALERT_WEBHOOK_URL`,
`MONGODB_DATABASE`, `MENU_IMAGE_HOSTS`, `RELEASE_SHA`,
`SHUTDOWN_TIMEOUT_MS`, and `MONGODB_DNS_SERVERS`.

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are temporary one-time seed inputs. Remove
them from the runtime environment immediately after `create-admin` succeeds.
`ADMIN_SIGNUP_CODE` is server-only and powers the first-admin form at
`/admin/login`; never prefix it with `NEXT_PUBLIC_` or expose it in browser
configuration. The form refuses additional primary admins after setup.
