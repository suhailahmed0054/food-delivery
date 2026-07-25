# Controlled Beta Manual Verification

This checklist is required because the automated visual browser was unavailable
during Phase 2. Do not mark the mobile-viewport or end-to-end order gates passed
until a person records the result for every item below.

## Test setup

1. Start the API with `npm run dev:api`.
2. Start the website with `npm run dev:web`.
3. Open browser developer tools, enable device emulation, disable cache, and use
   each exact viewport width: `320`, `360`, `375`, `393`, `412`, `768`, and
   `1440` pixels.
4. At each width, run this in the browser console:

   ```js
   document.documentElement.scrollWidth <= document.documentElement.clientWidth
   ```

   Record **PASS** only when it returns `true`.
5. Repeat the customer critical flow on a physical Android phone using the
   synchronized Capacitor build before beta sign-off.

## Admin mobile drawer

Run at 320, 360, 375, 393, 412, and 768 pixels:

- [ ] Menu button is visible and does not overlap header controls.
- [ ] Touch/click opens the drawer.
- [ ] The first drawer control receives keyboard focus.
- [ ] Tab and Shift+Tab remain inside the open drawer.
- [ ] Escape closes the drawer and returns focus to the menu button.
- [ ] Close button closes the drawer.
- [ ] Backdrop touch/click closes the drawer.
- [ ] Background page cannot scroll while the drawer is open.
- [ ] Drawer content itself remains scrollable where required.
- [ ] Dashboard, Orders, Menu, Tables, Delivery, Customers, Reviews, Support,
      Reports, and Settings are all reachable.
- [ ] Selecting an item closes the drawer and the selected item remains visible.
- [ ] No horizontal overflow, clipped text, or overlapping controls.

Run at 1440 pixels:

- [ ] Desktop sidebar remains visible and unchanged.
- [ ] Mobile menu button/drawer is not shown.
- [ ] Every admin section remains reachable.

## Customer beta-critical pages

At every requested width, check:

### Home and menu (`/mobile`)

- [ ] Header, hero, selector, category tabs, menu cards, buttons, and bottom
      navigation stay inside the viewport.
- [ ] Add an item with a size/add-on and confirm the cart indicator updates.

### Cart

- [ ] Open the cart from the mobile page (there is no standalone `/cart` route).
- [ ] Long item names, size/add-on text, quantity controls, totals, and checkout
      action are readable with no clipping.
- [ ] Repeated checkout taps are blocked while submission/navigation is active.

### Login and OTP (`/login`)

- [ ] Email field, Send OTP action, errors, code fields, countdown, and resend
      action are readable and operable.
- [ ] Request one real OTP from the verified Resend sender and receive it.
- [ ] Complete OTP login; do not record the OTP in this checklist.

### Checkout (`/checkout`)

- [ ] Logged-out access redirects without flashing private checkout content.
- [ ] Cart survives login and returns intact.
- [ ] Address, payment, total, and Place Order remain inside the viewport.

### Active order and tracking (`/orders`)

- [ ] Restaurant/order heading and orange action/status control do not overlap.
- [ ] Arrival, rider, progress, secure-tracking, and total cards do not overflow.
- [ ] Live status changes appear from confirmed through the applicable final
      status.

### Notifications

- [ ] Open the notification panel from the header (there is no standalone
      `/notifications` route).
- [ ] Unread and read text/icons have sufficient contrast.
- [ ] Unread dots, single mark-read, mark-all-read, close, navigation, and
      scrolling work.

## Complete controlled-beta order

Use a real test customer and a controlled non-production/staging restaurant
account. Do not alter production data for this verification.

- [ ] Customer signs in by received email OTP.
- [ ] Customer adds multiple customized items and reaches checkout.
- [ ] Customer submits once; rapid repeat taps/retry return the same order.
- [ ] Admin sees the order and confirms it.
- [ ] Admin moves a delivery order through `Preparing`, `Ready`,
      `Out for Delivery`, and `Delivered`.
- [ ] Customer tracking and notifications show each change.
- [ ] Refreshing both applications preserves the final state.
- [ ] Payment status and assigned delivery person remain correct.
- [ ] Delivered order appears in the intended completed/history filter.
- [ ] A cancelled/rejected order cannot transition to an active status.

Record the test date, tested build commit, device/browser, order number, and
tester name in the release evidence. Do not put credentials, session cookies,
OTPs, payment details, or customer private data in that evidence.
