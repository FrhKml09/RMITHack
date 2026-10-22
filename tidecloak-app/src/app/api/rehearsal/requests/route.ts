import { route, HttpError } from "@/lib/pcb/caller";
import { mutate, read, id, now, receipt } from "@/lib/pcb/store";
import { BREAKGLASS_ROLE, QUORUM, VOTERS, isPersona } from "@/lib/pcb/personas";

export const dynamic = "force-dynamic";

/**
 * REHEARSAL ONLY. A stand-in for TideCloak's IGA change requests so the story can be rehearsed
 * before the realm exists. In Tide mode this route refuses: the real quorum lives in TideCloak,
 * sealed by the Tide network, and our server has no say in it.
 */
function rehearsalOnly(mode: string) {
  if (mode !== "rehearsal") throw new HttpError(410, "In Tide mode, approvals happen in TideCloak's QEA console.");
}

export const GET = route(async (_req, caller) => {
  rehearsalOnly(caller.mode);
  return Response.json({ requests: read().rehearsal.requests, quorum: QUORUM, voters: VOTERS });
});

// POST { action: "file", target } | { action: "approve" | "deny", requestId }
export const POST = route(async (req, caller) => {
  rehearsalOnly(caller.mode);
  const body = await req.json().catch(() => ({}));
  if (!caller.persona || !VOTERS.includes(caller.persona)) throw new HttpError(403, "Only the three admins can vote.");
  const me = caller.persona;
  const out = mutate((s) => {
    if (body?.action === "file") {
      if (!isPersona(body.target)) throw new HttpError(400, "Unknown target");
      if (s.rehearsal.requests.some((r) => r.target === body.target && r.status === "pending")) {
        throw new HttpError(409, "A request for this person is already pending.");
      }
      const r = {
        id: id(),
        role: BREAKGLASS_ROLE,
        target: body.target,
        filedBy: me,
        approvals: [] as typeof VOTERS,
        status: "pending" as const,
        createdAt: now(),
      };
      s.rehearsal.requests.unshift(r);
      return r;
    }
    const r = s.rehearsal.requests.find((x) => x.id === body?.requestId);
    if (!r) throw new HttpError(404, "No such request");
    if (r.status !== "pending") throw new HttpError(409, `Request is already ${r.status}`);
    if (body?.action === "deny") {
      r.status = "denied";
    } else if (body?.action === "approve") {
      if (!r.approvals.includes(me)) r.approvals.push(me);
      if (r.approvals.length >= QUORUM) r.status = "approved";
    } else {
      throw new HttpError(400, "Unknown action");
    }
    receipt(s, {
      circle: "*",
      actorSub: caller.sub,
      actorPersona: me,
      action: `Vote on ${r.role} for the ${r.target}: ${r.approvals.length} of ${QUORUM}${r.status === "approved" ? ", granted" : r.status === "denied" ? ", denied" : ""}`,
      outcome: r.status === "approved" ? "allowed" : r.status === "denied" ? "refused" : "pending",
      enforcedBy: "app",
    });
    return r;
  });
  return Response.json({ request: out });
});
