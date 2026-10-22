import type { Caller } from "./caller";
import type { Store } from "./store";
import { now } from "./store";

/** A circle is named after the student's anonymous Tide subject. No name, no email, ever. */
export function circleOf(sub: string): string {
  const hex = sub.replace(/[^0-9a-f]/gi, "").toLowerCase();
  return (hex + "00000000").slice(0, 8);
}

/** The student's own circle, created on first visit. */
export function ensureCircle(s: Store, caller: Caller): string {
  const c = circleOf(caller.sub);
  if (!s.circles[c]) s.circles[c] = { studentSub: caller.sub, flareOptIn: false, createdAt: now() };
  return c;
}
