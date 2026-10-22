"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Receipts, type LogRow } from "@/components/Receipts";
import { useSession } from "@/lib/pcb/session";

export default function LogPage() {
  return (
    <Shell requires={["student", "buddy", "counsellor", "committee"]}>
      <AccessLog />
    </Shell>
  );
}

function AccessLog() {
  const s = useSession();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [integrity, setIntegrity] = useState<{ ok: boolean; count: number; brokenAt?: number } | null>(null);

  const load = useCallback(async () => {
    const r = await s.api("/api/log");
    if (!r.ok) return;
    const d = await r.json();
    setRows(d.entries);
    setIntegrity(d.integrity);
  }, [s]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <p className="eyebrow">Access log</p>
      <h1 className="page">Who touched what, and when.</h1>
      <p className="lede">
        Read-only for everyone, admins included. Each entry carries the hash of the one before it, so editing or deleting a
        single line breaks every line after it.
        {s.persona === "student" ? " You see everything that touched your case." : " Staff see who did what, never what was written."}
      </p>
      <hr className="rule" />
      <div className="row" style={{ marginBottom: "1rem" }}>
        {integrity && (
          <span className={`stamp ${integrity.ok ? "allowed" : "refused"}`}>
            {integrity.ok ? `Chain intact · ${integrity.count} entries verified` : `Chain broken at #${integrity.brokenAt}`}
          </span>
        )}
        <button className="btn ghost" onClick={load}>Verify again</button>
      </div>
      <Receipts rows={rows} showCase={s.persona !== "student"} />
      <p className="figure-note">
        Prototype limit: the chain makes tampering visible, it doesn&apos;t stop the server operator rewriting the whole file.
        Anchoring each hash with a Tide-network signature is on the roadmap.
      </p>
    </>
  );
}
