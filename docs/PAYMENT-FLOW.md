# Payment Flow

Yemen has no ubiquitous card-present online payment rail, so the payment
model here is the one the restaurant actually uses: cash at the counter, or a
bank transfer the customer makes themselves and the restaurant confirms by
eye. The product's job is not to process money — it is to make sure an order
never reaches the kitchen on the strength of a payment nobody checked.

Configured per method in `PaymentMethodConfig`, editable from
`/admin/settings`. A method the restaurant cannot support is switched off and
disappears from checkout; nothing is hardcoded.

## The methods

| Method | Order path | Who confirms |
|---|---|---|
| `PAY_AT_PICKUP` | Straight to `CONFIRMED` | Nobody — the money arrives with the customer |
| `BANK_TRANSFER` | `PAYMENT_PENDING` until reviewed | Staff, against a receipt |
| `ELECTRONIC` | Modelled, disabled | — reserved for a future gateway |

## Pay at pickup

```
checkout → Order CONFIRMED, Payment UNPAID
        → kitchen release at kitchenReleaseAt
        → customer collects and pays → COMPLETED
```

The order is trusted immediately because the restaurant risks only the cost
of the food, and a customer who does not collect is a problem for the owner's
judgement — an admin cancel and, if the same phone number does it repeatedly,
a conversation. The platform does not try to solve no-shows with technology.

## Bank transfer

```
checkout with reference number (+ optional receipt image)
        │
        ▼
Order PAYMENT_PENDING          Payment PENDING
        │                      appears in /admin/payments
        │
        ├── staff opens the receipt        → logged to the audit trail
        │
        ├── verify ──▶ Payment VERIFIED ──▶ Order CONFIRMED
        │                                   → enters the release schedule
        │
        └── reject ──▶ Payment REJECTED ──▶ Order REJECTED
                                            → slot released
```

**The order does not take a pickup slot's worth of kitchen time until the
transfer is verified.** That is the whole reason `PAYMENT_PENDING` exists as
a distinct status: an unverified claim of payment should not be able to fill
the 19:00 slot and keep paying customers out of it.

### One subtlety worth knowing

Verifying a payment confirms the order **only if the order is still waiting
for it**:

```ts
if (payment.order.status === "PAYMENT_PENDING" || payment.order.status === "PENDING") {
  await transitionOrder(payment.orderId, "CONFIRMED", actor, "payment_verified");
}
```

An order cancelled while the transfer was in review stays cancelled. The
payment is still recorded as `VERIFIED`, because the money genuinely did
arrive and the refund conversation needs that fact on record. Silently
un-cancelling an order because a transfer landed late would put food in front
of a customer who had already walked away.

## Receipts

An image of the transfer slip, uploaded either at checkout or afterwards from
the tracking page (a customer who paid after ordering can still attach
proof).

**Storage.** `PaymentReceipt.data` is a `bytea` column, not a file. The
reasoning is in `docs/DECISIONS.md`; the short version is that a public
uploads folder has no access control and guessable URLs, and object storage
is a service to provision and pay for before the restaurant has taken its
first order. Bytes in the database make the authorization check unavoidable.

**Validation**, all server-side (`decodeReceipt` in
`src/server/order-schema.ts`):

- Content type must be one of `image/jpeg`, `image/png`, `image/webp`
- Maximum 3 MB, re-checked **after** base64 decode, not on the encoded string
- The bytes are sniffed for the format's magic number — a `.png` that is
  actually an HTML file is rejected. A client-declared content type is a
  hint, never a permission.
- `originalName` is sanitized and stored for display only; it never builds a
  filesystem path, because there is no filesystem path.

**Serving.** `GET /api/receipts/[paymentId]` requires
`payments.receipt.read`, and **every view writes an audit entry**
(`payment.receipt.view`). A receipt shows a customer's bank details; who
looked at one and when is a question that should have an answer.

## Payment status vs. order status

Two separate state machines, on purpose (`docs/PRD.md` §19):

```
Payment:  UNPAID → PENDING → PROCESSING → VERIFIED → PAID
                      ↓                       ↓
                   REJECTED                REFUNDED
```

An order can be `PAYMENT_PENDING` while its payment is `PENDING`, and the two
resolve on different schedules — the transfer clears when a human checks the
bank app, the order progresses when the kitchen cooks. Collapsing them into
one field would mean inventing statuses like `CONFIRMED_BUT_PAYMENT_PENDING`
and multiplying every future state by two.

## Concurrency

Verification uses the same guarded-update pattern as order transitions:

```ts
await tx.payment.updateMany({ where: { id, status: previous }, data: { status: "VERIFIED" } });
if (result.count === 0) throw new ConcurrentUpdateError();
```

Two staff members opening the same payment and both clicking Verify produce
one verification and one clear "this changed while you were working on it" —
not two history rows and not two confirmations of the same order.

## What is not built

- **No payment gateway integration.** `ELECTRONIC` exists in the enum and the
  config table so adding one is a new branch in `createOrder` and a webhook
  route, not a schema migration.
- **No automated bank reconciliation.** Verification is a human reading a
  transfer reference against a bank app. That is what the restaurant does
  today; automating it needs bank API access that does not exist here.
- **No partial payments or split bills.** One order, one payment, one amount.
