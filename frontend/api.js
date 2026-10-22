// api.js — the ONLY file the backend needs to replace.
//
// Every function here is the contract between the UI and the backend.
// Right now it is a MOCK that keeps synthetic data in localStorage so the
// UI can be demoed. The mock does NOT enforce anything: it imitates the rules
// TideCloak must enforce (per-case roles, E2EE, quorum approvals) so the
// screens behave the way they will once the real backend is wired in.
//
// Backend TODO per function is marked "TIDECLOAK:".

export const MOCK = true;

const KEY = 'safecircle-mock-v2';

// ---------- seed (synthetic only) ----------
const USERS = [
  { id: 'aisha', role: 'student', name: 'Aisha Rahman', alias: 'Student Blue-17', info: 'Sophomore · Engineering' },
  { id: 'farid', role: 'student', name: 'Farid Hakim', alias: 'Student Green-04', info: 'Freshman · Business' },
  { id: 'ben', role: 'buddy', name: 'Ben Ong', title: 'Peer Buddy · Psychology Y3' },
  { id: 'chloe', role: 'buddy', name: 'Chloe Lee', title: 'Peer Buddy · Medicine Y2' },
  { id: 'drlim', role: 'counsellor', name: 'Dr Lim', title: 'Counsellor' },
  { id: 'mstan', role: 'counsellor', name: 'Ms Tan', title: 'Counsellor' },
  { id: 'admin', role: 'admin', name: 'IT Admin', title: 'Admin' },
];

function seed() {
  const t = Date.now();
  return {
    session: null,
    // Per-case roles. TIDECLOAK: these are realm roles e.g. case-aisha / identity-aisha.
    grants: [
      { user: 'aisha', role: 'case-aisha' },
      { user: 'aisha', role: 'identity-aisha' },
      { user: 'ben', role: 'case-aisha' },
      { user: 'farid', role: 'case-farid' },
      { user: 'farid', role: 'identity-farid' },
      { user: 'ben', role: 'case-farid' },
    ],
    activeBuddies: ['ben', 'chloe'],
    notes: [
      { id: 'n1', caseId: 'aisha', author: 'aisha', at: t - 3 * 864e5, title: 'Welcome check-in',
        tags: ['Isolation'], plain: 'First week back and I feel like I don\'t know anyone in my cohort.', cipher: fakeCipher(70) },
      { id: 'n2', caseId: 'aisha', author: 'ben', at: t - 2 * 864e5, title: 'Session notes',
        tags: [], plain: 'Talked about joining the study group on Thursdays. Agreed to check in after exams.', cipher: fakeCipher(80) },
      { id: 'n3', caseId: 'aisha', author: 'aisha', at: t - 864e5, title: 'Check-in: exam week coping routine',
        tags: ['Exam Stress'], plain: 'Sleeping badly before the stats exam. Trying the 25-minute study blocks Ben suggested.', cipher: fakeCipher(90) },
      { id: 'n4', caseId: 'farid', author: 'farid', at: t - 5 * 864e5, title: 'Moving into the hostel',
        tags: ['Isolation'], plain: 'Homesick most evenings. Would like someone to talk to after classes.', cipher: fakeCipher(70) },
    ],
    requests: [
      { id: 'r0', type: 'assign', caseId: 'aisha', target: 'ben', roles: ['case-aisha'], by: 'admin',
        reason: 'Initial buddy match', at: t - 4 * 864e5, need: { counsellors: 2 },
        votes: [{ by: 'drlim', ok: true, at: t - 4 * 864e5 }, { by: 'mstan', ok: true, at: t - 4 * 864e5 }], status: 'approved' },
      { id: 'r1', type: 'assign', caseId: 'farid', target: 'ben', roles: ['case-farid'], by: 'admin',
        reason: 'Initial buddy match', at: t - 6 * 864e5, need: { counsellors: 2 },
        votes: [{ by: 'drlim', ok: true, at: t - 6 * 864e5 }, { by: 'mstan', ok: true, at: t - 6 * 864e5 }], status: 'approved' },
    ],
    notifications: [
      { id: 'x0', to: 'aisha', at: t - 4 * 864e5, text: 'Ben was approved as your buddy by 2 counsellors. Ben can read your notes and sees you only as Student Blue-17.' },
    ],
  };
}

function fakeCipher(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b));
}

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return s; } catch {}
  const s = seed(); save(s); return s;
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
let db = load();
const commit = () => save(db);
const uid = () => Math.random().toString(36).slice(2, 9);
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120));
const has = (user, role) => db.grants.some((g) => g.user === user && g.role === role);
const me = () => USERS.find((u) => u.id === db.session);
const user = (id) => USERS.find((u) => u.id === id);

function need(roleName) {
  const u = me();
  if (!u || u.role !== roleName) throw new Error('Not allowed');
  return u;
}

// What a given viewer may see about a person. Alias by default.
function displayFor(viewer, studentId) {
  const s = user(studentId);
  return has(viewer.id, 'identity-' + studentId) ? `${s.name} (${s.alias})` : s.alias;
}

// ---------- auth ----------
// TIDECLOAK: replace with TideCloak login (IAMService / useTideCloak) and read roles from the token.
export async function listDemoUsers() { return delay(USERS.filter((u) => u.id !== 'farid').map(({ id, role, name, alias }) => ({ id, role, label: role === 'student' ? alias : name }))); }
export async function login(id) { db.session = id; commit(); return delay(me()); }
export async function logout() { db.session = null; commit(); return delay(true); }
export async function getSession() {
  const u = me();
  if (!u) return null;
  // A student sees their own alias in the UI; real name is never shown to others by default.
  return { id: u.id, role: u.role, displayName: u.role === 'student' ? u.alias : u.name, firstName: u.name.split(' ')[0], title: u.title };
}

// ---------- notes ----------
// TIDECLOAK: encrypt with doEncrypt([{ data, tags: ['case-<id>'] }]) before saving; store ciphertext only.
// Decrypt with doDecrypt — succeeds only if the user's token holds the case role.
function readable(n, viewerId) { return has(viewerId, 'case-' + n.caseId) && (user(viewerId).role !== 'buddy' || db.activeBuddies.includes(viewerId)); }

export async function listNotes(caseId) {
  const u = me();
  return delay(db.notes.filter((n) => n.caseId === caseId).sort((a, b) => b.at - a.at).map((n) => ({
    id: n.id, at: n.at, tags: n.tags,
    author: n.author === caseId ? (u.id === caseId ? 'You' : user(caseId).alias) : user(n.author).name,
    title: readable(n, u.id) ? n.title : null,
    text: readable(n, u.id) ? n.plain : null,
    cipher: n.cipher,
    locked: !readable(n, u.id),
  })));
}

export async function addNote(caseId, text, tags = []) {
  const u = me();
  if (!readable({ caseId }, u.id)) throw new Error('You no longer have access to this case.');
  const title = text.split(/[.!?\n]/)[0].slice(0, 48) || 'Check-in';
  db.notes.push({ id: uid(), caseId, author: u.id, at: Date.now(), title, tags, plain: text, cipher: fakeCipher(Math.max(40, text.length)) });
  commit();
  return delay(true);
}

// ---------- student ----------
export async function getAccessPanel(caseId) {
  need('student');
  const holders = (r) => db.grants.filter((g) => g.role === r && g.user !== caseId).map((g) => {
    const p = user(g.user);
    const active = p.role !== 'buddy' || db.activeBuddies.includes(p.id);
    return { name: p.name, title: p.title, role: p.role, active };
  }).filter((p) => p.active);
  return delay({ notes: holders('case-' + caseId), identity: holders('identity-' + caseId) });
}

// TIDECLOAK: approved items should come from TideCloak's change-request / audit records (source: 'tidecloak').
export async function getAccessHistory(caseId) {
  return delay(db.requests.filter((r) => r.caseId === caseId || r.affects?.includes(caseId)).sort((a, b) => b.at - a.at).map(view));
}

export async function listNotifications() {
  const u = me();
  return delay(db.notifications.filter((n) => n.to === u.id).sort((a, b) => b.at - a.at));
}

export async function requestBuddy(text) {
  const u = need('student');
  db.requests.push({ id: uid(), type: 'buddy-request', caseId: u.id, target: null, roles: [], by: u.id,
    reason: text || 'Student asked for a buddy', at: Date.now(), need: { counsellors: 0 }, votes: [], status: 'open' });
  commit();
  return delay(true);
}

// ---------- buddy ----------
export async function listMyCases() {
  const u = need('buddy');
  const active = db.activeBuddies.includes(u.id);
  const ids = [...new Set(db.grants.filter((g) => g.user === u.id && g.role.startsWith('case-')).map((g) => g.role.slice(5)))];
  return delay({ active, cases: active ? ids.map((id) => ({ caseId: id, label: displayFor(u, id), info: user(id).info, lastAt: Math.max(...db.notes.filter((n) => n.caseId === id).map((n) => n.at), 0) })) : [] });
}

export async function listMyEscalations() {
  const u = need('buddy');
  return delay(db.requests.filter((r) => r.type === 'escalate' && r.by === u.id).sort((a, b) => b.at - a.at).map(view));
}

export async function requestEscalation(caseId, reason) {
  const u = need('buddy');
  // Duty of care: buddy + 1 counsellor. The buddy's request counts as their approval.
  db.requests.push({ id: uid(), type: 'escalate', caseId, target: null, roles: ['case-' + caseId, 'identity-' + caseId], by: u.id,
    reason, at: Date.now(), need: { counsellors: 1 }, votes: [{ by: u.id, ok: true, at: Date.now() }], status: 'pending' });
  commit();
  return delay(true);
}

// ---------- counsellor ----------
// TIDECLOAK: change requests + quorum votes. Approving = signing the change request with the counsellor's Tide account.
function view(r) {
  const cVotes = r.votes.filter((v) => user(v.by).role === 'counsellor');
  const esc = r.type === 'escalate';
  return {
    ref: '#' + (parseInt(r.id.replace(/\W/g, ''), 36) % 900 + 100) + '-' + 'ABCDEFGH'[r.id.length % 8],
    caseInfo: r.caseId ? user(r.caseId).info : null,
    // Escalation = buddy + 1 counsellor (2 signatures); everything else = N counsellors.
    have: esc ? r.votes.filter((v) => v.ok).length : cVotes.filter((v) => v.ok).length,
    total: esc ? 1 + r.need.counsellors : r.need.counsellors,
    ...r,
    caseLabel: r.caseId ? user(r.caseId).alias : null,
    targetName: r.target ? user(r.target).name : null,
    byName: user(r.by).role === 'student' ? user(r.by).alias : user(r.by).name,
    votes: r.votes.map((v) => ({ ...v, name: user(v.by).name })),
    approvals: cVotes.filter((v) => v.ok).length,
    source: MOCK ? 'mock' : 'tidecloak',
  };
}

export async function listRequests() {
  const u = me();
  if (!['counsellor', 'admin'].includes(u.role)) throw new Error('Not allowed');
  return delay(db.requests.filter((r) => r.type !== 'buddy-request' || u.role === 'counsellor').sort((a, b) => b.at - a.at).map(view));
}

export async function vote(requestId, ok) {
  const u = need('counsellor');
  const r = db.requests.find((x) => x.id === requestId);
  if (r.status !== 'pending') throw new Error('Already decided');
  if (r.votes.some((v) => v.by === u.id)) throw new Error('You already voted');
  if (r.target === u.id) throw new Error('You cannot approve a change for yourself');
  r.votes.push({ by: u.id, ok, at: Date.now() });
  const yes = r.votes.filter((v) => v.ok && user(v.by).role === 'counsellor').length;
  if (!ok) r.status = 'rejected';
  else if (yes >= r.need.counsellors) apply(r);
  commit();
  return delay(view(r));
}

function apply(r) {
  r.status = 'approved';
  const names = r.votes.filter((v) => v.ok).map((v) => user(v.by).name).join(', ');
  if (r.type === 'assign') {
    r.roles.forEach((role) => db.grants.push({ user: r.target, role }));
    notify(r.caseId, `${user(r.target).name} was approved as your buddy (${names}). They see you only as ${user(r.caseId).alias}.`);
  } else if (r.type === 'role') {
    r.roles.forEach((role) => db.grants.push({ user: r.target, role }));
  } else if (r.type === 'escalate') {
    // Counsellors who approved get case + identity access.
    r.votes.filter((v) => v.ok && user(v.by).role === 'counsellor').forEach((v) => r.roles.forEach((role) => db.grants.push({ user: v.by, role })));
    const c = r.votes.filter((v) => v.ok && user(v.by).role === 'counsellor').map((v) => user(v.by).name).join(', ');
    notify(r.caseId, `Your buddy asked a counsellor for support. ${c} can now read your notes and see your name. Reason: "${r.reason}". Approved by ${names}.`);
  } else if (r.type === 'offboard') {
    const hadCases = db.grants.filter((g) => g.user === r.target && g.role.startsWith('case-')).map((g) => g.role.slice(5));
    db.activeBuddies = db.activeBuddies.filter((b) => b !== r.target);
    db.grants = db.grants.filter((g) => !(g.user === r.target && g.role.startsWith('case-')));
    hadCases.forEach((id) => notify(id, `${user(r.target).name} has left the buddy programme and can no longer read your notes.`));
  }
}
function notify(to, text) { db.notifications.push({ id: uid(), to, at: Date.now(), text }); }

export async function listEscalatedCases() {
  const u = need('counsellor');
  const ids = [...new Set(db.grants.filter((g) => g.user === u.id && g.role.startsWith('case-')).map((g) => g.role.slice(5)))];
  return delay(ids.map((id) => ({ caseId: id, label: displayFor(u, id) })));
}

// ---------- admin ----------
// Admin can only SUBMIT. Every request below stays pending until 2 counsellors approve.
export async function adminOverview() {
  need('admin');
  return delay({
    users: USERS.map((p) => ({ id: p.id, role: p.role, label: p.role === 'student' ? p.alias : p.name,
      roles: db.grants.filter((g) => g.user === p.id).map((g) => g.role).map((r) => r.replace(/-(\w+)$/, (m, id) => '-' + (user(id)?.role === 'student' ? user(id).alias.replace(/\s/g, '') : id))),
      active: p.role !== 'buddy' || db.activeBuddies.includes(p.id) })),
    notes: db.notes.slice().sort((a, b) => b.at - a.at).map((n) => ({ id: n.id, caseLabel: user(n.caseId).alias, at: n.at, cipher: n.cipher })),
    students: USERS.filter((p) => p.role === 'student').map((p) => ({ id: p.id, alias: p.alias })),
    buddies: USERS.filter((p) => p.role === 'buddy').map((p) => ({ id: p.id, name: p.name, active: db.activeBuddies.includes(p.id) })),
  });
}

function submit(type, fields) {
  const u = need('admin');
  const r = { id: uid(), type, by: u.id, at: Date.now(), need: { counsellors: 2 }, votes: [], status: 'pending', ...fields };
  db.requests.push(r); commit();
  return delay(view(r));
}
export const requestAssignment = (caseId, buddyId, reason) => submit('assign', { caseId, target: buddyId, roles: ['case-' + caseId], reason });
export const requestRoleGrant = (userId, role, reason) => submit('role', { caseId: null, target: userId, roles: [role], reason });
export const requestOffboard = (buddyId, reason) => submit('offboard', { caseId: null, target: buddyId, roles: [], reason,
  affects: db.grants.filter((g) => g.user === buddyId && g.role.startsWith('case-')).map((g) => g.role.slice(5)) });

export function resetDemo() { db = seed(); commit(); }
