import { route, requirePersona } from "@/lib/pcb/caller";
import { read } from "@/lib/pcb/store";
import { buddyActive, isActive, remember } from "@/lib/pcb/circles";
import { mutate } from "@/lib/pcb/store";

export const dynamic = "force-dynamic";

interface Row { circle: string; alias: string; as: "buddy" | "counsellor"; live: boolean; until: string | null; lastNote: string | null; why: string }

// GET /api/cases — buddies: the students assigned to them (and cases that ended).
// Counsellors: only cases two people approved them for. Pseudonyms only, never names.
export const GET = route(async (_req, caller) => {
  requirePersona(caller, "buddy", "counsellor");
  mutate((s) => remember(s, caller));
  const s = read();
  const active = isActive(s, caller.sub);
  const cases = Object.entries(s.circles).flatMap(([circle, c]): Row[] => {
    const lastNote = s.notes.filter((n) => n.circle === circle).at(-1)?.createdAt ?? null;
    if (caller.persona === "buddy" && c.buddy?.sub === caller.sub) {
      const live = buddyActive(s, c);
      return [{ circle, alias: c.alias, as: "buddy", live, until: c.buddy.until, lastNote, why: live ? "" : active ? "Your contract for this case has ended." : "You were offboarded." }];
    }
    if (caller.persona === "buddy" && c.pastBuddies.some((b) => b.sub === caller.sub)) {
      const b = c.pastBuddies.filter((x) => x.sub === caller.sub).at(-1)!;
      return [{ circle, alias: "(hidden)", as: "buddy", live: false, until: b.endedAt, lastNote: null, why: b.why }];
    }
    if (caller.persona === "counsellor" && c.counsellors.some((x) => x.sub === caller.sub)) {
      return [{ circle, alias: c.alias, as: "counsellor", live: active, until: null, lastNote, why: c.counsellors.find((x) => x.sub === caller.sub)!.reason }];
    }
    return [];
  });
  return Response.json({ cases, active });
});
