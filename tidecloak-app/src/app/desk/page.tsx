"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Shell, day } from "@/components/Shell";
import { NoteList, type CaseNote } from "@/components/NoteList";
import { useSession } from "@/lib/pcb/session";
import { readFlare } from "@/lib/pcb/flare";

interface CaseRow { circle: string; alias: string; as: "buddy" | "counsellor"; live: boolean; until: string | null; why: string }
interface Person { sub: string; name: string; persona: string; status: string }
interface CaseView { circle: string; alias: string; notes: CaseNote[]; requests: { id: string; summary: string; status: string; approvals: { name: string }[]; quorum: number }[] }

export default function DeskPage() {
  return (
    <Shell requires={["buddy", "counsellor"]}>
      <Desk />
    </Shell>
  );
}

function Desk() {
  const s = useSession();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [staff, setStaff] = useState<Person[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [cv, setCv] = useState<CaseView | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [reqStatus, setReqStatus] = useState("");
  const [counsellor, setCounsellor] = useState("");
  const [reason, setReason] = useState("");
  const [newBuddy, setNewBuddy] = useState("");
  const [handReason, setHandReason] = useState("I'm graduating at the end of this semester.");
  const isBuddy = s.persona === "buddy";

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([s.api("/api/cases"), s.api("/api/requests")]);
    if (r.ok) {
      const d = await r.json();
      setCases(d.cases);
      setActive((a) => a ?? d.cases.find((c: CaseRow) => c.live)?.circle ?? null);
    }
    if (p.ok) setStaff((await p.json()).people);
  }, [s]);

  const loadCase = useCallback(async () => {
    if (!active) return setCv(null);
    const r = await s.api(`/api/case?circle=${active}`);
    const d = await r.json();
    if (!r.ok) {
      setCv(null);
      return setStatus(d.error);
    }
    setCv(d);
  }, [s, active]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadCase();
  }, [loadCase]);

  const reading = useMemo(() => readFlare(draft), [draft]);
  const current = cases.find((c) => c.circle === active);

  async function seal() {
    if (!active || !draft.trim()) return;
    setStatus("Locking…");
    try {
      const ciphertext = await s.encrypt(draft.trim(), active);
      const r = await s.api("/api/notes", { method: "POST", body: JSON.stringify({ circle: active, ciphertext }) });
      if (!r.ok) throw new Error((await r.json()).error);
      setDraft("");
      setStatus("Locked. Only people in this case can read it.");
      loadCase();
    } catch (e) {
      setStatus(`Could not save: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function file(kind: "escalation" | "handover") {
    if (!active) return;
    const body = kind === "escalation" ? { beneficiarySub: counsellor, reason } : { beneficiarySub: newBuddy, reason: handReason };
    const r = await s.api("/api/requests", { method: "POST", body: JSON.stringify({ action: "file", kind, circle: active, ...body }) });
    const d = await r.json();
    if (!r.ok) return setReqStatus(d.error);
    setReqStatus(`Request filed: ${d.request.summary}. ${d.request.approvals.length} of ${d.request.quorum} approvals (yours counts). It goes through when one more person on the care team approves.`);
    setReason("");
    loadCase();
  }

  const counsellors = staff.filter((p) => p.persona === "counsellor" && p.status === "active");
  const buddies = staff.filter((p) => p.persona === "buddy" && p.status === "active" && p.sub !== s.sub);

  return (
    <>
      <p className="eyebrow">{isBuddy ? "Buddy dashboard" : "Counsellor cases"}</p>
      <h1 className="page">{isBuddy ? "The students you're walking with." : "Cases two people let you into."}</h1>
      <p className="lede">
        You see pseudonyms, not names. You only see cases you&apos;re part of{isBuddy ? ", and only until your buddy contract ends" : ""}.
      </p>
      <hr className="rule" />

      {cases.length === 0 ? (
        <div className="notice wait">
          <strong>No cases</strong>
          {isBuddy ? "An admin assigns you once a student asks for a buddy." : "A case appears here only after a buddy escalates it and a second person approves."}
        </div>
      ) : (
        <div className="row" role="tablist" aria-label="Cases" style={{ marginBottom: "1.4rem" }}>
          {cases.map((c) => (
            <button key={c.circle + c.as} role="tab" aria-selected={c.circle === active} className={`btn ${c.circle === active ? "" : "ghost"}`} onClick={() => c.live && setActive(c.circle)} disabled={!c.live}>
              <span className="mono">{c.alias}</span>
              {!c.live && <span className="stamp refused" style={{ color: "inherit" }}>access ended</span>}
            </button>
          ))}
        </div>
      )}

      {cases.filter((c) => !c.live).map((c) => (
        <p key={"x" + c.circle} className="small">Case <span className="mono">{c.alias}</span>: {c.why}</p>
      ))}

      {cv && current?.live && (
        <div className="cols">
          <section>
            <p className="small" style={{ marginTop: 0 }}>
              Case <span className="mono">{cv.alias}</span>
              {current.until ? ` · your access ends ${day(current.until)}` : current.why ? ` · approved because: ${current.why}` : ""}
            </p>
            <h2>Notes</h2>
            <NoteList notes={cv.notes} circle={cv.circle} />

            <h2 style={{ marginTop: "2rem" }}>Session note</h2>
            <label className="field" htmlFor="draft">Locked the same way. Only people in this case can read it.</label>
            <textarea id="draft" rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="row" style={{ marginTop: ".8rem" }}>
              <button className="btn" onClick={seal} disabled={!draft.trim()}>Lock and save</button>
            </div>
            <p className="status" aria-live="polite">{status}</p>
            {reading.level !== "none" && (
              <div className={`notice ${reading.level === "urgent" ? "" : "wait"}`}>
                <strong>{reading.level === "urgent" ? "Possible risk to life" : "Worth watching"}</strong>
                Your note mentions {reading.cues.map((c) => `"${c}"`).join(", ")}. Consider escalating to a counsellor.
                This check runs only in your browser.
              </div>
            )}
          </section>

          <aside>
            {isBuddy && (
              <div className="panel">
                <p className="eyebrow">Escalate to counsellor</p>
                <p className="small" style={{ marginTop: 0 }}>Worried they may be at risk? Ask for a counsellor to join. Your request counts as one approval; one more person must agree. The student is told who and why.</p>
                <label className="field" htmlFor="c">Counsellor</label>
                <select id="c" value={counsellor} onChange={(e) => setCounsellor(e.target.value)}>
                  <option value="">Choose…</option>
                  {counsellors.map((p) => <option key={p.sub} value={p.sub}>{p.name}</option>)}
                </select>
                <label className="field" htmlFor="why" style={{ marginTop: ".7rem" }}>Reason (the student will see this)</label>
                <input id="why" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="I'm worried about their safety this week." />
                <div className="row" style={{ marginTop: ".8rem" }}>
                  <button className="btn danger" onClick={() => file("escalation")} disabled={!counsellor || !reason.trim()}>Escalate to counsellor</button>
                </div>
              </div>
            )}

            {isBuddy && (
              <div className="panel" style={{ marginTop: "1.2rem" }}>
                <p className="eyebrow">Leaving? Hand over the case</p>
                <label className="field" htmlFor="nb">New buddy</label>
                <select id="nb" value={newBuddy} onChange={(e) => setNewBuddy(e.target.value)}>
                  <option value="">Choose…</option>
                  {buddies.map((p) => <option key={p.sub} value={p.sub}>{p.name}</option>)}
                </select>
                <label className="field" htmlFor="hr" style={{ marginTop: ".7rem" }}>Reason</label>
                <input id="hr" type="text" value={handReason} onChange={(e) => setHandReason(e.target.value)} />
                <div className="row" style={{ marginTop: ".8rem" }}>
                  <button className="btn ghost" onClick={() => file("handover")} disabled={!newBuddy || !handReason.trim()}>Request handover</button>
                </div>
                <p className="figure-note">Once approved, you lose access and the student gets a new pseudonym.</p>
              </div>
            )}
            <p className="status" aria-live="polite">{reqStatus}</p>

            {cv.requests.filter((r) => r.status === "pending").length > 0 && (
              <div className="panel inset" style={{ marginTop: "1.2rem" }}>
                <p className="eyebrow">Waiting on this case</p>
                {cv.requests.filter((r) => r.status === "pending").map((r) => (
                  <p key={r.id} className="small" style={{ margin: "0 0 .4rem" }}>{r.summary}: {r.approvals.length} of {r.quorum}</p>
                ))}
                <Link href="/approvals" className="btn link">Open approvals</Link>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
