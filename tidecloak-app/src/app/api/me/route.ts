import { route } from "@/lib/pcb/caller";
import { mutate } from "@/lib/pcb/store";
import { ensureCircle, remember } from "@/lib/pcb/circles";

export const dynamic = "force-dynamic";

// GET /api/me — who the server believes you are, read from the signed token.
export const GET = route(async (_req, caller) => {
  const out = mutate((s) => {
    remember(s, caller);
    if (caller.persona !== "student") return { circle: null, alias: null };
    const c = ensureCircle(s, caller);
    return { circle: c, alias: s.circles[c].alias };
  });
  return Response.json({
    mode: caller.mode,
    sub: caller.sub,
    persona: caller.persona,
    name: caller.name,
    roles: caller.roles.filter((r) => r.startsWith("pcb-")),
    ...out,
  });
});
