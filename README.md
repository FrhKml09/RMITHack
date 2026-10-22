# Safe Circle (PCB Safe Space)

A peer-support app for Taylor's University Peer Counselling Buddies, where students talk to trained student buddies under an alias, and no single admin, counsellor, developer or server can read their notes, unmask them, or grant themselves access.

**Vision.** Any student can reach out about depression, family or personal problems without first having to trust one person, or one system, with their story and their name.

**Trust constraint.** Today, whoever runs the system (an admin, IT, the app's builder) can read every note and see who is behind every alias. That fear stops students from asking for help.

**Value.** Students get a buddy who knows them only by an alias. Buddies can still get counsellor support on serious cases, and the student is told who gained access and why.

**Why TideCloak.** Notes are encrypted per student case and can only be decrypted by holders of that case's role. Granting a role goes through Quorum-Enforced Governance: a change request that counsellors must approve, so no single admin can approve their own change. Approvals are signed and logged by TideCloak, which gives a tamper-evident access history.

**Prototype.** Student, buddy, counsellor and admin dashboards. Encrypted notes, aliases by default, a ciphertext-only admin view, a 2-counsellor approval queue, escalation (buddy + 1 counsellor), buddy offboarding, and a "who can see my notes / my name" panel with an access history.

---

## Status: frontend only (demo mode)

`frontend/` is a complete UI running on a **mock** backend (`frontend/api.js`, synthetic data in localStorage). The mock imitates the rules but **does not enforce anything**: nothing is really encrypted, and a yellow banner says so on every screen. The real enforcement comes from TideCloak and is being built by the backend teammate.

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

**Open question for backend:** "buddy + 1 counsellor" for escalation is a custom M-of-N rule. Plain quorum approval is a majority of realm admins, so this rule probably needs Forseti policy. Confirm with Tide's MCP before claiming it in the demo.

## Future work

Appointment booking, auto-expiry of notes after a case closes, biometric/passkey unlock, screenshot deterrents (these can't be fully prevented on the web), real university integration.

All data is synthetic.
