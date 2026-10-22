import { route, requirePersona } from "@/lib/pcb/caller";
import { read } from "@/lib/pcb/store";

export const dynamic = "force-dynamic";

// GET /api/ledger — the whole database, exactly as the server holds it. This is what the
// programme committee, IT, or anyone who copies the disk would get.
export const GET = route(async (_req, caller) => {
  requirePersona(caller, "committee", "counsellor");
  const s = read();
  const { rehearsal, ...held } = s;
  return Response.json(caller.mode === "rehearsal" ? { ...held, rehearsal } : held);
});
