"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Shell, day } from "@/components/Shell";
import { useSession } from "@/lib/pcb/session";
import { PERSONA_LABEL, type Persona } from "@/lib/pcb/personas";

interface CaseRow {
  circle: string;
  alias: string;
  buddyRequested: boolean;
  buddy: { name: string; until: string; live: boolean } | null;
  counsellors: string[];
  notes: number;
}
interface Person { sub: string; name: string; persona: Persona; status: string }

export default function AdminPage() {
  return (
    <Shell requires={["committee"]}>
      <Console />
    </Shell>
  );
}

const inSemester = () => new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);

function Console() {
  const s = useSession();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [until, setUntil] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [grab, setGrab] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await s.api("/api/admin");
    const d = await r.json();
    if (!r.ok) return setStatus(d.error);
    setCases(d.cases);
    setPeople(d.people);
  }, [s]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(url: string, body: object) {
    const r = await s.api(url, { method: "POST", body: JSON.stringify(body) });
    const d = await r.json();
    return { ok: r.ok, d };
  }

  async function assign(c: CaseRow) {
    const { ok, d } = await post("/api/admin", { action: "assign", circle: c.circle, buddySub: pick[c.circle], until: until[c.circle] ?? inSemester() });
    setStatus(ok ? `Assigned. Case ${c.alias} now has a buddy. You still can't read it.` : d.error);
    load();
  }

  async function selfGrant(c: CaseRow) {
    const { ok, d } = await post("/api/requests", { action: "file", kind: "self-grant", circle: c.circle, reason: "Admin wants to review this case." });
    setGrab(ok ? { ok: false, text: `Pending: needs 2 counsellor approvals. You have ${d.request.approvals.length} of ${d.request.quorum}. You can't approve it yourself, and the student has been told.` } : { ok: false, text: d.error });
    load();
  }

  async function offboard(p: Person) {
    const { ok, d } = await post("/api/admin", { action: "offboard", sub: p.sub });
    setStatus(ok ? `${p.name} offboarded. Access ended on ${d.casesEnded} case(s), effective now.` : d.error);
    load();
  }

  const buddies = people.filter((p) => p.persona === "buddy" && p.status === "active");

  return (
    <>
      <p className="eyebrow">Admin console</p>
      <h1 className="page">You run the system. You can&apos;t read it.</h1>
      <p className="lede">
        Match buddies, manage contracts, offboard people. Every case shows up as a pseudonym, and every note as scrambled text.
      </p>
      <hr className="rule" />

      <div className="cols">
        <section>
          <h2>Cases</h2>
          {cases.length === 0 ? <p className="small">No cases yet. A case appears when a student signs in.</p> : (
            <ul className="entries">
              {cases.map((c) => (
                <li key={c.circle}>
                  <div className="entry-meta">
                    <span><span className="mono">{c.alias}</span> · {c.notes} locked note{c.notes === 1 ? "" : "s"}</span>
                    <span className={`stamp ${c.buddy?.live ? "allowed" : c.buddyRequested ? "pending" : "refused"}`}>
                      {c.buddy?.live ? "Has a buddy" : c.buddyRequested ? "Asked for a buddy" : "No buddy"}
                    </span>
                  </div>
                  <p className="small" style={{ margin: ".4rem 0" }}>
                    {c.buddy ? `Buddy: ${c.buddy.name}, contract ends ${day(c.buddy.until)}${c.buddy.live ? "" : " (ended)"}. ` : ""}
                    {c.counsellors.length ? `Counsellors: ${c.counsellors.join(", ")}.` : ""}
                  </p>
                  {c.buddyRequested && !c.buddy?.live && (
                    <div className="row" style={{ marginTop: ".5rem" }}>
                      <select aria-label="Buddy" value={pick[c.circle] ?? ""} onChange={(e) => setPick((x) => ({ ...x, [c.circle]: e.target.value }))}>
                        <option value="">Choose a buddy…</option>
                        {buddies.map((b) => <option key={b.sub} value={b.sub}>{b.name}</option>)}
                      </select>
                      <label className="small" htmlFor={`u-${c.circle}`}>Contract ends</label>
                      <input id={`u-${c.circle}`} type="date" value={until[c.circle] ?? inSemester()} onChange={(e) => setUntil((x) => ({ ...x, [c.circle]: e.target.value }))} />
                      <button className="btn" onClick={() => assign(c)} disabled={!pick[c.circle]}>Assign</button>
                    </div>
                  )}
                  <div className="row" style={{ marginTop: ".6rem" }}>
                    <button className="btn danger" onClick={() => selfGrant(c)}>Give myself access to this case</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="status" aria-live="polite">{status}</p>
          {grab && (
            <div className="notice wait" role="status">
              <strong>Not granted</strong>
              {grab.text} <Link href="/approvals">See it in the approvals queue</Link>
            </div>
          )}
        </section>

        <aside>
          <div className="panel">
            <p className="eyebrow">People</p>
            <table className="access">
              <tbody>
                {people.map((p) => (
                  <tr key={p.sub}>
                    <td><b>{p.name}</b><br /><span className="small">{PERSONA_LABEL[p.persona].title}</span></td>
                    <td>
                      {p.status === "offboarded" ? <span className="stamp refused">Offboarded</span> : p.persona === "committee" ? <span className="small">You</span> : (
                        <button className="btn link" onClick={() => offboard(p)}>Offboard</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="figure-note">
              Roles come from the signed sign-in token. In the Tide build, making someone a buddy or counsellor is a TideCloak
              change that needs 2 of 3 admin approvals, so an admin can&apos;t promote themselves either.
            </p>
          </div>
          <div className="panel inset" style={{ marginTop: "1.2rem" }}>
            <p className="eyebrow">Encrypted data view</p>
            <p className="small" style={{ marginTop: 0 }}>See every byte the server holds, and try to decrypt a student&apos;s note.</p>
            <Link className="btn ghost" href="/ledger">Open the raw database</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
