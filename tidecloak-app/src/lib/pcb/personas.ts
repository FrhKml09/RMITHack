export type Persona = "student" | "buddy" | "counsellor" | "committee";

export const PERSONAS: Persona[] = ["student", "buddy", "counsellor", "committee"];

/** Approvals needed for any new way into a student's case. */
export const QUORUM = 2;

export const PERSONA_LABEL: Record<Persona, { title: string; line: string }> = {
  student: { title: "Student", line: "Owns their notes." },
  buddy: { title: "Peer buddy", line: "Trained, supervised peer. Not a counsellor." },
  counsellor: { title: "Counsellor", line: "Registered counsellor who supervises the buddies." },
  committee: { title: "Admin", line: "IT / PCB committee. Runs the system." },
};

export function isPersona(v: unknown): v is Persona {
  return typeof v === "string" && (PERSONAS as string[]).includes(v);
}

export function personaFromRoles(roles: string[]): Persona | null {
  for (const p of PERSONAS) if (roles.includes(`pcb-${p}`)) return p;
  return null;
}

/** The demo cast. In the live build each is a separate Tide identity; in rehearsal they share a browser. */
export type IdentityKey = "aisha" | "ben" | "chloe" | "lim" | "tan" | "admin";

export const IDENTITIES: Record<IdentityKey, { persona: Persona; name: string; line: string; sub: string }> = {
  aisha: { persona: "student", name: "Aisha", line: "Student who needs support.", sub: "7f3a9c1e-rehearsal-aisha" },
  ben: { persona: "buddy", name: "Ben", line: "Her peer buddy. Graduating this semester.", sub: "b0dd1e5a-rehearsal-ben" },
  chloe: { persona: "buddy", name: "Chloe", line: "Peer buddy who can take over a case.", sub: "c41f0e22-rehearsal-chloe" },
  lim: { persona: "counsellor", name: "Dr Lim", line: "Registered counsellor. Supervises buddies.", sub: "d71a0b33-rehearsal-lim" },
  tan: { persona: "counsellor", name: "Ms Tan", line: "Registered counsellor. Supervises buddies.", sub: "e7a40c44-rehearsal-tan" },
  admin: { persona: "committee", name: "Admin", line: "IT / committee. Runs the system.", sub: "a0d1e055-rehearsal-admin" },
};

export const IDENTITY_KEYS = Object.keys(IDENTITIES) as IdentityKey[];

export function isIdentity(v: unknown): v is IdentityKey {
  return typeof v === "string" && v in IDENTITIES;
}

/** Short, human-readable form of an anonymous subject: "7f3a·9c1e". */
export function shortSubject(sub: string | null | undefined): string {
  if (!sub) return "—";
  const hex = sub.replace(/[^0-9a-f]/gi, "").toLowerCase();
  const s = (hex.length >= 8 ? hex : hex + "00000000").slice(0, 8);
  return `${s.slice(0, 4)}·${s.slice(4, 8)}`;
}
