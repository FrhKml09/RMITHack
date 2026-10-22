# Safe Circle (PCB Safe Space)

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

## `frontend/`: demo mode

`frontend/` is a complete UI running on a **mock** backend (`frontend/api.js`, synthetic data in localStorage). The mock imitates the rules but **does not enforce anything**: nothing is really encrypted, and a yellow banner says so on every screen. The real enforcement lives in `tidecloak-app/`.

### Run it

No install needed (Node 18+):

```bash
node frontend/serve.mjs
```

Open http://localhost:5173. Click **Sign in with TideCloak**, then pick a synthetic user. Use **Reset demo** in the banner to restore the seed data.

### Demo script (acceptance tests)

1. **Student Blue-17** (Aisha) writes a note on Reflect.
2. **Ben Ong** → My students → Student Blue-17: reads the note and sees only the alias.
3. **Chloe Lee**: no students, so no access.
4. **IT Admin** → Overview: users shown by alias, notes shown as ciphertext. Request role grant "counsellor" for IT Admin → *Pending 0/2*.
5. **Dr Lim** and **Ms Tan** → Approvals: each approves → approved (Approve/Reject buttons).
6. **Ben** → Escalate to counsellor (reason) → **Dr Lim** approves → Escalated cases shows the real name. **Aisha** → Alerts shows who got access and why.
7. **IT Admin** → Request offboarding for Ben → 2 counsellor approvals → **Ben** has no access.

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
