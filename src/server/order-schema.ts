import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  optionValueIds: z.array(z.string().min(1)).default([]),
  note: z.string().max(200).optional(),
});

export const createOrderSchema = z.object({
  idempotencyKey: z.string().min(8).max(100),
  items: z.array(cartItemSchema).min(1).max(50),
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(6).max(20),
  }),
  pickup: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("ASAP") }),
    z.object({ mode: z.literal("SCHEDULED"), requestedAt: z.string().datetime() }),
  ]),
  payment: z.discriminatedUnion("method", [
    z.object({ method: z.literal("PAY_AT_PICKUP") }),
    z.object({
      method: z.literal("BANK_TRANSFER"),
      referenceNumber: z.string().trim().min(2).max(60),
    }),
  ]),
  notes: z.string().max(300).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
