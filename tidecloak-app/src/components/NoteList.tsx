"use client";

import { useState } from "react";
import { useSession } from "@/lib/pcb/session";
import { PERSONA_LABEL, type Persona } from "@/lib/pcb/personas";

export interface CaseNote {
  id: string;
  kind: "request" | "journal" | "session";
  authorSub: string;
  authorPersona: Persona;
  ciphertext: string;
  createdAt: string;
}

const KIND: Record<CaseNote["kind"], string> = { request: "Buddy request", journal: "Student note", session: "Session note" };

/** Notes stay scrambled until the reader opens them; decryption happens in this browser only. */
export function NoteList({ notes, circle }: { notes: CaseNote[]; circle: string }) {
  const s = useSession();
  const [open, setOpen] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});

  async function reveal(n: CaseNote) {
    try {
      const pt = await s.decrypt(n.ciphertext, circle);
      setOpen((o) => ({ ...o, [n.id]: pt }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr((x) => ({
        ...x,
        [n.id]: s.mode === "tide" && n.authorSub !== s.sub ? `Sealed to its writer. Shared case keys are the next Tide step (see README). ${msg}` : msg,
      }));
    }
  }

  if (notes.length === 0) return <p className="small">Nothing yet.</p>;
  return (
    <ul className="entries">
      {[...notes].reverse().map((n) => (
        <li key={n.id}>
          <div className="entry-meta">
            <span>
              {KIND[n.kind]} · {n.authorSub === s.sub ? "you" : PERSONA_LABEL[n.authorPersona].title.toLowerCase()} ·{" "}
              {new Date(n.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </span>
            {open[n.id] ? (
              <button className="btn link" onClick={() => setOpen(({ [n.id]: _, ...rest }) => rest)}>Lock</button>
            ) : (
              <button className="btn link" onClick={() => reveal(n)}>Unlock</button>
            )}
          </div>
          {open[n.id] ? <p className="plain">{open[n.id]}</p> : <p className="cipher" aria-label="Scrambled text">{n.ciphertext}</p>}
          {err[n.id] && !open[n.id] && <p className="status">{err[n.id]}</p>}
        </li>
      ))}
    </ul>
  );
}
