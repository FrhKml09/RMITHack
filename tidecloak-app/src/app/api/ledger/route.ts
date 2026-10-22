import { route, requirePersona } from "@/lib/pcb/caller";
import { read } from "@/lib/pcb/store";

export const dynamic = "force-dynamic";

// GET /api/ledger — the whole database, exactly as the server holds it. This is what an admin,
// IT, or anyone who copies the disk gets. (Rehearsal circle keys are withheld from this view.)
export const GET = route(async (_req, caller) => {
  requirePersona(caller, "committee", "counsellor");
  const { rehearsal: _keys, ...held } = read();
  return Response.json(held);
});
