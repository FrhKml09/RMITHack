"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell, when } from "@/components/Shell";
import { useSession } from "@/lib/pcb/session";
import { BREAKGLASS_ROLE, PERSONA_LABEL, QUORUM, type Persona } from "@/lib/pcb/personas";

interface Req { id: string; role: string; target: Persona; filedBy: Persona; approvals: Persona[]; status: string; createdAt: string }

export default function ApprovalsPage() {
  return (
    <Shell requires={["buddy", "counsellor", "committee"]}>
      <Approvals />
    </Shell>
  );
}

function Tally({ n }: { n: number }) {
  return (
    <span>
      <span className="tally" aria-hidden="true">
        {Array.from({ length: QUORUM }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}
      </span>
      <span className="tally-label">{Math.min(n, QUORUM)} of {QUORUM}</span>
    </span>
  );
}

function Approvals() {
  const s = useSession();
  return (
    <>
      <p className="eyebrow">The two-person rule</p>
      <h1 className="page">Any new way into a circle needs two of three.</h1>
      <p className="lede">
        The buddy, the counsellor and the committee member each hold one vote. Two must agree before anyone gets{" "}
        <span className="mono">{BREAKGLASS_ROLE}</span>, including the person asking.
      </p>
      <hr className="rule" />
      {s.mode === "tide" ? <TideConsole /> : <Rehearsal />}
    </>
  );
}

function TideConsole() {
  const s = useSession();
  const [status, setStatus] = useState("");
  return (
    <div className="cols">
      <section>
        <h2>Votes are cast in TideCloak, not in PCB</h2>
        <p>
          PCB has no approve button on purpose. Each admin signs their vote in their own Tide enclave, and the Tide
          network seals it. Our server can&apos;t cast a vote, can&apos;t count one twice, and can&apos;t skip the count.
        </p>
        <ol className="margin-notes" style={{ marginTop: "1.4rem" }}>
          <li>Open the Tide console, go to Users, pick the person, and add the realm role <span className="mono">{BREAKGLASS_ROLE}</span>. TideCloak files a change request instead of applying it.</li>
          <li>Under QEA Approvals, the asker can approve their own request. That makes it 1 of 2. It stays there.</li>
          <li>A second admin approves in their own browser. At 2 of 2 TideCloak commits the change.</li>
          <li>The new holder refreshes their token here. Only now does the signed token carry the role.</li>
        </ol>
        <div className="row" style={{ marginTop: "1.2rem" }}>
          {s.consoleUrl && (
            <a className="btn" href={s.consoleUrl} target="_blank" rel="noreferrer">Open the Tide console</a>
          )}
          <button
            className="btn ghost"
            onClick={async () => {
              setStatus("Refreshing…");
              await s.refresh();
              setStatus("Token refreshed.");
            }}
          >
            Refresh my token
          </button>
        </div>
        <p className="status" aria-live="polite">{status}</p>
      </section>
      <aside className="panel">
        <p className="eyebrow">Your signed token right now</p>
        <p className="mono" style={{ margin: 0 }}>{s.roles.join(", ") || "no PCB roles"}</p>
        <p className="figure-note">Roles can take up to two minutes to appear after the second approval.</p>
      </aside>
    </div>
  );
}

function Rehearsal() {
  const s = useSession();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const r = await s.api("/api/rehearsal/requests");
    if (r.ok) setReqs((await r.json()).requests);
  }, [s]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(body: object) {
    const r = await s.api("/api/rehearsal/requests", { method: "POST", body: JSON.stringify(body) });
    const d = await r.json();
    setStatus(r.ok ? "" : d.error);
    await load();
    await s.refresh();
  }

  return (
    <div className="cols">
      <section>
        <div className="notice wait">
          <strong>Rehearsal stand-in</strong>
          In the live build these votes are TideCloak change requests signed in each admin&apos;s Tide enclave. Here our
          server counts them, which is exactly the kind of trust PCB exists to remove.
        </div>
        <h2 style={{ marginTop: "1.6rem" }}>Requests</h2>
        {reqs.length === 0 ? (
          <p className="small">No requests yet.</p>
        ) : (
          <ul className="entries">
            {reqs.map((r) => (
              <li key={r.id}>
                <div className="entry-meta">
                  <span>
                    <span className="mono">{r.role}</span> for the {PERSONA_LABEL[r.target].title.toLowerCase()} · filed by the{" "}
                    {PERSONA_LABEL[r.filedBy].title.toLowerCase()} · {when(r.createdAt)}
                  </span>
                  <span className={`stamp ${r.status === "approved" ? "allowed" : r.status === "denied" ? "refused" : "pending"}`}>{r.status}</span>
                </div>
                <div className="row" style={{ marginTop: ".7rem", justifyContent: "space-between" }}>
                  <Tally n={r.approvals.length} />
                  {r.status === "pending" && (
                    <span className="row">
                      <button className="btn" onClick={() => act({ action: "approve", requestId: r.id })} disabled={!!s.persona && r.approvals.includes(s.persona)}>
                        {s.persona && r.approvals.includes(s.persona) ? "You voted" : "Approve"}
                      </button>
                      <button className="btn ghost" onClick={() => act({ action: "deny", requestId: r.id })}>Deny</button>
                    </span>
                  )}
                </div>
                <p className="figure-note">Voted: {r.approvals.map((p) => PERSONA_LABEL[p].title).join(", ") || "nobody yet"}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="status" aria-live="polite">{status}</p>
      </section>
      <aside className="panel">
        <p className="eyebrow">File a request</p>
        <p className="small">Ask for <span className="mono">{BREAKGLASS_ROLE}</span> for:</p>
        <div className="row">
          {(["counsellor", "committee", "buddy"] as Persona[]).map((p) => (
            <button key={p} className="btn ghost" onClick={() => act({ action: "file", target: p })}>
              {p === s.persona ? "Myself" : `The ${PERSONA_LABEL[p].title.toLowerCase()}`}
            </button>
          ))}
        </div>
        <p className="figure-note">Your token now: {s.roles.join(", ") || "no PCB roles"}</p>
      </aside>
    </div>
  );
}
