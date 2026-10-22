"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { TideCloakProvider, useTideCloak } from "@tidecloak/nextjs";
import { isPersona, type Persona } from "./personas";

export type Mode = "loading" | "tide" | "rehearsal";

export interface Session {
  mode: Mode;
  ready: boolean;
  authenticated: boolean;
  /** True once /api/me has answered, so "no persona" means "no pcb-* role", not "still loading". */
  rolesLoaded: boolean;
  sub: string | null;
  persona: Persona | null;
  roles: string[];
  circle: string | null;
  error: string | null;
  consoleUrl: string | null;
  login: () => void;
  logout: () => void;
  choosePersona: (p: Persona | null) => void;
  encrypt: (text: string) => Promise<string>;
  decrypt: (ciphertext: string) => Promise<string>;
  api: (path: string, init?: RequestInit) => Promise<Response>;
  refresh: () => Promise<void>;
}

// Tag the realm grants self-encrypt/self-decrypt for (see scripts/realm.json.template).
const TAG = "vault";

const noop = async () => {
  throw new Error("Session not ready");
};

const LOADING: Session = {
  mode: "loading",
  ready: false,
  authenticated: false,
  rolesLoaded: false,
  sub: null,
  persona: null,
  roles: [],
  circle: null,
  error: null,
  consoleUrl: null,
  login: () => {},
  logout: () => {},
  choosePersona: () => {},
  encrypt: noop,
  decrypt: noop,
  api: noop,
  refresh: noop,
};

const Ctx = createContext<Session>(LOADING);
export const useSession = () => useContext(Ctx);

interface Me {
  sub: string;
  persona: Persona | null;
  roles: string[];
  circle: string | null;
}

async function loadMe(api: Session["api"]): Promise<Me | null> {
  const r = await api("/api/me");
  if (!r.ok) return null;
  return r.json();
}

export function PcbProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Record<string, unknown> | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setConfig(c && c.jwk ? c : null))
      .catch(() => setConfig(null));
  }, []);

  if (config === undefined) return <Ctx.Provider value={LOADING}>{children}</Ctx.Provider>;
  if (config === null) return <RehearsalProvider>{children}</RehearsalProvider>;
  return (
    // useDPoP goes inside config: tokens are sender-constrained, so a stolen token is useless alone.
    <TideCloakProvider config={{ ...config, useDPoP: { mode: "strict", alg: "ES256" } }}>
      <TideBridge config={config}>{children}</TideBridge>
    </TideCloakProvider>
  );
}

/* ------------------------------------------------------------------ Tide mode */

function TideBridge({ config, children }: { config: Record<string, unknown>; children: React.ReactNode }) {
  const tc = useTideCloak();
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = useCallback<Session["api"]>(
    (path, init = {}) => {
      const url = new URL(path, window.location.origin).toString();
      const headers = new Headers(init.headers);
      if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      // secureFetch attaches the access token AND a fresh DPoP proof for this exact URL + method.
      return tc.secureFetch(url, { ...init, headers });
    },
    [tc],
  );

  useEffect(() => {
    if (!tc.authenticated) {
      setMe(null);
      setLoaded(false);
      return;
    }
    loadMe(api)
      .then((m) => setMe(m))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoaded(true));
  }, [tc.authenticated, tc.token, api]);

  const base = String(config["auth-server-url"] ?? "").replace(/\/+$/, "");
  const value = useMemo<Session>(
    () => ({
      mode: "tide",
      ready: !tc.isInitializing,
      authenticated: tc.authenticated,
      rolesLoaded: loaded,
      sub: me?.sub ?? (tc.authenticated ? tc.getValueFromToken("sub") : null),
      persona: me?.persona ?? null,
      roles: me?.roles ?? [],
      circle: me?.circle ?? null,
      error: error ?? (tc.initError ? tc.initError.message : null),
      consoleUrl: base ? `${base}/realms/${config.realm}/tide-console/` : null,
      login: () => void tc.login(),
      logout: () => void tc.logout(),
      choosePersona: () => {},
      encrypt: async (text) => {
        const [ct] = await tc.doEncrypt([{ data: text, tags: [TAG] }]);
        return typeof ct === "string" ? ct : JSON.stringify(ct);
      },
      decrypt: async (ciphertext) => {
        const [pt] = await tc.doDecrypt([{ encrypted: ciphertext, tags: [TAG] }]);
        return typeof pt === "string" ? pt : new TextDecoder().decode(pt);
      },
      api,
      refresh: async () => {
        await tc.forceRefreshToken();
        setMe(await loadMe(api));
      },
    }),
    [tc, me, loaded, error, api, base, config.realm],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ------------------------------------------------------------- rehearsal mode */
// Used only when the server has no Tide adapter config. Encryption here is real AES-GCM, but with
// a key kept in this browser per persona, NOT Tide's threshold key. Every screen labels it.

const KEY_PREFIX = "pcb.rehearsal.key.";
const PERSONA_KEY = "pcb.rehearsal.persona";

async function rehearsalKey(p: Persona): Promise<CryptoKey> {
  let raw = localStorage.getItem(KEY_PREFIX + p);
  if (!raw) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    raw = btoa(String.fromCharCode(...bytes));
    localStorage.setItem(KEY_PREFIX + p, raw);
  }
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function RehearsalProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = localStorage.getItem(PERSONA_KEY);
    setPersona(isPersona(p) ? p : null);
    setReady(true);
  }, []);

  const api = useCallback<Session["api"]>(
    (path, init = {}) => {
      const headers = new Headers(init.headers);
      if (persona) headers.set("x-pcb-rehearsal", persona);
      if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      return fetch(path, { ...init, headers });
    },
    [persona],
  );

  useEffect(() => {
    if (!persona) {
      setMe(null);
      return;
    }
    loadMe(api).then(setMe).catch(() => setMe(null));
  }, [persona, api]);

  const value = useMemo<Session>(
    () => ({
      mode: "rehearsal",
      ready,
      authenticated: Boolean(persona),
      rolesLoaded: !persona || me !== null,
      sub: me?.sub ?? null,
      persona,
      roles: me?.roles ?? [],
      circle: me?.circle ?? null,
      error: null,
      consoleUrl: null,
      login: () => {},
      logout: () => {
        localStorage.removeItem(PERSONA_KEY);
        setPersona(null);
      },
      choosePersona: (p) => {
        if (p) localStorage.setItem(PERSONA_KEY, p);
        else localStorage.removeItem(PERSONA_KEY);
        setPersona(p);
      },
      encrypt: async (text) => {
        if (!persona) throw new Error("No persona");
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = new Uint8Array(
          await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await rehearsalKey(persona), new TextEncoder().encode(text)),
        );
        const all = new Uint8Array(iv.length + ct.length);
        all.set(iv);
        all.set(ct, iv.length);
        return "rh1." + btoa(String.fromCharCode(...all));
      },
      decrypt: async (ciphertext) => {
        if (!persona) throw new Error("No persona");
        const all = Uint8Array.from(atob(ciphertext.replace(/^rh1\./, "")), (c) => c.charCodeAt(0));
        try {
          const pt = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: all.slice(0, 12) },
            await rehearsalKey(persona),
            all.slice(12),
          );
          return new TextDecoder().decode(pt);
        } catch {
          throw new Error("Refused: this key did not seal that note.");
        }
      },
      api,
      refresh: async () => {
        setMe(await loadMe(api));
      },
    }),
    [ready, persona, me, api],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
