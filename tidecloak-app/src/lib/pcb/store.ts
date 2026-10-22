import { mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { Persona } from "./personas";

/**
 * Everything the PCB server ever holds lives in one JSON file, so the "operator view" can show it
 * verbatim. Note bodies arrive already encrypted by the Tide SDK in the writer's browser; the server
 * never receives plaintext for them. Flares carry only a circle id and a level, never words.
 */
const DIR = join(process.cwd(), "data", "pcb");
const FILE = join(DIR, "store.json");

export interface Note {
  id: string;
  circle: string;
  kind: "journal" | "session";
  authorSub: string;
  authorPersona: Persona;
  ciphertext: string;
  createdAt: string;
}

export interface Flare {
  id: string;
  circle: string;
  level: "watch" | "urgent";
  filedBy: "flare";
  onBehalfOf: string; // buddy subject
  status: "open" | "answered";
  createdAt: string;
}

export interface CheckIn {
  id: string;
  circle: string;
  fromSub: string;
  body: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  circle: string | "*";
  at: string;
  actorSub: string;
  actorPersona: Persona | null;
  action: string;
  outcome: "allowed" | "refused" | "pending";
  enforcedBy: "tide" | "app";
}

/** Rehearsal-only stand-in for Tide's IGA change requests. Never consulted in Tide mode. */
export interface RehearsalRequest {
  id: string;
  role: string;
  target: Persona;
  filedBy: Persona;
  approvals: Persona[];
  status: "pending" | "approved" | "denied";
  createdAt: string;
}

export interface Store {
  circles: Record<string, { studentSub: string; flareOptIn: boolean; createdAt: string }>;
  notes: Note[];
  flares: Flare[];
  checkIns: CheckIn[];
  receipts: Receipt[];
  rehearsal: { requests: RehearsalRequest[] };
}

const EMPTY: Store = { circles: {}, notes: [], flares: [], checkIns: [], receipts: [], rehearsal: { requests: [] } };

export function read(): Store {
  try {
    return { ...EMPTY, ...JSON.parse(readFileSync(FILE, "utf-8")) };
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
  const out = fn(s);
  write(s);
  return out;
}

export const id = () => randomUUID();
export const now = () => new Date().toISOString();

export function receipt(s: Store, r: Omit<Receipt, "id" | "at">) {
  s.receipts.unshift({ id: id(), at: now(), ...r });
  s.receipts = s.receipts.slice(0, 200);
}

export function rehearsalGrants(persona: Persona): string[] {
  return read()
    .rehearsal.requests.filter((r) => r.status === "approved" && r.target === persona)
    .map((r) => r.role);
}
