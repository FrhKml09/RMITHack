import { existsSync } from "fs";
import { join } from "path";
import type { NextRequest } from "next/server";
import { verifyTideJWT, extractToken } from "@/lib/auth/tideJWT";
import { verifyDpop } from "@/lib/auth/verifyDpop";
import { IDENTITIES, isIdentity, personaFromRoles, PERSONA_LABEL, shortSubject, type Persona } from "./personas";

export type Mode = "tide" | "rehearsal";

export interface Caller {
  sub: string;
  roles: string[];
  persona: Persona | null;
  /** Display name for staff. Students are never shown by name to anyone but themselves. */
  name: string;
  mode: Mode;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

/** Tide mode is on as soon as an adapter config exists. Rehearsal can never run alongside it. */
export function tideConfigured(): boolean {
  return Boolean(process.env.CLIENT_ADAPTER) || existsSync(join(process.cwd(), "data", "tidecloak.json"));
}

export async function getCaller(req: NextRequest): Promise<Caller> {
  if (tideConfigured()) {
    let token: string;
    try {
      token = extractToken(req.headers.get("authorization"));
      const jwt = await verifyTideJWT(token);
      // Sender-constrained token: a stolen token replayed without its DPoP proof is refused here.
      await verifyDpop(req, token, jwt as { cnf?: { jkt?: string } });
      const roles = (((jwt.realm_access as { roles?: string[] } | undefined)?.roles) ?? []).slice();
      const persona = personaFromRoles(roles);
      const sub = String(jwt.sub ?? "");
      const uname = typeof jwt.preferred_username === "string" ? jwt.preferred_username : "";
      const name = persona === "student" || !uname ? `${persona ? PERSONA_LABEL[persona].title : "User"} ${shortSubject(sub)}` : uname;
      return { sub, roles, persona, name, mode: "tide" };
    } catch (err) {
      throw new HttpError(401, err instanceof Error ? err.message : "Unauthorized");
    }
  }

  if (process.env.PCB_REHEARSAL === "off") {
    throw new HttpError(503, "Tide is not configured on this server.");
  }
  const key = req.headers.get("x-pcb-rehearsal");
  if (!isIdentity(key)) throw new HttpError(401, "Pick a rehearsal identity first.");
  const who = IDENTITIES[key];
  return { sub: who.sub, roles: [`pcb-${who.persona}`], persona: who.persona, name: who.name, mode: "rehearsal" };
}

type Handler = (req: NextRequest, caller: Caller) => Promise<Response>;

/** Wraps a route: resolves the caller, maps errors to JSON. */
export function route(handler: Handler) {
  return async (req: NextRequest) => {
    try {
      const caller = await getCaller(req);
      return await handler(req, caller);
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json({ error: err.message, ...err.extra }, { status: err.status });
      }
      console.error(err);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

export function requirePersona(caller: Caller, ...allowed: Persona[]) {
  if (!caller.persona || !allowed.includes(caller.persona)) {
    throw new HttpError(403, `Only ${allowed.map((p) => PERSONA_LABEL[p].title.toLowerCase()).join(" or ")} accounts can do this.`, {
      tokenRoles: caller.roles.filter((r) => r.startsWith("pcb-")),
    });
  }
}

export const enforcedBy = (c: Caller) => (c.mode === "tide" ? ("tide" as const) : ("app" as const));
