import { route, HttpError } from "@/lib/pcb/caller";
import { mutate } from "@/lib/pcb/store";
import { requireMember } from "@/lib/pcb/circles";

export const dynamic = "force-dynamic";

// GET /api/key?circle=… — REHEARSAL ONLY. Hands the case key to its members.
// A server that holds and hands out keys is exactly the trust TideCloak removes; in Tide mode
// this route refuses and the key never exists outside the Tide network.
export const GET = route(async (req, caller) => {
  if (caller.mode !== "rehearsal") throw new HttpError(410, "In Tide mode keys never leave the Tide network.");
  const circle = String(req.nextUrl.searchParams.get("circle") ?? "");
  const key = mutate((s) => {
    requireMember(s, circle, caller);
    return s.rehearsal.keys[circle];
  });
  if (!key) throw new HttpError(404, "No key for this case");
  return Response.json({ key });
});
