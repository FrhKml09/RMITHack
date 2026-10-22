"use client";

import Link from "next/link";
import { Shell, SignIn } from "@/components/Shell";
import { useSession } from "@/lib/pcb/session";
import type { Persona } from "@/lib/pcb/personas";

const HOME: Record<Persona, { href: string; label: string }> = {
  student: { href: "/circle", label: "Open my space" },
  buddy: { href: "/desk", label: "Open my students" },
  counsellor: { href: "/approvals", label: "Open the approvals queue" },
  committee: { href: "/admin", label: "Open the admin console" },
};

export default function Home() {
  const s = useSession();
  return (
    <Shell>
      <div className="cols">
        <section>
          <p className="eyebrow">SafeCounsel · for Peer Counselling Buddies</p>
          <h1 className="display">
            Counselling notes <em>nobody</em> can open alone.
          </h1>
          <p className="lede">
            A student can open up to a trained peer, knowing no admin, IT person or nosy counsellor can read their story
            on their own, and that help can still reach them on a bad night.
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
              SafeCounsel locks every note on the writer&apos;s device with TideCloak before it is saved. Only the student and
              their buddy can read it. Anyone else who wants in, even a counsellor in a crisis, needs two people to agree, and
              the student is told who and why.
            </li>
          </ol>
        </section>

        <aside>
          <div className="rule-card">
            <p className="eyebrow">The one rule</p>
            <blockquote>Nobody gets into a student&apos;s case alone.</blockquote>
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
              <tr><td>Their assigned peer buddy</td><td className="cond">Yes, until their contract ends</td></tr>
              <tr><td>A counsellor, when a buddy escalates</td><td className="cond">Only after 2 approve</td></tr>
              <tr><td>Other counsellors and buddies</td><td className="no">No</td></tr>
              <tr><td>An admin or committee member</td><td className="no">No. Asking needs 2 counsellors.</td></tr>
              <tr><td>IT, or whoever copies the database</td><td className="no">Scrambled text only</td></tr>
              <tr><td>Us, the people who built SafeCounsel</td><td className="no">No</td></tr>
            </tbody>
          </table>
          <p className="figure-note">Buddies are trained, supervised peers, not counsellors. Registered counsellors supervise them and approve escalations.</p>

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
