import { day, when } from "./Shell";
import type { Persona } from "@/lib/pcb/personas";

export interface LogRow {
  seq: number;
  at: string;
  actorName: string;
  actorPersona: Persona | null;
  action: string;
  outcome: "allowed" | "refused" | "pending";
  enforcedBy: "tide" | "app";
  hash: string;
  alias?: string;
}

const OUTCOME: Record<LogRow["outcome"], string> = { allowed: "Done", refused: "Refused", pending: "Waiting" };

export function Receipts({ rows, showCase = false }: { rows: LogRow[]; showCase?: boolean }) {
  if (rows.length === 0) return <p className="small">No activity yet.</p>;
  return (
    <ul className="receipts">
      {rows.map((r) => (
        <li key={r.seq}>
          <time dateTime={r.at} title={day(r.at)}>{when(r.at)}</time>
          <span>
            {r.action}
            <span className="by">
              #{r.seq}
              {showCase && r.alias ? ` · case ${r.alias}` : ""} · proof <span className="mono">{r.hash.slice(0, 10)}</span> ·{" "}
              {r.enforcedBy === "tide" ? "Tide-signed identity" : "logged by SafeCounsel"}
            </span>
          </span>
          <span className={`stamp ${r.outcome}`}>{OUTCOME[r.outcome]}</span>
        </li>
      ))}
    </ul>
  );
}
