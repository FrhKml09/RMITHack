import { randomInt } from "crypto";
import type { Caller } from "./caller";
import { HttpError } from "./caller";
import { IDENTITIES, QUORUM, type Persona } from "./personas";
import { log, newKey, now, type AccessRequest, type Circle, type Person, type Store } from "./store";

/** A circle is named after the student's anonymous subject. No name, no email, ever. */
export function circleOf(sub: string): string {
  const hex = sub.replace(/[^0-9a-f]/gi, "").toLowerCase();
  return (hex + "00000000").slice(0, 8);
}

const BIRDS = ["Kestrel", "Heron", "Wren", "Merbok", "Kingfisher", "Swift", "Lark", "Sparrow", "Hornbill", "Robin", "Finch", "Egret"];
export const freshAlias = () => `${BIRDS[randomInt(BIRDS.length)]}-${randomInt(1000, 9999)}`;

/** The student's own circle, created on first visit. */
export function ensureCircle(s: Store, caller: Caller): string {
  const c = circleOf(caller.sub);
  if (!s.circles[c]) {
    s.circles[c] = {
      studentSub: caller.sub,
      alias: freshAlias(),
      createdAt: now(),
      buddyRequested: false,
      buddy: null,
      pastBuddies: [],
      counsellors: [],
    };
    if (caller.mode === "rehearsal") s.rehearsal.keys[c] = newKey();
  }
  return c;
}

/** Staff directory. Rehearsal seeds the demo cast; Tide mode learns people as they sign in. */
export function remember(s: Store, caller: Caller) {
  if (!caller.persona || caller.persona === "student") return;
  if (!s.people[caller.sub]) s.people[caller.sub] = { sub: caller.sub, name: caller.name, persona: caller.persona, status: "active" };
}

export function people(s: Store, mode: Caller["mode"]): Person[] {
  const out: Record<string, Person> = {};
  if (mode === "rehearsal") {
    for (const i of Object.values(IDENTITIES)) {
      if (i.persona !== "student") out[i.sub] = { sub: i.sub, name: i.name, persona: i.persona, status: "active" };
    }
  }
  for (const p of Object.values(s.people)) out[p.sub] = { ...out[p.sub], ...p };
  return Object.values(out);
}

export function isActive(s: Store, sub: string) {
  return s.people[sub]?.status !== "offboarded";
}

export function buddyActive(s: Store, c: Circle): boolean {
  return Boolean(c.buddy && Date.parse(c.buddy.until) > Date.now() && isActive(s, c.buddy.sub));
}

/** Why a caller may read a case, or null. The server returns ciphertext to members only. */
export function memberRole(s: Store, circle: string, caller: Caller): "student" | "buddy" | "counsellor" | null {
  const c = s.circles[circle];
  if (!c) return null;
  if (c.studentSub === caller.sub) return "student";
  if (c.buddy?.sub === caller.sub && buddyActive(s, c)) return "buddy";
  if (c.counsellors.some((x) => x.sub === caller.sub) && isActive(s, caller.sub)) return "counsellor";
  return null;
}

export function requireMember(s: Store, circle: string, caller: Caller) {
  const role = memberRole(s, circle, caller);
  if (!role) {
    log(s, {
      circle,
      actorSub: caller.sub,
      actorName: caller.name,
      actorPersona: caller.persona,
      action: `${caller.name} tried to open a case they are not part of`,
      outcome: "refused",
      enforcedBy: "app",
    });
    throw new HttpError(403, "You are not part of this case. Access needs two approvals first.");
  }
  return role;
}

/** Who sees a case right now, in plain words, for the student's "Who can see my notes" panel. */
export function whoCanSee(s: Store, circle: string) {
  const c = s.circles[circle];
  const rows: { who: string; why: string; until?: string }[] = [{ who: "You", why: "You own these notes." }];
  if (c?.buddy && buddyActive(s, c)) rows.push({ who: `${c.buddy.name} (peer buddy)`, why: "Assigned at your request.", until: c.buddy.until });
  for (const x of c?.counsellors ?? []) rows.push({ who: `${x.name} (counsellor)`, why: `Approved by two people: ${x.reason}` });
  return rows;
}

/**
 * The one rule: two approvals from the care team, and nobody votes themselves in.
 *  - escalation / handover: the case's current buddy or any counsellor
 *  - self-grant (an admin asking for access): counsellors only
 * The admin is never a voter.
 */
export function canVote(s: Store, r: AccessRequest, caller: Caller): boolean {
  if (r.status !== "pending") return false;
  if (caller.sub === r.beneficiarySub) return false;
  if (r.approvals.some((v) => v.sub === caller.sub)) return false;
  if (!isActive(s, caller.sub)) return false;
  if (caller.persona === "counsellor") return true;
  if (r.kind === "self-grant") return false;
  const c = s.circles[r.circle];
  return caller.persona === "buddy" && Boolean(c?.buddy?.sub === caller.sub && c && buddyActive(s, c));
}

export function castVote(s: Store, r: AccessRequest, caller: Caller) {
  const entry = log(s, {
    circle: r.circle,
    actorSub: caller.sub,
    actorName: caller.name,
    actorPersona: caller.persona,
    action: `${caller.name} approved: ${describe(r)} (${r.approvals.length + 1} of ${QUORUM})`,
    outcome: r.approvals.length + 1 >= QUORUM ? "allowed" : "pending",
    enforcedBy: "app",
  });
  r.approvals.push({ sub: caller.sub, name: caller.name, at: entry.at, proof: entry.hash });
  if (r.approvals.length >= QUORUM) apply(s, r);
}

export function describe(r: AccessRequest): string {
  if (r.kind === "escalation") return `share the case with ${r.beneficiaryName}`;
  if (r.kind === "handover") return `hand the case to ${r.beneficiaryName}`;
  return `give ${r.beneficiaryName} access to the case`;
}

function apply(s: Store, r: AccessRequest) {
  const c = s.circles[r.circle];
  r.status = "approved";
  r.decidedAt = now();
  if (!c) return;
  const voters = r.approvals.map((v) => v.name).join(" and ");
  if (r.kind === "handover") {
    if (c.buddy) c.pastBuddies.push({ ...c.buddy, endedAt: now(), why: `Handed over to ${r.beneficiaryName}` });
    const until = new Date(Date.now() + 120 * 86_400_000).toISOString();
    c.buddy = { sub: r.beneficiarySub, name: r.beneficiaryName, since: now(), until };
    c.alias = freshAlias();
    log(s, {
      circle: r.circle,
      actorSub: "system",
      actorName: "SafeCounsel",
      actorPersona: null,
      action: `Your case moved to ${r.beneficiaryName}, approved by ${voters}. Your previous buddy lost access. Reason: ${r.reason}`,
      outcome: "allowed",
      enforcedBy: "app",
    });
  } else {
    c.counsellors.push({ sub: r.beneficiarySub, name: r.beneficiaryName, since: now(), reason: r.reason });
    log(s, {
      circle: r.circle,
      actorSub: "system",
      actorName: "SafeCounsel",
      actorPersona: null,
      action: `${r.beneficiaryName} can now read your case, approved by ${voters}. Reason: ${r.reason}`,
      outcome: "allowed",
      enforcedBy: "app",
    });
  }
}

export function personaOf(s: Store, sub: string, mode: Caller["mode"]): Person | undefined {
  return people(s, mode).find((p) => p.sub === sub);
}

export type { Persona };
