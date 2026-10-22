export type Persona = "student" | "buddy" | "counsellor" | "committee";

export const PERSONAS: Persona[] = ["student", "buddy", "counsellor", "committee"];

/** The three people who may vote on access. The student is never outvoted silently: they see receipts. */
export const VOTERS: Persona[] = ["buddy", "counsellor", "committee"];
export const QUORUM = 2;

export const BREAKGLASS_ROLE = "pcb-breakglass";

export const PERSONA_LABEL: Record<Persona, { title: string; line: string }> = {
  student: { title: "Student", line: "Owns the circle. Writes what they need to say." },
  buddy: { title: "Peer buddy", line: "Trained, supervised peer. Not a counsellor." },
  counsellor: { title: "Counsellor", line: "Registered counsellor who supervises the buddies." },
  committee: { title: "Committee member", line: "Runs the programme. Holds admin rights." },
};

export function isPersona(v: unknown): v is Persona {
  return typeof v === "string" && (PERSONAS as string[]).includes(v);
}

export function personaFromRoles(roles: string[]): Persona | null {
  for (const p of PERSONAS) if (roles.includes(`pcb-${p}`)) return p;
  return null;
}

/** Fixed, obviously-fake subjects for rehearsal mode so nothing looks like a real Tide vuid. */
export const REHEARSAL_SUBJECTS: Record<Persona, string> = {
  student: "7f3a9c1e-rehearsal-student",
  buddy: "b0dd1e5a-rehearsal-buddy",
  counsellor: "c0de5e11-rehearsal-counsellor",
  committee: "c0ff1ce5-rehearsal-committee",
};

/** Short, human-readable form of an anonymous subject: "7f3a·9c1e". */
export function shortSubject(sub: string | null | undefined): string {
  if (!sub) return "—";
  const hex = sub.replace(/[^0-9a-f]/gi, "").toLowerCase();
  const s = (hex.length >= 8 ? hex : (hex + "00000000")).slice(0, 8);
  return `${s.slice(0, 4)}·${s.slice(4, 8)}`;
}
