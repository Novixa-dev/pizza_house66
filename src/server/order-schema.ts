import { z } from "zod";

// Request validation for order creation.
//
// Note what is *not* here: no prices, no totals, no discount amounts, no
// order status. The client may say what it wants, never what it costs — the
// server re-reads every price from the database (docs/PRD.md §43, §92.H).

export const RECEIPT_MAX_BYTES = 3 * 1024 * 1024; // 3MB — safely under serverless body limits
export const RECEIPT_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const cartItemSchema = z.object({
  productId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(20),
  optionValueIds: z.array(z.string().min(1).max(64)).max(20).default([]),
  note: z.string().trim().max(200).optional(),
});

// Phone numbers in Yemen are written with and without the +967 prefix, with
// spaces and dashes. Accept the shapes people actually type, then normalize.
const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^[+]?[\d\s()-]{7,20}$/, "invalid_phone");

export const createOrderSchema = z.object({
  // Generated once per checkout form instance. A double-clicked submit sends
  // the same key twice and gets the same order back (docs/PRD.md §45).
  idempotencyKey: z.string().min(8).max(100),
  items: z.array(cartItemSchema).min(1).max(50),
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: phoneSchema,
  }),
  pickup: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("ASAP") }),
    z.object({ mode: z.literal("SCHEDULED"), requestedAt: z.iso.datetime() }),
  ]),
  payment: z.discriminatedUnion("method", [
    z.object({ method: z.literal("PAY_AT_PICKUP") }),
    z.object({
      method: z.literal("BANK_TRANSFER"),
      referenceNumber: z.string().trim().min(2).max(60),
      receipt: z
        .object({
          contentType: z.enum(RECEIPT_ALLOWED_TYPES),
          // base64 without the data: prefix; size is re-checked after decode.
          dataBase64: z.string().min(1).max(Math.ceil(RECEIPT_MAX_BYTES * 1.4)),
          originalName: z.string().trim().max(120).optional(),
        })
        .optional(),
    }),
  ]),
  promoCode: z.string().trim().min(2).max(40).optional(),
  notes: z.string().trim().max(300).optional(),
  sessionId: z.string().trim().max(64).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const uploadReceiptSchema = z.object({
  trackingToken: z.string().min(16).max(128),
  referenceNumber: z.string().trim().min(2).max(60).optional(),
  contentType: z.enum(RECEIPT_ALLOWED_TYPES),
  dataBase64: z.string().min(1).max(Math.ceil(RECEIPT_MAX_BYTES * 1.4)),
  originalName: z.string().trim().max(120).optional(),
});

export const promoPreviewSchema = z.object({
  code: z.string().trim().min(2).max(40),
  items: z.array(cartItemSchema).min(1).max(50),
});

/** Strips formatting so the same human phone number always maps to one customer row. */
export function normalizePhone(raw: string): string {
  const digitsOnly = raw.replace(/[^\d+]/g, "");
  return digitsOnly.startsWith("+") ? digitsOnly : digitsOnly.replace(/^00/, "+");
}

/**
 * Decodes an uploaded receipt, enforcing type and size server-side and
 * verifying the bytes really are the image they claim to be. A client-sent
 * content type is a hint, never a permission (docs/PRD.md §42).
 */
export function decodeReceipt(
  contentType: string,
  dataBase64: string
): { buffer: Buffer; contentType: string } {
  if (!(RECEIPT_ALLOWED_TYPES as readonly string[]).includes(contentType)) {
    throw new ReceiptValidationError("RECEIPT_TYPE");
  }
  const buffer = Buffer.from(dataBase64, "base64");
  if (buffer.byteLength === 0) throw new ReceiptValidationError("RECEIPT_EMPTY");
  if (buffer.byteLength > RECEIPT_MAX_BYTES) throw new ReceiptValidationError("RECEIPT_TOO_LARGE");
  const sniffed = sniffImageType(buffer);
  if (!sniffed || sniffed !== contentType) throw new ReceiptValidationError("RECEIPT_TYPE");
  return { buffer, contentType: sniffed };
}

/** Magic-number check: a renamed script must not pass as a JPEG. */
function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type ReceiptErrorCode = "RECEIPT_TYPE" | "RECEIPT_TOO_LARGE" | "RECEIPT_EMPTY";

export class ReceiptValidationError extends Error {
  readonly code: ReceiptErrorCode;
  constructor(code: ReceiptErrorCode) {
    super(code);
    this.name = "ReceiptValidationError";
    this.code = code;
  }
}

/** Client filenames are never used to build a path — only kept for display. */
export function sanitizeFilename(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const base = name.replace(/[\\/]/g, "_").replace(/[^\w.\-؀-ۿ ]/g, "");
  return base.slice(0, 120) || undefined;
}
