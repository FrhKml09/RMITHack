"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell, when } from "@/components/Shell";
import { Receipts, type ReceiptRow } from "@/components/Receipts";
import { useSession } from "@/lib/pcb/session";
import { shortSubject } from "@/lib/pcb/personas";

interface Note { id: string; ciphertext: string; createdAt: string }
interface CheckIn { id: string; body: string; createdAt: string }

export default function CirclePage() {
  return (
    <Shell requires={["student"]}>
      <Circle />
    </Shell>
  );
}

function Circle() {
  const s = useSession();
  const [notes, setNotes] = useState<Note[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [flareOptIn, setFlareOptIn] = useState(false);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await s.api("/api/notes");
    if (!r.ok) return setStatus((await r.json()).error ?? "Could not load your circle.");
    const d = await r.json();
    setNotes(d.notes);
    setCheckIns(d.checkIns);
    setReceipts(d.receipts);
    setFlareOptIn(d.flareOptIn);
  }, [s]);

  useEffect(() => {
    load();
  }, [load]);

  async function seal() {
    if (!draft.trim()) return;
    setBusy(true);
    setStatus(s.mode === "tide" ? "Sealing with your Tide key…" : "Sealing with this browser's rehearsal key…");
    try {
      const ciphertext = await s.encrypt(draft.trim());
      const r = await s.api("/api/notes", { method: "POST", body: JSON.stringify({ ciphertext }) });
      if (!r.ok) throw new Error((await r.json()).error);
      setDraft("");
      setStatus("Sealed. The server stored ciphertext only.");
      await load();
    } catch (e) {
      setStatus(`Could not seal: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  async function reveal(n: Note) {
    setStatus("Opening…");
    try {
      const pt = await s.decrypt(n.ciphertext);
      setOpen((o) => ({ ...o, [n.id]: pt }));
      setStatus("");
    } catch (e) {
      setStatus(`Could not open: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function toggleFlare(on: boolean) {
    const r = await s.api("/api/circle", { method: "POST", body: JSON.stringify({ flareOptIn: on }) });
    if (r.ok) {
      setFlareOptIn(on);
      load();
    }
  }

  return (
    <>
      <p className="eyebrow">My circle</p>
      <h1 className="page">
        Circle <span className="mono" style={{ fontSize: ".7em" }}>{shortSubject(s.sub)}</span>
      </h1>
      <p className="lede">
        Safe Circle knows you by a random ID. Not your name, not your email, not your student number. What you write here is
        sealed on this device before it leaves.
      </p>

      <hr className="rule" />

      <div className="cols">
        <section aria-labelledby="write">
          <h2 id="write">Write it down</h2>
          <label className="field" htmlFor="draft">Only you can open what you seal here.</label>
          <textarea
            id="draft"
            rows={6}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What's been on your mind this week?"
          />
          <div className="row" style={{ marginTop: ".8rem" }}>
            <button className="btn" onClick={seal} disabled={busy || !draft.trim()}>Seal and save</button>
          </div>
          <p className="status" aria-live="polite">{status}</p>

          <h2 style={{ marginTop: "2.2rem" }}>Sealed entries</h2>
          {notes.length === 0 ? (
            <p className="small">Nothing yet.</p>
          ) : (
            <ul className="entries">
              {[...notes].reverse().map((n) => (
                <li key={n.id}>
                  <div className="entry-meta">
                    <span>{new Date(n.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                    {open[n.id] ? (
                      <button className="btn link" onClick={() => setOpen(({ [n.id]: _, ...rest }) => rest)}>Close</button>
                    ) : (
                      <button className="btn link" onClick={() => reveal(n)}>Open</button>
                    )}
                  </div>
                  {open[n.id] ? <p className="plain">{open[n.id]}</p> : <p className="cipher" aria-label="Sealed text">{n.ciphertext}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside>
          <div className="panel">
            <p className="eyebrow">Flare</p>
            <label className="toggle">
              <input type="checkbox" checked={flareOptIn} onChange={(e) => toggleFlare(e.target.checked)} />
              <span>
                Let Flare watch my buddy&apos;s notes for signs I&apos;m not safe.
                <span className="small" style={{ display: "block", marginTop: ".3rem" }}>
                  Flare runs on your buddy&apos;s device. If it worries, it raises a flag with your circle ID and a
                  level. Never your words. It can ask for help; it can never grant itself access.
                </span>
              </span>
            </label>
          </div>

          {checkIns.length > 0 && (
            <div className="panel inset">
              <p className="eyebrow">Someone reached out</p>
              {checkIns.map((c) => (
                <div key={c.id} style={{ marginBottom: ".8rem" }}>
                  <p style={{ margin: 0 }}>{c.body}</p>
                  <p className="figure-note">A counsellor, {when(c.createdAt)}, after two people approved.</p>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: "2rem" }}>
            <h2>Receipts</h2>
            <p className="small">Everything that has touched your circle. You see this whether or not it worked.</p>
            <Receipts rows={receipts} />
          </div>
        </aside>
      </div>
    </>
  );
}
