"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell, when } from "@/components/Shell";
import { useSession } from "@/lib/pcb/session";

interface Req {
  id: string;
  kind: "escalation" | "handover" | "self-grant";
  alias: string;
  summary: string;
  reason: string;
  filedByName: string;
  beneficiaryName: string;
  approvals: { name: string; at: string; proof: string }[];
  status: "pending" | "approved" | "denied";
  decidedBy?: string;
  canVote: boolean;
  quorum: number;
  createdAt: string;
}

const KIND = { escalation: "Escalation", handover: "Handover", "self-grant": "Admin access request" };

export default function ApprovalsPage() {
  return (
    <Shell requires={["buddy", "counsellor", "committee"]}>
      <Approvals />
    </Shell>
  );
}

function Tally({ n, of }: { n: number; of: number }) {
  return (
    <span>
      <span className="tally" aria-hidden="true">
        {Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}
      </span>
      <span className="tally-label">{Math.min(n, of)} of {of}</span>
    </span>
  );
}

function Approvals() {
  const s = useSession();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const r = await s.api("/api/requests");
    if (r.ok) setReqs((await r.json()).requests);
  }, [s]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: "approve" | "deny", id: string) {
    const r = await s.api("/api/requests", { method: "POST", body: JSON.stringify({ action, id }) });
    const d = await r.json();
    setStatus(r.ok ? (d.request.status === "approved" ? `Approved. ${d.request.summary} is now in effect, and the student has been told why.` : d.request.status === "denied" ? "Denied. The student can see this." : "Your approval is recorded.") : d.error);
    load();
  }

  const pending = reqs.filter((r) => r.status === "pending");
  const done = reqs.filter((r) => r.status !== "pending");

  return (
    <>
      <p className="eyebrow">Approvals queue</p>
      <h1 className="page">Nobody gets into a case alone.</h1>
      <p className="lede">
        Every new reader needs two approvals from the care team: the student&apos;s buddy or a counsellor. Nobody can approve
        their own access, and admins never vote.
      </p>
      <hr className="rule" />

      <div className="cols">
        <section>
          <h2>Waiting</h2>
          {pending.length === 0 ? <p className="small">Nothing waiting.</p> : <List reqs={pending} act={act} me={s.persona} />}
          <p className="status" aria-live="polite">{status}</p>
          <h2 style={{ marginTop: "2rem" }}>Decided</h2>
          {done.length === 0 ? <p className="small">Nothing yet.</p> : <List reqs={done} act={act} me={s.persona} />}
        </section>
        <aside className="panel">
          <p className="eyebrow">The rule</p>
          <table className="access">
            <tbody>
              <tr><td>Escalation to a counsellor</td><td className="cond">Buddy + another counsellor</td></tr>
              <tr><td>Handover to a new buddy</td><td className="cond">2 of buddy / counsellors</td></tr>
              <tr><td>An admin asking for access</td><td className="cond">2 counsellors</td></tr>
              <tr><td>Approving your own access</td><td className="no">Never</td></tr>
            </tbody>
          </table>
          <p className="figure-note">
            Every vote is written to the hash-chained access log. The proof code next to each vote is that log entry&apos;s hash,
            so a vote can&apos;t later be denied or faked without breaking the chain.
          </p>
          {s.mode === "tide" && s.consoleUrl && (
            <p className="figure-note">
              Role changes (making someone a counsellor or buddy) happen in TideCloak and need 2 of 3 admin approvals signed by the
              Tide network. <a href={s.consoleUrl} target="_blank" rel="noreferrer">Open the Tide console</a>
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

function List({ reqs, act }: { reqs: Req[]; act: (a: "approve" | "deny", id: string) => void; me: string | null }) {
  return (
    <ul className="entries">
      {reqs.map((r) => (
        <li key={r.id}>
          <div className="entry-meta">
            <span>
              <b>{KIND[r.kind]}</b> · case <span className="mono">{r.alias}</span> · filed by {r.filedByName} · {when(r.createdAt)}
            </span>
            <span className={`stamp ${r.status === "approved" ? "allowed" : r.status === "denied" ? "refused" : "pending"}`}>
              {r.status === "pending" ? `Pending: needs ${r.quorum - r.approvals.length} more` : r.status}
            </span>
          </div>
          <p style={{ margin: ".5rem 0" }}>
            Request to {r.summary}. <span className="small">Reason: {r.reason}</span>
          </p>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <Tally n={r.approvals.length} of={r.quorum} />
            {r.status === "pending" && r.canVote && (
              <span className="row">
                <button className="btn" onClick={() => act("approve", r.id)}>Approve</button>
                <button className="btn ghost" onClick={() => act("deny", r.id)}>Deny</button>
              </span>
            )}
            {r.status === "pending" && !r.canVote && <span className="small">You can&apos;t vote on this one.</span>}
          </div>
          <p className="figure-note">
            {r.approvals.length === 0
              ? "No approvals yet."
              : r.approvals.map((v) => `${v.name} at ${when(v.at)} (proof ${v.proof.slice(0, 10)})`).join(" · ")}
            {r.decidedBy ? ` · denied by ${r.decidedBy}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
