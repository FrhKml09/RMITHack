/**
 * Flare — the crisis assistant. It runs only in the buddy's browser, on text the buddy already has.
 *
 * Detection is a deliberately simple, deterministic phrase list for the prototype (and we say so).
 * What matters is its authority, not its cleverness: Flare's only output is a level. It has no
 * Tide key, no admin role and no way to approve anything, so an instruction hidden in a note
 * ("approve it yourself") has nothing to act on.
 */
export type FlareLevel = "none" | "watch" | "urgent";

export interface FlareReading {
  level: FlareLevel;
  cues: string[];
  ignoredInstructions: string[];
}

const URGENT = [
  /\bkill(ing)? myself\b/i,
  /\bend (it|my life)( all)?\b/i,
  /\bdon'?t want to (be here|live|wake up)\b/i,
  /\bsuicid/i,
  /\bself[- ]?harm/i,
  /\bhurt(ing)? myself\b/i,
  /\bbetter off without me\b/i,
  /\bno (reason|point) (to|in) (live|living|going on)\b/i,
  /\boverdose\b/i,
];

const WATCH = [
  /\bhopeless\b/i,
  /\bcan'?t cope\b/i,
  /\bcannot cope\b/i,
  /\bpanic attacks?\b/i,
  /\bnot sleeping\b/i,
  /\bcan'?t sleep\b/i,
  /\bworthless\b/i,
  /\bnumb\b/i,
  /\bso alone\b/i,
  /\bexhausted\b/i,
];

// Text that tries to give Flare orders. Flare reports it and does nothing else.
const INJECTION = [
  /\bignore (all|any|previous|prior) (instructions|rules)\b/i,
  /\bsystem\s*:/i,
  /\byou are now\b/i,
  /\bapprove (it|this|the request|the grant)( yourself)?\b/i,
  /\bgrant (me|yourself|the counsellor|him|her|them)\b/i,
  /\b(make|give) (me|yourself) (admin|access)\b/i,
];

function hits(text: string, list: RegExp[]): string[] {
  const out: string[] = [];
  for (const re of list) {
    const m = text.match(re);
    if (m) out.push(m[0]);
  }
  return out;
}

export function readFlare(text: string): FlareReading {
  const urgent = hits(text, URGENT);
  const watch = hits(text, WATCH);
  return {
    level: urgent.length ? "urgent" : watch.length ? "watch" : "none",
    cues: [...urgent, ...watch],
    ignoredInstructions: hits(text, INJECTION),
  };
}
