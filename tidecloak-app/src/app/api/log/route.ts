import { route } from "@/lib/pcb/caller";
import { read, verifyLog } from "@/lib/pcb/store";

export const dynamic = "force-dynamic";

// GET /api/log — the read-only, hash-chained access log.
// Students see entries about their own case. Staff see every entry (metadata only, never content).
// There is no POST, PUT or DELETE: nobody, including admins, can edit it through the app.
export const GET = route(async (_req, caller) => {
  const s = read();
  const integrity = verifyLog(s.log);
  let entries = s.log;
  if (caller.persona === "student") {
    const mine = Object.keys(s.circles).find((c) => s.circles[c].studentSub === caller.sub);
    entries = s.log.filter((e) => e.circle === mine);
  } else if (caller.persona === "buddy") {
    entries = s.log.filter((e) => e.actorSub === caller.sub || s.circles[e.circle]?.buddy?.sub === caller.sub);
  }
  const alias = (c: string) => (c === "*" ? "—" : s.circles[c]?.alias ?? "?");
  return Response.json({ integrity, entries: [...entries].reverse().map((e) => ({ ...e, alias: alias(e.circle) })) });
});
