import type { NextRequest } from "next/server";
import { getCaller, HttpError, type Caller } from "@/lib/pcb/caller";
import { BREAKGLASS_ROLE } from "@/lib/pcb/personas";
import { mutate, id, now, receipt } from "@/lib/pcb/store";

export const dynamic = "force-dynamic";

/**
 * The escalation desk. The ONLY gate is a realm role inside a token the Tide network signed.
 * TideCloak will not put pcb-breakglass in a token until 2 of the 3 admins have approved the
 * grant, so one admin (or Flare, or our own server) cannot open this alone.
 */
async function gate(req: NextRequest): Promise<Caller> {
  const caller = await getCaller(req);
  if (!caller.roles.includes(BREAKGLASS_ROLE)) {
    mutate((s) =>
      receipt(s, {
        circle: "*",
        actorSub: caller.sub,
        actorPersona: caller.persona,
        action: "Someone tried to open the escalation desk without a quorum-approved grant",
        outcome: "refused",
        enforcedBy: "tide",
      }),
    );
    throw new HttpError(403, `Refused. Your Tide-signed token does not carry ${BREAKGLASS_ROLE}.`, {
      required: BREAKGLASS_ROLE,
      tokenRoles: caller.roles.filter((r) => r.startsWith("pcb-")),
      mode: caller.mode,
    });
  }
  return caller;
}

function fail(err: unknown) {
  if (err instanceof HttpError) return Response.json({ error: err.message, ...err.extra }, { status: err.status });
  console.error(err);
  return Response.json({ error: "Internal error" }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    const caller = await gate(req);
    const s = mutate((st) => {
      const recent = st.receipts.find((r) => r.actorSub === caller.sub && r.outcome === "allowed");
      const fresh = recent && Date.now() - Date.parse(recent.at) < 10 * 60_000 && recent.action.includes("opened the escalation desk");
      if (!fresh) receipt(st, {
        circle: "*",
        actorSub: caller.sub,
        actorPersona: caller.persona,
        action: "A quorum-approved counsellor opened the escalation desk",
        outcome: "allowed",
        enforcedBy: "tide",
      });
      return st;
    });
    return Response.json({
      flares: s.flares.filter((f) => f.status === "open"),
      checkIns: s.checkIns,
      refusals: s.receipts.filter((r) => r.outcome === "refused").slice(0, 20),
    });
  } catch (err) {
    return fail(err);
  }
}

// POST /api/escalation { flareId, body } — reach out to the circle that raised the flare.
export async function POST(req: NextRequest) {
  try {
    const caller = await gate(req);
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (!text || text.length > 600) throw new HttpError(400, "Message must be 1-600 characters");
    const out = mutate((s) => {
      const f = s.flares.find((x) => x.id === body?.flareId);
      if (!f) throw new HttpError(404, "No such flare");
      f.status = "answered";
      const c = { id: id(), circle: f.circle, fromSub: caller.sub, body: text, createdAt: now() };
      s.checkIns.push(c);
      receipt(s, {
        circle: f.circle,
        actorSub: caller.sub,
        actorPersona: caller.persona,
        action: "A counsellor reached out to your circle after two people approved",
        outcome: "allowed",
        enforcedBy: "tide",
      });
      return c;
    });
    return Response.json({ checkIn: out }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
