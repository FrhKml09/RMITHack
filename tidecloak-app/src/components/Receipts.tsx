import { when } from "./Shell";
import { PERSONA_LABEL, shortSubject, type Persona } from "@/lib/pcb/personas";

export interface ReceiptRow {
  id: string;
  at: string;
  actorSub: string;
  actorPersona: Persona | null;
  action: string;
  outcome: "allowed" | "refused" | "pending";
  enforcedBy: "tide" | "app";
}

const OUTCOME: Record<ReceiptRow["outcome"], string> = { allowed: "Allowed", refused: "Refused", pending: "Waiting" };

export function Receipts({ rows }: { rows: ReceiptRow[] }) {
  if (rows.length === 0) return <p className="small">No activity yet.</p>;
  return (
    <ul className="receipts">
      {rows.map((r) => (
        <li key={r.id}>
          <time dateTime={r.at}>{when(r.at)}</time>
          <span>
            {r.action}
            <span className="by">
              {r.actorPersona ? PERSONA_LABEL[r.actorPersona].title : "Unknown"} {shortSubject(r.actorSub)} ·{" "}
              {r.enforcedBy === "tide" ? "enforced by the Tide network" : "logged by PCB"}
            </span>
          </span>
          <span className={`stamp ${r.outcome}`}>{OUTCOME[r.outcome]}</span>
        </li>
      ))}
    </ul>
  );
}
