"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { TideCloakProvider, useTideCloak } from "@tidecloak/nextjs";
import { isIdentity, IDENTITIES, type IdentityKey, type Persona } from "./personas";

export type Mode = "loading" | "tide" | "rehearsal";

export interface Session {
  mode: Mode;
  ready: boolean;
  authenticated: boolean;
  sub: string | null;
  persona: Persona | null;
  identity: IdentityKey | null;
  name: string | null;
  alias: string | null;
  roles: string[];
  circle: string | null;
  error: string | null;
  consoleUrl: string | null;
  login: () => void;
  logout: () => void;
  chooseIdentity: (k: IdentityKey | null) => void;
  /** Seal text for a case. Tide mode: the writer's Tide key. Rehearsal: the case key. */
  encrypt: (text: string, circle: string) => Promise<string>;
  decrypt: (ciphertext: string, circle: string) => Promise<string>;
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
  sub: null,
  persona: null,
  identity: null,
  name: null,
  alias: null,
  roles: [],
  circle: null,
  error: null,
  consoleUrl: null,
  login: () => {},
  logout: () => {},
  chooseIdentity: () => {},
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
  name: string;
  alias: string | null;
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
      return;
    }
    loadMe(api)
      .then((m) => setMe(m))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [tc.authenticated, tc.token, api]);

  const base = String(config["auth-server-url"] ?? "").replace(/\/+$/, "");
  const value = useMemo<Session>(
    () => ({
      mode: "tide",
      ready: !tc.isInitializing,
      authenticated: tc.authenticated,
      sub: me?.sub ?? (tc.authenticated ? tc.getValueFromToken("sub") : null),
      persona: me?.persona ?? null,
      identity: null,
      name: me?.name ?? null,
      alias: me?.alias ?? null,
      roles: me?.roles ?? [],
      circle: me?.circle ?? null,
      error: error ?? (tc.initError ? tc.initError.message : null),
      consoleUrl: base ? `${base}/realms/${config.realm}/tide-console/` : null,
      login: () => void tc.login(),
      logout: () => void tc.logout(),
      chooseIdentity: () => {},
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
    [tc, me, error, api, base, config.realm],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ------------------------------------------------------------- rehearsal mode */
// Used only when the server has no Tide adapter config. Encryption here is real AES-GCM, but the
// case key is handed out by our server to case members, NOT held by Tide's network. Every screen
// labels it.

const IDENTITY_KEY = "safecounsel.rehearsal.identity";

function RehearsalProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<IdentityKey | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const k = localStorage.getItem(IDENTITY_KEY);
    setIdentity(isIdentity(k) ? k : null);
    setReady(true);
  }, []);

  const api = useCallback<Session["api"]>(
    (path, init = {}) => {
      const headers = new Headers(init.headers);
      if (identity) headers.set("x-pcb-rehearsal", identity);
      if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      return fetch(path, { ...init, headers });
    },
    [identity],
  );

  const keyFor = useCallback(
    async (circle: string): Promise<CryptoKey> => {
      const r = await api(`/api/key?circle=${encodeURIComponent(circle)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Refused");
      const bytes = Uint8Array.from(atob(d.key), (c) => c.charCodeAt(0));
      return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
    },
    [api],
  );

  useEffect(() => {
    if (!identity) {
      setMe(null);
      return;
    }
    loadMe(api).then(setMe).catch(() => setMe(null));
  }, [identity, api]);

  const value = useMemo<Session>(
    () => ({
      mode: "rehearsal",
      ready,
      authenticated: Boolean(identity),
      sub: me?.sub ?? null,
      persona: identity ? IDENTITIES[identity].persona : null,
      identity,
      name: identity ? IDENTITIES[identity].name : null,
      alias: me?.alias ?? null,
      roles: me?.roles ?? [],
      circle: me?.circle ?? null,
      error: null,
      consoleUrl: null,
      login: () => {},
      logout: () => {
        localStorage.removeItem(IDENTITY_KEY);
        setIdentity(null);
      },
      chooseIdentity: (k) => {
        if (k) localStorage.setItem(IDENTITY_KEY, k);
        else localStorage.removeItem(IDENTITY_KEY);
        setIdentity(k);
      },
      encrypt: async (text, circle) => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = new Uint8Array(
          await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(circle), new TextEncoder().encode(text)),
        );
        const all = new Uint8Array(iv.length + ct.length);
        all.set(iv);
        all.set(ct, iv.length);
        return "rh1." + btoa(String.fromCharCode(...all));
      },
      decrypt: async (ciphertext, circle) => {
        const key = await keyFor(circle);
        const all = Uint8Array.from(atob(ciphertext.replace(/^rh1\./, "")), (c) => c.charCodeAt(0));
        try {
          const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12) }, key, all.slice(12));
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
    [ready, identity, me, api, keyFor],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
