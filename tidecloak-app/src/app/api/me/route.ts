import { route } from "@/lib/pcb/caller";
import { mutate } from "@/lib/pcb/store";
import { ensureCircle } from "@/lib/pcb/circles";

export const dynamic = "force-dynamic";

// GET /api/me — who the server believes you are, read from the Tide-signed token.
export const GET = route(async (_req, caller) => {
  const circle = caller.persona === "student" ? mutate((s) => ensureCircle(s, caller)) : null;
  return Response.json({
    mode: caller.mode,
    sub: caller.sub,
    persona: caller.persona,
    roles: caller.roles.filter((r) => r.startsWith("pcb-")),
    circle,
  });
});
