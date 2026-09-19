import { describe, expect, it } from "vitest";
import {
  assertTransitionAllowed,
  ForbiddenTransitionError,
  InvalidTransitionError,
} from "@/lib/order-state";

describe("assertTransitionAllowed", () => {
  it("allows kitchen staff to move a queued order to preparing", () => {
    expect(() => assertTransitionAllowed("QUEUED", "PREPARING", "KITCHEN")).not.toThrow();
  });

  it("rejects skipping straight from PENDING to READY", () => {
    expect(() => assertTransitionAllowed("PENDING", "READY", "OWNER")).toThrow(InvalidTransitionError);
  });

  it("rejects a completed order from ever changing state", () => {
    expect(() => assertTransitionAllowed("COMPLETED", "CANCELLED", "OWNER")).toThrow(InvalidTransitionError);
  });

  it("rejects kitchen staff from verifying a refund (financial action)", () => {
    expect(() => assertTransitionAllowed("CANCELLED", "REFUNDED", "KITCHEN")).toThrow(
      ForbiddenTransitionError
    );
  });

  it("allows owner/manager to refund a cancelled order", () => {
    expect(() => assertTransitionAllowed("CANCELLED", "REFUNDED", "OWNER")).not.toThrow();
  });
});
