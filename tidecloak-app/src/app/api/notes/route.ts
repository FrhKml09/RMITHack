import { route, requirePersona, HttpError, enforcedBy } from "@/lib/pcb/caller";
import { mutate, id, now, log } from "@/lib/pcb/store";
import { ensureCircle, memberRole } from "@/lib/pcb/circles";

export const dynamic = "force-dynamic";

const MAX_CIPHERTEXT = 64_000;

// POST /api/notes { circle?, ciphertext, kind? } — store a note the browser already encrypted.
// Students write to their own case; buddies and approved counsellors write session notes.
export const POST = route(async (req, caller) => {
  requirePersona(caller, "student", "buddy", "counsellor");
  const body = await req.json().catch(() => ({}));
  const ciphertext = body?.ciphertext;
  if (typeof ciphertext !== "string" || !ciphertext || ciphertext.length > MAX_CIPHERTEXT) {
    throw new HttpError(400, "ciphertext must be a non-empty string under 64 kB");
  }
  const note = mutate((s) => {
    const circle = caller.persona === "student" ? ensureCircle(s, caller) : String(body?.circle ?? "");
    const role = memberRole(s, circle, caller);
    if (!role) throw new HttpError(403, "You are not part of this case.");
    const kind = role === "student" ? (body?.kind === "request" ? "request" : "journal") : "session";
    const n = { id: id(), circle, kind: kind as "request" | "journal" | "session", authorSub: caller.sub, authorPersona: caller.persona!, ciphertext, createdAt: now() };
    s.notes.push(n);
    log(s, {
      circle,
      actorSub: caller.sub,
      actorName: role === "student" ? s.circles[circle].alias : caller.name,
      actorPersona: caller.persona,
      action: role === "student" ? "You sealed a note" : `${caller.name} sealed a session note`,
      outcome: "allowed",
      enforcedBy: enforcedBy(caller),
    });
    return n;
  });
  return Response.json({ note }, { status: 201 });
});
