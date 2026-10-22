import { existsSync } from "fs";
import { join } from "path";
import type { NextRequest } from "next/server";
import { verifyTideJWT, extractToken } from "@/lib/auth/tideJWT";
import { verifyDpop } from "@/lib/auth/verifyDpop";
import { isPersona, personaFromRoles, REHEARSAL_SUBJECTS, type Persona } from "./personas";
import { rehearsalGrants } from "./store";

export type Mode = "tide" | "rehearsal";

export interface Caller {
  sub: string;
  roles: string[];
  persona: Persona | null;
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
      return { sub: String(jwt.sub ?? ""), roles, persona: personaFromRoles(roles), mode: "tide" };
    } catch (err) {
      throw new HttpError(401, err instanceof Error ? err.message : "Unauthorized");
    }
  }

  // Rehearsal: only when Tide is NOT configured, and never in production builds unless opted in.
  if (process.env.PCB_REHEARSAL === "off") {
    throw new HttpError(503, "Tide is not configured on this server.");
  }
  const persona = req.headers.get("x-pcb-rehearsal");
  if (!isPersona(persona)) throw new HttpError(401, "Pick a rehearsal persona first.");
  const roles = [`pcb-${persona}`, ...rehearsalGrants(persona)];
  return { sub: REHEARSAL_SUBJECTS[persona], roles, persona, mode: "rehearsal" };
}

type Handler = (req: NextRequest, caller: Caller) => Promise<Response>;

/** Wraps a route: resolves the caller, optionally requires a realm role, maps errors to JSON. */
export function route(handler: Handler, opts: { role?: string } = {}) {
  return async (req: NextRequest) => {
    try {
      const caller = await getCaller(req);
      if (opts.role && !caller.roles.includes(opts.role)) {
        throw new HttpError(403, `This token does not carry ${opts.role}.`, {
          required: opts.role,
          tokenRoles: caller.roles.filter((r) => r.startsWith("pcb-")),
          mode: caller.mode,
        });
      }
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
    throw new HttpError(403, `Only ${allowed.join(" or ")} accounts can do this.`, {
      tokenRoles: caller.roles.filter((r) => r.startsWith("pcb-")),
    });
  }
}
