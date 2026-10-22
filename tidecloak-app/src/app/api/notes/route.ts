import { route, requirePersona, HttpError } from "@/lib/pcb/caller";
import { mutate, read, id, now, receipt } from "@/lib/pcb/store";
import { ensureCircle } from "@/lib/pcb/circles";

export const dynamic = "force-dynamic";

const MAX_CIPHERTEXT = 64_000;

// GET /api/notes — the caller's own notes (ciphertext). Students get their circle, buddies get
// every circle they support plus their own session notes. Nobody gets anyone else's plaintext,
// because the server never had it.
export const GET = route(async (_req, caller) => {
  requirePersona(caller, "student", "buddy");
  if (caller.persona === "student") {
    const s = read();
    const circle = Object.keys(s.circles).find((c) => s.circles[c].studentSub === caller.sub);
    if (!circle) return Response.json({ circle: null, notes: [], checkIns: [], receipts: [], flareOptIn: false });
    return Response.json({
      circle,
      flareOptIn: s.circles[circle].flareOptIn,
      notes: s.notes.filter((n) => n.circle === circle && n.authorSub === caller.sub),
      checkIns: s.checkIns.filter((c) => c.circle === circle),
      receipts: s.receipts.filter((r) => r.circle === circle || r.circle === "*"),
    });
  }
  const s = read();
  return Response.json({
    circles: Object.entries(s.circles).map(([c, v]) => ({
      circle: c,
      flareOptIn: v.flareOptIn,
      since: v.createdAt,
      openFlares: s.flares.filter((f) => f.circle === c && f.status === "open").length,
    })),
    notes: s.notes.filter((n) => n.authorSub === caller.sub),
  });
});

// POST /api/notes  { circle?, ciphertext } — store a note the browser already encrypted.
export const POST = route(async (req, caller) => {
  requirePersona(caller, "student", "buddy");
  const body = await req.json().catch(() => ({}));
  const ciphertext = body?.ciphertext;
  if (typeof ciphertext !== "string" || !ciphertext || ciphertext.length > MAX_CIPHERTEXT) {
    throw new HttpError(400, "ciphertext must be a non-empty string under 64 kB");
  }
  const note = mutate((s) => {
    let circle: string;
    if (caller.persona === "student") {
      circle = ensureCircle(s, caller);
    } else {
      circle = String(body?.circle ?? "");
      if (!s.circles[circle]) throw new HttpError(404, "No such circle");
    }
    const n = {
      id: id(),
      circle,
      kind: caller.persona === "student" ? ("journal" as const) : ("session" as const),
      authorSub: caller.sub,
      authorPersona: caller.persona!,
      ciphertext,
      createdAt: now(),
    };
    s.notes.push(n);
    receipt(s, {
      circle,
      actorSub: caller.sub,
      actorPersona: caller.persona,
      action: caller.persona === "student" ? "You sealed a journal entry" : "Your buddy sealed a session note",
      outcome: "allowed",
      enforcedBy: "tide",
    });
    return n;
  });
  return Response.json({ note }, { status: 201 });
});
