"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/pcb/session";
import { IDENTITIES, IDENTITY_KEYS, PERSONA_LABEL, shortSubject, type Persona } from "@/lib/pcb/personas";

const NAV: { href: string; label: string; for: Persona[] }[] = [
  { href: "/circle", label: "My space", for: ["student"] },
  { href: "/desk", label: "My students", for: ["buddy"] },
  { href: "/desk", label: "My cases", for: ["counsellor"] },
  { href: "/admin", label: "Admin console", for: ["committee"] },
  { href: "/approvals", label: "Approvals", for: ["buddy", "counsellor", "committee"] },
  { href: "/log", label: "Access log", for: ["student", "buddy", "counsellor", "committee"] },
  { href: "/ledger", label: "Raw database", for: ["counsellor", "committee"] },
];

export function Shell({ children, requires }: { children: React.ReactNode; requires?: Persona[] }) {
  const s = useSession();
  const path = usePathname();
  const items = NAV.filter((n) => s.persona && n.for.includes(s.persona));

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      {s.mode === "rehearsal" && (
        <div className="rehearsal-strip" role="note">
          Rehearsal: not connected to the Tide network. Our server hands out case keys and counts votes here; the Tide build moves both to TideCloak.
        </div>
      )}
      <header className="masthead">
        <Link href="/" className="wordmark" aria-label="SafeCounsel home">
          <b>SafeCounsel</b>
          <span>for Peer Counselling Buddies</span>
        </Link>
        <nav className="nav" aria-label="Sections">
          {items.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="who">
          {s.authenticated ? (
            <>
              <strong>{s.name && s.persona !== "student" ? s.name : s.persona ? PERSONA_LABEL[s.persona].title : "Signed in"}</strong>
              {" · "}
              {s.persona === "student" ? <>others see you as <span className="mono">{s.alias ?? shortSubject(s.sub)}</span></> : s.persona ? PERSONA_LABEL[s.persona].title : ""}
              <button className="btn link" onClick={s.logout}>
                {s.mode === "rehearsal" ? "Switch" : "Sign out"}
              </button>
              <br />
              {s.mode === "tide" ? "Tide network" : "Rehearsal"}
            </>
          ) : (
            <>Not signed in</>
          )}
        </div>
      </header>
      <main id="main">
        <Gate requires={requires}>{children}</Gate>
      </main>
      <footer className="colophon">
        <span>A student-run prototype for Tide UNLOCKED 2026. Not affiliated with or endorsed by any university.</span>
        <span>Sign-in, signed roles and note encryption: TideCloak on the Tide network.</span>
      </footer>
    </>
  );
}

function Gate({ children, requires }: { children: React.ReactNode; requires?: Persona[] }) {
  const s = useSession();
  if (!s.ready || s.mode === "loading") return <p className="status" aria-live="polite">Opening…</p>;
  if (s.error) return <div className="notice"><strong>Something went wrong</strong>{s.error}</div>;
  if (!requires) return <>{children}</>;
  if (!s.authenticated) return <SignIn />;
  if (s.persona && !requires.includes(s.persona)) {
    return (
      <div className="notice">
        <strong>Not your page</strong>
        This page is for {requires.map((r) => PERSONA_LABEL[r].title.toLowerCase()).join(" or ")} accounts.
      </div>
    );
  }
  if (!s.persona) return <p className="status" aria-live="polite">Reading your roles from the signed token…</p>;
  return <>{children}</>;
}

export function SignIn() {
  const s = useSession();
  if (s.mode === "tide") {
    return (
      <section aria-labelledby="signin">
        <p className="eyebrow">Sign in</p>
        <h2 id="signin">Your Tide key stays with you.</h2>
        <p className="small">
          Tide checks your password across a network of independent nodes. SafeCounsel never sees it, never stores a hash of it,
          and only learns a random ID for you.
        </p>
        <button className="btn" onClick={s.login}>Sign in with Tide</button>
      </section>
    );
  }
  return (
    <section aria-labelledby="signin">
      <p className="eyebrow">Rehearsal sign-in</p>
      <h2 id="signin">Who are you playing?</h2>
      <p className="small">Six people, one student&apos;s case. In the live build each is a separate Tide identity.</p>
      <div className="cards">
        {IDENTITY_KEYS.map((k) => (
          <button key={k} className="card-btn" onClick={() => s.chooseIdentity(k)}>
            <b>{IDENTITIES[k].name} · {PERSONA_LABEL[IDENTITIES[k].persona].title}</b>
            <span>{IDENTITIES[k].line}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function day(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}
