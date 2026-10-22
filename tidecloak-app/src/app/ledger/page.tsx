"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { useSession } from "@/lib/pcb/session";
import { shortSubject } from "@/lib/pcb/personas";

interface Held {
  notes?: { id: string; circle: string; kind: string; ciphertext: string; createdAt: string }[];
  [k: string]: unknown;
}

export default function LedgerPage() {
  return (
    <Shell requires={["committee", "counsellor"]}>
      <Ledger />
    </Shell>
  );
}

function Ledger() {
  const s = useSession();
  const [held, setHeld] = useState<Held | null>(null);
  const [attempt, setAttempt] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await s.api("/api/ledger");
    if (r.ok) setHeld(await r.json());
  }, [s]);

  useEffect(() => {
    load();
  }, [load]);

  const target = held?.notes?.filter((n) => n.kind === "journal").at(-1) ?? null;

  async function tryOpen() {
    if (!target) return;
    setBusy(true);
    setAttempt(null);
    try {
      const pt = await s.decrypt(target.ciphertext);
      setAttempt({ ok: true, text: `Opened. This should never happen: ${pt.slice(0, 80)}` });
    } catch (e) {
      setAttempt({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="eyebrow">What the server holds</p>
      <h1 className="page">This is the whole database. Go ahead and read it.</h1>
      <p className="lede">
        Anyone who runs PCB, or steals a copy of it, gets exactly this. Notes are sealed by the person who wrote them.
        People appear as random IDs.
      </p>
      <hr className="rule" />
      <div className="cols">
        <section>
          <pre className="ledger" tabIndex={0} aria-label="Raw database contents">
            {held ? JSON.stringify(held, null, 2) : "Loading…"}
          </pre>
          <p className="figure-note">
            What it does show, honestly: timestamps, which anonymous circle raised a flag, and refused attempts. We list
            these limits in the README.
          </p>
        </section>
        <aside className="panel">
          <p className="eyebrow">Try it yourself</p>
          <h2>Open a student&apos;s note with your own session.</h2>
          {target ? (
            <>
              <p className="small">
                Newest journal entry in circle <span className="mono">{shortSubject(target.circle)}</span>. You are signed in as
                the {s.persona}, with admin rights.
              </p>
              <button className="btn danger" onClick={tryOpen} disabled={busy}>
                {busy ? "Asking the Tide network…" : "Try to decrypt it"}
              </button>
              {attempt && (
                <div className={`notice ${attempt.ok ? "" : "ok"}`} role="status">
                  <strong>{attempt.ok ? "Opened" : "Refused"}</strong>
                  {attempt.ok
                    ? attempt.text
                    : `${s.mode === "tide" ? "The Tide network would not release the key" : "This browser's key did not seal that note"}. ${attempt.text}`}
                </div>
              )}
            </>
          ) : (
            <p className="small">No student has sealed an entry yet.</p>
          )}
        </aside>
      </div>
    </>
  );
}
