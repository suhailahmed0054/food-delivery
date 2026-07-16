# Product Requirements Document

## Product

**Name:** Al-Arab Food Ordering and Delivery Platform
**Document status:** Draft 1.0
**Product type:** Responsive web application
**Primary market:** Local restaurant ordering, dine-in, pickup, and delivery

## 1. Product Summary

Al-Arab is a responsive food ordering and delivery platform connecting customers, restaurant teams, delivery drivers, and platform administrators. Customers can discover food, customize items, pay securely, and track orders. Restaurant teams can manage menus and live operations. Delivery drivers can receive assignments, navigate to customers, and update delivery progress. Platform administrators can oversee users, restaurants, payments, support, and performance.

The current application operates as a single-restaurant Al-Arab experience. The first release should complete and stabilize that experience while establishing data and permission boundaries that can later support multiple restaurant partners.

## 2. Goals

- Make ordering food fast and reliable on mobile and desktop.
- Provide accurate address pinning and enforce the restaurant delivery radius.
- Give restaurant staff one live operational view for incoming orders.
- Let delivery staff receive assignments and communicate delivery progress.
- Support cash on delivery and secure online payments.
- Keep customers informed through real-time order status updates.
- Give administrators visibility into customers, staff, orders, revenue, and support cases.
- Preserve dine-in QR ordering alongside delivery and pickup workflows.

## 3. Non-Goals for MVP

- Nationwide restaurant discovery or franchise marketplace search.
- Automated driver payroll or tax filing.
- Advanced route optimization across multiple simultaneous deliveries.
- Subscription meal plans.
- Grocery, pharmacy, or non-food delivery.
- International currencies and tax systems.
- Native iOS or Android applications.

## 4. Target Users

### Customers

People who want to browse a menu and order food for delivery, pickup, or dine-in.

Customer needs:

- Fast mobile ordering with minimal typing.
- Clear menu prices, availability, and customization choices.
- Accurate map-based address selection.
- Transparent totals, payment status, and delivery timing.
- Live order tracking, receipts, support, favorites, and reorder.

### Restaurant Partners and Staff

Restaurant owners, administrators, kitchen staff, and order managers.

Restaurant needs:

- Immediate notification of new orders.
- Clear delivery, pickup, and dine-in separation.
- Menu, availability, pricing, table QR, and restaurant-status controls.
- Kitchen-friendly status updates and elapsed-time visibility.
- Driver assignment and customer communication.
- Sales reports and operational analytics.

### Delivery Drivers

Delivery team members who accept or receive delivery assignments.

Driver needs:

- Secure access to assigned deliveries only.
- Customer address, map link, phone, instructions, and payment type.
- Simple status controls for accepted, picked up, and delivered.
- A history of completed deliveries and current availability status.

### Platform Administrators

Super-users responsible for the platform, participating restaurants, users, and support.

Administrator needs:

- Cross-platform dashboards and analytics.
- Restaurant, staff, driver, customer, and role management.
- Payment and refund visibility.
- Support ticket handling and audit history.
- Ability to suspend accounts or restaurants when necessary.

## 5. User Roles and Permissions

| Role | Primary permissions |
| --- | --- |
| Guest | Browse menu, manage a local cart, check delivery availability, and place a guest order where permitted |
| Customer | Guest permissions plus saved addresses, order history, favorites, reviews, support, and reorder |
| Kitchen staff | View active orders and update kitchen statuses |
| Restaurant manager | Kitchen permissions plus menu, orders, tables, drivers, customers, reports, and restaurant settings |
| Delivery driver | View assigned orders and update delivery statuses |
| Platform admin | Manage all restaurants, users, roles, support cases, payments, and platform analytics |

Permissions must be enforced by the API, not only hidden in the interface.

## 6. Core Customer Experience

### 6.1 Welcome and Service Selection

- Show restaurant identity, operating status, contact information, and service modes.
- Allow customers to choose Delivery, Dine-in, or Menu.
- Preserve active cart and customer session during navigation.
- Show an offline screen when the restaurant is not accepting orders.

### 6.2 User Authentication

- Provide secure signup and login for customers, restaurant staff, delivery drivers, and platform administrators.
- Use short-lived JWT access tokens with securely stored refresh tokens.
- Support email and phone credentials, with Google OAuth as an optional configured provider.
- Require email or phone verification before enabling sensitive account actions.
- Provide password reset, logout from the current device, and logout from all devices.
- Resolve the user's active role and restaurant membership after authentication.
- Redirect each authenticated role to its permitted interface.
- Reject disabled, blocked, or suspended accounts at the API boundary.
- Record login, password reset, role change, and account suspension events for audit purposes.

### 6.3 Restaurant Discovery

- Show restaurants currently available to the customer's selected location.
- Search restaurants by name, cuisine, dish, or keyword.
- Filter by cuisine, customer rating, delivery time, delivery fee, and open status.
- Sort by relevance, rating, fastest delivery, and delivery fee.
- Restaurant cards show image, name, cuisines, rating, estimated delivery time, fee, distance, and open or closed status.
- Opening a restaurant shows its menu, offers, operating hours, reviews, delivery rules, and service modes.
- Preserve the selected restaurant with the cart and reject mixed-restaurant carts in Phase 1.
- Closed or out-of-range restaurants remain discoverable but cannot accept a delivery order.
- Search and filter controls must remain usable at 320 px screen width.

### 6.4 Location Search and Map Pinning

- Customers can search by area, street, or landmark.
- Customers can use the device's current location with high-accuracy GPS when available.
- Customers can drag an interactive map under a fixed center pin.
- Moving the map updates the selected latitude and longitude.
- Reverse geocoding displays a readable road, locality, district, state, and postal code where available.
- The application shows whether the selected pin is inside the delivery area.
- Delivery checkout remains disabled until an eligible location is selected.
- Location permission errors and unavailable GPS must produce understandable recovery instructions.

### 6.5 Menu Browsing

- Browse categories, featured dishes, offers, and availability.
- Search by dish name or category.
- View image, description, base price, rating, and availability.
- Select size, spice level, and available add-ons.
- Add, increase, decrease, or remove cart items.
- Save or remove favorites for signed-in customers.

### 6.6 Cart and Pricing

- Persist the cart between page changes and browser refreshes.
- Associate every cart with exactly one restaurant in Phase 1.
- Ask for confirmation before clearing a cart when the customer changes restaurants.
- Show line-item quantities, customizations, and unit prices.
- Calculate subtotal, discounts, tax, delivery fee, and final total consistently on the server.
- Validate promo codes before applying discounts.
- Prevent unavailable or invalid menu configurations from being ordered.

### 6.7 Checkout

- Support Delivery, Pickup, and Dine-in order types where enabled.
- Collect customer name, phone, optional email, delivery time, and instructions.
- Let customers choose, add, and save delivery addresses.
- Require map-verified coordinates for delivery orders.
- Support Cash on Delivery and one configured online payment provider.
- Use a payment-provider adapter so Stripe or Razorpay can be selected by environment configuration.
- For Stripe, create PaymentIntents server-side and confirm payment status through verified webhooks.
- Display a final server-generated price quote before confirmation.
- Prevent duplicate submissions while an order is being placed.
- Confirm the order with a unique order number and receipt.

### 6.8 Dine-in QR Ordering

- Each table has a private, rotatable QR token.
- Scanning a valid QR opens the menu with the table session preserved.
- Dine-in checkout does not require a delivery address.
- The order stores its table number and dine-in order type.
- Invalid, expired, or paused table tokens are rejected.

### 6.9 Order Tracking and Live Delivery

- Display the order number, items, amount, payment status, and service type.
- Delivery flow: Placed, Preparing, Ready for Pickup, Out for Delivery, Delivered.
- Dine-in flow: Pending, Preparing, Ready, Served.
- Pickup flow: Placed, Preparing, Ready for Pickup, Collected.
- Update status in real time using Socket.IO, with polling as a fallback.
- Once an order is picked up, show the assigned driver's latest permitted location on a map.
- Send driver coordinates at a controlled interval while an active delivery is in progress.
- Calculate and display an estimated arrival time using the latest driver and customer locations.
- Show when the driver location was last updated and fall back to status-only tracking when location is unavailable.
- Stop exposing driver coordinates after delivery, cancellation, or assignment removal.
- Show elapsed time, estimated arrival, delivery staff details, and contact controls when available.
- Allow cancellation only while the order is still eligible for cancellation.

### 6.10 Customer Account and Reviews

- Email or phone login with secure session handling.
- Profile and contact management.
- Saved addresses and default-address selection.
- Order history, details, receipts, and reorder.
- Favorites and offers.
- Allow reviews only after the related order is completed.
- Collect separate food and delivery ratings from 1 to 5 stars.
- Accept optional written feedback and approved customer-uploaded images.
- Show restaurant rating summaries and published reviews on restaurant pages.
- Let authorized staff respond to reviews without modifying the customer's rating.
- Provide moderation and reporting controls for abusive or irrelevant content.
- Support issue creation and customer-support chat.

## 7. Restaurant Dashboard

### 7.1 Live Orders

- Show new and active orders with audible and visual notifications.
- Separate Delivery, Pickup, and Dine-in orders.
- Display order age, customer, items, address or table, payment, notes, and total.
- Allow valid status transitions only.
- Allow bill and receipt printing.
- Allow delivery-person assignment and WhatsApp handoff where configured.
- Keep completed and cancelled orders searchable.

### 7.2 Kitchen Display

- Provide a focused view of accepted and preparing orders.
- Group or sort by order age and priority.
- Clearly show item quantities and special instructions.
- Support Preparing, Ready, and Served or Pickup status actions.

### 7.3 Menu Management

- Create, edit, activate, deactivate, and delete menu items.
- Manage category, description, image, base price, sizes, add-ons, and availability.
- Validate prices and required fields.
- Reflect availability changes on the customer menu promptly.

### 7.4 Restaurant Operations

- Toggle the public website online or offline.
- Manage restaurant profile, contact details, opening hours, tax, fees, minimum order, and delivery radius.
- Create, activate, pause, regenerate, download, and print table QR codes.
- Manage delivery staff and availability.
- Manage customer notes and account blocking where authorized.

### 7.5 Reports

- Revenue, order count, average order value, discounts, tax, and delivery fees.
- Breakdown by date, order type, payment method, item, and status.
- Driver delivery counts and completion times.
- Export supported reports in a common format such as CSV.

## 8. Delivery Driver Experience

- Secure JWT login with driver-only access.
- Availability toggle: Available, Busy, Offline.
- List of assigned current deliveries.
- Assignment details: restaurant, customer, phone, address, map link, order amount, payment type, and instructions.
- Status actions: Accept, Arrived at Restaurant, Picked Up, Arrived at Customer, Delivered, Unable to Deliver.
- Require confirmation before final delivery completion.
- Send status changes to the customer and restaurant in real time.
- Share location only during an assigned active delivery and only with the related customer, restaurant, and authorized administrators.
- Update live coordinates at a rate that balances ETA quality, battery usage, and network cost.
- Display route guidance by opening the configured map provider rather than building turn-by-turn navigation in Phase 1.
- Completed-delivery history and basic earnings or delivery-count summary.
- Do not expose orders assigned to other drivers.

## 9. Platform Administration

- Platform-wide overview of restaurants, customers, drivers, orders, payments, and support cases.
- Add, approve, suspend, and reactivate restaurant partners.
- Assign restaurant owners and staff roles.
- Manage customers and drivers with an audit trail for sensitive actions.
- View payment transactions, failures, refunds, and reconciliation status.
- Manage support tickets, internal notes, assignment, priority, and resolution status.
- Monitor order volume, gross sales, cancellation rate, delivery time, and active users.
- Configure platform-level policies without exposing secrets to restaurant users.

## 10. Order and Payment Rules

- Server pricing is authoritative.
- Menu prices and availability must be revalidated at checkout.
- Delivery orders require coordinates within the configured branch radius.
- Payment success must be verified server-side through the configured provider's signatures and webhooks.
- Stripe integrations must use PaymentIntents and verified webhook events; Razorpay integrations must verify order and payment signatures.
- A failed online payment must not create a paid order.
- Cash orders clearly indicate payment due at delivery, pickup, or table.
- Refund actions require an authorized role and an audit record.
- Status transitions must follow the workflow for the order type.
- Completed, served, collected, and cancelled orders are terminal.

## 11. Notifications

- New-order alert for restaurant staff.
- Order confirmation for customers.
- Status-change updates for customers.
- Delivery assignment notification for drivers.
- Payment success or failure notification.
- Support ticket and reply notifications.
- Initial channels: in-app and real-time events.
- Optional configured channels: email, SMS, and WhatsApp.

## 12. Data Model

Core entities:

- User
- CustomerProfile
- Restaurant
- RestaurantSettings
- StaffMembership
- DeliveryPerson
- MenuCategory
- MenuItem
- MenuCustomization
- Cart
- Address
- Table
- Order
- OrderItem
- DeliveryAssignment
- Payment
- PromoCode
- Review
- SupportIssue
- SupportMessage
- Notification
- AuditLog

Every restaurant-owned record must include a restaurant identifier before multi-restaurant onboarding is enabled.

## 13. Non-Functional Requirements

### Responsive Design

- Support widths from 320 px mobile screens through desktop dashboards.
- Core customer tasks must work with touch, mouse, and keyboard.
- No hidden or unreachable primary controls in sheets, dialogs, or fixed navigation.
- Respect safe-area insets on modern mobile devices.

### Performance

- Customer pages should become usable within 3 seconds on a typical mobile connection.
- Optimize menu and hero images through Next.js image handling.
- Lazy-load maps, QR scanners, and heavy dashboard modules.
- Avoid animation effects that cause scrolling lag.

### Accessibility

- Meet WCAG 2.1 AA for core flows.
- Provide visible focus states, semantic labels, keyboard navigation, and sufficient contrast.
- Support reduced-motion preferences.
- Status changes and validation errors must be announced accessibly.

### Security

- Use secure, HTTP-only authentication cookies and refresh-token rotation.
- Enforce role-based authorization at API boundaries.
- Hash passwords and rate-limit authentication and sensitive endpoints.
- Validate and sanitize all external input.
- Verify payment webhooks and avoid storing raw payment-card details.
- Protect private table tokens and support tokens from unauthorized listing.
- Record privileged actions in audit logs.

### Reliability

- Prevent duplicate order creation through idempotent checkout handling.
- Preserve order data if live socket updates temporarily disconnect.
- Provide loading, empty, error, and retry states for all data-driven screens.
- Production deployment must use HTTPS for geolocation and secure payment flows.

## 14. Success Metrics

- Checkout completion rate.
- Median time from menu entry to order placement.
- Cart abandonment rate.
- Payment success rate.
- Order acceptance time.
- Preparation and delivery duration.
- Cancellation and refund rate.
- Repeat-order rate.
- Customer support issue rate per 100 orders.
- Percentage of deliveries with a verified map pin.
- Restaurant search-to-menu conversion rate.
- Accuracy of displayed delivery ETA compared with actual arrival.
- Percentage of completed orders receiving a verified review.

## 15. MVP Release Scope

### Must Have

- Secure role-aware signup and login using JWT, with optional OAuth.
- Responsive restaurant discovery, menu, cart, checkout, and account flows.
- Restaurant search and filters for cuisine, rating, and delivery time.
- Map pinning and delivery-radius validation.
- Cash on Delivery and a verified Stripe or Razorpay online-payment flow.
- Delivery and dine-in order workflows.
- Real-time order status updates with fallback polling.
- Live assigned-driver map tracking and estimated arrival time.
- Restaurant live orders, kitchen, menu, table QR, staff, settings, and reports.
- Delivery-driver access, availability, assignments, navigation links, location updates, and delivery statuses.
- Customer order history, tracking, reorder, and support.
- Verified food and delivery reviews after completed orders.
- API-enforced authentication and role permissions.

### Next Release

- Pickup workflow completion.
- Self-service restaurant onboarding and expanded restaurant-level data tenancy controls.
- Platform-admin dashboard spanning all restaurants.
- Refund workflow and broader payment reconciliation.
- Advanced route optimization, expanded notifications, and driver performance reporting.

## 16. Acceptance Criteria

Phase 1 is ready when:

1. Every user type can authenticate securely and is restricted to its permitted API and interface.
2. A customer can search and filter local restaurants by cuisine, rating, and delivery time on a 320 px-wide phone.
3. A customer can open one restaurant, customize items, maintain a single-restaurant cart, and receive a server-authoritative total.
4. A customer can select an eligible map pin, pay with the configured online provider or choose cash, and receive an order confirmation.
5. Online payment success is confirmed only after server-side provider verification.
6. An out-of-radius delivery pin is rejected in both the browser and API.
7. A valid table QR creates a dine-in order containing the correct restaurant and table number.
8. Restaurant staff receive new orders in an active queue and can move them through only valid statuses.
9. Customer order tracking reflects restaurant and driver status changes without requiring a page reload under normal real-time conditions.
10. During an active delivery, the customer can see the assigned driver's latest permitted location, last-update time, and ETA.
11. Driver location sharing stops when the delivery is completed, cancelled, or unassigned.
12. A manager can update menu availability and the customer menu reflects the change.
13. A manager can assign a delivery person, and that assignment is stored with the order.
14. A customer can submit separate food and delivery ratings only after completing the related order.
15. Bills and receipts can be printed from the restaurant dashboard.
16. Restaurant online or offline status controls whether customers can begin ordering.
17. Core pages have usable loading, empty, validation, and failure states.
18. Type checking, production builds, and critical authentication, payment, ordering, tracking, and review tests pass before release.

## 17. Delivery Phases

### Phase 1: Core Marketplace and Ordering

- Deliver secure multi-role JWT authentication with optional OAuth.
- Add restaurant identifiers and API-enforced tenancy to core menus, carts, orders, staff, drivers, settings, and reviews.
- Add local restaurant search and filtering by cuisine, rating, and delivery time.
- Complete restaurant menus, customization, single-restaurant carts, checkout, and configured online payments.
- Complete restaurant active-order queues and real-time customer status updates.
- Deliver the essential driver assignment, status, live location, and ETA flow.
- Add verified food and delivery reviews.
- Preserve map-based delivery validation, dine-in QR ordering, restaurant controls, and receipt printing.

### Phase 2: Operational Expansion

- Add pickup workflow completion, refunds, payment reconciliation, and richer notifications.
- Expand driver history, performance reporting, and delivery operations.

### Phase 3: Partner Scaling and Self-Service Onboarding

- Add self-service restaurant onboarding, approval, subscription, and expanded profile controls.
- Add platform-wide partner administration, cross-restaurant analytics, and stronger tenant-isolation audits.

### Phase 4: Platform Optimization

- Add reconciliation, refunds, advanced analytics, notification automation, and operational monitoring.
