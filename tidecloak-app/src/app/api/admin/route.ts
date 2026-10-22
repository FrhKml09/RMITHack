import { route, requirePersona, HttpError } from "@/lib/pcb/caller";
import { mutate, read, now, log } from "@/lib/pcb/store";
import { buddyActive, people, remember } from "@/lib/pcb/circles";

export const dynamic = "force-dynamic";

// GET /api/admin — the admin console: people, and case metadata. No names, no note content.
export const GET = route(async (_req, caller) => {
  requirePersona(caller, "committee");
  mutate((s) => remember(s, caller));
  const s = read();
  return Response.json({
    people: people(s, caller.mode),
    cases: Object.entries(s.circles).map(([circle, c]) => ({
      circle,
      alias: c.alias,
      buddyRequested: c.buddyRequested,
      buddy: c.buddy ? { name: c.buddy.name, until: c.buddy.until, live: buddyActive(s, c) } : null,
      counsellors: c.counsellors.map((x) => x.name),
      notes: s.notes.filter((n) => n.circle === circle).length,
    })),
  });
});

// POST { action: "assign", circle, buddySub, until } | { action: "offboard", sub }
export const POST = route(async (req, caller) => {
  requirePersona(caller, "committee");
  const body = await req.json().catch(() => ({}));
  const out = mutate((s) => {
    const staff = people(s, caller.mode);
    if (body?.action === "assign") {
      const c = s.circles[String(body.circle ?? "")];
      if (!c) throw new HttpError(404, "No such case");
      if (!c.buddyRequested) throw new HttpError(409, "This student hasn't asked for a buddy. Admins can't add people to a case on their own.");
      if (c.buddy && buddyActive(s, c)) throw new HttpError(409, "This case already has a buddy. Changing buddy is a handover and needs two approvals.");
      const b = staff.find((p) => p.sub === body.buddySub);
      if (!b || b.persona !== "buddy" || b.status !== "active") throw new HttpError(400, "Pick an active peer buddy.");
      const until = new Date(String(body.until ?? ""));
      if (Number.isNaN(until.getTime()) || until.getTime() < Date.now()) throw new HttpError(400, "Contract end must be a future date.");
      c.buddy = { sub: b.sub, name: b.name, since: now(), until: until.toISOString() };
      c.buddyRequested = false;
      log(s, {
        circle: String(body.circle),
        actorSub: caller.sub,
        actorName: caller.name,
        actorPersona: caller.persona,
        action: `${b.name} was assigned as your buddy until ${until.toDateString()}, at your request`,
        outcome: "allowed",
        enforcedBy: "app",
      });
      return { ok: true };
    }
    if (body?.action === "offboard") {
      const p = staff.find((x) => x.sub === body.sub);
      if (!p) throw new HttpError(404, "No such person");
      if (p.sub === caller.sub) throw new HttpError(400, "You can't offboard yourself.");
      s.people[p.sub] = { ...p, status: "offboarded", offboardedAt: now() };
      const touched = Object.entries(s.circles).filter(([, c]) => c.buddy?.sub === p.sub || c.counsellors.some((x) => x.sub === p.sub));
      for (const [circle, c] of touched) {
        if (c.buddy?.sub === p.sub) {
          c.pastBuddies.push({ ...c.buddy, endedAt: now(), why: `${p.name} left the programme` });
          c.buddy = null;
        }
        c.counsellors = c.counsellors.filter((x) => x.sub !== p.sub);
        log(s, {
          circle,
          actorSub: caller.sub,
          actorName: caller.name,
          actorPersona: caller.persona,
          action: `${p.name} left the programme and lost access to your case`,
          outcome: "allowed",
          enforcedBy: "app",
        });
      }
      return { ok: true, casesEnded: touched.length };
    }
    throw new HttpError(400, "Unknown action");
  });
  return Response.json(out);
});
