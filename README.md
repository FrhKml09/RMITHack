# Safe Circle (PCB Safe Space)

**Live UI demo:** https://frhkml09.github.io/RMITHack/ (synthetic data, mock backend)

A peer-support app for Taylor's University Peer Counselling Buddies, where students talk to trained student buddies under an alias, and no single admin, counsellor, developer or server can read their notes, unmask them, or grant themselves access.

**Vision.** Any student can reach out about depression, family or personal problems without first having to trust one person, or one system, with their story and their name.

**Trust constraint.** Today, whoever runs the system (an admin, IT, the app's builder) can read every note and see who is behind every alias. That fear stops students from asking for help.

**Value.** Students get a buddy who knows them only by an alias. Buddies can still get counsellor support on serious cases, and the student is told who gained access and why.

**Why TideCloak.** Notes are encrypted in the writer's browser through the Tide network, so the server, IT and admins only ever hold ciphertext, and no password hash exists anywhere. Every access change is a TideCloak change request that needs 2 of 3 programme admins, each signing in their own Tide enclave. One admin alone stays stuck at 1 of 2, and the Tide network won't sign a token carrying a role the quorum hasn't approved, so not even our own server can hand out access.

**Prototype.** `frontend/`: the full product UX (student, buddy, counsellor and admin dashboards, aliases, approval queue, escalation, offboarding, "who can see my notes" panel). `tidecloak-app/`: a working TideCloak build of the core rule, with real Tide login, encrypted notes, and a quorum-gated crisis escalation.

---

## Two parts

| Folder | What it is | Enforcement |
|---|---|---|
| `tidecloak-app/` | Next.js + `@tidecloak/nextjs`. Tide login, browser-side encryption, DPoP-bound tokens, quorum-gated escalation desk. See [`tidecloak-app/README.md`](tidecloak-app/README.md). | **Real**, via TideCloak and the Tide network |
| `frontend/` | The full UX on a mock API, for the screens not yet wired to Tide. | Mock (yellow banner on every screen) |

**Answer to the open question below:** the TideCloak build doesn't need a custom "buddy + 1 counsellor" rule. The three programme admins (buddy lead, registered counsellor, committee member) are TideCloak realm admins, and Tide's own quorum is `floor(0.7 × 3)` = 2. So any 2 of the 3 must approve, which covers the duty-of-care escalation with no Forseti policy.

## How to run

### Part 1: `frontend/` (full UI, mock data)

**Quickest:** open the live demo, https://frhkml09.github.io/RMITHack/. Nothing to install.

**Or locally.** Requirements: Node 18+. No `npm install` needed.

```bash
node frontend/serve.mjs
```

Open http://localhost:5173.

**Test logins:** click **Try the demo**, then pick a synthetic user. All data is synthetic, with no passwords.

**Real TideCloak sign-in (optional):** put the client adapter JSON exported from your realm at `frontend/tidecloak.json`. The **Sign in with TideCloak** button then logs in against TideCloak from this page and comes back here; **Try the demo** keeps working next to it. Without the file the button is disabled. After sign-in the data is still the mock: each user sees the seeded profile for their realm role (`pcb-student` → Student Blue-17, `pcb-buddy` → Ben, `pcb-counsellor` → Dr Lim, `pcb-admin` or `pcb-committee` → IT Admin).

Use a separate public client for this frontend (standard flow, PKCE S256, **no** "DPoP bound tokens": there's no resource server to check DPoP proofs, and GitHub Pages can't serve `tide_dpop_auth.html` with the headers it needs). Register:
- Valid redirect URIs: `http://localhost:5173/*`, `https://frhkml09.github.io/RMITHack/frontend/*`
- Web origins: `http://localhost:5173`, `https://frhkml09.github.io`

Visitors can only sign in if their browser can reach the TideCloak server in `tidecloak.json`. A server on `localhost:8080` works only on the machine running it; for everyone else, put TideCloak on a public HTTPS address.

| User | Role | Notes |
|---|---|---|
| Student Blue-17 | student | Aisha's alias. Her real name is hidden from everyone else by default |
| Ben Ong | buddy | Assigned to Student Blue-17 and Student Green-04 |
| Chloe Lee | buddy | Not assigned to anyone |
| Dr Lim, Ms Tan | counsellor | Approve requests |
| IT Admin | admin | Can only submit requests |

Once signed in, switch person with the **Viewing as** dropdown in the yellow bar. **Reset demo** in the same bar restores the starting data.

**What to click (acceptance tests):**

1. **Student Blue-17** → *Reflect*: write a note → *Send privately to your Buddy*.
2. **Ben Ong** → *Students*: reads the note; sees only "Student Blue-17", never the name.
3. **Chloe Lee**: "No students assigned to you".
4. **IT Admin** → *Overview*: students shown by alias only; *Stored notes* shows ciphertext. *Assign buddy / Request role* → grant `counsellor` to IT Admin → **0 of 2**, pending.
5. **Dr Lim**, then **Ms Tan** → *Approvals* → **Approve** each → 2 of 2, approved.
6. **Ben** → *Escalate to counsellor* (enter a reason) → 1 of 2. **Dr Lim** → *Approvals* → Approve → *Cases* shows the real name. **Student Blue-17** → *Transparency* / *Alerts* shows who got access and why.
7. **IT Admin** → *Request offboarding* for Ben → Dr Lim + Ms Tan approve → **Ben** no longer sees any students.

### Part 2: `tidecloak-app/` (real TideCloak)

Requirements: Docker (running), Node 20.9+, `curl`, `jq`, bash, and a Tide licence email you control. Full details are in [`tidecloak-app/README.md`](tidecloak-app/README.md).

```bash
cd tidecloak-app
npm install
cp .env.example .env    # set KC_BOOTSTRAP_ADMIN_PASSWORD
TIDE_LICENSE_EMAIL=you@example.com TIDE_TERMS_ACCEPTED=yes npm run init
npm run dev             # http://localhost:3000
```

**Test logins:** there are no shared passwords. `npm run init` prints one invite link per person (counsellor first, then buddy, committee, student) and saves them to `data/invite-links.txt`. Open **each link in its own private/incognito window** and create that person's Tide account. Keep the init terminal open: it waits until all four are linked, then writes `data/tidecloak.json`, and the app switches from rehearsal to real Tide mode.

**What to click:** see "Demo moments" in [`tidecloak-app/README.md`](tidecloak-app/README.md):
- the student writes a note;
- the committee member's *What the server holds* page shows ciphertext only;
- the committee member granting himself `pcb-breakglass` stays at **1 of 2**;
- buddy + counsellor approve, and the escalation desk opens.

Without the init step, `npm run dev` runs in **rehearsal mode**, labelled on every screen.

## Mocked / simulated functionality

**`frontend/` is entirely mocked.** The yellow "Demo mode" bar is on every screen.

- **Login:** *Try the demo* is a picker of synthetic users. *Sign in with TideCloak* is real TideCloak login when `frontend/tidecloak.json` is present (see Part 1), but the data behind it is still this mock.
- **Encryption:** nothing is encrypted. "Ciphertext" is random bytes generated for display. Notes are stored as plain text in the browser's localStorage.
- **Access rules and approvals:** the per-case roles, 2-counsellor approvals, escalation (buddy + 1 counsellor) and offboarding are simulated in JavaScript (`frontend/api.js`). Nothing enforces them.
- **Real identity:** stored in plain text in the mock. The UI only shows names where the rules allow.
- **Notifications and access history:** generated by the mock and labelled "App-logged (demo)". They are not tamper-proof.
- **SOS:** shows real Malaysian crisis numbers (999, Befrienders KL, Talian HEAL 15555) but contacts nobody.

**`tidecloak-app/` is real when set up, with these exceptions:**

- **Rehearsal mode** (when TideCloak isn't set up): approvals are simulated and keys live in the browser. Every screen says so.
- **Student receipts:** written by our server and labelled "logged by Safe Circle". The approvals themselves are recorded by TideCloak.
- **Shared decryption:** a note can only be decrypted by its writer (Tide self-encryption). Letting the buddy and counsellor decrypt a student's note needs a Forseti policy and is on the roadmap.
- **Storage:** a local JSON file (`data/pcb/`), not a database.

**Differences between the two parts:** the mock shows "buddy + 1 counsellor" for escalation and "2 counsellors" for assignments. The real build enforces any 2 of 3 programme admins (buddy lead, counsellor, committee member) for every access change.

## Backend handoff

All UI ↔ backend calls go through **`frontend/api.js`**. Replace each function's body and keep the same name and return shape. `TIDECLOAK:` comments mark where each real call goes.

| Function | Real implementation |
|---|---|
| `login` / `getSession` / `logout` | TideCloak login; role from token (`student`/`buddy`/`counsellor`/`admin`) |
| `addNote(caseId, text, tags)` | TideCloak E2EE encrypt tagged to the `case-<id>` role → store ciphertext |
| `listNotes(caseId)` | Decrypt each note; on failure return `{ locked: true, cipher }` |
| `listMyCases` / `listEscalatedCases` | Cases where the user holds `case-<id>`; show the real name only with `identity-<id>` |
| `requestAssignment` / `requestRoleGrant` / `requestOffboard` | Create a TideCloak change request (role grant / removal) |
| `requestEscalation(caseId, reason)` | Change request granting `case-<id>` + `identity-<id>` to a counsellor |
| `listRequests` / `vote` | List change requests; approve/reject with the counsellor's Tide account |
| `getAccessHistory` | From TideCloak change-request records; set `source: 'tidecloak'` (UI shows "TideCloak record" instead of "App-logged") |
| `listNotifications` | App-side, labelled as app-logged |

Set `export const MOCK = false` once real calls are in. The UI then drops the banner and its demo wording.

**Escalation rule (answered above):** the mock shows "buddy + 1 counsellor". The real TideCloak build enforces any 2 of the 3 programme admins, which is Tide's own quorum, with no Forseti policy needed.

## Future work

Appointment booking, auto-expiry of notes after a case closes, biometric/passkey unlock, screenshot deterrents (these can't be fully prevented on the web), real university integration.

All data is synthetic.
