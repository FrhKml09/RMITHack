"use client";

import Link from "next/link";
import { Shell, SignIn } from "@/components/Shell";
import { useSession } from "@/lib/pcb/session";
import type { Persona } from "@/lib/pcb/personas";

const HOME: Record<Persona, { href: string; label: string }> = {
  student: { href: "/circle", label: "Open my circle" },
  buddy: { href: "/desk", label: "Open the buddy desk" },
  counsellor: { href: "/escalation", label: "Open the escalation desk" },
  committee: { href: "/ledger", label: "See what the server holds" },
};

export default function Home() {
  const s = useSession();
  return (
    <Shell>
      <div className="cols">
        <section>
          <p className="eyebrow">Peer Counselling Buddies</p>
          <h1 className="display">
            Break-glass <em>without</em> a master key.
          </h1>
          <p className="lede">
            A student can open up to a trained peer, knowing that no admin, IT person, AI or app can read their
            story alone, and that help can still reach them on a bad night.
          </p>

          <hr className="rule" />

          <ol className="margin-notes">
            <li>
              Peer-support notes usually end up in forms and spreadsheets that the committee and IT can open, with
              nothing to show who looked. Students notice. They hold back, use fake names, or never sign up.
            </li>
            <li>
              In 2018 attackers took the therapy notes of about 33,000 patients from Vastaamo in Finland. In 2020 they
              blackmailed the patients one by one. One server held everything, so one breach exposed everything.
            </li>
            <li>
              PCB keeps each student&apos;s notes sealed to the person who wrote them. Anyone else who wants in, even a
              counsellor in a crisis, needs two of three people to agree, and the Tide network enforces that, not our
              code.
            </li>
          </ol>
        </section>

        <aside>
          <div className="rule-card">
            <p className="eyebrow">The one rule</p>
            <blockquote>Nobody joins a student&apos;s circle alone.</blockquote>
          </div>
          <table className="access" aria-label="Who can read a student's notes">
            <thead>
              <tr>
                <th scope="col">Who</th>
                <th scope="col">Can read the notes</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>The student</td><td className="yes">Yes</td></tr>
              <tr><td>Their peer buddy</td><td className="cond">Their own session notes</td></tr>
              <tr><td>A counsellor, in a crisis</td><td className="cond">Only after 2 of 3 approve</td></tr>
              <tr><td>A committee member</td><td className="no">No</td></tr>
              <tr><td>IT, or whoever copies the database</td><td className="no">No</td></tr>
              <tr><td>Flare, the crisis assistant</td><td className="no">No. It can only ask.</td></tr>
              <tr><td>Us, the people who built PCB</td><td className="no">No</td></tr>
            </tbody>
          </table>
          <p className="figure-note">Buddies are trained, supervised peers, not counsellors. A registered counsellor is one of the three voters.</p>

          <div style={{ marginTop: "2rem" }}>
            {s.ready && s.authenticated && s.persona ? (
              <Link className="btn" href={HOME[s.persona].href}>{HOME[s.persona].label} →</Link>
            ) : s.ready ? (
              <SignIn />
            ) : null}
          </div>
        </aside>
      </div>
    </Shell>
  );
}
