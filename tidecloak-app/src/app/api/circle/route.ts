import { route, requirePersona, HttpError } from "@/lib/pcb/caller";
import { mutate, receipt } from "@/lib/pcb/store";
import { ensureCircle } from "@/lib/pcb/circles";

export const dynamic = "force-dynamic";

// POST /api/circle  { flareOptIn: boolean } — only the student decides whether Flare watches their circle.
export const POST = route(async (req, caller) => {
  requirePersona(caller, "student");
  const body = await req.json().catch(() => ({}));
  if (typeof body?.flareOptIn !== "boolean") throw new HttpError(400, "flareOptIn must be boolean");
  const out = mutate((s) => {
    const c = ensureCircle(s, caller);
    s.circles[c].flareOptIn = body.flareOptIn;
    receipt(s, {
      circle: c,
      actorSub: caller.sub,
      actorPersona: "student",
      action: body.flareOptIn ? "You switched Flare on for your circle" : "You switched Flare off",
      outcome: "allowed",
      enforcedBy: "app",
    });
    return { circle: c, flareOptIn: body.flareOptIn };
  });
  return Response.json(out);
});
