import { route, requirePersona, HttpError } from "@/lib/pcb/caller";
import { mutate, id, now, receipt } from "@/lib/pcb/store";

export const dynamic = "force-dynamic";

// POST /api/flares  { circle, level } — Flare (running in the buddy's browser) raises a hand.
// It sends a circle id and a level. It cannot send words: the schema has nowhere to put them.
export const POST = route(async (req, caller) => {
  requirePersona(caller, "buddy");
  const body = await req.json().catch(() => ({}));
  const level = body?.level;
  const circle = String(body?.circle ?? "");
  if (level !== "watch" && level !== "urgent") throw new HttpError(400, "level must be watch or urgent");
  const flare = mutate((s) => {
    const c = s.circles[circle];
    if (!c) throw new HttpError(404, "No such circle");
    if (!c.flareOptIn) throw new HttpError(409, "The student has not switched Flare on for this circle.");
    const f = { id: id(), circle, level, filedBy: "flare" as const, onBehalfOf: caller.sub, status: "open" as const, createdAt: now() };
    s.flares.push(f);
    receipt(s, {
      circle,
      actorSub: caller.sub,
      actorPersona: "buddy",
      action: `Flare raised ${level === "urgent" ? "an urgent" : "a watch"} flag on your circle. No words left your buddy's device.`,
      outcome: "pending",
      enforcedBy: "app",
    });
    return f;
  });
  return Response.json({ flare }, { status: 201 });
});
