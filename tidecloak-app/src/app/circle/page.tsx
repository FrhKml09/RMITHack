"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Shell, day } from "@/components/Shell";
import { Receipts, type LogRow } from "@/components/Receipts";
import { useSession } from "@/lib/pcb/session";
import { NoteList, type CaseNote } from "@/components/NoteList";

interface CaseView {
  circle: string;
  alias: string;
  buddyRequested: boolean;
  buddy: { name: string; until: string } | null;
  access: { who: string; why: string; until?: string }[];
  notes: CaseNote[];
  requests: { id: string; summary: string; reason: string; status: string; approvals: { name: string }[]; quorum: number; filedByName: string }[];
  log: LogRow[];
}

export default function CirclePage() {
  return (
    <Shell requires={["student"]}>
      <StudentDashboard />
    </Shell>
  );
}

function StudentDashboard() {
  const s = useSession();
  const [cv, setCv] = useState<CaseView | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await s.api("/api/case");
    const d = await r.json();
    if (!r.ok) return setStatus(d.error ?? "Could not load your space.");
    setCv(d);
  }, [s]);

  useEffect(() => {
    load();
  }, [load]);

  async function seal(kind: "journal" | "request") {
    if (!cv || !draft.trim()) return;
    setBusy(true);
    setStatus(s.mode === "tide" ? "Locking it with your Tide key…" : "Locking it in this browser…");
    try {
      const ciphertext = await s.encrypt(draft.trim(), cv.circle);
      const r = await s.api("/api/notes", { method: "POST", body: JSON.stringify({ ciphertext, kind }) });
      if (!r.ok) throw new Error((await r.json()).error);
      if (kind === "request") {
        const q = await s.api("/api/case", { method: "POST", body: JSON.stringify({ action: "request-buddy" }) });
        if (!q.ok) throw new Error((await q.json()).error);
      }
      setDraft("");
      setStatus(kind === "request" ? "Sent. The server stored scrambled text only. You'll be matched with a buddy." : "Locked and saved. The server stored scrambled text only.");
      await load();
    } catch (e) {
      setStatus(`Could not save: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  if (!cv) return <p className="status" aria-live="polite">{status || "Opening your space…"}</p>;
  const noBuddy = !cv.buddy && !cv.buddyRequested;
  const pending = cv.requests.filter((r) => r.status === "pending");

  return (
    <>
      <p className="eyebrow">My space</p>
      <h1 className="page">Hi{s.name ? ` ${s.name}` : ""}. This is yours.</h1>
      <p className="lede">
        Everyone else, including your buddy and the admins, sees you as <span className="mono">{cv.alias}</span>. Never your
        name, email or student number. What you write is locked on this device before it leaves.
      </p>

      <hr className="rule" />

      <div className="cols">
        <section aria-labelledby="write">
          {noBuddy ? (
            <>
              <h2 id="write">Request a buddy</h2>
              <label className="field" htmlFor="draft">A few lines about what&apos;s going on. Only you and the buddy you&apos;re matched with can read it.</label>
            </>
          ) : (
            <>
              <h2 id="write">Write a note</h2>
              <label className="field" htmlFor="draft">Only the people in the panel on the right can read this.</label>
            </>
          )}
          <textarea id="draft" rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What's been on your mind this week?" />
          <div className="row" style={{ marginTop: ".8rem" }}>
            <button className="btn" onClick={() => seal(noBuddy ? "request" : "journal")} disabled={busy || !draft.trim()}>
              {noBuddy ? "Request a buddy" : "Lock and save"}
            </button>
          </div>
          <p className="status" aria-live="polite">{status}</p>

          {cv.buddyRequested && !cv.buddy && (
            <div className="notice wait">
              <strong>Waiting for a match</strong>An admin will match you with a trained peer buddy. They can match you, but they can&apos;t read anything you wrote.
            </div>
          )}

          <h2 style={{ marginTop: "2rem" }}>Notes in your case</h2>
          <NoteList notes={cv.notes} circle={cv.circle} />
        </section>

        <aside>
          <div className="panel">
            <p className="eyebrow">Who can see my notes</p>
            <table className="access" aria-label="Who can see my notes">
              <tbody>
                {cv.access.map((a) => (
                  <tr key={a.who}>
                    <td><b>{a.who}</b><br /><span className="small">{a.why}{a.until ? ` Access ends ${day(a.until)}.` : ""}</span></td>
                    <td className="yes">Can read</td>
                  </tr>
                ))}
                <tr><td>Admins, IT, the committee</td><td className="no">Scrambled text only</td></tr>
                <tr><td>Other buddies and counsellors</td><td className="no">No</td></tr>
              </tbody>
            </table>
            <p className="figure-note">
              {cv.access.length === 1 ? "Only you, for now." : cv.access.length === 2 ? "Only you and your buddy." : "Anyone added beyond your buddy needed two approvals."}{" "}
              Anyone new needs two people to approve, and you&apos;re told why.
            </p>
          </div>

          {pending.length > 0 && (
            <div className="panel inset">
              <p className="eyebrow">Waiting for approval</p>
              {pending.map((r) => (
                <p key={r.id} style={{ margin: "0 0 .6rem" }}>
                  {r.filedByName} asked to {r.summary.replace(/^share/, "share")}. <span className="small">Reason: {r.reason}. {r.approvals.length} of {r.quorum} approvals.</span>
                </p>
              ))}
            </div>
          )}

          <div style={{ marginTop: "2rem" }}>
            <h2>Notifications</h2>
            <p className="small">Everything that has touched your case, including attempts that were refused. <Link href="/log">Full access log</Link></p>
            <Receipts rows={cv.log.slice(0, 12)} />
          </div>
        </aside>
      </div>
    </>
  );
}
