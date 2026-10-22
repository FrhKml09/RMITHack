import * as api from './api.js';

const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (name, fill) => `<span class="icon${fill ? ' fill' : ''}" aria-hidden="true">${name}</span>`;
const ago = (t) => {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return 'Just now';
  if (d < 3600) return Math.floor(d / 60) + ' min ago';
  if (d < 86400) return Math.floor(d / 3600) + ' h ago';
  if (d < 172800) return 'Yesterday';
  return Math.floor(d / 86400) + ' days ago';
};

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function modal(html, bind) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => bg.remove();
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  document.body.appendChild(bg);
  bind?.(bg, close);
}

function sos() {
  modal(`
    <h2>${icon('emergency', true)} Need help right now?</h2>
    <p>If you or someone else is in immediate danger, call <b>999</b>.</p>
    <div class="list">
      <div class="row"><div class="grow"><h3>Befrienders KL</h3><p class="small muted">24-hour emotional support</p></div><b>03-7627 2929</b></div>
      <div class="row"><div class="grow"><h3>Talian HEAL</h3><p class="small muted">Ministry of Health mental health line</p></div><b>15555</b></div>
    </div>
    <p class="small muted">These lines are outside Safe Circle. Calling them shares nothing from this app.</p>
    <button class="btn primary" data-close>Close</button>`);
}

// ---------- shell ----------
const ROUTES = {
  student: [['reflect', 'favorite', 'Reflect'], ['notes', 'forum', 'Notes'], ['transparency', 'shield', 'Transparency'], ['alerts', 'notifications', 'Alerts']],
  buddy: [['cases', 'groups', 'My students']],
  counsellor: [['approvals', 'how_to_vote', 'Approvals'], ['cases', 'folder_shared', 'Escalated cases']],
  admin: [['admin', 'dashboard', 'Overview'], ['requests', 'pending_actions', 'Requests']],
};

function mockBar() {
  return api.MOCK ? `<div class="mockbar">Demo mode: synthetic data in this browser, no TideCloak connected. Nothing here is encrypted or enforced yet. <button data-act="reset">Reset demo</button></div>` : '';
}

async function shell(session, current, body, unread = 0) {
  const isStudent = session.role === 'student';
  const nav = ROUTES[session.role].map(([r, ic, label]) =>
    isStudent
      ? `<a href="#/${r}" ${r === current ? 'aria-current="page"' : ''}>${icon(ic, r === current)}<span>${label}</span>${r === 'alerts' && unread ? `<span class="badge">${unread}</span>` : ''}</a>`
      : `<a href="#/${r}" ${r === current ? 'aria-current="page"' : ''}>${label}</a>`).join('');
  app.innerHTML = `
    ${mockBar()}
    <header class="topbar">
      <div class="brand"><span class="logo">${icon('lock', true)}</span>Safe Circle</div>
      ${isStudent ? '' : `<nav class="staffnav">${nav}</nav>`}
      <div class="right">
        ${isStudent ? `<button class="sos" data-act="sos">${icon('emergency', true)} SOS</button>` : `<div class="who-am-i"><b>${esc(session.displayName)}</b><br>${esc(session.role)}</div>`}
        <button class="btn ghost sm" data-act="logout" title="Sign out">${icon('logout')}</button>
      </div>
    </header>
    <main class="wrap ${isStudent ? '' : 'wide'}">${body}</main>
    ${isStudent ? `<nav class="bottomnav"><div class="inner">${nav}</div></nav>` : ''}`;
}

app.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act;
  if (act === 'logout') { await api.logout(); location.hash = '#/login'; }
  if (act === 'sos') sos();
  if (act === 'reset') { api.resetDemo(); location.hash = '#/login'; render(); }
});

// ---------- login ----------
async function loginView() {
  const users = await api.listDemoUsers();
  app.innerHTML = `
    ${mockBar()}
    <div class="login"><div class="card">
      <div class="brand"><span class="logo">${icon('lock', true)}</span>Safe Circle</div>
      <p class="muted">Peer support from Taylor's Peer Counselling Buddies. Talk to a trained student buddy under an alias. No single person can read your notes or reveal who you are.</p>
      <button class="btn primary block" id="tide">${icon('fingerprint')} Sign in with TideCloak</button>
      <div class="userpick" id="pick" hidden>
        <p class="small muted">Demo: choose a synthetic user</p>
        ${users.map((u) => `<button class="btn ghost" data-user="${u.id}"><b>${esc(u.label)}</b>&nbsp;<span class="muted small">${u.role}</span></button>`).join('')}
      </div>
    </div></div>`;
  // TIDECLOAK: the button should call the real TideCloak login. In demo mode it reveals the user picker.
  app.querySelector('#tide').onclick = () => { app.querySelector('#pick').hidden = false; };
  app.querySelectorAll('[data-user]').forEach((b) => b.onclick = async () => {
    const u = await api.login(b.dataset.user);
    location.hash = '#/' + ROUTES[u.role][0][0];
  });
}

// ---------- student ----------
const FOCUS = ['Exam Stress', 'Isolation', 'Family', 'Anxiety', 'Low mood'];

async function whoCanSee(s) {
  const p = await api.getAccessPanel(s.id);
  const people = p.notes;
  const onlyTwo = people.length === 1 && people[0].role === 'buddy';
  const pill = people.length === 0 ? '<span class="pill grey">Only you</span>' : onlyTwo ? '<span class="pill green">Only you two</span>' : `<span class="pill amber">${people.length + 1} people</span>`;
  const avatar = (pp) => `<div class="link"><span></span></div><div class="person"><div class="avatar ${pp.role === 'counsellor' ? 'amber' : 'green'}">${icon(pp.role === 'counsellor' ? 'medical_services' : 'psychology')}</div><b>${esc(pp.name)}</b><span class="small muted">${esc(pp.title || pp.role)}</span></div>`;
  return `
    <section class="card">
      <div class="card-head"><div class="title">${icon('visibility')}<h2>Who can see this?</h2></div>${pill}</div>
      <div class="inset who">
        <div class="person"><div class="avatar">${icon('fingerprint')}</div><b>You</b><span class="small muted">Your Tide account</span></div>
        ${people.map(avatar).join('')}
      </div>
      <div class="list small">
        <div><b>Can read your notes:</b> ${people.length ? people.map((x) => esc(x.name)).join(', ') : 'only you'}</div>
        <div><b>Can see your real name:</b> ${p.identity.length ? p.identity.map((x) => esc(x.name)).join(', ') : 'nobody but you. Everyone else sees ' + esc(s.displayName)}</div>
      </div>
      <div class="note-box">${icon('verified_user')}<span>Giving anyone else access needs <b>2 counsellor approvals</b> (or, for a safety escalation, your buddy + 1 counsellor), and you get a notification saying who and why.</span></div>
    </section>`;
}

async function studentReflect(s) {
  const notes = await api.listNotes(s.id);
  const panel = await whoCanSee(s);
  await shell(s, 'reflect', `
    <div class="status"><span><span class="dot"></span>${esc(s.displayName)}</span><span class="pill green">${icon('shield')} Alias mode on</span></div>
    <div><h1>Hi, ${esc(s.displayName)}</h1>
      <p class="muted" style="margin-top:6px">Your notes are meant to be readable only by you and your current buddy. Your buddy knows you only by this alias.</p></div>
    <section class="card">
      <div class="card-head"><div class="title"><span class="bubble">${icon('favorite')}</span><div><h2>Share what's on your heart</h2><p class="small muted">Private peer reflection</p></div></div></div>
      <div><p class="small" style="margin-bottom:8px">Select a focus (optional):</p>
        <div class="chips">${FOCUS.map((f) => `<button class="chip" aria-pressed="false" data-focus="${f}">${f}</button>`).join('')}</div></div>
      <textarea id="note" placeholder="What's on your mind today? Share as much or as little as you like..."></textarea>
      <button class="btn primary block" id="send">${icon('lock')} Send privately to your buddy</button>
      <p class="small muted" style="text-align:center">${api.MOCK ? 'Demo: saved locally, not encrypted yet.' : 'Encrypted with TideCloak before it leaves your device.'}</p>
    </section>
    ${panel}
    <section class="card">
      <div class="card-head"><div class="title">${icon('history_edu')}<h2>Recent check-ins</h2></div><span class="small muted">${notes.length} saved</span></div>
      <div class="list">${notes.slice(0, 3).map((n) => `
        <a class="row clickable" href="#/notes" style="text-decoration:none;color:inherit">
          <span class="bubble">${icon(n.author === 'You' ? 'edit_note' : 'psychology')}</span>
          <div class="grow"><h3>${esc(n.title)}</h3><div class="meta"><span>${ago(n.at)}</span>·<span>${esc(n.author)}</span>·<span style="color:var(--green)">${icon('lock')} Sealed</span></div></div>
          ${icon('chevron_right')}</a>`).join('') || '<div class="empty">No check-ins yet.</div>'}</div>
    </section>`, await unread(s));

  app.querySelectorAll('[data-focus]').forEach((c) => c.onclick = () => c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'));
  app.querySelector('#send').onclick = async () => {
    const text = app.querySelector('#note').value.trim();
    if (!text) return toast('Write something first.');
    const tags = [...app.querySelectorAll('[data-focus][aria-pressed="true"]')].map((c) => c.dataset.focus);
    await api.addNote(s.id, text, tags);
    toast('Sent privately to your buddy.');
    render();
  };
}

function noteCard(n) {
  return `<div class="row" style="align-items:flex-start">
    <span class="bubble">${icon(n.locked ? 'lock' : n.author === 'You' ? 'edit_note' : 'psychology')}</span>
    <div class="grow" style="display:grid;gap:6px">
      ${n.locked
        ? `<h3>Encrypted note</h3><div class="cipher mono">${esc(n.cipher)}</div><p class="small muted">You don't have the case role for this note, so it can't be decrypted.</p>`
        : `<h3>${esc(n.title)}</h3><p>${esc(n.text)}</p>`}
      <div class="meta"><span>${esc(n.author)}</span>·<span>${ago(n.at)}</span>${n.tags.map((t) => `<span class="pill blue" style="padding:1px 8px;font-size:12px">${esc(t)}</span>`).join('')}</div>
    </div></div>`;
}

async function studentNotes(s) {
  const notes = await api.listNotes(s.id);
  await shell(s, 'notes', `
    <h1>Your notes</h1>
    <p class="muted">Notes you and your buddy have written. Newest first.</p>
    <div class="list">${notes.map(noteCard).join('') || '<div class="empty">No notes yet.</div>'}</div>
    <section class="card">
      <h3>Not matched with a buddy yet?</h3>
      <p class="small muted">Ask the PCB team for a buddy. You stay anonymous: they see only your alias.</p>
      <button class="btn ghost" id="req">${icon('person_add')} Request a buddy</button>
    </section>`, await unread(s));
  app.querySelector('#req').onclick = async () => { await api.requestBuddy(); toast('Request sent. A counsellor will review it.'); };
}

function statusPill(r) {
  if (r.status === 'approved') return `<span class="pill green">${icon('check_circle')} Approved</span>`;
  if (r.status === 'rejected') return `<span class="pill red">${icon('cancel')} Rejected</span>`;
  if (r.status === 'open') return `<span class="pill blue">${icon('inbox')} Received</span>`;
  return `<span class="pill amber">${icon('hourglass_top')} Pending ${r.approvals}/${r.need.counsellors}</span>`;
}

const TYPE = {
  assign: (r) => `Assign ${r.targetName} as buddy for ${r.caseLabel}`,
  escalate: (r) => `Escalate ${r.caseLabel} to a counsellor`,
  role: (r) => `Grant role "${r.roles.join(', ')}" to ${r.targetName}`,
  offboard: (r) => `Offboard buddy ${r.targetName} (remove all case access)`,
  'buddy-request': (r) => `${r.caseLabel} asked for a buddy`,
};

function sourceTag(r) {
  return r.source === 'tidecloak'
    ? `<span class="pill green" title="Signed record from TideCloak">${icon('verified')} TideCloak record</span>`
    : `<span class="pill grey" title="Logged by this demo only, not tamper-proof">${icon('description')} App-logged (demo)</span>`;
}

async function studentTransparency(s) {
  const hist = await api.getAccessHistory(s.id);
  await shell(s, 'transparency', `
    <h1>Transparency</h1>
    ${await whoCanSee(s)}
    <section class="card">
      <div class="card-head"><div class="title">${icon('history')}<h2>Access history</h2></div></div>
      <div class="list">${hist.filter((r) => r.type !== 'buddy-request').map((r) => `
        <div class="row" style="align-items:flex-start"><div class="grow" style="display:grid;gap:6px">
          <h3>${esc(TYPE[r.type](r).replace(r.caseLabel, 'you'))}</h3>
          <p class="small">${esc(r.reason)}</p>
          <div class="meta"><span>Requested by ${esc(r.byName)}</span>·<span>${ago(r.at)}</span></div>
          <div class="meta">${r.votes.map((v) => `<span>${v.ok ? '✓' : '✗'} ${esc(v.name)}</span>`).join('')}</div>
          <div class="chips">${statusPill(r)}${sourceTag(r)}</div>
        </div></div>`).join('') || '<div class="empty">No access changes yet.</div>'}</div>
    </section>`, await unread(s));
}

async function studentAlerts(s) {
  const items = await api.listNotifications();
  try { localStorage.setItem('seen-' + s.id, String(items.length)); } catch {}
  await shell(s, 'alerts', `
    <h1>Alerts</h1>
    <p class="muted">You're told every time someone new gets access to your notes or your name.</p>
    <div class="list">${items.map((n) => `<div class="row" style="align-items:flex-start"><span class="bubble">${icon('notifications_active')}</span><div class="grow"><p>${esc(n.text)}</p><p class="small muted">${ago(n.at)}</p></div></div>`).join('') || '<div class="empty">No alerts.</div>'}</div>`, 0);
}

async function unread(s) {
  const n = (await api.listNotifications()).length;
  let seen = 0; try { seen = Number(localStorage.getItem('seen-' + s.id) || 0); } catch {}
  return Math.max(0, n - seen);
}

// ---------- buddy ----------
async function buddyCases(s) {
  const { active, cases } = await api.listMyCases();
  await shell(s, 'cases', `
    <div><h1>My students</h1><p class="muted">You see students only by alias. You can read a student's notes only while you're their active, approved buddy.</p></div>
    ${!active ? `<div class="card"><h3>${icon('block')} You're no longer an active buddy</h3><p class="muted">Your access to all cases has been removed.</p></div>` : ''}
    <div class="list">${cases.map((c) => `
      <a class="row clickable" href="#/case/${c.caseId}" style="text-decoration:none;color:inherit">
        <span class="bubble">${icon('person')}</span>
        <div class="grow"><h3>${esc(c.label)}</h3><div class="meta">Last note ${c.lastAt ? ago(c.lastAt) : 'never'}</div></div>${icon('chevron_right')}</a>`).join('') || (active ? '<div class="empty">No students assigned to you.</div>' : '')}</div>`);
}

async function caseView(s, caseId) {
  const notes = await api.listNotes(caseId);
  const label = s.role === 'buddy'
    ? (await api.listMyCases()).cases.find((c) => c.caseId === caseId)?.label
    : (await api.listEscalatedCases()).find((c) => c.caseId === caseId)?.label;
  const allowed = !!label;
  await shell(s, 'cases', `
    <a href="#/cases" class="small muted">← Back</a>
    <div class="card-head"><h1>${esc(label || 'Case')}</h1>${s.role === 'buddy' && allowed ? `<button class="btn danger" id="esc">${icon('priority_high')} Escalate to counsellor</button>` : ''}</div>
    ${s.role === 'counsellor' && allowed ? `<div class="note-box">${icon('info')}<span>You have access because an escalation was approved. The student has been notified.</span></div>` : ''}
    <div class="grid2">
      <div class="list">${notes.map(noteCard).join('') || '<div class="empty">No notes.</div>'}</div>
      ${allowed ? `<section class="card">
        <h3>Add session note</h3>
        <textarea id="note" placeholder="What did you talk about? Agreed next steps?"></textarea>
        <button class="btn primary" id="save">${icon('lock')} Save note</button>
        <p class="small muted">Only people holding this student's case role can read it.</p>
      </section>` : ''}
    </div>`);
  app.querySelector('#save')?.addEventListener('click', async () => {
    const t = app.querySelector('#note').value.trim();
    if (!t) return;
    try { await api.addNote(caseId, t); toast('Note saved.'); render(); } catch (e) { toast(e.message); }
  });
  app.querySelector('#esc')?.addEventListener('click', () => modal(`
    <h2>Escalate to a counsellor</h2>
    <p class="small muted">Use this when a student may be at serious risk. One counsellor must approve. Once approved, that counsellor can read this case and see the student's real name, and the student is told who and why.</p>
    <label class="field">Reason (the student will see this)<textarea id="why" placeholder="e.g. Mentioned thoughts of self-harm in today's session"></textarea></label>
    <div class="chips"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="go">Request escalation</button></div>`,
    (m, close) => m.querySelector('#go').onclick = async () => {
      const why = m.querySelector('#why').value.trim();
      if (!why) return toast('Add a reason.');
      await api.requestEscalation(caseId, why); close(); toast('Escalation sent. Waiting for 1 counsellor approval.');
    }));
}

// ---------- counsellor ----------
async function approvals(s) {
  const all = await api.listRequests();
  const tab = sessionStorage.getItem('apptab') || 'pending';
  const shown = all.filter((r) => tab === 'pending' ? r.status === 'pending' : r.status === tab);
  const counts = { pending: 0, approved: 0, rejected: 0 };
  all.forEach((r) => { if (r.status in counts) counts[r.status]++; });
  const asks = all.filter((r) => r.type === 'buddy-request');
  await shell(s, 'approvals', `
    <div><h1>Approvals</h1><p class="muted">Access changes need counsellor sign-off: <b>2 counsellors</b> for assignments, role grants and offboarding; <b>buddy + 1 counsellor</b> for escalations. You can't approve a change for yourself.</p></div>
    <div class="tabs" role="tablist">${['pending', 'approved', 'rejected'].map((t) => `<button class="tab" role="tab" aria-selected="${t === tab}" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)} (${counts[t]})</button>`).join('')}</div>
    <div class="list">${shown.map((r) => {
      const voted = r.votes.some((v) => v.by === s.id);
      return `<div class="card">
        <div class="card-head"><h3>${esc(TYPE[r.type](r))}</h3>${statusPill(r)}</div>
        <p>${esc(r.reason)}</p>
        <div class="meta"><span>Requested by ${esc(r.byName)}</span>·<span>${ago(r.at)}</span>${r.votes.map((v) => `·<span>${v.ok ? '✓' : '✗'} ${esc(v.name)}</span>`).join('')}</div>
        ${r.status === 'pending' ? (voted
          ? '<p class="small muted">You\'ve voted. Waiting for others.</p>'
          : r.target === s.id ? '<p class="small muted">This change is for you, so you can\'t vote on it.</p>'
          : `<div class="chips"><button class="btn primary sm" data-vote="${r.id}" data-ok="1">${icon('check')} Approve</button><button class="btn danger sm" data-vote="${r.id}" data-ok="0">${icon('close')} Reject</button></div>`) : ''}
        ${sourceTag(r)}
      </div>`;
    }).join('') || '<div class="empty">Nothing here.</div>'}</div>
    ${asks.length ? `<section class="card"><h3>Buddy requests from students</h3><div class="list">${asks.map((r) => `<div class="row"><div class="grow">${esc(r.caseLabel)} <span class="muted small">· ${ago(r.at)}</span></div><span class="small muted">Ask admin to submit an assignment</span></div>`).join('')}</div></section>` : ''}`);
  app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { sessionStorage.setItem('apptab', b.dataset.tab); render(); });
  app.querySelectorAll('[data-vote]').forEach((b) => b.onclick = async () => {
    try {
      const r = await api.vote(b.dataset.vote, b.dataset.ok === '1');
      toast(r.status === 'approved' ? 'Approved. Access change applied.' : r.status === 'rejected' ? 'Rejected.' : `Vote recorded (${r.approvals}/${r.need.counsellors}).`);
      render();
    } catch (e) { toast(e.message); }
  });
}

async function counsellorCases(s) {
  const cases = await api.listEscalatedCases();
  await shell(s, 'cases', `
    <div><h1>Escalated cases</h1><p class="muted">You only see cases where an escalation you approved went through.</p></div>
    <div class="list">${cases.map((c) => `<a class="row clickable" href="#/case/${c.caseId}" style="text-decoration:none;color:inherit"><span class="bubble">${icon('medical_services')}</span><div class="grow"><h3>${esc(c.label)}</h3></div>${icon('chevron_right')}</a>`).join('') || '<div class="empty">No escalated cases.</div>'}</div>`);
}

// ---------- admin ----------
async function adminView(s) {
  const o = await api.adminOverview();
  await shell(s, 'admin', `
    <div><h1>Admin overview</h1><p class="muted">You can create accounts and submit requests. You can't read notes, see who's behind an alias, or grant access on your own. Every change below needs 2 counsellor approvals.</p></div>
    <div class="grid2">
      <section class="card">
        <h2>Users</h2>
        <div class="scroll-x"><table class="table"><thead><tr><th>User</th><th>Role</th><th>Access roles</th></tr></thead><tbody>
        ${o.users.map((u) => `<tr><td><b>${esc(u.label)}</b>${u.active ? '' : ' <span class="pill red" style="padding:0 8px">offboarded</span>'}</td><td>${u.role}</td><td class="mono">${u.roles.map(esc).join('<br>') || '<span class="muted">—</span>'}</td></tr>`).join('')}
        </tbody></table></div>
      </section>
      <section class="card">
        <h2>Submit a request</h2>
        <label class="field">Assign buddy to student
          <div class="chips" style="flex-wrap:nowrap">
            <select id="as-s">${o.students.map((x) => `<option value="${x.id}">${esc(x.alias)}</option>`).join('')}</select>
            <select id="as-b">${o.buddies.filter((b) => b.active).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>
          </div></label>
        <button class="btn ghost" id="assign">${icon('person_add')} Request assignment</button>
        <label class="field">Grant a role
          <div class="chips" style="flex-wrap:nowrap">
            <select id="rg-u">${o.users.map((x) => `<option value="${x.id}">${esc(x.label)}</option>`).join('')}</select>
            <select id="rg-r"><option>counsellor</option><option>buddy</option>${o.students.map((x) => `<option value="case-${x.id}">case access: ${esc(x.alias)}</option>`).join('')}</select>
          </div></label>
        <button class="btn ghost" id="grant">${icon('key')} Request role grant</button>
        <label class="field">Offboard a buddy
          <select id="ob">${o.buddies.filter((b) => b.active).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
        <button class="btn ghost" id="offboard">${icon('person_remove')} Request offboarding</button>
      </section>
    </div>
    <section class="card">
      <div class="card-head"><h2>Stored notes</h2><span class="pill grey">${icon('lock')} Ciphertext only</span></div>
      <div class="scroll-x"><table class="table"><thead><tr><th>Case</th><th>When</th><th>Stored value</th></tr></thead><tbody>
      ${o.notes.map((n) => `<tr><td style="white-space:nowrap">${esc(n.caseLabel)}</td><td style="white-space:nowrap">${ago(n.at)}</td><td class="mono">${esc(n.cipher)}</td></tr>`).join('')}
      </tbody></table></div>
    </section>`);
  const done = (r) => { toast(`Submitted. Pending approval (0/${r.need.counsellors}).`); location.hash = '#/requests'; };
  app.querySelector('#assign').onclick = async () => done(await api.requestAssignment(app.querySelector('#as-s').value, app.querySelector('#as-b').value, 'Buddy match requested by admin'));
  app.querySelector('#grant').onclick = async () => done(await api.requestRoleGrant(app.querySelector('#rg-u').value, app.querySelector('#rg-r').value, 'Role grant requested by admin'));
  app.querySelector('#offboard').onclick = async () => done(await api.requestOffboard(app.querySelector('#ob').value, 'Buddy has graduated / left the programme'));
}

async function adminRequests(s) {
  const all = await api.listRequests();
  await shell(s, 'requests', `
    <div><h1>Requests</h1><p class="muted">Nothing you submit takes effect until counsellors approve it.</p></div>
    <div class="list">${all.map((r) => `<div class="card">
      <div class="card-head"><h3>${esc(TYPE[r.type](r))}</h3>${statusPill(r)}</div>
      <div class="meta"><span>${esc(r.reason)}</span>·<span>${ago(r.at)}</span>${r.votes.map((v) => `·<span>${v.ok ? '✓' : '✗'} ${esc(v.name)}</span>`).join('')}</div>
      ${sourceTag(r)}</div>`).join('') || '<div class="empty">No requests.</div>'}</div>`);
}

// ---------- router ----------
async function render() {
  const s = await api.getSession();
  const [route, arg] = location.hash.replace(/^#\//, '').split('/');
  if (!s) return loginView();
  const views = {
    student: { reflect: studentReflect, notes: studentNotes, transparency: studentTransparency, alerts: studentAlerts },
    buddy: { cases: buddyCases, case: (s) => caseView(s, arg) },
    counsellor: { approvals, cases: counsellorCases, case: (s) => caseView(s, arg) },
    admin: { admin: adminView, requests: adminRequests },
  }[s.role];
  const v = views[route];
  if (!v) { location.hash = '#/' + ROUTES[s.role][0][0]; return; }
  try { await v(s); } catch (e) { app.innerHTML = `<div class="wrap"><div class="card"><h2>Something went wrong</h2><p class="muted">${esc(e.message)}</p><a href="#/">Go home</a></div></div>`; }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();
