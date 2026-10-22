import { route, HttpError, type Caller } from "@/lib/pcb/caller";
import { mutate, read, id, now, log, type AccessRequest, type Store } from "@/lib/pcb/store";
import { buddyActive, canVote, castVote, describe, people } from "@/lib/pcb/circles";
import { QUORUM } from "@/lib/pcb/personas";

export const dynamic = "force-dynamic";

function visible(s: Store, caller: Caller, r: AccessRequest) {
  const c = s.circles[r.circle];
  if (caller.persona === "counsellor" || caller.persona === "committee") return true;
  if (caller.persona === "student") return c?.studentSub === caller.sub;
  if (caller.persona === "buddy") return r.filedBySub === caller.sub || r.beneficiarySub === caller.sub || c?.buddy?.sub === caller.sub;
  return false;
}

function view(s: Store, caller: Caller, r: AccessRequest) {
  return { ...r, alias: s.circles[r.circle]?.alias ?? "?", summary: describe(r), canVote: canVote(s, r, caller), quorum: QUORUM };
}

export const GET = route(async (_req, caller) => {
  const s = read();
  return Response.json({
    requests: s.requests.filter((r) => visible(s, caller, r)).map((r) => view(s, caller, r)),
    people: caller.persona === "student" ? [] : people(s, caller.mode).map(({ sub, name, persona, status }) => ({ sub, name, persona, status })),
  });
});

// POST { action: "file", kind, circle, beneficiarySub?, reason } | { action: "approve" | "deny", id }
export const POST = route(async (req, caller) => {
  const body = await req.json().catch(() => ({}));
  const out = mutate((s) => {
    if (body?.action === "file") {
      const kind = body.kind as AccessRequest["kind"];
      const circle = String(body.circle ?? "");
      const c = s.circles[circle];
      if (!c) throw new HttpError(404, "No such case");
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
      if (!reason) throw new HttpError(400, "Give a reason. The student will see it.");
      const staff = people(s, caller.mode);
      let beneficiary = staff.find((p) => p.sub === body.beneficiarySub);

      if (kind === "escalation") {
        if (!(caller.persona === "buddy" && c.buddy?.sub === caller.sub && buddyActive(s, c))) {
          throw new HttpError(403, "Only the student's current buddy can escalate this case.");
        }
        if (!beneficiary || beneficiary.persona !== "counsellor") throw new HttpError(400, "Pick a counsellor.");
      } else if (kind === "handover") {
        const mayFile = (caller.persona === "buddy" && c.buddy?.sub === caller.sub) || caller.persona === "committee" || caller.persona === "counsellor";
        if (!mayFile) throw new HttpError(403, "Only the current buddy, a counsellor or an admin can start a handover.");
        if (!beneficiary || beneficiary.persona !== "buddy" || beneficiary.sub === c.buddy?.sub) throw new HttpError(400, "Pick a different buddy.");
      } else if (kind === "self-grant") {
        if (caller.persona !== "committee") throw new HttpError(403, "Only an admin files this request.");
        beneficiary = { sub: caller.sub, name: caller.name, persona: "committee", status: "active" };
      } else {
        throw new HttpError(400, "Unknown request kind");
      }

      if (s.requests.some((r) => r.status === "pending" && r.kind === kind && r.circle === circle && r.beneficiarySub === beneficiary!.sub)) {
        throw new HttpError(409, "The same request is already waiting for approval.");
      }
      const r: AccessRequest = {
        id: id(),
        kind,
        circle,
        beneficiarySub: beneficiary.sub,
        beneficiaryName: beneficiary.name,
        beneficiaryPersona: beneficiary.persona,
        reason,
        filedBySub: caller.sub,
        filedByName: caller.name,
        approvals: [],
        status: "pending",
        createdAt: now(),
      };
      s.requests.unshift(r);
      log(s, {
        circle,
        actorSub: caller.sub,
        actorName: caller.name,
        actorPersona: caller.persona,
        action: `${caller.name} asked to ${describe(r)}. Reason: ${reason}`,
        outcome: "pending",
        enforcedBy: "app",
      });
      // Filing counts as the filer's own approval when they are allowed to vote (e.g. Ben escalating).
      if (canVote(s, r, caller)) castVote(s, r, caller);
      return view(s, caller, r);
    }

    const r = s.requests.find((x) => x.id === body?.id);
    if (!r) throw new HttpError(404, "No such request");
    if (body?.action === "approve") {
      if (!canVote(s, r, caller)) {
        log(s, {
          circle: r.circle,
          actorSub: caller.sub,
          actorName: caller.name,
          actorPersona: caller.persona,
          action: `${caller.name} tried to approve "${describe(r)}" but is not allowed to vote on it`,
          outcome: "refused",
          enforcedBy: "app",
        });
        throw new HttpError(403, caller.sub === r.beneficiarySub ? "You can't approve your own access." : "You can't vote on this request.");
      }
      castVote(s, r, caller);
    } else if (body?.action === "deny") {
      if (!canVote(s, r, caller)) throw new HttpError(403, "You can't vote on this request.");
      r.status = "denied";
      r.decidedBy = caller.name;
      r.decidedAt = now();
      log(s, {
        circle: r.circle,
        actorSub: caller.sub,
        actorName: caller.name,
        actorPersona: caller.persona,
        action: `${caller.name} denied: ${describe(r)}`,
        outcome: "refused",
        enforcedBy: "app",
      });
    } else {
      throw new HttpError(400, "Unknown action");
    }
    return view(s, caller, r);
  });
  return Response.json({ request: out });
});
