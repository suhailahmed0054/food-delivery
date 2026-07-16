# Repository Development Rules

## 1. Scope

These rules apply to all new and modified code in the Al-Arab food delivery monorepo, including:

- `apps/web`
- `apps/api`
- Future shared packages
- Tests, scripts, migrations, and configuration

When a rule conflicts with a security requirement, data-integrity requirement, or explicit task instruction, follow the safer explicit requirement and document the reason.

## 2. Language and Type Safety

### TypeScript Only

- Use TypeScript for frontend, backend, shared packages, tests, and scripts.
- New React files must use `.tsx`.
- New non-React source files must use `.ts`.
- Do not add JavaScript source files unless a tool requires a specific configuration format.
- Keep TypeScript strict mode enabled.
- Code must pass `npm.cmd run typecheck` before completion.

### Data Models and Contracts

- Define clear interfaces or named types for all domain data.
- Core models include User, Restaurant, MenuItem, Cart, Order, Payment, DeliveryAssignment, Review, and SupportIssue.
- Define request DTOs, response DTOs, and persisted entities separately when their shapes differ.
- Prefer shared Zod schemas for API boundary validation.
- Infer TypeScript types from Zod schemas where it prevents duplicated contracts.
- Use Prisma-generated types only inside backend persistence code.
- Do not expose complete Prisma records directly as API responses.
- Map database entities to explicit safe response DTOs.

### Prohibited TypeScript Shortcuts

- Do not use `any`.
- Use `unknown` for untrusted values and narrow them before access.
- Do not use unchecked type assertions to bypass compiler errors.
- Do not use `@ts-ignore` or disable strict compiler rules.
- Use `@ts-expect-error` only for a documented external-library incompatibility and include a reason.
- Do not create broad index signatures when a known interface can be defined.
- Do not use non-null assertions unless the invariant is proven immediately before use.

## 3. Frontend Rules

### React Components

- Use functional React components and hooks exclusively.
- Do not use React class components.
- Do not use legacy lifecycle methods.
- Keep each component focused on one responsibility.
- Extract repeated or complex UI behavior into a reusable component or hook.
- Keep page components responsible for route composition, not all domain logic.
- Prefer controlled form fields and explicit validation states.
- Clean up timers, event listeners, subscriptions, and observers in effects.
- Do not perform side effects during rendering.

### Component Size

- Prefer small components that can be understood without scanning unrelated workflows.
- Split a component when it owns multiple independent dialogs, forms, tables, or business workflows.
- Do not split a component only to reduce line count if doing so hides tightly related logic.
- Place route-specific components near their route and shared components under `components`.

### State Management

- Use Zustand for global client state such as the cart and cross-route preferences.
- Use React Query for API-backed server state.
- Use `useState`, `useReducer`, or React Context for local or subtree state.
- Do not copy API server state into Zustand without a documented offline requirement.
- Keep authoritative prices, permissions, payment state, and order status on the server.
- Store shareable search, filter, sort, and pagination state in the URL where practical.
- Do not create a global store for state used by only one component.

### Styling

- Use Tailwind CSS utility classes for all new application styling.
- Do not create new application `.css`, `.scss`, Sass, CSS Module, or styled-component files.
- Do not add inline `style={{ ... }}` declarations.
- Use Tailwind arbitrary values only when no existing design token or utility is appropriate.
- Prefer existing theme tokens and shared UI component variants.
- Reuse existing layouts, buttons, cards, dialogs, tables, navigation, and form patterns.
- Do not redesign an existing working interface unless the task explicitly requests a redesign.
- Keep all layouts responsive from 320 px mobile width through desktop.
- Preserve keyboard access, visible focus, sufficient contrast, and reduced-motion support.

Existing `globals.css` is legacy application infrastructure. Do not expand it for ordinary component styling. When modifying an existing interface, migrate the touched style to Tailwind when that can be done safely without rewriting unrelated working code.

Third-party package styles required by a library, such as Leaflet's distributed stylesheet, are allowed. Do not modify third-party package files.

### Icons and Media

- Use the installed Lucide icon library when an appropriate icon exists.
- Do not manually draw replacement SVG icons for common actions.
- Use Next.js Image for application images when compatible.
- Provide meaningful alt text for informative images and empty alt text for decoration.

### Frontend API Access

- Route all application data through the backend API or an approved web proxy route.
- Never import Prisma, database clients, Mongoose models, or database repositories into browser code.
- Never place database credentials or server secrets in public environment variables.
- Use the shared API client rather than duplicating fetch-base logic.
- Preserve the repository's localhost and private-LAN API URL behavior.
- Validate unknown API payloads before relying on them when they cross an untrusted boundary.

### Frontend Error Handling

- Catch expected API and integration failures.
- Display actionable failures through the shared toast notification system.
- Use a maintained toast library such as React Hot Toast if no shared toast system exists.
- Provide inline field errors for form validation in addition to a toast when useful.
- Provide loading, empty, error, and retry states for data-driven screens.
- Never leave the user with a blank screen after a recoverable failure.
- Use route-level error boundaries for unexpected rendering failures.
- Log technical details without exposing secrets or raw server internals to customers.
- Do not use browser alerts for normal application feedback.

## 4. Backend Rules

### API Structure

- Keep routes, controllers, validation, services, repositories, and integrations separated.
- Controllers translate HTTP input and output.
- Services own business rules and transaction boundaries.
- Repositories own Prisma or database queries.
- Integrations own Stripe, Razorpay, maps, email, SMS, and WhatsApp SDK calls.
- Do not place core business logic directly in Express route files.
- Do not access the database directly from controllers when a repository or service exists.

### Request Validation

- Validate params, query strings, headers, and bodies at the API boundary.
- Use Zod for new request schemas.
- Treat all client input as untrusted.
- Reject malformed input before business logic runs.
- Normalize email addresses, phone numbers, identifiers, and monetary values consistently.
- Do not trust client-provided prices, roles, restaurant IDs, payment status, or order status.

### Controller Error Handling

- Wrap every asynchronous controller with the existing `asyncHandler` or an equivalent try-catch wrapper.
- Explicit try-catch blocks must call `next(error)` unless the controller is intentionally converting a known domain error.
- Do not swallow errors or only write them to the console.
- Forward unexpected errors to the centralized Express error middleware.
- Keep one final centralized error handler after all routes.
- Do not expose stack traces, database errors, secret values, or provider responses to clients.

### Standard Error Responses

Use appropriate HTTP status codes:

- `400` for malformed requests and validation errors.
- `401` for missing or invalid authentication.
- `403` for authenticated users without permission.
- `404` for resources that do not exist or must not be disclosed.
- `409` for state or uniqueness conflicts.
- `422` for valid requests that violate business rules.
- `429` for rate limiting.
- `500` for unexpected server failures.
- `502` or `503` for unavailable required providers when retry is appropriate.

Return a consistent JSON envelope:

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found",
    "requestId": "req_123",
    "fields": []
  }
}
```

- Customer-facing messages must be understandable and safe.
- Machine-readable error codes must remain stable.
- Validation failures should identify safe field-level errors.

### Database Access

- Prisma and database calls are backend-only.
- Use PostgreSQL transactions for orders, payments, refunds, assignments, and other multi-write operations.
- Store money as integer minor units, never floating-point values.
- Enforce restaurant tenancy in repository queries and service authorization.
- Do not trust a route's `restaurantId` without checking the user's membership or platform role.
- Use database constraints for uniqueness and required relationships.
- Avoid raw SQL unless Prisma cannot express the query safely.
- Parameterize every approved raw query.
- Add a brief comment above a complex transaction or query explaining its invariant.

### Authentication and Security

- Use short-lived JWT access tokens and rotating refresh tokens.
- Store refresh tokens in secure, HTTP-only cookies.
- Hash passwords using an approved password-hashing algorithm.
- Enforce authorization in the API, not only in frontend navigation.
- Rate-limit authentication, checkout, payment, support, and sensitive mutation endpoints.
- Verify Stripe or Razorpay webhook signatures using the raw request body.
- Never log passwords, tokens, payment secrets, full cookies, or private customer data.
- Keep secrets in environment variables or a managed secret store.

## 5. Real-Time Rules

- Authenticate Socket.IO connections.
- Authorize every room join.
- Scope restaurant, order, driver, user, and support rooms explicitly.
- Persist the authoritative database change before emitting an event.
- Keep event payloads minimal and free of secrets.
- Re-fetch authoritative state after reconnection.
- Provide polling fallback for critical active-order views.
- Stop driver-location sharing after delivery, cancellation, or reassignment.

## 6. Testing and Verification

- Add tests in proportion to the risk and behavioral impact of the change.
- Unit-test business rules such as pricing, permissions, delivery radius, and status transitions.
- Integration-test authentication, database transactions, webhooks, and tenant boundaries.
- End-to-end test critical customer, restaurant, and driver flows.
- Verify responsive behavior at 320 px mobile width and common desktop widths.
- Run targeted tests while developing.
- Run type checking before completion.
- Run production builds for changes affecting routing, bundling, server boundaries, or deployment.
- Do not claim visual verification unless the interface was actually rendered and inspected.
- Report tests that could not be run and the remaining risk.

## 7. Comments and Documentation

- Add brief comments above complex business rules, transactions, algorithms, or queries.
- Explain why a complex block exists and which invariant it protects.
- Do not narrate obvious assignments, loops, or JSX.
- Update `PRD.md` when product scope or acceptance criteria change.
- Update `Architecture.md` when system boundaries, technology choices, data ownership, or deployment change.
- Keep environment-variable examples synchronized with implementation.

Example of an appropriate comment:

```ts
// Lock the order and assignment in one transaction so two drivers cannot accept it.
```

## 8. Change Safety and AI Boundaries

### No Destructive Edits

- Do not delete or rewrite working functions without an explicit requirement.
- Make surgical changes around the requested behavior.
- Preserve unrelated user changes in a dirty worktree.
- Do not revert files or code that was not changed for the current task.
- Do not run destructive Git or filesystem commands without explicit authorization.
- Do not replace an existing working module with a new framework only for style preference.
- A bug fix may modify the responsible function, but must preserve unrelated behavior and receive proportional verification.

### Complex Feature Workflow

For every complex feature implementation:

1. Identify the files and dependencies involved.
2. Implement one logical file at a time.
3. Explain that file's responsibility and verification result.
4. Wait for confirmation before moving to the next file.
5. Keep the repository runnable at each confirmed step where practical.

- Do not batch several implementation files into one unconfirmed step.

### Existing Patterns

- Read the surrounding code before editing.
- Prefer existing helpers, components, and conventions.
- Do not add a new abstraction unless it removes real complexity or matches an established pattern.
- Keep the current admin shell and role navigation unless a redesign is explicitly requested.
- Keep customer route compatibility and query parameters when changing navigation.
- Preserve delivery-radius, table-QR, payment, order-tracking, and LAN/mobile behavior across the full flow.

## 9. Definition of Done

A change is complete only when:

- The requested behavior works end-to-end.
- TypeScript has no new errors.
- API authorization and validation are enforced where relevant.
- Loading, error, empty, and disabled states are handled.
- Mobile and desktop layouts remain usable where UI changed.
- Relevant tests or live checks pass.
- No unrelated working behavior was intentionally removed.
- Documentation and environment examples are updated when required.
- The completion summary lists modified files, database changes, APIs, tests, and manual setup for substantial features.
