import * as api from './api.js';

const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (name, fill) => `<span class="icon${fill ? ' fill' : ''}" aria-hidden="true">${name}</span>`;
const initials = (s) => s.replace(/^Student\s+/, '').split(/[\s-]+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
const ago = (t) => {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return 'Just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  if (d < 172800) return 'Yesterday';
  return Math.floor(d / 86400) + ' days ago';
};
const when = (t) => new Date(t).toLocaleString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

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
  student: [['reflect', 'favorite', 'Reflect'], ['notes', 'forum', 'Notes'], ['transparency', 'verified_user', 'Transparency'], ['alerts', 'notifications', 'Alerts']],
  buddy: [['students', 'group', 'Students'], ['escalations', 'shield_person', 'Escalations']],
  counsellor: [['approvals', 'how_to_vote', 'Approvals'], ['cases', 'folder_shared', 'Cases']],
  admin: [['admin', 'dashboard', 'Overview'], ['requests', 'pending_actions', 'Requests']],
};
const SUBTITLE = { student: null, buddy: (s) => `${s.firstName} (${s.title?.split('·')[0].trim()})`, counsellor: () => 'Counsellor Portal', admin: () => 'Safe Circle Node' };

function mockBar() {
  return api.MOCK ? `<div class="mockbar">Demo mode: synthetic data, no TideCloak connected yet. Nothing is really encrypted or enforced. <button data-act="reset">Reset demo</button></div>` : '';
}

function shell(s, current, body, badge = 0) {
  const nav = ROUTES[s.role].map(([r, ic, label]) =>
    `<a href="#/${r}" ${r === current ? 'aria-current="page"' : ''}>${icon(ic, r === current)}<span>${label}</span>${r === 'alerts' && badge ? `<span class="badge">${badge}</span>` : ''}</a>`).join('');
  const sub = SUBTITLE[s.role]?.(s);
  app.innerHTML = `
    ${mockBar()}
    <header class="topbar">
      <div class="brand"><span class="logo">${icon('lock', true)}</span><div><div>Safe Circle${s.role === 'buddy' ? ' <span class="online"></span>' : ''}</div>${sub ? `<div class="sub">${icon('verified', true)} ${esc(sub)}</div>` : ''}</div></div>
      <div class="right">
        <button class="sos" data-act="sos">${icon('emergency', true)} SOS</button>
        <button class="iconbtn" data-act="logout" title="Sign out" aria-label="Sign out">${icon('lock')}</button>
      </div>
    </header>
    <main class="wrap">${body}</main>
    <nav class="bottomnav"><div class="inner">${nav}</div></nav>`;
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
    <main class="wrap login">
      <div class="hero">
        <div class="hero-logo">${icon('lock', true)}<span class="hero-dot">${icon('shield', true)}</span></div>
        <h1>Welcome to Safe Circle</h1>
        <p class="muted">A safe, private space to talk with trained university peer buddies.</p>
        <div class="chips center"><span class="pill green">${icon('visibility_off')} Alias by default</span><span class="pill blue">${icon('how_to_vote')} Approval-gated access</span></div>
      </div>
      <section class="card">
        <div class="card-head small"><span><span class="dot"></span>Taylor's University · PCB</span><span class="pill outline">${icon('lock')} Protected by TideCloak</span></div>
        <label class="field">University account<div class="inputwrap">${icon('key')}<input type="text" value="student@sd.taylors.edu.my" readonly aria-label="University account" /></div></label>
        <p class="small muted">${icon('info')} You sign in with TideCloak. Buddies only ever see your alias, never your name.</p>
        <button class="btn primary block" id="tide">${icon('lock', true)} Sign in securely with TideCloak</button>
        <div class="userpick" id="pick" hidden>
          <p class="small muted">Demo: choose a synthetic user</p>
          ${users.map((u) => `<button class="btn ghost" data-user="${u.id}"><b>${esc(u.label)}</b>&nbsp;<span class="muted small">${u.role}</span></button>`).join('')}
        </div>
        <button class="btn soft" id="tour">${icon('explore')} Take a self-guided tour</button>
        <button class="linkbtn" data-act="sos">${icon('call')} View emergency crisis numbers without signing in</button>
      </section>
      <h3 class="section-title">${icon('shield', true)} Safe Circle privacy architecture</h3>
      <div class="list">
        <div class="feature"><span class="fi green">${icon('masks')}</span><div><h3>True peer privacy</h3><p class="small muted">Your real name is never shown in chats. Peer buddies only see your alias.</p></div></div>
        <div class="feature"><span class="fi blue">${icon('enhanced_encryption')}</span><div><h3>Encrypted notes</h3><p class="small muted">Notes are encrypted per student. Only you and your current, approved buddy hold the key to read them. Admins see ciphertext.</p></div></div>
        <div class="feature"><span class="fi amber">${icon('groups')}</span><div><h3>Dual-custody approvals</h3><p class="small muted">No single admin or staff member can give anyone access to your notes. Every grant needs independent approvals, and you're told.</p></div></div>
      </div>
      <div class="helpbox">
        <h3>${icon('support_agent', true)} Need immediate help?</h3>
        <p class="small muted">Crisis lines are open 24/7 and don't need a Safe Circle account.</p>
        <div class="chips center small"><a href="tel:999">${icon('call')} 999 Emergency</a><a href="tel:0376272929">${icon('call')} Befrienders KL</a><a href="tel:15555">${icon('call')} Talian HEAL 15555</a></div>
      </div>
    </main>`;
  // TIDECLOAK: the button should start the real TideCloak login. In demo mode it reveals the user picker.
  const reveal = () => { app.querySelector('#pick').hidden = false; app.querySelector('#pick').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  app.querySelector('#tide').onclick = reveal;
  app.querySelector('#tour').onclick = reveal;
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
  const person = (pp) => `<div class="link"><span></span><em>${icon('lock')} E2EE</em><span></span></div><div class="person"><div class="avatar ${pp.role === 'counsellor' ? 'amber' : 'green'}">${icon(pp.role === 'counsellor' ? 'medical_services' : 'psychology')}</div><b>${esc(pp.role === 'buddy' ? pp.name.split(' ')[0] : pp.name)}</b><span class="small muted">${esc(pp.role === 'buddy' ? 'Peer Buddy' : pp.title || pp.role)}</span></div>`;
  return `
    <section class="card">
      <div class="card-head"><div class="title">${icon('visibility')}<h2>Who can see this?</h2></div>${pill}</div>
      <div class="inset who">
        <div class="person"><div class="avatar">${icon('fingerprint')}</div><b>You</b><span class="small muted">Your Tide key</span></div>
        ${people.map(person).join('')}
      </div>
      <p class="small"><b>Your real name:</b> ${p.identity.length ? 'visible to ' + p.identity.map((x) => esc(x.name)).join(', ') : 'nobody but you. Everyone else sees ' + esc(s.displayName) + '.'}</p>
      <div class="note-box">${icon('verified_user')}<span>Anyone else needs <b>2 counsellor approvals</b> (a safety escalation needs your buddy + 1 counsellor), and you get an alert saying who and why.</span></div>
    </section>`;
}

async function studentReflect(s) {
  const notes = await api.listNotes(s.id);
  const panel = await whoCanSee(s);
  shell(s, 'reflect', `
    <div class="status"><span><span class="dot"></span>${esc(s.displayName)}</span><span class="pill green">${icon('shield')} Alias Mode Active</span></div>
    <div><h1>Hi, ${esc(s.displayName)}</h1>
      <p class="muted" style="margin-top:6px">Your notes can only be read by you and your current buddy. Your buddy only knows you by this alias.</p>
      <span class="pill outline" style="margin-top:10px">${icon('lock')} Protected by TideCloak</span></div>
    <section class="card">
      <div class="card-head"><div class="title"><span class="bubble">${icon('favorite')}</span><div><h2>Share what's on your heart</h2><p class="small muted">Private peer reflection</p></div></div>${icon('verified_user')}</div>
      <div><p class="small" style="margin-bottom:8px">Select a focus (optional):</p>
        <div class="chips">${FOCUS.map((f) => `<button class="chip" aria-pressed="false" data-focus="${f}">${f}</button>`).join('')}</div></div>
      <textarea id="note" placeholder="What's on your mind today? Share as much or as little as you like..."></textarea>
      <button class="btn primary block" id="send">${icon('lock')} Send privately to your Buddy</button>
      <p class="small muted center">${api.MOCK ? 'Demo: saved in this browser, not encrypted yet.' : 'Encrypted with TideCloak before it leaves your device.'}</p>
    </section>
    ${panel}
    <section class="card">
      <div class="card-head"><div class="title">${icon('history_edu')}<h2>Recent check-ins</h2></div><span class="small muted">${notes.length} saved</span></div>
      <div class="list">${notes.slice(0, 3).map((n) => `
        <a class="row clickable" href="#/notes">
          <span class="bubble sq">${icon(n.author === 'You' ? 'checklist' : 'psychology')}</span>
          <div class="grow"><h3>${esc(n.title)}</h3><div class="meta"><span>${ago(n.at)}</span>·<span class="ok">${icon('lock')} Sealed</span></div></div>
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
  return `<div class="row top">
    <span class="bubble sq">${icon(n.locked ? 'lock' : n.author === 'You' ? 'edit_note' : 'psychology')}</span>
    <div class="grow stack">
      ${n.locked
        ? `<h3>Encrypted note</h3><div class="cipher mono">${esc(n.cipher)}</div><p class="small muted">You don't hold this case's role, so this note can't be decrypted.</p>`
        : `<h3>${esc(n.title)}</h3><p>${esc(n.text)}</p>`}
      <div class="meta"><span>${esc(n.author)}</span>·<span>${ago(n.at)}</span>${n.tags.map((t) => `<span class="pill blue tiny">${esc(t)}</span>`).join('')}</div>
    </div></div>`;
}

async function studentNotes(s) {
  const notes = await api.listNotes(s.id);
  shell(s, 'notes', `
    <h1>Your notes</h1>
    <p class="muted">Notes from you and your buddy, newest first.</p>
    <div class="list">${notes.map(noteCard).join('') || '<div class="empty">No notes yet.</div>'}</div>
    <section class="card">
      <h3>Not matched with a buddy yet?</h3>
      <p class="small muted">Ask the PCB team for a buddy. They only see your alias.</p>
      <button class="btn ghost" id="req">${icon('person_add')} Request a buddy</button>
    </section>`, await unread(s));
  app.querySelector('#req').onclick = async () => { await api.requestBuddy(); toast('Request sent. A counsellor will review it.'); };
}

function statusPill(r) {
  if (r.status === 'approved') return `<span class="pill green">${icon('check_circle')} Approved ${r.have} of ${r.total}</span>`;
  if (r.status === 'rejected') return `<span class="pill red">${icon('cancel')} Declined</span>`;
  if (r.status === 'open') return `<span class="pill blue">${icon('inbox')} Received</span>`;
  return `<span class="pill amber">${icon('hourglass_top')} ${r.have} of ${r.total} approvals</span>`;
}

const TYPE = {
  assign: (r) => `Assign ${r.targetName} as buddy for ${r.caseLabel}`,
  escalate: (r) => `Escalate ${r.caseLabel} to a counsellor`,
  role: (r) => `Grant role "${r.roles.join(', ')}" to ${r.targetName}`,
  offboard: (r) => `Offboard buddy ${r.targetName}`,
  'buddy-request': (r) => `${r.caseLabel} asked for a buddy`,
};

function sourceTag(r) {
  return r.source === 'tidecloak'
    ? `<span class="pill green" title="Signed record from TideCloak">${icon('verified')} TideCloak record</span>`
    : `<span class="pill grey" title="Logged by this demo only, not tamper-proof">${icon('description')} App-logged (demo)</span>`;
}

// What the student sees in their timeline, in their words.
function storyOf(r) {
  const voters = r.votes.filter((v) => v.ok).map((v) => v.name).join(' & ');
  if (r.type === 'assign') return { icon: 'person_add', kind: 'buddy', title: `Your buddy ${r.targetName.split(' ')[0]} was assigned${r.status === 'approved' ? ' – approved by ' + voters : ''}` };
  if (r.type === 'escalate') return { icon: 'shield', kind: 'safety', title: r.status === 'approved' ? `Your case was shared with ${r.votes.filter((v) => v.by !== r.by && v.ok).map((v) => v.name).join(', ')} because your buddy was concerned for your safety` : 'Your buddy asked a counsellor for support', note: r.reason };
  if (r.type === 'offboard') return { icon: 'key_off', kind: 'buddy', title: `${r.targetName.split(' ')[0]} ${r.status === 'approved' ? 'has finished as a buddy; their access was removed' : 'is leaving the buddy programme'}` };
  return { icon: 'key', kind: 'safety', title: TYPE[r.type](r) };
}

async function studentTransparency(s) {
  const hist = (await api.getAccessHistory(s.id)).filter((r) => r.type !== 'buddy-request');
  const tab = sessionStorage.getItem('ttab') || 'all';
  const shown = hist.filter((r) => tab === 'all' || storyOf(r).kind === tab);
  shell(s, 'transparency', `
    <section class="card tint">
      <h2>You'll always know who can see your story</h2>
      <p class="small muted">Every access request, buddy pairing and crisis escalation needs approval and is logged here.</p>
      <span class="pill outline">${icon('sync')} ${api.MOCK ? 'Demo log (TideCloak not connected)' : 'Synced from TideCloak'}</span>
    </section>
    <div class="tabs" role="tablist">${[['all', `All activity (${hist.length})`], ['buddy', 'Buddy updates'], ['safety', 'Safety & approvals']].map(([k, l]) => `<button class="tab" role="tab" aria-selected="${k === tab}" data-tab="${k}">${l}</button>`).join('')}</div>
    <div class="timeline">${shown.map((r) => { const st = storyOf(r); return `
      <div class="tl-item">
        <span class="tl-icon ${st.kind === 'safety' ? 'amber' : 'green'}">${icon(st.icon, true)}</span>
        <div class="card tl-card">
          <div class="card-head small"><span class="muted">${when(r.at)}</span>${r.type === 'escalate' ? '<span class="pill amber">Safety escalation</span>' : statusPill(r)}</div>
          <p><b>${esc(st.title)}</b></p>
          ${st.note ? `<p class="small muted">Reason: "${esc(st.note)}"</p>` : ''}
          <div class="chips">${r.type === 'escalate' ? statusPill(r) : ''}${sourceTag(r)}</div>
        </div>
      </div>`; }).join('') || '<div class="empty">No access changes yet.</div>'}</div>
    ${await whoCanSee(s)}
    <section class="card tint">
      <h3>${icon('verified_user', true)} Your privacy rights at Safe Circle</h3>
      <p class="small muted">You can export this log at any time and ask the PCB team to review any access decision.</p>
      <button class="btn primary" id="export">${icon('download')} Export JSON log</button>
    </section>`, await unread(s));
  app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { sessionStorage.setItem('ttab', b.dataset.tab); render(); });
  app.querySelector('#export').onclick = () => {
    const blob = new Blob([JSON.stringify(hist, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'safe-circle-access-log.json' });
    a.click(); URL.revokeObjectURL(a.href);
  };
}

async function studentAlerts(s) {
  const items = await api.listNotifications();
  try { localStorage.setItem('seen-' + s.id, String(items.length)); } catch {}
  shell(s, 'alerts', `
    <h1>Alerts</h1>
    <p class="muted">You're told every time someone new gets access to your notes or your name.</p>
    <div class="list">${items.map((n) => `<div class="row top"><span class="bubble">${icon('notifications_active')}</span><div class="grow"><p>${esc(n.text)}</p><p class="small muted">${ago(n.at)}</p></div></div>`).join('') || '<div class="empty">No alerts.</div>'}</div>`, 0);
}

async function unread(s) {
  const n = (await api.listNotifications()).length;
  let seen = 0; try { seen = Number(localStorage.getItem('seen-' + s.id) || 0); } catch {}
  return Math.max(0, n - seen);
}

// ---------- buddy ----------
const BUDDY_TAGS = ['Grounding exercise', 'Follow-up tomorrow', 'Referred to campus support'];

async function buddyStudents(s) {
  const { active, cases } = await api.listMyCases();
  const pending = (await api.listMyEscalations()).filter((r) => r.status === 'pending');
  let sel = sessionStorage.getItem('bsel');
  if (!cases.some((c) => c.caseId === sel)) sel = cases[0]?.caseId;
  const c = cases.find((x) => x.caseId === sel);
  const notes = c ? await api.listNotes(c.caseId) : [];
  const lastStudent = notes.find((n) => n.author === c?.label && !n.locked);
  const escPending = pending.find((r) => r.caseId === sel);
  shell(s, 'students', `
    <div><h1>Hi ${esc(s.firstName)} – your circles today</h1>
      <p class="small muted" style="margin-top:6px">${cases.length} student peer${cases.length === 1 ? '' : 's'} assigned. You see students only by alias, and can read their notes only while you're their active buddy.</p></div>
    ${!active ? `<div class="card"><h3>${icon('block')} You're no longer an active buddy</h3><p class="muted">Your access to all cases has been removed.</p></div>` : ''}
    ${cases.length ? `<div class="section-head"><span class="label">Assigned students</span><span class="small link-blue">${cases.length} active</span></div>
    <div class="picker">${cases.map((x) => `
      <button class="pick ${x.caseId === sel ? 'on' : ''}" data-sel="${x.caseId}">
        <div class="pick-top"><b>${esc(x.label)}</b>${x.caseId === sel ? icon('check_circle', true) : icon('radio_button_unchecked')}</div>
        <span class="small muted">Last note ${x.lastAt ? ago(x.lastAt) : 'never'}</span>
        ${x.caseId === sel ? `<span class="pill blue tiny">${icon('center_focus_strong')} In focus</span>` : ''}
      </button>`).join('')}</div>` : (active ? '<div class="empty">No students assigned to you.</div>' : '')}
    ${c ? `
    <section class="card">
      <div class="card-head"><div class="title"><span class="avatar-sq">${initials(c.label)}</span><div><h2>${esc(c.label)}</h2><p class="small muted">${esc(c.info || '')}</p></div></div><span class="pill green">${icon('lock_open')} Unlocked for you</span></div>
      ${lastStudent ? `<div class="quote"><div class="card-head small"><span class="link-blue">${icon('auto_stories')} Latest self-reflection</span><span class="muted">${ago(lastStudent.at)}</span></div><p>"${esc(lastStudent.text)}"</p>${lastStudent.tags.length ? `<p class="small muted">Focus: ${lastStudent.tags.map(esc).join(', ')}</p>` : ''}</div>` : ''}
      <details><summary class="small link-blue">All notes (${notes.length})</summary><div class="list" style="margin-top:10px">${notes.map(noteCard).join('')}</div></details>
    </section>
    <section class="card">
      <div class="card-head"><h3>${icon('edit_note')} Write session note</h3><span class="small muted">Encrypted per case</span></div>
      <div class="chips">${BUDDY_TAGS.map((t) => `<button class="chip" aria-pressed="false" data-tag="${t}">${t}</button>`).join('')}</div>
      <textarea id="note" placeholder="Add confidential buddy notes (e.g. student responded warmly to the 5-4-3-2-1 breathing technique)..."></textarea>
      <button class="btn primary block" id="save">${icon('lock')} Save encrypted session note</button>
    </section>
    <section class="card danger-soft">
      <div class="card-head"><div><h3>${icon('medical_services')} Need clinical backup?</h3><p class="small muted">Escalating shares this case and the student's real name with a counsellor once 1 counsellor approves (your request + their sign-off). The student is told who and why.</p></div></div>
      ${escPending ? `<span class="pill amber">${icon('hourglass_top')} Escalation pending ${escPending.have} of ${escPending.total}</span>` : `<button class="btn danger" id="esc">${icon('priority_high')} Escalate to counsellor</button>`}
    </section>` : ''}`);

  app.querySelectorAll('[data-sel]').forEach((b) => b.onclick = () => { sessionStorage.setItem('bsel', b.dataset.sel); render(); });
  app.querySelectorAll('[data-tag]').forEach((b) => b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'));
  app.querySelector('#save')?.addEventListener('click', async () => {
    const t = app.querySelector('#note').value.trim();
    if (!t) return toast('Write a note first.');
    const tags = [...app.querySelectorAll('[data-tag][aria-pressed="true"]')].map((x) => x.dataset.tag);
    try { await api.addNote(c.caseId, t, tags); toast('Encrypted note saved.'); render(); } catch (e) { toast(e.message); }
  });
  app.querySelector('#esc')?.addEventListener('click', () => modal(`
    <h2>Escalate to a counsellor</h2>
    <p class="small muted">Use this when ${esc(c.label)} may be at serious risk. After 1 counsellor approves, they can read this case and see the student's real name.</p>
    <label class="field">Reason (the student will see this)<textarea id="why" placeholder="e.g. Reported persistent panic episodes during exam prep"></textarea></label>
    <div class="chips"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="go">Request escalation</button></div>`,
    (m, close) => m.querySelector('#go').onclick = async () => {
      const why = m.querySelector('#why').value.trim();
      if (!why) return toast('Add a reason.');
      await api.requestEscalation(c.caseId, why); close(); toast('Escalation sent: 1 of 2 approvals (yours).'); render();
    }));
}

async function buddyEscalations(s) {
  const list = await api.listMyEscalations();
  shell(s, 'escalations', `
    <h1>Escalations</h1>
    <p class="muted">Escalations you've raised. Each needs your request plus 1 counsellor.</p>
    <div class="list">${list.map((r) => `<div class="card">
      <div class="card-head"><h3>${esc(r.caseLabel)} <span class="muted small">${r.ref}</span></h3>${statusPill(r)}</div>
      <p class="small">"${esc(r.reason)}"</p>
      <div class="meta">${ago(r.at)}${r.votes.map((v) => ` · ${v.ok ? '✓' : '✗'} ${esc(v.name)}`).join('')}</div>
      ${sourceTag(r)}</div>`).join('') || '<div class="empty">No escalations.</div>'}</div>`);
}

// ---------- counsellor ----------
const BADGE = {
  escalate: '<span class="pill red">' + icon('warning') + ' Urgent – student at risk</span>',
  assign: '<span class="pill green">' + icon('group_add') + ' Peer assignment</span>',
  role: '<span class="pill blue">' + icon('key') + ' Role grant</span>',
  offboard: '<span class="pill grey">' + icon('person_remove') + ' Buddy offboarding</span>',
};

async function approvals(s) {
  const all = (await api.listRequests()).filter((r) => r.type !== 'buddy-request');
  const asks = (await api.listRequests()).filter((r) => r.type === 'buddy-request');
  const tab = sessionStorage.getItem('apptab') || 'pending';
  const counts = { pending: 0, approved: 0, rejected: 0 };
  all.forEach((r) => { if (r.status in counts) counts[r.status]++; });
  const shown = all.filter((r) => r.status === tab);
  shell(s, 'approvals', `
    <div class="card-head"><h1>Approvals Queue</h1><span class="pill blue">${counts.pending} Pending</span></div>
    <p class="small muted">Reviewing peer escalations and pairings. No one can approve alone, and you can't approve a change for yourself.</p>
    <div class="tabs full" role="tablist">${[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([k, l]) => `<button class="tab" role="tab" aria-selected="${k === tab}" data-tab="${k}">${l} (${counts[k]})</button>`).join('')}</div>
    <div class="list">${shown.map((r) => {
      const voted = r.votes.some((v) => v.by === s.id);
      const blocked = r.target === s.id;
      const chain = r.votes.map((v) => `<span class="pill ${v.ok ? 'green' : 'red'} tiny">${icon(v.ok ? 'check_circle' : 'cancel', true)} ${esc(v.name)}</span>`).join(icon('arrow_forward'));
      return `<div class="card ${r.type === 'escalate' && r.status === 'pending' ? 'urgent' : ''}">
        <div class="card-head small">${BADGE[r.type]}<span class="muted">${ago(r.at)}</span></div>
        <div class="card-head"><div><h2>${esc(r.type === 'role' || r.type === 'offboard' ? r.targetName : r.caseLabel)} <span class="ref">${r.ref}</span></h2>
          <p class="small muted">${r.type === 'escalate' ? icon('lock') + ' Case shared only after approval' : r.type === 'assign' ? 'Recommended buddy: <b>' + esc(r.targetName) + '</b>' : esc(TYPE[r.type](r))}</p></div>
          <div class="small right-txt muted">Requested by<br><b class="link-blue">${esc(r.byName)}</b></div></div>
        <div class="quote"><p>"${esc(r.reason)}"</p></div>
        <div class="progress ${r.status === 'pending' ? '' : 'done'}">
          <div class="card-head small"><span>${icon('group')} ${r.have} of ${r.total} approvals recorded</span><span class="muted">Dual-custody lock</span></div>
          ${chain ? `<div class="chips">${chain}</div>` : ''}
        </div>
        ${r.status === 'pending' ? (voted ? '<p class="small muted">You\'ve signed. Waiting for the next approver.</p>'
          : blocked ? '<p class="small muted">This change is for you, so you can\'t approve it.</p>'
          : `<div class="two"><button class="btn primary" data-vote="${r.id}" data-ok="1">${icon('verified_user')} Approve</button><button class="btn ghost" data-vote="${r.id}" data-ok="0">Decline</button></div>`) : ''}
        ${sourceTag(r)}
      </div>`;
    }).join('') || '<div class="empty">Nothing here.</div>'}</div>
    ${asks.length ? `<section class="card"><h3>Buddy requests from students</h3><div class="list">${asks.map((r) => `<div class="row"><div class="grow">${esc(r.caseLabel)} <span class="muted small">· ${ago(r.at)}</span></div><span class="small muted">Admin submits the match</span></div>`).join('')}</div></section>` : ''}
    <div class="helpbox"><p class="small muted">${icon('lock')} Every decision is recorded. No single counsellor can approve alone.</p></div>`);
  app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { sessionStorage.setItem('apptab', b.dataset.tab); render(); });
  app.querySelectorAll('[data-vote]').forEach((b) => b.onclick = async () => {
    try {
      const r = await api.vote(b.dataset.vote, b.dataset.ok === '1');
      toast(r.status === 'approved' ? 'Approved. Access change applied.' : r.status === 'rejected' ? 'Declined.' : `Signed (${r.have} of ${r.total}).`);
      render();
    } catch (e) { toast(e.message); }
  });
}

async function counsellorCases(s, arg) {
  const cases = await api.listEscalatedCases();
  const c = cases.find((x) => x.caseId === arg);
  if (c) {
    const notes = await api.listNotes(c.caseId);
    return shell(s, 'cases', `
      <a href="#/cases" class="small muted">← All cases</a>
      <h1>${esc(c.label)}</h1>
      <div class="note-box">${icon('info')}<span>You can see this case because an escalation was approved. The student has been told.</span></div>
      <div class="list">${notes.map(noteCard).join('')}</div>`);
  }
  shell(s, 'cases', `
    <h1>Escalated cases</h1><p class="muted">Only cases where an escalation you approved went through.</p>
    <div class="list">${cases.map((x) => `<a class="row clickable" href="#/cases/${x.caseId}"><span class="bubble">${icon('medical_services')}</span><div class="grow"><h3>${esc(x.label)}</h3></div>${icon('chevron_right')}</a>`).join('') || '<div class="empty">No escalated cases.</div>'}</div>`);
}

// ---------- admin ----------
async function adminView(s) {
  const o = await api.adminOverview();
  const reqs = (await api.listRequests()).filter((r) => r.status === 'pending');
  const first = reqs.find((r) => r.by === s.id) || reqs[0];
  shell(s, 'admin', `
    <section class="card tint">
      <div class="title"><span class="bubble">${icon('admin_panel_settings')}</span><h2>System admin – you manage the system, not the stories</h2></div>
      <p class="small muted">You can create accounts and submit requests. You can't read notes, see who's behind an alias, or grant access on your own.</p>
      <span class="pill outline">${icon('lock')} Protected by TideCloak</span>
    </section>
    <section class="card warn">
      <div class="card-head"><h3>${icon('warning', true)} Multi-sig guard</h3><span class="pill amber">${reqs.length} pending</span></div>
      <p class="small">${first ? `Pending: <b>${esc(TYPE[first.type](first))}</b> needs ${first.total} counsellor approvals (Dr Lim, Ms Tan). You can't approve it yourself.` : 'Any role or access change you request needs 2 counsellor approvals (Dr Lim, Ms Tan). You can\'t approve it yourself.'}</p>
      ${first ? `<div class="card-head small"><span>${first.have} of ${first.total} signed</span><a class="btn primary sm" href="#/requests">View pending (${reqs.length})</a></div>` : ''}
    </section>
    <button class="btn primary block" id="open">${icon('group_add')} Assign buddy / Request role <span class="pill tiny" style="background:#ffffff33;color:#fff">Multi-sig</span></button>
    <section class="card">
      <div class="card-head"><h2>Directory summary</h2><span class="pill grey">${o.users.length} entities</span></div>
      <p class="small muted">Students appear only as aliases. Real names are stored encrypted and aren't visible to admins.</p>
      <div class="list">${o.users.map((u) => `<div class="row">
        <span class="avatar-sq ${u.role}">${initials(u.label)}</span>
        <div class="grow"><b>${esc(u.label)}</b><div class="small muted">${u.role === 'student' ? icon('lock') + ' Alias only' : esc(u.role)}</div></div>
        ${u.role === 'student' ? '<span class="pill green tiny">Alias only</span>' : u.role === 'buddy' ? (u.active ? `<span class="pill blue tiny">${u.roles.length} assigned</span>` : '<span class="pill red tiny">Offboarded</span>') : u.role === 'counsellor' ? '<span class="pill amber tiny">Co-signer</span>' : '<span class="pill grey tiny">Supervised</span>'}
      </div>`).join('')}</div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Stored notes</h2><span class="pill grey">${icon('lock')} Ciphertext only</span></div>
      <p class="small muted">This is exactly what the database holds. Admins can't decrypt it.</p>
      <div class="list">${o.notes.map((n) => `<div class="cipherbox"><div class="card-head small"><span class="mono">case: ${esc(n.caseLabel)}</span><span class="muted">${ago(n.at)}</span></div><div class="mono">${esc(n.cipher)}</div></div>`).join('')}</div>
    </section>`);

  app.querySelector('#open').onclick = () => modal(`
    <h2>Submit a request</h2>
    <p class="small muted">Nothing takes effect until 2 counsellors approve.</p>
    <label class="field">Assign buddy to student
      <select id="as-s">${o.students.map((x) => `<option value="${x.id}">${esc(x.alias)}</option>`).join('')}</select>
      <select id="as-b">${o.buddies.filter((b) => b.active).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
    <button class="btn primary" id="assign">${icon('person_add')} Request assignment</button>
    <label class="field">Grant a role
      <select id="rg-u">${o.users.map((x) => `<option value="${x.id}">${esc(x.label)}</option>`).join('')}</select>
      <select id="rg-r"><option>counsellor</option><option>buddy</option>${o.students.map((x) => `<option value="case-${x.id}">case access: ${esc(x.alias)}</option>`).join('')}</select></label>
    <button class="btn primary" id="grant">${icon('key')} Request role grant</button>
    <label class="field">Offboard a buddy
      <select id="ob">${o.buddies.filter((b) => b.active).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
    <button class="btn danger" id="offboard">${icon('person_remove')} Request offboarding</button>
    <button class="btn ghost" data-close>Cancel</button>`, (m, close) => {
    const done = (r) => { close(); toast(`Submitted. Pending approval (0 of ${r.total}).`); location.hash = '#/requests'; };
    m.querySelector('#assign').onclick = async () => done(await api.requestAssignment(m.querySelector('#as-s').value, m.querySelector('#as-b').value, 'Buddy match requested by admin'));
    m.querySelector('#grant').onclick = async () => done(await api.requestRoleGrant(m.querySelector('#rg-u').value, m.querySelector('#rg-r').value, 'Role grant requested by admin'));
    m.querySelector('#offboard').onclick = async () => done(await api.requestOffboard(m.querySelector('#ob').value, 'Buddy has graduated / left the programme'));
  });
}

async function adminRequests(s) {
  const all = (await api.listRequests()).filter((r) => r.type !== 'buddy-request');
  shell(s, 'requests', `
    <h1>Requests</h1><p class="muted">Nothing you submit takes effect until counsellors approve it.</p>
    <div class="list">${all.map((r) => `<div class="card">
      <div class="card-head small">${BADGE[r.type]}${statusPill(r)}</div>
      <h3>${esc(TYPE[r.type](r))}</h3>
      <div class="meta"><span>${esc(r.reason)}</span>·<span>${ago(r.at)}</span>${r.votes.map((v) => `·<span>${v.ok ? '✓' : '✗'} ${esc(v.name)}</span>`).join('')}</div>
      ${sourceTag(r)}</div>`).join('') || '<div class="empty">No requests.</div>'}</div>`);
}

// ---------- router ----------
let seq = 0;
async function render() {
  const my = ++seq;
  const s = await api.getSession();
  const [route, arg] = location.hash.replace(/^#\//, '').split('/');
  if (!s) return loginView();
  const views = {
    student: { reflect: studentReflect, notes: studentNotes, transparency: studentTransparency, alerts: studentAlerts },
    buddy: { students: buddyStudents, escalations: buddyEscalations },
    counsellor: { approvals, cases: (s) => counsellorCases(s, arg) },
    admin: { admin: adminView, requests: adminRequests },
  }[s.role];
  const v = views[route];
  if (!v) { location.hash = '#/' + ROUTES[s.role][0][0]; return; }
  try { await v(s); } catch (e) { if (my !== seq) return; app.innerHTML = `<div class="wrap"><div class="card"><h2>Something went wrong</h2><p class="muted">${esc(e.message)}</p><a href="#/">Go home</a></div></div>`; }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();
