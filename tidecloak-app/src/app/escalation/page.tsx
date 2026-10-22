"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Shell, when } from "@/components/Shell";
import { Receipts, type ReceiptRow } from "@/components/Receipts";
import { useSession } from "@/lib/pcb/session";
import { BREAKGLASS_ROLE, shortSubject } from "@/lib/pcb/personas";

interface Flare { id: string; circle: string; level: "watch" | "urgent"; createdAt: string; onBehalfOf: string }
interface Refusal { error: string; tokenRoles?: string[]; required?: string }

export default function EscalationPage() {
  return (
    <Shell requires={["buddy", "counsellor", "committee"]}>
      <Escalation />
    </Shell>
  );
}

function Escalation() {
  const s = useSession();
  const [refused, setRefused] = useState<Refusal | null>(null);
  const [flares, setFlares] = useState<Flare[]>([]);
  const [refusals, setRefusals] = useState<ReceiptRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [checking, setChecking] = useState(true);

  const load = useCallback(async () => {
    setChecking(true);
    const r = await s.api("/api/escalation");
    const d = await r.json();
    if (r.status === 403) {
      setRefused(d);
    } else if (r.ok) {
      setRefused(null);
      setFlares(d.flares);
      setRefusals(d.refusals);
    } else {
      setStatus(d.error ?? "Could not reach the desk.");
    }
    setChecking(false);
  }, [s]);

  useEffect(() => {
    load();
  }, [load]);

  async function refreshAndRetry() {
    setStatus("Asking TideCloak for a fresh token…");
    await s.refresh();
    setStatus("");
    await load();
  }

  async function reachOut(f: Flare) {
    const body = (drafts[f.id] ?? "").trim();
    if (!body) return;
    const r = await s.api("/api/escalation", { method: "POST", body: JSON.stringify({ flareId: f.id, body }) });
    const d = await r.json();
    if (!r.ok) return setStatus(d.error);
    setStatus(`Sent to circle ${shortSubject(f.circle)}. The student will see it, and a receipt.`);
    load();
  }

  if (checking && !refused && flares.length === 0) return <p className="status" aria-live="polite">Checking your token…</p>;

  if (refused) {
    return (
      <>
        <p className="eyebrow">Escalation desk</p>
        <h1 className="page">Refused.</h1>
        <p className="lede">The server checked a token signed by the Tide network. The grant isn&apos;t in it.</p>
        <hr className="rule" />
        <div className="cols">
          <section>
            <table className="access" aria-label="What the server checked">
              <tbody>
                <tr><td>Needed</td><td className="mono">{refused.required ?? BREAKGLASS_ROLE}</td></tr>
                <tr><td>Your token carries</td><td className="mono">{(refused.tokenRoles ?? []).join(", ") || "no PCB roles"}</td></tr>
                <tr><td>Who signed the token</td><td>{s.mode === "tide" ? "Tide network (threshold signature)" : "Rehearsal server"}</td></tr>
              </tbody>
            </table>
            <p style={{ marginTop: "1.4rem" }}>
              Being an admin isn&apos;t enough. Writing the role into the database isn&apos;t either: the Tide network won&apos;t sign a
              token with a role that two of the three admins haven&apos;t approved.
            </p>
            <div className="row" style={{ marginTop: "1.2rem" }}>
              <Link className="btn" href="/approvals">Go to the two-person rule</Link>
              <button className="btn ghost" onClick={refreshAndRetry}>I&apos;ve been approved, check again</button>
            </div>
            <p className="status" aria-live="polite">{status}</p>
          </section>
          <aside className="panel inset">
            <p className="eyebrow">Recorded</p>
            <p className="small" style={{ margin: 0 }}>
              This attempt is now on every student&apos;s receipts as a refused attempt, with your anonymous ID.
            </p>
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="eyebrow">Escalation desk</p>
      <h1 className="page">Two people let you in. Use it gently.</h1>
      <p className="lede">
        You can see which circles raised a flag, and you can reach out to them. You can&apos;t read their notes, and you
        don&apos;t know their names.
      </p>
      <hr className="rule" />
      <div className="cols">
        <section aria-labelledby="flags">
          <h2 id="flags">Open flags</h2>
          {flares.length === 0 ? (
            <p className="small">No open flags.</p>
          ) : (
            <ul className="entries">
              {flares.map((f) => (
                <li key={f.id}>
                  <div className="entry-meta">
                    <span>
                      Circle <span className="mono">{shortSubject(f.circle)}</span> · raised by Flare for buddy{" "}
                      <span className="mono">{shortSubject(f.onBehalfOf)}</span> · {when(f.createdAt)}
                    </span>
                    <span className={`stamp ${f.level === "urgent" ? "refused" : "pending"}`}>{f.level}</span>
                  </div>
                  <label className="field" htmlFor={`m-${f.id}`} style={{ marginTop: ".8rem" }}>
                    A short message to this circle
                  </label>
                  <textarea
                    id={`m-${f.id}`}
                    rows={3}
                    value={drafts[f.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                    placeholder="I'm one of the counsellors who supervises PCB. I'm free today at 4pm, or call the line any time."
                  />
                  <div className="row" style={{ marginTop: ".6rem" }}>
                    <button className="btn" onClick={() => reachOut(f)} disabled={!(drafts[f.id] ?? "").trim()}>Reach out</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="status" aria-live="polite">{status}</p>
        </section>
        <aside>
          <h2>Refused attempts</h2>
          <Receipts rows={refusals} />
        </aside>
      </div>
    </>
  );
}
