import { mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import { createHash, randomUUID, randomBytes } from "crypto";
import type { Persona } from "./personas";

/**
 * Everything the SafeCounsel server ever holds lives in one JSON file, so the admin's
 * "encrypted data view" can show it verbatim. Note bodies arrive already encrypted in the
 * writer's browser; the server never receives plaintext. Students appear only as a pseudonym.
 */
const DIR = join(process.cwd(), "data", "pcb");
const FILE = join(DIR, "store.json");

export interface Assignment {
  sub: string;
  name: string;
  since: string;
  /** Contract end. Access stops on its own after this, no admin action needed. */
  until: string;
}

export interface Circle {
  studentSub: string;
  /** Dynamic pseudonym: what staff see instead of a name. Rotates on every handover. */
  alias: string;
  createdAt: string;
  buddyRequested: boolean;
  buddy: Assignment | null;
  pastBuddies: (Assignment & { endedAt: string; why: string })[];
  counsellors: { sub: string; name: string; since: string; reason: string }[];
}

export interface Note {
  id: string;
  circle: string;
  kind: "request" | "journal" | "session";
  authorSub: string;
  authorPersona: Persona;
  ciphertext: string;
  createdAt: string;
}

export interface Person {
  sub: string;
  name: string;
  persona: Persona;
  status: "active" | "offboarded";
  offboardedAt?: string;
}

export interface Vote {
  sub: string;
  name: string;
  at: string;
  proof: string; // hash of the audit-log entry that recorded this vote
}

export interface AccessRequest {
  id: string;
  kind: "escalation" | "handover" | "self-grant";
  circle: string;
  beneficiarySub: string;
  beneficiaryName: string;
  beneficiaryPersona: Persona;
  reason: string;
  filedBySub: string;
  filedByName: string;
  approvals: Vote[];
  status: "pending" | "approved" | "denied";
  decidedBy?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface LogEntry {
  seq: number;
  at: string;
  circle: string | "*";
  actorSub: string;
  actorName: string;
  actorPersona: Persona | null;
  action: string;
  outcome: "allowed" | "refused" | "pending";
  enforcedBy: "tide" | "app";
  prev: string;
  hash: string;
}

export interface Store {
  circles: Record<string, Circle>;
  notes: Note[];
  people: Record<string, Person>;
  requests: AccessRequest[];
  log: LogEntry[];
  /** Rehearsal only: circle keys the server hands to members. Exactly the trust Tide removes. */
  rehearsal: { keys: Record<string, string> };
}

const EMPTY: Store = { circles: {}, notes: [], people: {}, requests: [], log: [], rehearsal: { keys: {} } };

export function read(): Store {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf-8"));
    // Old Safe Circle stores have a different shape; start clean rather than half-migrate.
    if (!Array.isArray(raw.log)) return structuredClone(EMPTY);
    return { ...structuredClone(EMPTY), ...raw };
  } catch {
    return structuredClone(EMPTY);
  }
}

/** Atomic write: a crash mid-write can never leave a half-written store. */
export function write(s: Store) {
  mkdirSync(DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2));
  renameSync(tmp, FILE);
}

export function mutate<T>(fn: (s: Store) => T): T {
  const s = read();
  try {
    const out = fn(s);
    write(s);
    return out;
  } catch (err) {
    // Refusals are logged before they throw; keep that record.
    write(s);
    throw err;
  }
}

export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const newKey = () => randomBytes(32).toString("base64");

const GENESIS = "0".repeat(64);

function digest(e: Omit<LogEntry, "hash">): string {
  const { seq, at, circle, actorSub, actorName, actorPersona, action, outcome, enforcedBy, prev } = e;
  return createHash("sha256")
    .update(JSON.stringify([seq, at, circle, actorSub, actorName, actorPersona, action, outcome, enforcedBy, prev]))
    .digest("hex");
}

/** Append-only, hash-chained audit log. Editing or deleting any entry breaks every hash after it. */
export function log(s: Store, e: Omit<LogEntry, "seq" | "at" | "prev" | "hash">): LogEntry {
  const last = s.log.at(-1);
  const base = { ...e, seq: (last?.seq ?? 0) + 1, at: now(), prev: last?.hash ?? GENESIS };
  const entry = { ...base, hash: digest(base) };
  s.log.push(entry);
  return entry;
}

export function verifyLog(entries: LogEntry[]): { ok: boolean; count: number; brokenAt?: number } {
  let prev = GENESIS;
  for (const e of entries) {
    const { hash, ...rest } = e;
    if (e.prev !== prev || digest(rest) !== hash) return { ok: false, count: entries.length, brokenAt: e.seq };
    prev = hash;
  }
  return { ok: true, count: entries.length };
}
