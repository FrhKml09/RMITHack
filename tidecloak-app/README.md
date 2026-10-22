# Safe Circle: TideCloak build

The working TideCloak version of Safe Circle's core rule: **nobody joins a student's circle alone.** Next.js 16 + `@tidecloak/nextjs`.

## What Tide enforces here

| Moment | Who enforces it |
|---|---|
| Sign-in with no password hash stored anywhere (PRISM across Tide's ORK network) | Tide |
| The app knows a student only by their random Tide subject (`7f3a·9c1e`), never a name or email | Tide |
| Notes are encrypted in the writer's browser (`doEncrypt`); the server and admins hold ciphertext only (`/ledger`) | Tide |
| Decrypting needs the live ORK network to check the role in the signed token; there is no offline key to steal | Tide |
| A committee member grants himself `pcb-breakglass`: the change request sits at **1 of 2** in TideCloak's QEA console | Tide (quorum = `floor(0.7 × 3 admins)` = 2) |
| `/escalation` is refused until the Tide-signed token carries `pcb-breakglass` | Tide signs the token; our API checks it |
| Tokens are DPoP-bound, so a stolen token is useless without the browser's key | Tide + our API |
| Flare (crisis assistant) only files a request with circle ID + risk level, never the student's words | Our code |
| Receipts shown to the student | Our code, labelled "logged by Safe Circle" |

## Run it

Rehearsal (no Tide network, for practising the demo; every screen says so):

```bash
npm install
npm run dev            # http://localhost:3000, pick a persona
```

Real Tide mode (needs Docker and a Tide licence email you control):

```bash
cp .env.example .env   # set KC_BOOTSTRAP_ADMIN_PASSWORD
TIDE_LICENSE_EMAIL=you@example.com TIDE_TERMS_ACCEPTED=yes npm run init
npm run dev
```

`npm run init` creates the realm, enables quorum governance with the Tide attestor, writes `data/tidecloak.json` and prints one invite link per person (student, buddy, counsellor, committee). Each person opens their link and creates a Tide account. Once `data/tidecloak.json` exists, the app switches to Tide mode automatically and rehearsal is disabled.

## Demo moments

1. **The database is useless.** Student writes in *My circle*. Committee opens *What the server holds* and sees only ciphertext.
2. **The grab fails.** Committee grants himself `pcb-breakglass` in the Tide console and approves it: **1 of 2**. *Escalation desk* still refuses him.
3. **Help still arrives.** On the buddy desk, Flare spots crisis language and files a flare; buddy and counsellor approve the counsellor's grant (2 of 2). The counsellor refreshes the token and the desk opens. The student sees the receipt.

## Limits we state openly

- Our server can still delete or withhold ciphertext, or serve modified front-end code. Roadmap: signed front-end builds.
- Notes use Tide self-encryption: only the writer can decrypt. Shared student + buddy decryption needs a Forseti policy and is on the roadmap.
- The TideCloak master admin can change realm settings; keep it offline and out of the app.
- Storage is a JSON file in `data/pcb/` (gitignored). Swap for a database in production.
