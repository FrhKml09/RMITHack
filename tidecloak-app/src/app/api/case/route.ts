import { route, requirePersona, HttpError, enforcedBy } from "@/lib/pcb/caller";
import { mutate, log } from "@/lib/pcb/store";
import { buddyActive, ensureCircle, memberRole, requireMember, whoCanSee } from "@/lib/pcb/circles";

export const dynamic = "force-dynamic";

// GET /api/case?circle=…  — one case, for its members only. Students always get their own.
export const GET = route(async (req, caller) => {
  const asked = req.nextUrl.searchParams.get("circle");
  const out = mutate((s) => {
    const circle = caller.persona === "student" ? ensureCircle(s, caller) : String(asked ?? "");
    const role = requireMember(s, circle, caller);
    const c = s.circles[circle];
    // Record who opened the case (once per 5 minutes per person, so the log stays readable).
    if (role !== "student") {
      const recent = [...s.log].reverse().find((e) => e.circle === circle && e.actorSub === caller.sub && e.action.includes("opened the case"));
      if (!recent || Date.now() - Date.parse(recent.at) > 5 * 60_000) {
        log(s, {
          circle,
          actorSub: caller.sub,
          actorName: caller.name,
          actorPersona: caller.persona,
          action: `${caller.name} opened the case`,
          outcome: "allowed",
          enforcedBy: "app",
        });
      }
    }
    return {
      circle,
      role,
      alias: c.alias,
      buddyRequested: c.buddyRequested,
      buddy: c.buddy && buddyActive(s, c) ? c.buddy : null,
      counsellors: c.counsellors,
      access: whoCanSee(s, circle),
      notes: s.notes.filter((n) => n.circle === circle),
      requests: s.requests.filter((r) => r.circle === circle),
      log: s.log.filter((e) => e.circle === circle).reverse(),
    };
  });
  return Response.json(out);
});

// POST /api/case { action: "request-buddy" } — the student asks for a buddy. Only they can.
export const POST = route(async (req, caller) => {
  requirePersona(caller, "student");
  const body = await req.json().catch(() => ({}));
  if (body?.action !== "request-buddy") throw new HttpError(400, "Unknown action");
  const out = mutate((s) => {
    const circle = ensureCircle(s, caller);
    const c = s.circles[circle];
    if (memberRole(s, circle, caller) !== "student") throw new HttpError(403, "Not your case");
    c.buddyRequested = true;
    log(s, {
      circle,
      actorSub: caller.sub,
      actorName: c.alias,
      actorPersona: "student",
      action: "You asked for a peer buddy",
      outcome: "allowed",
      enforcedBy: enforcedBy(caller),
    });
    return { circle };
  });
  return Response.json(out);
});
