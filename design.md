# Al-Arab Platform Design System

## Document Status

**Version:** 1.0
**Status:** Target visual system
**Applies to:** Customer, restaurant, driver, and platform-admin interfaces
**Related documents:** [PRD.md](./PRD.md), [Architecture.md](./Architecture.md), [rules.md](./rules.md), [phases.md](./phases.md)

## 1. Design Direction

The Al-Arab platform should feel appetizing, friendly, modern, and operationally clear. The visual system uses a light neutral foundation, vibrant coral actions, warm amber highlights, strong slate text, food-focused imagery, and restrained depth.

The design must prioritize:

- Fast mobile ordering.
- Clear restaurant and menu comparison.
- Immediate recognition of actions and order states.
- Dense but readable restaurant, driver, and administrator dashboards.
- Consistent interaction patterns across all roles.
- Accessibility and performance over decorative effects.

This document supersedes earlier dark brown, black-and-gold, glossy-glass, and luxury-editorial palettes as the target system. Existing screens should migrate incrementally when touched; working functionality must not be rewritten only to change appearance.

## 2. Visual Personality

Brand attributes:

- Welcoming
- Energetic
- Dependable
- Fresh
- Local
- Direct

The interface should not feel:

- Metallic or overly dark.
- Dominated by glass blur or glossy effects.
- Like a marketing landing page inside operational workflows.
- Overly rounded, playful, or toy-like.
- Dependent on color alone for meaning.
- Crowded with decorative gradients, blobs, or unnecessary cards.

## 3. Token Architecture

Use three token layers:

```text
Primitive values -> Semantic purpose -> Component usage
```

Examples:

```text
coral-500 -> primary -> button-primary-background
slate-900 -> foreground -> heading-text
gray-50 -> background -> page-background
```

Components must consume semantic Tailwind tokens such as `bg-primary`, `text-foreground`, and `border-border`. Do not hardcode raw hex values repeatedly in component markup.

## 4. Color System

### 4.1 Core Brand Colors

| Token | Value | Purpose |
| --- | --- | --- |
| Coral 500 | `#FF5A5F` | Primary actions, active states, primary accents |
| Amber 500 | `#FFC107` | Ratings, highlights, warnings, secondary accents |
| Gray 50 | `#F9FAFB` | Main light-mode page background |
| White | `#FFFFFF` | Cards, menus, dialogs, and raised surfaces |
| Slate 900 | `#111827` | Primary text and high-contrast icons |
| Gray 500 | `#6B7280` | Secondary text, descriptions, and placeholders |

### 4.2 Primary Coral Scale

| Token | Value | Usage |
| --- | --- | --- |
| `primary-50` | `#FFF1F2` | Soft selected rows and backgrounds |
| `primary-100` | `#FFE4E6` | Hovered soft surfaces and badges |
| `primary-200` | `#FECDD3` | Subtle borders and focus support |
| `primary-500` | `#FF5A5F` | Main brand and CTA background |
| `primary-600` | `#E94B50` | Hover state |
| `primary-700` | `#D63F45` | Pressed state and accessible text accents |

Primary CTA buttons use `#FF5A5F` with `#111827` text. White normal-sized text on the base coral does not provide sufficient contrast and must not be used unless the final combination is independently verified.

### 4.3 Amber Scale

| Token | Value | Usage |
| --- | --- | --- |
| `amber-50` | `#FFFBEB` | Rating and warning backgrounds |
| `amber-100` | `#FEF3C7` | Highlighted soft surfaces |
| `amber-500` | `#FFC107` | Stars, highlights, warning accents |
| `amber-700` | `#B45309` | Accessible amber text on light surfaces |

Amber buttons and badges use dark slate text. Amber is not a substitute for the primary CTA color.

### 4.4 Neutral Scale

| Token | Value | Usage |
| --- | --- | --- |
| `gray-50` | `#F9FAFB` | Page background |
| `gray-100` | `#F3F4F6` | Secondary surfaces and skeletons |
| `gray-200` | `#E5E7EB` | Borders and dividers |
| `gray-300` | `#D1D5DB` | Stronger inactive borders |
| `gray-400` | `#9CA3AF` | Disabled icons and placeholder support |
| `gray-500` | `#6B7280` | Muted text |
| `gray-700` | `#374151` | Strong secondary text |
| `slate-900` | `#111827` | Primary text |
| `white` | `#FFFFFF` | Primary surface |

### 4.5 Status Colors

Status colors remain semantically separate from brand colors.

| Status | Main | Soft background | Use |
| --- | --- | --- | --- |
| Success | `#15803D` | `#F0FDF4` | Paid, delivered, available, eligible |
| Warning | `#B45309` | `#FFFBEB` | Delayed, action needed, payment pending |
| Error | `#DC2626` | `#FEF2F2` | Failed, cancelled, destructive errors |
| Information | `#2563EB` | `#EFF6FF` | Delivery, guidance, informational states |

Never communicate a status through color alone. Pair status color with an icon and label.

### 4.6 Semantic Tailwind Mapping

| Semantic token | Value |
| --- | --- |
| `background` | Gray 50 |
| `foreground` | Slate 900 |
| `card` | White |
| `card-foreground` | Slate 900 |
| `primary` | Coral 500 |
| `primary-foreground` | Slate 900 |
| `secondary` | Amber 500 |
| `secondary-foreground` | Slate 900 |
| `muted` | Gray 100 |
| `muted-foreground` | Gray 500 |
| `accent` | Primary 50 |
| `accent-foreground` | Primary 700 |
| `border` | Gray 200 |
| `input` | Gray 300 |
| `ring` | Primary 500 |
| `destructive` | Error red |

Use HSL-formatted CSS variables in the existing Tailwind token layer so opacity modifiers such as `bg-primary/10` continue to work.

### 4.7 Color Balance

Use color with restraint. The product should read as a clean food-ordering application with coral accents, not as a red interface.

Recommended visual balance:

| Share | Color family | Purpose |
| --- | --- | --- |
| 65-75% | White and Gray 50-100 | Pages, cards, inputs, tables, and open space |
| 15-25% | Slate 900 and neutral grays | Typography, icons, borders, and navigation |
| 5-8% | Coral | Primary actions, active navigation, selected controls, and cart indicators |
| 1-3% | Amber | Ratings, offers, and genuine warning highlights |

Color application rules:

- Use one obvious coral primary action per focused section whenever possible.
- Prefer Primary 50 or Primary 100 for selected backgrounds instead of filling large areas with Coral 500.
- Use Amber 500 for stars and small highlights, not page backgrounds or routine buttons.
- Use Slate 900 for important totals and headings instead of coral text everywhere.
- Keep dashboard sidebars white or Gray 50; mark the active item with coral text, icon, or a slim indicator.
- Use semantic success, information, warning, and error colors for status even when a brand color would look more decorative.
- Product and restaurant photography provides additional natural color; surrounding UI should not compete with it.
- Small shade adjustments are allowed during implementation when contrast testing requires them, but the primary identity must remain recognizably Coral 500 and Amber 500.

## 5. Typography

### 5.1 Font Families

| Role | Family | Fallback |
| --- | --- | --- |
| Headings and brand | Poppins | `ui-sans-serif`, `system-ui`, `sans-serif` |
| Body and UI | Inter | `Roboto`, `ui-sans-serif`, `system-ui`, `sans-serif` |

Use `next/font` or self-hosted font files. Do not depend on a runtime stylesheet request to a public font CDN in production.

### 5.2 Font Weights

| Weight | Usage |
| --- | --- |
| 400 | Body copy and descriptions |
| 500 | Inputs, navigation, labels, and secondary actions |
| 600 | Buttons, card titles, and compact headings |
| 700 | Page titles, restaurant names, and key totals |

Avoid using 800 or 900 throughout the interface. Heavy weight should remain exceptional.

### 5.3 Type Scale

| Token | Mobile | Desktop | Line height | Use |
| --- | --- | --- | --- | --- |
| Display | 32 px | 48 px | 1.1 | True welcome or campaign heading only |
| H1 | 28 px | 36 px | 1.2 | Page title |
| H2 | 22 px | 28 px | 1.25 | Major section title |
| H3 | 18 px | 20 px | 1.3 | Card group or panel title |
| Body large | 16 px | 18 px | 1.55 | Introductory text |
| Body | 14 px | 16 px | 1.5 | Standard interface copy |
| Small | 12 px | 14 px | 1.45 | Supporting information |
| Caption | 11 px | 12 px | 1.4 | Metadata and compact labels |

Do not scale font sizes continuously with viewport width. Use defined breakpoint changes.

### 5.4 Text Rules

- Use sentence case for headings, buttons, tabs, labels, and navigation.
- Do not use excessive uppercase text.
- Keep letter spacing at normal values for body and headings.
- Use tabular numerals for prices, elapsed timers, ETAs, and analytics values.
- Prevent labels and button text from clipping at 320 px width.
- Truncate restaurant and dish descriptions only when the complete value remains accessible in the detail view.

## 6. Spacing and Layout

### 6.1 Spacing Scale

Use Tailwind's 4 px spacing foundation.

| Token | Value | Typical usage |
| --- | --- | --- |
| 1 | 4 px | Icon-to-label micro spacing |
| 2 | 8 px | Compact control gaps |
| 3 | 12 px | Card metadata gaps |
| 4 | 16 px | Standard component spacing |
| 5 | 20 px | Mobile panel padding |
| 6 | 24 px | Desktop card and section padding |
| 8 | 32 px | Section separation |
| 12 | 48 px | Major customer-page sections |

### 6.2 Page Containers

- Mobile horizontal padding: 16 px.
- Tablet horizontal padding: 24 px.
- Desktop horizontal padding: 32 px.
- Customer content maximum width: 1280 px.
- Form content maximum width: 640 px unless paired with an order summary.
- Restaurant dashboard content uses available width with controlled column tracks.
- Avoid centered narrow cards for primary application workflows.

### 6.3 Responsive Breakpoints

Use Tailwind defaults unless the implementation requires an approved additional breakpoint.

| Breakpoint | Minimum width | Primary behavior |
| --- | --- | --- |
| Base | 0 px | One-column mobile layout |
| `sm` | 640 px | Wider forms and two-column compact grids |
| `md` | 768 px | Tablet navigation and two-column menus |
| `lg` | 1024 px | Desktop navigation and dashboard sidebar |
| `xl` | 1280 px | Four-column discovery grids and wide operations |

All primary workflows must remain usable at 320 px width and short mobile viewport heights.

### 6.4 Grid Guidance

- Restaurant listings: 1 column mobile, 2 tablet, 3 or 4 desktop.
- Menu items: 1 column mobile, 2 tablet, 3 or 4 wide desktop.
- Checkout: 1 column mobile; content plus sticky summary on desktop.
- Dashboards: fixed or collapsible sidebar plus flexible content.
- Tables become scrollable, stacked, or selectively condensed on mobile.
- Do not force dense desktop tables into unreadable mobile widths.

## 7. Shape, Borders, and Elevation

### 7.1 Radius

| Token | Value | Usage |
| --- | --- | --- |
| `rounded-sm` | 4 px | Badges and compact chips |
| `rounded-md` | 6 px | Small controls |
| `rounded-lg` | 8 px | Buttons, inputs, cards, images, dialogs |
| `rounded-full` | Full | Avatars, status dots, compact category pills only |

Cards must remain at 8 px radius or less. Do not turn every action or content container into a pill.

### 7.2 Borders

- Standard border: 1 px Gray 200.
- Hover border: Gray 300.
- Selected border: Primary 500.
- Error border: Error red.
- Dividers use Gray 200 and must not create heavy boxes around every section.

### 7.3 Shadows

| Tailwind utility | Usage |
| --- | --- |
| `shadow-sm` | Standard cards and inputs requiring separation |
| `shadow-md` | Hovered restaurant cards, dropdowns, dialogs |
| No shadow | Flat page sections, navigation bands, tables |

Shadows must be soft and neutral. Avoid colored glow shadows, deep black shadows, and multiple layered reflections.

## 8. Iconography and Images

### 8.1 Icons

- Use Lucide React across the application.
- Use outline icons at a consistent stroke weight.
- Standard icon sizes: 16, 18, 20, and 24 px.
- Icon-only buttons require accessible labels and tooltips when the action is not obvious.
- Do not mix Lucide, Heroicons, and manually drawn icons on one interface.
- Use filled stars only for rating display and selection.

### 8.2 Food and Restaurant Imagery

- Restaurant cards show the real restaurant, food, or storefront.
- Dish cards show the actual dish clearly enough to inspect.
- Avoid dark atmospheric images when the customer must compare food.
- Use stable `aspect-ratio` values to prevent layout shifts.
- Restaurant cover: 16:9 or 2:1.
- Dish card: 4:3 or 1:1 according to the grid.
- Profile and logo images: 1:1.
- Apply consistent object cropping and focal positioning.
- Use Next.js Image optimization and responsive sizes.

## 9. Core Component Specifications

### 9.1 Buttons

#### Sizes

| Size | Height | Horizontal padding | Text | Icon |
| --- | --- | --- | --- | --- |
| Small | 32 px | 12 px | 12-14 px | 16 px |
| Default | 40 px | 16 px | 14 px | 18 px |
| Large | 48 px | 20-24 px | 16 px | 20 px |
| Mobile primary | Minimum 48 px | 20 px | 15-16 px | 20 px |

#### Variants

| Variant | Default | Hover | Use |
| --- | --- | --- | --- |
| Primary | Coral 500, Slate 900 text | Coral 600 | Checkout, add, save, confirm |
| Secondary | Amber 500, Slate 900 text | Amber 500 with stronger shadow | Offers and emphasized secondary actions |
| Neutral | White, Gray 200 border | Gray 50 | Cancel and secondary commands |
| Ghost | Transparent | Gray 100 | Toolbars and low-priority actions |
| Destructive | Error red, white text | Darker red | Delete, cancel order, suspend |

Buttons must include hover, focus, active, loading, and disabled states. Disabled buttons use both visual treatment and the native `disabled` attribute.

### 9.2 Icon Buttons

- Default size: 40 by 40 px.
- Minimum touch target: 44 by 44 px on customer mobile screens.
- Use icons for close, back, search, cart, favorite, menu, edit, delete, and print.
- Avoid text inside rounded rectangles when a familiar icon communicates the action.

### 9.3 Inputs

- Standard height: 44 px; 48 px for mobile checkout and authentication.
- White background, Gray 300 border, Slate 900 value, Gray 500 placeholder.
- Focus uses Primary 500 border and a visible primary ring.
- Error uses red border, icon, and helper text.
- Labels appear above fields and remain visible after input.
- Do not rely on placeholders as labels.
- Search inputs use a leading search icon and one clear button.

### 9.4 Cards

- White background, Gray 200 border, 8 px radius.
- Use `shadow-sm` by default only when separation is needed.
- Interactive restaurant cards transition to `shadow-md` and a Gray 300 border.
- Keep card padding between 16 and 24 px.
- Do not nest cards inside cards.
- Page sections remain unframed unless they are true tools or repeated items.

### 9.5 Restaurant Card

Anatomy:

1. Restaurant image.
2. Open, promoted, or delivery badge where applicable.
3. Restaurant name in Poppins semibold.
4. Cuisine summary.
5. Rating with amber star.
6. Delivery time, fee, and distance.

The entire card may be interactive, but any favorite control must remain a separate accessible button.

### 9.6 Menu Item Card

Anatomy:

1. Dish image.
2. Dish name and availability.
3. Short description.
4. Price and rating.
5. Favorite control.
6. Add button or quantity stepper.

Keep price and add controls visible without requiring hover.

### 9.7 Category Controls

- Use horizontally scrollable tabs or compact pills on mobile.
- Active category uses Primary 500 and Slate 900 text.
- Inactive category uses White or Gray 100 with Gray 700 text.
- Preserve stable height so selection does not move the layout.

### 9.8 Badges and Status

- Badge height: 20-24 px.
- Radius: 4 px or full only for compact status chips.
- Use text and an optional icon.
- Order statuses use semantic success, warning, information, and error colors.
- Ratings use amber stars and Slate 900 rating text.

### 9.9 Dialogs and Bottom Sheets

- Mobile uses a bottom sheet with a maximum of the safe viewport height.
- Desktop uses a centered dialog with an appropriate maximum width.
- Header and primary footer actions remain reachable.
- Content scrolls independently when taller than the viewport.
- Close uses an icon button with an accessible label.
- Focus is trapped and returned to the trigger after closing.
- Backdrop is neutral black at restrained opacity; avoid heavy blur.

### 9.10 Toasts and Alerts

- Toasts appear for asynchronous success, failure, and recovery feedback.
- Inline alerts remain near blocking form or order issues.
- Use status color, icon, short title, and actionable message.
- Toast duration must allow the message to be read.
- Do not use browser `alert()` for product feedback.

### 9.11 Tables

- Header background: Gray 50.
- Rows: White with Gray 200 dividers.
- Hover: Gray 50.
- Selected: Primary 50 with a Primary 500 side or border indicator.
- Text left aligned, numeric values right aligned, actions right aligned.
- Default row height: 48 px.
- Compact operational row height: 40 px.
- Avoid placing every cell value inside a badge.

## 10. Navigation Patterns

### 10.1 Customer Navigation

- Desktop: top navigation with brand, location, search, account, and cart.
- Mobile: compact top header plus bottom navigation for primary destinations.
- Bottom navigation uses familiar icons and short labels.
- Cart quantity badge uses Primary 500.
- Active navigation uses Primary 700 text or a Primary 500 indicator.

### 10.2 Restaurant Dashboard Navigation

- Desktop sidebar with stable icon and text alignment.
- Mobile drawer or compact rail.
- Use grouped navigation for Orders, Menu, Customers, Drivers, Reports, and Settings.
- Keep operational pages quiet, dense, and scannable.
- Avoid decorative hero sections and oversized headings.

### 10.3 Driver Navigation

- Prioritize Current Delivery, Available Orders, History, and Profile.
- Keep the active assignment and location-sharing state visible.
- Place status actions within thumb reach on mobile.

### 10.4 Platform Admin Navigation

- Use a consistent dashboard sidebar and compact header.
- Prioritize overview, restaurants, users, drivers, orders, payments, support, and audit logs.
- Support dense data comparison without stacking decorative cards.

## 11. Page-Level Guidance

### 11.1 Restaurant Discovery

- Search and location controls appear before restaurant results.
- Filters use a compact row, drawer, or popover rather than permanent large panels.
- Show result count and active filters.
- Restaurant imagery remains the strongest card signal.
- Loading uses stable skeleton card dimensions.

### 11.2 Restaurant Menu

- Restaurant identity, rating, delivery time, fee, and status appear first.
- Category navigation remains reachable while browsing.
- Menu content begins in the first viewport; avoid a marketing-only hero.
- Cart access remains persistent without covering menu actions.

### 11.3 Checkout

- Use a clear vertical order: service mode, address, contact, payment, instructions, summary, confirmation.
- Primary CTA remains visible or easily reachable on short phones.
- Selected service and payment buttons must contain readable icons and labels.
- Address map uses a fixed center pin and a visible current-location action.
- Totals use aligned tabular numerals.
- Errors appear beside the responsible section and in a toast when appropriate.

### 11.4 Order Tracking

- Lead with order status and ETA.
- Show map only when it contains useful live information.
- Display the last driver-location update time.
- Status timeline has labels in addition to color.
- Support and cancellation controls are secondary to tracking.

### 11.5 Restaurant Live Orders

- Use compact order panels or rows optimized for repeated scanning.
- Show elapsed time, type, status, items, customer or table, amount, and action controls.
- New orders use a restrained Primary 50 highlight and audible notification.
- Critical delays use warning semantics.
- Print, assignment, and status actions must have recognizable icons and labels where needed.

## 12. Motion and Interaction

### 12.1 Timing

| Interaction | Duration | Easing |
| --- | --- | --- |
| Color and border | 150 ms | ease-in-out |
| Shadow and transform | 200 ms | ease-out |
| Dialog and sheet | 250 ms | ease-out |
| Map pin movement | 200-300 ms | spring-like ease-out |
| Skeleton shimmer | 1200-1600 ms | linear |

### 12.2 Motion Rules

- Use motion to explain state or spatial change.
- Restaurant cards may lift no more than 2 px on hover.
- Images may scale no more than 1.03 on hover.
- Buttons may compress subtly on active state but must not shift surrounding layout.
- Map pins may lift while the map moves and drop when selection settles.
- Avoid continuous ambient animation, parallax, or expensive backdrop filters.
- Respect `prefers-reduced-motion` and remove nonessential transforms.

## 13. Accessibility

- Meet WCAG 2.1 AA for core flows.
- Normal text contrast: at least 4.5:1.
- Large text and UI component contrast: at least 3:1.
- Focus ring: 2 px Primary 500 with 2 px offset.
- Keyboard focus order follows visual order.
- Use semantic buttons, links, labels, headings, lists, and tables.
- Icon-only controls require accessible names.
- Form errors use `aria-invalid` and associated messages.
- Loading and order status updates use appropriate live regions.
- Do not use color as the sole status indicator.
- Touch targets are at least 44 by 44 px for important mobile controls.
- Modal content must scroll and remain operable with zoomed text.

## 14. Empty, Loading, and Error States

### Loading

- Use stable skeletons matching final dimensions.
- Keep primary navigation available when safe.
- Use button spinners for local mutations.
- Do not replace the entire application with a blocking loader for background refreshes.

### Empty

- Explain the missing content briefly.
- Provide one clear next action where appropriate.
- Use a relevant Lucide icon, not decorative illustration by default.

### Error

- Explain what failed in user language.
- Preserve entered data where safe.
- Provide retry or recovery actions.
- Use Error red and an icon in addition to text.
- Do not show raw exception, provider, or database messages.

## 15. Tailwind Implementation Rules

- New component styling uses Tailwind utility classes only.
- Reuse semantic classes such as `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary`, and `border-border`.
- Map the design tokens through the existing Tailwind configuration and base variable layer.
- Do not create new component CSS files.
- Do not add inline `style` objects.
- Use `clsx`, `class-variance-authority`, or the existing class merge utility for controlled variants.
- Avoid dynamically constructed Tailwind class names that cannot be detected at build time.
- Use established component variants rather than repeating long class strings.
- Third-party package CSS remains allowed only when required by the package.

Example component usage:

```tsx
<button className="h-12 rounded-lg bg-primary px-5 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
  Place order
</button>
```

## 16. Design Migration Plan

Follow the one-file-at-a-time workflow defined in `rules.md`.

### Step 1: Tokens and Fonts

- Map the new semantic colors in the existing Tailwind token layer.
- Configure Poppins and Inter through Next.js font handling.
- Verify contrast and font loading before changing components.

### Step 2: Shared Components

- Button
- Input and select
- Card
- Badge and alert
- Dialog and bottom sheet
- Toast
- Navigation controls

### Step 3: Customer Screens

- Restaurant discovery
- Restaurant menu
- Cart
- Checkout
- Orders and tracking
- Profile and support

### Step 4: Operational Screens

- Restaurant dashboard
- Kitchen and live orders
- Driver dashboard
- Platform-admin dashboard

### Step 5: Cleanup

- Remove obsolete theme-specific utility combinations from migrated components.
- Reduce legacy global component styling only after all consumers move to Tailwind variants.
- Verify no functionality, responsive behavior, table QR flow, or mobile LAN behavior regressed.

Do not perform a one-pass global restyle of the entire application.

## 17. Visual Quality Checklist

Before approving a migrated screen:

- [ ] Primary actions use coral consistently.
- [ ] Ratings and highlights use amber consistently.
- [ ] Page background is Gray 50 and primary surfaces are white.
- [ ] Primary and muted text use approved slate and gray tokens.
- [ ] Poppins is used for headings and Inter for body UI.
- [ ] No text or icons disappear against button backgrounds.
- [ ] Cards use no more than 8 px radius and restrained shadows.
- [ ] Buttons, images, and cards have stable responsive dimensions.
- [ ] No nested cards or decorative floating page sections were added.
- [ ] Mobile layout works at 320 px without horizontal scrolling.
- [ ] Short mobile viewports can scroll to every required action.
- [ ] Keyboard focus, touch targets, labels, and contrast are correct.
- [ ] Reduced-motion mode remains usable.
- [ ] Loading, empty, error, disabled, hover, focus, and active states are present.
- [ ] Real restaurant and food media remain clear and inspectable.
- [ ] The screen was rendered and visually inspected on mobile and desktop.
