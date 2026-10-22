# SafeCounsel: TideCloak build

A privacy-first case system for Peer Counselling Buddies (PCB). The rule: **nobody gets into a student's case alone.** Next.js 16 + `@tidecloak/nextjs`.

Cast: Aisha (student), Ben and Chloe (peer buddies), Dr Lim and Ms Tan (counsellors), Admin (IT / committee).

## Screens

| Screen | Who | Route |
|---|---|---|
| Login (TideCloak) | everyone | `/` |
| Student dashboard: request a buddy, locked notes, "Who can see my notes", notifications | Aisha | `/circle` |
| Buddy dashboard: assigned students, session notes, **Escalate to counsellor**, handover | Ben, Chloe | `/desk` |
| Counsellor cases: only cases two people approved them for | Dr Lim, Ms Tan | `/desk` |
| Admin console: match buddies, contract end dates, offboarding, encrypted data view, "give myself access" | Admin | `/admin`, `/ledger` |
| Approvals queue | buddies, counsellors, admin (view only) | `/approvals` |
| Read-only, hash-chained access log | everyone (students see their own case) | `/log` |

## Features and who enforces them

| Feature | How | Enforced by |
|---|---|---|
| Sign-in with no password hash stored anywhere | PRISM across Tide's ORK network | Tide |
| Roles (`pcb-student`, `pcb-buddy`, `pcb-counsellor`, `pcb-committee`) | In a Tide-signed, DPoP-bound token; an admin can't promote themselves without 2 of 3 admin approvals in TideCloak | Tide |
| Notes encrypted in the writer's browser; server and admins hold ciphertext only | `doEncrypt` / `doDecrypt` | Tide |
| Dynamic pseudonym: staff see `Kestrel-6116`, never a name; it rotates on every handover | Random alias per case | Our code |
| Only the assigned buddy and approved counsellors get a case; others are refused and logged | Server returns ciphertext to case members only | Our code (identity from Tide token) |
| Admin can match a buddy only after the student asks, once | Admin API | Our code |
| Buddy access ends on the contract end date, or immediately when offboarded | Checked on every request | Our code |
| Escalation: Ben + one other counsellor; handover: 2 of buddy/counsellors; admin access: 2 counsellors; nobody approves their own access | Approvals API | Our code (each vote made with a Tide-signed token) |
| Every access, vote and refusal is in an append-only, SHA-256 hash-chained log; each vote's proof is its log hash | `/api/log` has no write route | Our code |
| Student is told who joined their case and why | Notifications from the log | Our code |

## Run it

Rehearsal (no Tide network, for practising the demo; a banner says so on every screen):

```bash
npm install
npm run dev            # http://localhost:3000, pick a person
```

Reset the demo data: `rm data/pcb/store.json`.

Real Tide mode (needs Docker and a Tide licence email you control):

```bash
cp .env.example .env   # set KC_BOOTSTRAP_ADMIN_PASSWORD
TIDE_LICENSE_EMAIL=you@example.com TIDE_TERMS_ACCEPTED=yes npm run init
npm run dev
```

`npm run init` creates the realm, enables quorum governance, writes `data/tidecloak.json` and prints one invite link per person. Once `data/tidecloak.json` exists, the app switches to Tide mode and rehearsal is disabled.

## Demo script

1. **Aisha** requests a buddy with a short note. "Who can see my notes": only you.
2. **Admin** matches Ben (contract end date). Aisha's panel now says "Only you and your buddy".
3. **Ben** unlocks Aisha's note and writes a session note.
4. **Admin snooping fails.** Admin opens the raw database: scrambled text. "Try to decrypt it": refused and logged. "Give myself access": **Pending: needs 2 counsellor approvals.** Admin can't approve it.
5. **Escalation.** Ben clicks *Escalate to counsellor* (Dr Lim): 1 of 2. Dr Lim can't approve her own access. Ms Tan approves: 2 of 2. Dr Lim can now read the case. Aisha is notified, with the reason.
6. **Offboarding.** Ben is graduating and requests a handover to Chloe; Dr Lim approves. Ben loses access, Aisha gets a new pseudonym.
7. **Access log:** every step, with proof hashes; "Chain intact".

## Limits we state openly

- In rehearsal, our server hands case keys to members and counts votes. That is exactly the trust the Tide build removes.
- In the Tide build, notes use Tide self-encryption: only the writer can decrypt. Sharing one case key between student, buddy and approved counsellors needs a Tide policy (Forseti) and is the next step. Case membership and approvals are enforced by our server today, with every vote tied to a Tide-signed identity.
- The hash chain makes tampering visible; it doesn't stop the operator rewriting the whole file. Roadmap: anchor log hashes with a Tide-network signature.
- Our server can still delete or withhold ciphertext, or serve modified front-end code. Roadmap: signed front-end builds.
- Not built yet from the PCB wishlist: appointment booking, anti-screenshot / biometric unlock.
- Storage is a JSON file in `data/pcb/` (gitignored). Swap for a database in production.
