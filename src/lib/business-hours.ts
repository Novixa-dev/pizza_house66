// The shape of a trading week.
//
// These are plain constants rather than exports of the admin actions module:
// a "use server" file may only export async functions, and adding a constant
// to one silently strips *every* export from it. TypeScript does not catch
// that — only the bundler does, and then the error names the importing page
// rather than the constant that caused it.

/** How many services the hours form offers per day. */
export const SESSIONS_PER_DAY = 2;

/**
 * What an unfilled service falls back to: the restaurant's real two shifts.
 *
 * Pizza House 66 bakes pastries in the morning and pizza in the evening, and
 * is shut between the two. A new row in the hours form should start from that
 * rather than from midnight to midnight.
 */
export const DEFAULT_SESSIONS = [
  { opensAt: "08:00", closesAt: "12:00" },
  { opensAt: "16:00", closesAt: "23:30" },
] as const;
