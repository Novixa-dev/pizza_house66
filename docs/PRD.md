# Product Requirements Document (PRD)

# Pizza House — Novixa Restaurant

**Document Type:** Product Requirements Document  
**Product:** Pizza House Digital Ordering & Restaurant Operations Platform  
**Parent Product:** Novixa Restaurant  
**Document Status:** Draft — Implementation Baseline  
**Version:** 1.0.0  
**Language:** English  
**Primary Deployment Language:** Arabic (RTL)  
**Secondary Language:** English (LTR)  
**Initial Business Model:** Single-restaurant implementation  
**Future Product Model:** Configurable multi-restaurant SaaS  
**Last Updated:** 2026-09-17

---

## 1. Executive Summary

Pizza House is a digital ordering and restaurant operations platform designed to give a restaurant a direct, modern, and operationally useful online ordering channel.

The product is intentionally more than a restaurant website. It connects the customer ordering experience with restaurant administration, payment verification, kitchen operations, order scheduling, notifications, and basic analytics.

The first implementation is for Pizza House. It should simultaneously establish a clean technical foundation for the future **Novixa Restaurant** product.

The immediate objective is not to build a massive SaaS platform. The objective is to deliver a small, complete, reliable system that can operate a real restaurant workflow.

The core customer journey is:

> Browse menu → Customize product → Add to cart → Choose pickup time → Choose payment method → Submit order → Track order → Receive ready notification/status → Pick up order.

The core restaurant journey is:

> Receive order → Verify payment if required → Queue order → Release to kitchen at the correct preparation time → Prepare → Mark ready → Complete order → Record analytics.

---

# 2. Product Vision

## 2.1 Vision

Build a fast, simple, reliable digital ordering layer that helps restaurants accept and manage direct online orders without forcing them to replace their existing operational systems.

## 2.2 Mission

Make restaurant ordering more convenient for customers and more organized for restaurant staff by connecting:

- Digital menu
- Online ordering
- Scheduled pickup
- Payment workflows
- Restaurant administration
- Kitchen operations
- Customer order tracking
- Operational analytics

## 2.3 Product Positioning

Pizza House should be positioned as:

> **A digital ordering and restaurant operations system — not merely a restaurant website.**

The system should reduce operational friction while keeping the restaurant's existing workflow and systems in mind.

---

# 3. Business Objectives

## 3.1 Immediate Objectives

1. Give Pizza House a professional direct ordering channel.
2. Reduce manual order handling.
3. Reduce ordering mistakes.
4. Allow customers to prepare orders before arriving.
5. Allow customers to choose valid pickup times.
6. Give staff a centralized order workflow.
7. Provide a dedicated kitchen queue.
8. Provide payment verification when transfer-based payment is used.
9. Allow restaurant staff to manage products and availability without developers.
10. Establish a strong reference implementation for Novixa.

## 3.2 Long-Term Objectives

After validating the first implementation:

1. Extract reusable restaurant functionality.
2. Convert Pizza House lessons into a generic restaurant product.
3. Support additional restaurants.
4. Introduce restaurant-specific configuration.
5. Introduce optional subscriptions and recurring revenue.
6. Offer hosting, maintenance, support, analytics, and growth services.

---

# 4. Product Strategy

The product will be developed in controlled stages.

```text
Discovery
    ↓
Sales Demo
    ↓
MVP
    ↓
Production
    ↓
Growth
    ↓
Productization
```

The first version must not attempt to solve every restaurant problem.

The principle is:

> **Build the smallest serious product that can actually operate a restaurant.**

---

# 5. Goals and Non-Goals

## 5.1 Goals

The MVP must:

- provide a polished customer-facing website
- provide a real database-backed menu
- support product customization
- support cart and checkout
- support guest ordering
- support pickup
- support ASAP and scheduled pickup
- support configurable payment methods
- support transfer receipt submission
- support manual payment verification
- support pay-at-pickup
- support order tracking
- support restaurant administration
- support kitchen operations
- support business hours
- support temporary online-order pausing
- support product availability
- support Arabic and English
- support responsive mobile-first UX
- provide basic analytics
- meet practical security requirements
- be deployable and maintainable

## 5.2 Non-Goals for MVP

The MVP will not include:

- native Android application
- native iOS application
- full POS replacement
- driver application
- advanced delivery routing
- advanced CRM
- loyalty program
- complex coupon engine
- AI chatbot
- automated AI financial decisions
- AI receipt verification
- AI sales forecasting
- multi-tenant SaaS infrastructure
- microservices
- blockchain/crypto features
- complex ERP functionality
- advanced warehouse management
- complex subscription billing

These may be considered in later phases.

---

# 6. Target Users

## 6.1 Customer

A person who wants to:

- browse the menu
- customize a product
- order food
- choose a pickup time
- select a payment method
- track the order

The customer should not be required to create an account for MVP ordering.

## 6.2 Restaurant Owner

Responsible for:

- restaurant settings
- products
- prices
- staff
- payment configuration
- business rules
- reports
- overall operations

## 6.3 Restaurant Manager

Responsible for daily operations:

- orders
- products
- availability
- payment verification
- business hours
- promotions
- operational settings

## 6.4 Cashier

Responsible primarily for:

- viewing orders
- reviewing payment submissions
- verifying/rejecting transfer payments
- assisting with customer orders

## 6.5 Kitchen Staff

Responsible for:

- viewing released orders
- starting preparation
- marking orders ready
- completing kitchen workflow

## 6.6 Novixa Administrator

Responsible for:

- deployment
- maintenance
- support
- monitoring
- technical configuration
- future productization

---

# 7. Core User Journeys

## 7.1 Customer Journey

```text
Homepage
   ↓
Order Now
   ↓
Menu
   ↓
Category
   ↓
Product
   ↓
Customize
   ↓
Add to Cart
   ↓
Cart
   ↓
Checkout
   ↓
Pickup Method
   ↓
Pickup Time
   ↓
Payment Method
   ↓
Payment Submission if Required
   ↓
Order Confirmation
   ↓
Order Tracking
   ↓
Preparing
   ↓
Ready
   ↓
Pickup
   ↓
Completed
```

## 7.2 Restaurant Journey

```text
Customer Creates Order
        ↓
Order Received
        ↓
Payment Verification if Required
        ↓
Order Confirmed
        ↓
Kitchen Release Time
        ↓
Kitchen Queue
        ↓
Preparing
        ↓
Ready
        ↓
Customer Pickup
        ↓
Completed
```

---

# 8. Product Scope

## 8.1 MVP Scope

### Customer

- Homepage
- Digital menu
- Categories
- Product details
- Product variants
- Product add-ons
- Cart
- Guest checkout
- Customer information
- Pickup selection
- ASAP pickup
- Scheduled pickup
- Payment method selection
- Transfer receipt upload
- Order confirmation
- Order reference
- Order tracking
- Basic status notifications
- Arabic/English support

### Restaurant Administration

- Dashboard
- Orders
- Order details
- Products
- Categories
- Add-ons
- Availability
- Business hours
- Schedule overrides
- Payment methods
- Restaurant settings
- Staff roles and permissions

### Kitchen

- Kitchen queue
- Queued state
- Preparing state
- Ready state
- Completed state
- Scheduled order release

### System

- Authentication
- RBAC
- Database persistence
- Secure file uploads
- Audit history
- Basic analytics
- Logging
- Error handling
- Responsive UI
- SEO foundation

---

# 9. Customer Experience Requirements

## 9.1 Homepage

The homepage must contain:

- restaurant branding
- logo
- hero section
- primary "Order Now" CTA
- menu CTA
- featured products
- categories
- current offers where available
- business hours
- location
- contact information
- optional WhatsApp contact
- restaurant information
- footer

The ordering CTA must be prominent.

The customer should reach the menu with minimal friction.

## 9.2 Menu

The menu must be database-driven.

It must support:

- categories
- products
- product images
- descriptions
- prices
- availability
- featured products
- sorting
- active/inactive products

Example:

```text
Pizza
├── Margherita
├── Pepperoni
├── Chicken
└── Special

Drinks
Desserts
Add-ons
Combos
```

## 9.3 Product Details

A product detail page/component must support:

- product image
- product name
- description
- base price
- size/variant selection
- add-ons
- quantity
- notes
- availability
- calculated price

Example:

```text
Pepperoni
Large                  2,500
Extra Cheese             +300
Olives                   +200

Total                   3,000
```

## 9.4 Product Customization

Customization must be configurable by restaurant staff.

Potential options include:

- size
- crust
- toppings
- extras
- removals where supported
- notes

The system must validate selected options server-side.

---

# 10. Cart Requirements

The cart must support:

- multiple products
- quantities
- variants
- add-ons
- item notes
- item removal
- quantity updates
- subtotal
- applicable fees
- discounts where implemented
- final total

The server must recalculate all financial values.

The browser must never be trusted for final pricing.

---

# 11. Checkout Requirements

Checkout should support guest ordering.

Required information should be minimized.

Potential fields:

- customer name
- phone number
- email if required
- order notes
- pickup option
- pickup time
- payment method

The checkout process should clearly display:

- items
- quantities
- subtotal
- fees
- discounts
- total
- pickup time
- payment method
- final confirmation

---

# 12. Pickup Requirements

## 12.1 Pickup Modes

MVP:

- ASAP
- Scheduled Pickup

Future:

- Curbside Pickup

## 12.2 ASAP

The system calculates the earliest valid pickup time using:

- current time
- restaurant business hours
- preparation time
- relevant operational rules
- capacity rules if enabled

## 12.3 Scheduled Pickup

The customer can choose only valid available times.

The customer must not be allowed to select an arbitrary invalid timestamp.

Example:

```text
Current Time: 17:30
Preparation Time: 25 minutes

Earliest Pickup:
17:55
```

If a selected time is too early, the system must reject it and offer valid alternatives.

---

# 13. Scheduled Order Logic

A future order must not immediately enter active kitchen preparation.

Example:

```text
Order created:       16:00
Pickup time:         19:00
Preparation time:    25 min
Kitchen release:     18:35
```

At 16:00:

```text
Order = Scheduled
Kitchen = Not Yet Released
```

At 18:35:

```text
Kitchen = Queued
```

This behavior must be deterministic and tested.

---

# 14. Capacity Management

Capacity management is a planned capability.

Future configuration:

```text
Time Slot: 15 minutes
Maximum Orders: 10
```

Example:

```text
19:00 — 10/10
19:15 — 4/10
```

When a slot reaches capacity, it must no longer be selectable.

For MVP, this may be implemented only if it does not materially delay the core product.

---

# 15. Restaurant Business Hours

The restaurant must be able to configure:

- opening time
- closing time
- days closed
- temporary closures
- special schedules
- pickup availability
- online ordering availability

Example:

```text
Saturday: 16:00–00:00
Sunday:   16:00–00:00
```

Business-hour logic must be centralized rather than duplicated throughout the application.

---

# 16. Pause Online Ordering

Authorized staff must be able to pause online ordering.

When paused:

- menu remains viewable
- customers cannot submit new orders
- the UI explains that ordering is temporarily unavailable
- existing orders continue normally
- administrators can resume ordering

Example message:

> Online ordering is temporarily unavailable. Please try again later.

---

# 17. Product Availability

Products must support at least:

```text
AVAILABLE
SOLD_OUT
HIDDEN
```

## Available

The product can be ordered.

## Sold Out

The product remains visible but cannot be added to a new order, depending on UX configuration.

## Hidden

The product is not displayed publicly.

Historical orders must remain unchanged.

---

# 18. Payment Requirements

Payment methods must be configurable.

Initial supported concepts:

1. Electronic Payment
2. Bank/Exchange Transfer
3. Pay at Pickup

The restaurant must be able to enable or disable methods.

Payment configuration must not be hardcoded.

---

# 19. Payment State Model

Payment state is separate from order state.

Possible payment states:

```text
UNPAID
PENDING
PROCESSING
VERIFIED
PAID
REJECTED
REFUNDED
```

Only relevant states should be used for each payment method.

---

# 20. Transfer Payment

For bank/exchange transfer:

Customer may provide:

- payment method
- transaction/reference number
- amount
- receipt image

The receipt must be stored securely.

The system should create:

```text
Payment = PENDING
```

until reviewed.

---

# 21. Payment Verification

Authorized staff can review:

```text
Order #1042
Amount: 4,500
Method: Bank Transfer
Reference: 8473921
Receipt: [Preview]
```

Actions:

```text
Approve
Reject
```

On approval:

```text
Payment = VERIFIED
```

On rejection:

```text
Payment = REJECTED
```

The system must record:

- reviewer
- timestamp
- previous status
- new status
- optional reason

---

# 22. Electronic Payment Integration

The system must not implement a custom payment gateway.

Payment providers should be integrated through a clear abstraction.

Potential conceptual interface:

```text
createPayment()
verifyPayment()
refundPayment()
handleWebhook()
```

If a production payment provider is not available, the system must clearly distinguish demo/test behavior from production payment behavior.

---

# 23. Order Management

## 23.1 Primary Order States

```text
PENDING
CONFIRMED
QUEUED
PREPARING
READY
COMPLETED
```

## 23.2 Alternative States

```text
PAYMENT_PENDING
REJECTED
CANCELLED
REFUNDED
```

## 23.3 State Transition Rules

Order status must be controlled.

The system must not allow arbitrary status manipulation from the client.

Each transition should validate:

- current state
- target state
- user permissions
- payment state where relevant
- order timing
- business rules

---

# 24. Order History

Every important order transition must be recorded.

Example:

```text
16:02 — Order Created
16:03 — Payment Submitted
16:08 — Payment Verified
18:35 — Kitchen Started
18:57 — Ready
19:04 — Completed
```

Each event should include:

- timestamp
- actor where applicable
- event type
- previous state
- new state
- optional metadata

---

# 25. Kitchen Display System

The kitchen interface must be optimized for fast operational use.

It should show:

- order number
- products
- quantities
- selected options
- customer notes relevant to preparation
- pickup time
- status
- elapsed/waiting time where useful

Primary actions:

```text
START
READY
COMPLETE
```

The interface should be usable on:

- tablet
- laptop
- large display

---

# 26. Kitchen Release

For scheduled orders:

```text
Kitchen Release Time =
Pickup Time - Preparation Time
```

The system must ensure future orders are not treated as immediate kitchen work.

Edge cases:

- order placed too late
- restaurant closes before pickup
- payment still pending
- order cancelled
- preparation time changes
- restaurant pauses orders

---

# 27. Customer Order Tracking

The customer must be able to view:

- order reference
- order items
- total
- payment status
- pickup time
- order status
- relevant status history
- restaurant contact information

Possible customer-facing status labels:

```text
Order Received
Payment Under Review
Order Confirmed
Queued
Preparing
Ready for Pickup
Completed
```

Do not expose unnecessary internal information.

---

# 28. Customer Accounts

MVP should support guest checkout.

Accounts should not be mandatory.

A future account system may support:

- saved profile
- order history
- saved preferences
- reorder
- loyalty
- saved addresses

---

# 29. Reorder

Future feature.

A completed order could support:

> Order Again

The system must revalidate:

- product availability
- current prices
- current options

It must not blindly copy obsolete pricing.

---

# 30. Restaurant Administration

The administration panel is a core product area.

Required modules:

```text
Dashboard
Orders
Payments
Products
Categories
Add-ons
Customers
Business Hours
Payment Methods
Restaurant Settings
Staff / Access
```

Optional MVP modules:

```text
Promotions
Analytics
```

---

# 31. Dashboard

The dashboard should provide operational information.

Potential metrics:

- today's orders
- today's sales
- pending payments
- preparing orders
- ready orders
- completed orders
- cancelled orders

Avoid decorative metrics without operational value.

---

# 32. Product Management

Authorized users can:

- create product
- update product
- archive/hide product
- change price
- change image
- change description
- assign category
- configure variants
- configure add-ons
- change availability
- feature/unfeature product
- reorder display position

Price changes must not alter historical order totals.

---

# 33. Category Management

Categories must support:

- name
- slug
- description if required
- image if required
- active state
- sort order

Categories should be manageable without code changes.

---

# 34. Add-On Management

Add-ons must support:

- name
- price
- availability
- active state
- applicable products/categories where required

Example:

```text
Extra Cheese +300
Olives +200
Mushrooms +250
```

---

# 35. Customer Management

Staff may view:

- customer name
- phone
- email if collected
- order count
- order history
- first order date
- latest order date

Access must follow privacy and role permissions.

---

# 36. Promotions

MVP promotions should remain simple.

Potential support:

- percentage discount
- fixed discount
- combo
- product-specific offer
- category-specific offer
- start/end dates
- active/inactive
- minimum order value where required

Do not build a complex coupon engine unless explicitly required.

---

# 37. Roles and Permissions

Initial roles:

```text
OWNER
MANAGER
CASHIER
KITCHEN
```

Permissions should be explicit.

Examples:

```text
dashboard.read

orders.read
orders.update
orders.cancel

payments.read
payments.verify
payments.reject

products.read
products.create
products.update
products.delete

categories.manage
addons.manage

kitchen.read
kitchen.update

customers.read

promotions.manage

settings.read
settings.update

reports.read

staff.manage
```

Authorization must be enforced server-side.

UI hiding alone is not security.

---

# 38. Role Expectations

## OWNER

Full restaurant control.

## MANAGER

Daily operational control.

## CASHIER

Orders and payment verification.

## KITCHEN

Kitchen workflow only.

Kitchen staff should not have access to sensitive financial or configuration features unless explicitly granted.

---

# 39. Authentication

Administrative access requires secure authentication.

Requirements:

- secure sessions
- password hashing using a modern secure algorithm
- secure cookies
- session expiration/rotation where appropriate
- logout
- authorization checks
- rate limiting where appropriate
- no default production credentials

Customer guest checkout does not require authentication.

---

# 40. Security Requirements

The system must protect against:

- broken access control
- IDOR
- privilege escalation
- SQL injection
- XSS
- CSRF where applicable
- malicious uploads
- forged prices
- forged quantities
- forged order states
- unauthorized payment access
- unauthorized receipt access
- session abuse
- secret leakage
- duplicate order submission

Security validation must occur server-side.

---

# 41. Order Security

A customer must not be able to access another customer's order simply by changing an identifier in the URL.

Order references must not become a substitute for authorization.

Use appropriate access controls and secure verification mechanisms.

---

# 42. File Upload Security

Payment receipts must:

- have size limits
- have MIME/type validation
- have safe generated filenames
- not permit executable content
- not expose storage paths
- require authorization for access
- be stored securely

Never trust client-provided filenames.

---

# 43. Financial Integrity

The client must never be trusted for:

- final price
- discount amount
- tax/fee calculation
- product price
- payment amount
- order total

The server must calculate and validate the final order.

---

# 44. Order Snapshot Integrity

Historical orders must preserve the information relevant at purchase time.

If:

```text
Pepperoni = 2,500
```

and later the product changes to:

```text
Pepperoni = 2,800
```

previous orders must remain:

```text
Pepperoni = 2,500
```

Order items should store historical product name, selected options, unit price, quantity, and relevant totals.

---

# 45. Idempotency and Duplicate Prevention

Critical actions must be safe against accidental repetition.

Especially:

- order creation
- payment submission
- payment webhook handling
- payment verification
- status transitions

Double-clicking "Place Order" must not create two orders.

---

# 46. Concurrency

The system should account for:

- two customers ordering the last available item
- product becoming sold out during checkout
- manager changing price during checkout
- simultaneous staff status changes
- payment verification while an order is cancelled
- scheduled order release

Use transactions and server-side validation where necessary.

---

# 47. Localization

The application must support:

```text
Arabic — RTL
English — LTR
```

Arabic is the primary language for the initial Pizza House deployment.

Localization must cover:

- navigation
- buttons
- validation
- statuses
- dashboard
- order flow
- settings
- errors
- metadata
- empty states
- notifications

Avoid scattered hardcoded strings.

---

# 48. Design Requirements

The product should feel:

- premium
- modern
- trustworthy
- fast
- restaurant-focused
- operationally practical

Avoid:

- generic AI-generated layouts
- excessive gradients
- excessive glassmorphism
- excessive animation
- emoji-dependent UI
- visual clutter
- huge unnecessary typography
- meaningless dashboard cards
- unnecessary page transitions

Use:

- strong typography
- consistent spacing
- accessible contrast
- professional imagery
- clear CTA hierarchy
- subtle animation
- reusable components
- polished mobile behavior

---

# 49. Responsive Requirements

Mobile-first.

Primary customer device:

> Smartphone

Must also support:

- tablet
- desktop
- kitchen tablet/display
- admin desktop

The layout must be tested at realistic viewport sizes.

---

# 50. Accessibility

Follow practical WCAG principles.

Requirements include:

- semantic HTML
- keyboard navigation
- visible focus
- accessible form labels
- accessible dialogs
- appropriate contrast
- meaningful alt text
- screen-reader-friendly status changes
- no color-only communication

---

# 51. SEO

Public pages must support:

- unique title
- description
- canonical URL
- Open Graph
- social metadata
- sitemap
- robots
- structured data
- Restaurant/LocalBusiness schema
- location information where appropriate
- Arabic SEO
- English SEO

Potential search intent:

- Pizza House Mukalla
- Pizza in Mukalla
- بيتزا في المكلا
- مطعم بيتزا في المكلا

Do not keyword-stuff content.

---

# 52. Analytics

Track meaningful events.

Minimum event set:

```text
page_view
menu_view
product_view
add_to_cart
remove_from_cart
checkout_started
checkout_completed
order_created
payment_started
payment_submitted
payment_verified
payment_rejected
order_cancelled
order_preparing
order_ready
order_completed
```

Do not collect unnecessary personal information.

---

# 53. Analytics Funnel

The platform should be capable of measuring:

```text
Visitors
   ↓
Menu Views
   ↓
Product Views
   ↓
Add to Cart
   ↓
Checkout Started
   ↓
Orders
```

Future dashboard metrics:

- total orders
- sales
- average order value
- best-selling product
- best category
- peak hour
- repeat customer rate
- cancellation rate
- payment method distribution
- pickup vs delivery

---

# 54. Notifications

MVP notification strategy should remain simple.

Potential channels:

- order tracking page
- email if configured
- WhatsApp/manual contact where appropriate

Important events:

```text
Order Received
Payment Verified
Order Confirmed
Preparing
Ready
Completed
```

Do not spam customers.

Notification failures should not destroy the underlying order workflow.

---

# 55. WhatsApp

MVP:

- WhatsApp contact button
- optional order-related contact action
- manual communication

Future:

- automated confirmation
- status notifications
- support automation
- customer service workflows

A full WhatsApp bot is not part of MVP.

---

# 56. Delivery

MVP is pickup-first.

Delivery should be disabled unless explicitly enabled.

Future delivery architecture may include:

```text
Delivery Zones
Delivery Fees
Driver Assignment
Out for Delivery
Delivered
```

Later possibilities:

- driver management
- external delivery providers
- route optimization

These are not MVP requirements.

---

# 57. AI Strategy

AI should solve actual operational problems.

Do not add AI simply because it is fashionable.

Future AI opportunities:

1. Receipt OCR assistance
2. Sales analysis
3. Review analysis
4. Demand forecasting
5. Promotion suggestions
6. Management assistant

AI must remain assistive.

Human confirmation must be required for important financial decisions.

---

# 58. Database Requirements

Expected core entities:

```text
User
Role
Permission

Restaurant
RestaurantSettings
BusinessHour
ScheduleOverride

Category
Product
ProductVariant
ProductAddon

Customer

Order
OrderItem
OrderItemOption
OrderStatusHistory

Payment
PaymentMethod
PaymentReceipt
PaymentStatusHistory

Promotion

Notification

AnalyticsEvent

AuditLog
```

Additional entities should only be added when justified by requirements.

---

# 59. Data Integrity

Use database-level constraints for:

- foreign keys
- unique identifiers
- unique slugs
- valid quantities
- non-negative prices
- required relationships
- valid statuses

Do not rely entirely on frontend validation.

---

# 60. Currency and Money

Currency must be explicit.

Example:

```text
currency = YER
amount = 2500
```

Do not silently convert currencies.

Use integer minor units or another precise representation appropriate to the currency.

Never use unreliable floating-point calculations for financial values.

---

# 61. Audit Logging

Important actions should be auditable.

Examples:

- payment verification
- payment rejection
- order cancellation
- product price change
- availability change
- settings change
- role changes

Record where appropriate:

```text
actor
action
entity
entity_id
timestamp
metadata
```

---

# 62. Error Handling

Production users must never see:

- stack traces
- database errors
- internal file paths
- secret configuration
- debugging information

Errors should be:

- understandable
- actionable
- localized where appropriate
- logged internally

---

# 63. Loading and Empty States

Every major workflow must have appropriate loading states.

Every major list must have meaningful empty states.

Examples:

> No orders yet.

> No pending payments.

> No products found.

Do not display unexplained blank screens.

---

# 64. Performance Requirements

Optimize:

- image delivery
- server rendering
- database queries
- bundle size
- unnecessary client components
- caching
- lazy loading
- pagination
- API calls

Do not make the entire application client-side unnecessarily.

Prefer server-side capabilities when appropriate.

---

# 65. Technical Architecture

The preferred architecture is a modular monolith.

Conceptually:

```text
Next.js
│
├── Public Customer Experience
├── Customer Ordering
├── Admin
├── Kitchen
├── Authentication
├── API / Server Actions
├── Domain Services
├── Database
├── Storage
├── Notifications
└── Analytics
```

The exact implementation may evolve if justified.

Any major architectural deviation must be documented in `DECISIONS.md`.

---

# 66. Recommended Technology

Preferred stack:

- Next.js
- React
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui or equivalent accessible components
- Lucide
- PostgreSQL
- Prisma
- Zod
- React Hook Form where appropriate
- secure authentication solution
- Playwright
- Vitest or equivalent
- ESLint
- Prettier

Use stable versions compatible with one another.

Avoid unnecessary dependencies.

---

# 67. Project Structure

Recommended structure:

```text
src/
  app/
  components/
  features/
    auth/
    restaurant/
    products/
    orders/
    payments/
    kitchen/
    customers/
    promotions/
    analytics/
    notifications/
  lib/
  server/
  db/
  types/
  config/
  hooks/
  utils/

prisma/

public/

tests/
  unit/
  integration/
  e2e/

docs/
```

The final structure may differ if a documented architectural reason exists.

---

# 68. Required Documentation

The project should maintain:

```text
docs/
├── README.md
├── PRODUCT-REQUIREMENTS.md
├── PRODUCT-SCOPE.md
├── USER-PERSONAS.md
├── USER-STORIES.md
├── USER-FLOWS.md
├── ARCHITECTURE.md
├── DATABASE.md
├── DATA-MODEL.md
├── ROLES-PERMISSIONS.md
├── ORDER-STATE-MACHINE.md
├── PAYMENT-FLOW.md
├── KITCHEN-FLOW.md
├── NOTIFICATION-FLOW.md
├── ANALYTICS.md
├── SEO.md
├── LOCALIZATION.md
├── SECURITY.md
├── TESTING.md
├── QA-CHECKLIST.md
├── DEPLOYMENT.md
├── ENVIRONMENT.md
├── API.md
├── DESIGN-SYSTEM.md
├── ROADMAP.md
├── BACKLOG.md
├── DECISIONS.md
├── CHANGELOG.md
├── PROJECT-STATUS.md
├── HANDOVER.md
└── FINAL-REPORT.md
```

Documents must contain useful project-specific information, not filler.

---

# 69. User Stories

Each major feature should be represented as user stories.

Example:

### Scheduled Pickup

**As a customer,**

I want to choose a valid pickup time,

so that I can arrive when my order is expected to be ready.

Acceptance criteria:

- invalid times cannot be selected
- restaurant hours are respected
- preparation time is respected
- scheduled orders are not released too early
- the selected time is stored with the order

---

# 70. Acceptance Criteria

Features are not complete merely because the UI exists.

Example:

## Scheduled Pickup

Given:

```text
Current time = 17:30
Preparation time = 25 minutes
```

When the customer attempts to select:

```text
17:40
```

Then:

- the system rejects the time
- the system offers the earliest valid time
- the customer receives a clear explanation

---

# 71. Definition of Done

A feature is complete only when:

```text
Requirements complete
↓
UI complete
↓
Business logic complete
↓
Database complete
↓
Validation complete
↓
Authorization complete
↓
Error handling complete
↓
Tests complete
↓
Responsive QA complete
↓
Arabic QA complete
↓
English QA complete
↓
Security QA complete
↓
Documentation updated
↓
Acceptance criteria passed
```

---

# 72. Testing Strategy

## 72.1 Unit Tests

Test:

- pricing
- discounts
- pickup time calculation
- order transitions
- payment transitions
- availability rules
- validation

## 72.2 Integration Tests

Test:

- database operations
- order creation
- payment verification
- authorization
- product availability
- scheduled order release

## 72.3 E2E Tests

Use Playwright.

Customer flow:

```text
Homepage
→ Menu
→ Product
→ Cart
→ Checkout
→ Order
→ Tracking
```

Staff flow:

```text
Admin
→ Payment
→ Verify
→ Order
```

Kitchen flow:

```text
Kitchen
→ Queued
→ Preparing
→ Ready
→ Complete
```

---

# 73. Security QA

Explicitly test:

- unauthorized admin access
- unauthorized kitchen access
- role escalation
- IDOR
- price manipulation
- quantity manipulation
- invalid product IDs
- invalid status transitions
- malicious uploads
- unauthorized receipt access
- duplicate order submission
- session abuse

---

# 74. Browser QA

Minimum QA:

- mobile Chrome
- desktop Chrome
- responsive layouts
- Arabic RTL
- English LTR

Critical paths must be tested manually and through automated E2E tests.

---

# 75. Deployment Requirements

Deployment documentation must cover:

- runtime requirements
- environment variables
- database setup
- migrations
- seed strategy
- file storage
- build
- start command
- domain
- SSL
- backups
- logs
- monitoring
- rollback

The application should be deployable by following documented instructions.

---

# 76. Environment Variables

Maintain:

```text
.env.example
```

Never commit secrets.

Document all variables in:

```text
docs/ENVIRONMENT.md
```

Classify each variable as:

- required
- optional
- development-only
- production-only

---

# 77. Seed Data

Development/demo seed data should be realistic.

Do not use meaningless placeholder data such as:

```text
Product 1
Product 2
Test User
```

Seed data should represent a realistic Pizza House environment.

Production seed behavior must be explicitly documented.

---

# 78. Backup and Recovery

Production documentation must define:

- backup frequency
- retention
- storage
- restore process
- responsible party

A backup strategy is incomplete without a restore procedure.

---

# 79. Monitoring

Production should support:

- application logs
- error tracking/logging
- health checks
- database monitoring where available

Do not log:

- passwords
- tokens
- private credentials
- unnecessary sensitive personal information

---

# 80. Git and Change Management

Use clean Git practices.

Recommended stable branch:

```text
main
```

Feature branches may include:

```text
feature/menu
feature/orders
feature/payments
feature/kitchen
feature/admin
```

Before merging:

- typecheck
- lint
- tests
- build
- relevant E2E tests

must pass.

---

# 81. Scope Change Policy

When a new requirement appears:

1. determine whether it is in scope
2. identify the phase
3. determine dependencies
4. determine architectural impact
5. update documentation
6. update backlog
7. implement only when approved

Do not silently expand the scope.

---

# 82. Product Roadmap

## Phase 0 — Discovery

Deliverables:

- requirements
- PRD
- personas
- user stories
- flows
- architecture
- data model
- design direction
- backlog

## Phase 1 — Sales Demo

Deliverables:

- homepage
- menu
- product details
- cart
- checkout prototype
- dashboard prototype
- kitchen prototype
- realistic demo data

Objective:

> Demonstrate and sell the concept.

## Phase 2 — MVP

Deliver:

- real database
- ordering
- pickup
- scheduled pickup
- payment methods
- transfer receipts
- payment verification
- admin
- kitchen
- order tracking
- authentication
- RBAC
- availability
- business hours
- pause orders
- basic analytics

## Phase 3 — Production

Deliver:

- security hardening
- performance optimization
- SEO
- monitoring
- backups
- deployment
- production configuration
- browser QA
- Arabic/English QA
- handover documentation

## Phase 4 — Growth

Potential features:

- delivery
- promotions
- reviews
- loyalty
- WhatsApp automation
- advanced analytics
- reorder
- notifications
- capacity management

## Phase 5 — Productization

Convert lessons from Pizza House into:

> Novixa Restaurant

Potential capabilities:

- reusable restaurant configuration
- multi-restaurant support
- custom domains
- branding
- subscriptions
- tenant isolation
- billing
- restaurant onboarding

Do not implement Phase 5 infrastructure during the initial MVP unless explicitly required.

---

# 83. Success Metrics

The MVP should be measured using practical metrics.

## Customer

- menu-to-cart conversion
- cart-to-checkout conversion
- checkout completion
- order completion
- repeat ordering

## Restaurant

- number of online orders
- payment verification time
- order preparation time
- pickup readiness
- cancellation rate
- order errors

## Product

- uptime
- critical error rate
- page performance
- failed checkout rate
- payment failure rate

Do not define arbitrary success percentages before baseline data exists.

---

# 84. Business Model

The first implementation is a customer project.

Potential commercial structure:

```text
Implementation / Setup Fee
+
Optional Hosting
+
Maintenance
+
Support
+
Future Feature Development
+
Growth Services
```

Future Novixa Restaurant model:

```text
Starter
Business
Professional
Enterprise / Custom
```

Exact pricing is outside this technical PRD and must be determined separately.

---

# 85. Client Delivery Model

Recommended lifecycle:

```text
Discovery
↓
Proposal
↓
Scope
↓
Agreement
↓
Initial Payment
↓
Design / Demo
↓
Development
↓
Client Review
↓
UAT
↓
Production
↓
Training
↓
Handover
↓
Warranty
↓
Maintenance
↓
Growth
```

The project scope must clearly distinguish:

### Included

- agreed website
- ordering
- admin
- kitchen
- payment methods
- deployment

### Not Included Unless Explicitly Agreed

- payment provider fees
- SMS fees
- WhatsApp API fees
- hardware
- delivery staff
- POS replacement
- third-party subscriptions
- future features

---

# 86. Training and Handover

Provide a concise operational guide.

## Manager

- login
- products
- prices
- availability
- orders
- payments
- promotions
- settings
- reports

## Kitchen

- queued
- preparing
- ready
- complete

Training should focus on actual daily workflows.

---

# 87. Warranty and Maintenance

A separate service agreement may provide:

- bug fixes
- backups
- updates
- monitoring
- small changes
- technical support

Warranty should cover defects within the agreed delivered scope.

New functionality is not automatically included as a bug fix.

---

# 88. Future Productization

Pizza House should become the validation layer for Novixa Restaurant.

Conceptually:

```text
Pizza House
    ↓
Real-world usage
    ↓
Operational lessons
    ↓
Refactoring
    ↓
Reusable modules
    ↓
Novixa Restaurant
    ↓
Restaurant A
Restaurant B
Restaurant C
```

Restaurant-specific configuration should eventually include:

- logo
- colors
- branding
- menu
- categories
- products
- prices
- currency
- payment methods
- business hours
- pickup settings
- delivery settings
- SEO
- contact information

---

# 89. Architecture Principles for Future Productization

Even though multi-tenancy is not part of MVP:

- avoid hardcoding Pizza House values into business logic
- keep restaurant configuration centralized
- avoid deeply coupling UI components to one restaurant
- use configuration for branding where reasonable
- separate domain logic from presentation
- use clean service boundaries
- avoid database assumptions that prevent future tenant isolation

Do not over-engineer for hypothetical scale.

---

# 90. Risks

## Risk: Existing Restaurant System

Pizza House may already use another POS/system.

Mitigation:

- treat the product as an ordering layer
- investigate current systems during discovery
- do not promise POS replacement
- consider integration later

## Risk: Payment Availability

Local electronic payment APIs may be unavailable or inconsistent.

Mitigation:

- support configurable payment methods
- support transfer verification
- support pay-at-pickup
- isolate payment integrations

## Risk: Operational Change

Staff may resist a completely new workflow.

Mitigation:

- keep workflows simple
- train staff
- start with a pilot
- do not replace existing systems unnecessarily

## Risk: Scope Creep

Too many features can delay launch.

Mitigation:

- enforce phase boundaries
- use backlog
- use acceptance criteria
- require explicit scope changes

## Risk: Future SaaS Premature Complexity

Building multi-tenancy too early can slow delivery.

Mitigation:

- single-restaurant MVP
- clean modular architecture
- productize after validation

---

# 91. Key Business Rules

1. The server is the authority for pricing.
2. Customers may use guest checkout.
3. Payment state and order state are separate.
4. Transfer payments require verification before being treated as verified.
5. Sold-out products cannot be included in new orders.
6. Hidden products cannot be ordered.
7. Scheduled pickup times must respect preparation time and business hours.
8. Future orders must not enter active kitchen preparation too early.
9. Pausing online ordering does not affect existing orders.
10. Historical orders preserve historical prices and product information.
11. Unauthorized users cannot change financial or operational data.
12. Critical operations must be protected against duplication.
13. AI must not independently make irreversible financial decisions.
14. Delivery is optional and not required for MVP.
15. Multi-tenancy is not required for MVP.
16. New features must be assigned to a defined phase.
17. Documentation must reflect important architectural decisions.
18. A feature is not complete until its acceptance criteria and tests pass.

---

# 92. Critical Acceptance Scenarios

## Scenario A — Normal Pickup Order

Given the restaurant is open and the product is available.

When the customer:

1. selects a product
2. chooses options
3. adds it to cart
4. chooses pickup
5. selects ASAP
6. selects a valid payment method
7. submits the order

Then:

- an order is created
- the total is calculated server-side
- the customer receives an order reference
- the restaurant sees the order
- the order follows the correct state workflow

---

## Scenario B — Transfer Payment

Given transfer payment is enabled.

When the customer submits:

- payment method
- receipt
- reference

Then:

```text
Payment = PENDING
```

After authorized staff approves:

```text
Payment = VERIFIED
```

The order may proceed according to configured business rules.

---

## Scenario C — Rejected Payment

If staff rejects a transfer:

```text
Payment = REJECTED
```

The customer must receive a clear status.

The order must not be treated as successfully paid.

---

## Scenario D — Scheduled Order

Given:

```text
Pickup = 19:00
Preparation = 25 minutes
```

The kitchen release must be:

```text
18:35
```

The order must not appear as an active kitchen task at 16:00.

---

## Scenario E — Sold Out Product

Given a product is marked:

```text
SOLD_OUT
```

A customer cannot create a new order containing that product.

Existing historical orders remain unchanged.

---

## Scenario F — Pause Orders

Given:

```text
Online Ordering = PAUSED
```

Customers can browse.

Customers cannot create new orders.

Existing orders continue normally.

---

## Scenario G — Unauthorized Access

Given a Kitchen user attempts to access financial settings.

Then:

- server-side authorization denies access
- the UI does not expose the feature
- the action is not executed

---

## Scenario H — Price Manipulation

Given a customer modifies a browser request and submits a lower product price.

Then:

- the server ignores the manipulated price
- the server retrieves the authoritative price
- the order uses the valid server-side calculation

---

## Scenario I — Duplicate Submission

Given a customer clicks "Place Order" multiple times.

Then:

- only one valid order is created
- duplicate submissions are rejected or deduplicated

---

# 93. Final MVP Acceptance Criteria

The MVP is considered functionally complete only when this end-to-end flow succeeds:

```text
Customer
↓
Homepage
↓
Menu
↓
Product
↓
Customization
↓
Cart
↓
Checkout
↓
Pickup
↓
Valid Pickup Time
↓
Payment Method
↓
Payment Submission if Required
↓
Order Created
↓
Order Reference
↓
Order Tracking
↓
Payment Verification if Required
↓
Order Confirmed
↓
Kitchen Release
↓
Preparing
↓
Ready
↓
Customer Pickup
↓
Completed
```

And the restaurant workflow succeeds:

```text
Admin
↓
Manage Menu
↓
Manage Availability
↓
Receive Order
↓
Verify Payment
↓
Monitor Order
↓
Kitchen
↓
Prepare
↓
Ready
↓
Complete
```

---

# 94. Production Readiness Checklist

## Product

- [ ] MVP scope implemented
- [ ] acceptance criteria passed
- [ ] no critical workflow gaps
- [ ] no unauthorized scope creep

## Code

- [ ] TypeScript passes
- [ ] lint passes
- [ ] build passes
- [ ] no critical dead code
- [ ] no secrets committed

## Database

- [ ] migrations work
- [ ] constraints validated
- [ ] seed strategy documented
- [ ] historical order integrity verified

## Security

- [ ] authentication tested
- [ ] RBAC tested
- [ ] IDOR tested
- [ ] file uploads tested
- [ ] price manipulation tested
- [ ] order state transitions protected
- [ ] payment access protected

## UX

- [ ] mobile tested
- [ ] desktop tested
- [ ] Arabic tested
- [ ] English tested
- [ ] loading states tested
- [ ] empty states tested
- [ ] error states tested

## Business

- [ ] pickup tested
- [ ] scheduled pickup tested
- [ ] payment tested
- [ ] receipt verification tested
- [ ] kitchen tested
- [ ] pause orders tested
- [ ] sold out tested
- [ ] business hours tested

## SEO

- [ ] metadata
- [ ] sitemap
- [ ] robots
- [ ] canonical
- [ ] structured data
- [ ] Open Graph

## Deployment

- [ ] environment documented
- [ ] production build verified
- [ ] database deployment documented
- [ ] storage documented
- [ ] backup strategy documented
- [ ] rollback strategy documented
- [ ] monitoring documented

---

# 95. Definition of Product Success

The product should succeed when Pizza House can use it as a practical digital ordering channel without requiring the development team for normal daily operations.

A restaurant employee should be able to:

- update a price
- mark an item sold out
- verify a payment
- process an order
- operate the kitchen queue
- pause online ordering
- manage business hours

without developer intervention.

A customer should be able to:

- understand the menu quickly
- customize a product
- place an order
- choose a valid pickup time
- complete the supported payment flow
- understand order status
- know when the order is ready

without confusion.

---

# 96. Product Philosophy

The product should follow five principles:

## 1. Simplicity

Restaurant staff should not need technical knowledge.

## 2. Reliability

An ordering system must be dependable.

## 3. Transparency

Customers should understand what is happening with their order.

## 4. Security

Financial and operational actions must be protected.

## 5. Extensibility

Pizza House should be able to evolve into Novixa Restaurant without requiring a complete rewrite.

---

# 97. Final Product Definition

Pizza House is:

> **A mobile-first, Arabic-first digital ordering and restaurant operations platform that connects customers, payments, restaurant administration, and kitchen operations through one coherent workflow.**

It is not:

> a static restaurant website.

It is not:

> a premature multi-tenant SaaS platform.

It is:

> **the first serious production implementation of Novixa Restaurant.**

The immediate objective is to build a complete, reliable, sellable restaurant ordering system.

The long-term objective is to turn the validated implementation into a reusable Novixa product.

---

# 98. Document Governance

This PRD is the baseline product specification.

Changes should be recorded through:

- `DECISIONS.md`
- `CHANGELOG.md`
- `BACKLOG.md`
- updated acceptance criteria where necessary

Major scope changes require explicit review.

The implementation should remain aligned with this document unless a documented product decision supersedes a requirement.

---

# 99. Final Principle

> **Do not build everything. Build the right things, make them work completely, validate them in the real restaurant workflow, and only then expand the product.**

Pizza House is the validation ground.

Novixa Restaurant is the product opportunity.

The MVP must optimize for real operational value, fast adoption, maintainability, and a clear path to future productization.
