"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { useSession } from "@/lib/pcb/session";
import { shortSubject } from "@/lib/pcb/personas";
import { readFlare } from "@/lib/pcb/flare";

interface CircleRow { circle: string; flareOptIn: boolean; since: string; openFlares: number }
interface Note { id: string; circle: string; ciphertext: string; createdAt: string }

export default function DeskPage() {
  return (
    <Shell requires={["buddy"]}>
      <Desk />
    </Shell>
  );
}

function Desk() {
  const s = useSession();
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [flareStatus, setFlareStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await s.api("/api/notes");
    if (!r.ok) return setStatus((await r.json()).error ?? "Could not load circles.");
    const d = await r.json();
    setCircles(d.circles);
    setNotes(d.notes);
    setActive((a) => a ?? d.circles[0]?.circle ?? null);
  }, [s]);

  useEffect(() => {
    load();
  }, [load]);

  const circle = circles.find((c) => c.circle === active) ?? null;
  const reading = useMemo(() => readFlare(draft), [draft]);
  const flareOn = Boolean(circle?.flareOptIn);

  async function seal() {
    if (!active || !draft.trim()) return;
    setBusy(true);
    setStatus("Sealing with your key…");
    try {
      const ciphertext = await s.encrypt(draft.trim());
      const r = await s.api("/api/notes", { method: "POST", body: JSON.stringify({ circle: active, ciphertext }) });
      if (!r.ok) throw new Error((await r.json()).error);
      setStatus("Sealed. Only you can open this session note.");
      setDraft("");
      await load();
    } catch (e) {
      setStatus(`Could not seal: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  async function raise(level: "watch" | "urgent") {
    if (!active) return;
    setFlareStatus("Raising a flag…");
    const r = await s.api("/api/flares", { method: "POST", body: JSON.stringify({ circle: active, level }) });
    const d = await r.json();
    if (!r.ok) return setFlareStatus(d.error);
    setFlareStatus(
      `Flag raised: circle ${shortSubject(active)}, ${level}. Sent: a circle ID and a level. Not sent: anything you wrote. A counsellor can only see it once two of three people approve their access.`,
    );
    load();
  }

  async function reveal(n: Note) {
    try {
      const pt = await s.decrypt(n.ciphertext);
      setOpen((o) => ({ ...o, [n.id]: pt }));
    } catch (e) {
      setStatus(`Could not open: ${e instanceof Error ? e.message : e}`);
    }
  }

  return (
    <>
      <p className="eyebrow">Buddy desk</p>
      <h1 className="page">The people you&apos;re walking with.</h1>
      <p className="lede">
        You see circles, not names. Your session notes are sealed to you. If you&apos;re worried about someone, Flare can
        raise a hand. It can&apos;t do anything else.
      </p>

      <hr className="rule" />

      {circles.length === 0 ? (
        <div className="notice wait">
          <strong>No circles yet</strong>A circle appears once a student signs in for the first time.
        </div>
      ) : (
        <div className="cols">
          <section aria-labelledby="session">
            <div className="row" role="tablist" aria-label="Circles" style={{ marginBottom: "1.2rem" }}>
              {circles.map((c) => (
                <button
                  key={c.circle}
                  role="tab"
                  aria-selected={c.circle === active}
                  className={`btn ${c.circle === active ? "" : "ghost"}`}
                  onClick={() => setActive(c.circle)}
                >
                  <span className="mono">{shortSubject(c.circle)}</span>
                  {c.openFlares > 0 && <span className="stamp pending" style={{ color: "inherit" }}>flagged</span>}
                </button>
              ))}
            </div>

            <h2 id="session">Session note</h2>
            <label className="field" htmlFor="draft">
              Sealed to you alone. Write what you&apos;d want to remember before the next session.
            </label>
            <textarea id="draft" rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="row" style={{ marginTop: ".8rem" }}>
              <button className="btn" onClick={seal} disabled={busy || !draft.trim()}>Seal and save</button>
            </div>
            <p className="status" aria-live="polite">{status}</p>

            <h2 style={{ marginTop: "2rem" }}>Your notes for this circle</h2>
            <ul className="entries">
              {notes.filter((n) => n.circle === active).reverse().map((n) => (
                <li key={n.id}>
                  <div className="entry-meta">
                    <span>{new Date(n.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                    {!open[n.id] && <button className="btn link" onClick={() => reveal(n)}>Open</button>}
                  </div>
                  {open[n.id] ? <p className="plain">{open[n.id]}</p> : <p className="cipher">{n.ciphertext}</p>}
                </li>
              ))}
            </ul>
          </section>

          <aside>
            <div className="panel" aria-live="polite">
              <div className="panel-head">
                <p className="eyebrow" style={{ margin: 0 }}>Flare</p>
                <span className={`stamp ${flareOn ? "allowed" : "refused"}`}>{flareOn ? "On, by the student" : "Off"}</span>
              </div>
              {!flareOn ? (
                <p className="small">The student hasn&apos;t switched Flare on for this circle, so it isn&apos;t reading anything.</p>
              ) : (
                <>
                  <p className="small" style={{ marginTop: 0 }}>
                    Reading your draft on this device only.{" "}
                    {reading.level === "none" && "Nothing worrying so far."}
                  </p>
                  {reading.level !== "none" && (
                    <div className={`notice ${reading.level === "urgent" ? "" : "wait"}`}>
                      <strong>{reading.level === "urgent" ? "Possible risk to life" : "Worth watching"}</strong>
                      Picked up: {reading.cues.map((c) => `"${c}"`).join(", ")}.
                      <div className="row" style={{ marginTop: ".7rem" }}>
                        <button className={`btn ${reading.level === "urgent" ? "danger" : ""}`} onClick={() => raise(reading.level as "watch" | "urgent")}>
                          Raise a {reading.level} flag
                        </button>
                      </div>
                    </div>
                  )}
                  {reading.ignoredInstructions.length > 0 && (
                    <div className="notice">
                      <strong>Instruction ignored</strong>
                      This note tells Flare to {reading.ignoredInstructions.map((c) => `"${c}"`).join(", ")}. Flare
                      holds no admin role and no Tide key. It can raise a flag. Approving access is for two humans.
                    </div>
                  )}
                </>
              )}
              {flareStatus && <p className="status">{flareStatus}</p>}
            </div>
            <p className="figure-note">
              Flare&apos;s detection is a fixed phrase list in this prototype. A real deployment would use an on-device
              model; its authority would stay exactly this small.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
