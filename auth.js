// Bounma AI auth (Supabase). Loaded after the main script.
(function () {
  const C = window.BOUNMA_CONFIG || {};
  if (!(C.url && C.key && window.supabase)) { console.warn('Supabase not configured: running in guest (local-only) mode.'); return; }
  const sb = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, autoRefreshToken: true } });
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RL = { admin: 'Admin', teacher: 'ຄູ', student: 'ນັກຮຽນ' }, ST = { pending: 'ລໍຖ້າອະນຸມັດ', approved: 'ອະນຸມັດແລ້ວ', rejected: 'ຖືກປະຕິເສດ' };
  const IN = 'w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm';
  const GUEST = 'bounmaAI_v3_progress';
  let me = null, profile = null, pushTimer = null;

  function gate(html) {
    let g = $('auth-gate');
    if (!g) { g = document.createElement('div'); g.id = 'auth-gate'; g.className = 'fixed inset-0 z-[60] bg-slate-950 overflow-y-auto flex items-center justify-center p-4'; document.body.appendChild(g); }
    g.innerHTML = `<div class="app-card rounded-3xl p-6 w-full max-w-md space-y-4"><div class="flex items-center gap-3"><img src="assets/bounma-mascot.png" class="w-12 h-12 object-contain" alt=""><div><h1 class="font-extrabold text-xl">ບຸນມາ AI</h1><p class="text-xs text-slate-400">ແພລດຟອມຮຽນຮູ້ AI</p></div></div>${html}</div>`;
    g.classList.remove('hidden');
  }
  const setMsg = t => { const m = $('a-msg'); if (m) m.textContent = t; };
  function errText(e) {
    const m = (e && e.message) || '';
    if (/invalid login/i.test(m)) return 'ອີເມວ ຫຼືລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ';
    if (/not confirmed/i.test(m)) return 'ຍັງບໍ່ໄດ້ຢືນຢັນອີເມວ ກະລຸນາກວດກ່ອງຈົດໝາຍ';
    if (/rate limit|too many/i.test(m)) return 'ພະຍາຍາມຫຼາຍເກີນໄປ ກະລຸນາລໍຖ້າສັກຄູ່ ແລ້ວລອງໃໝ່';
    if (/password/i.test(m)) return 'ລະຫັດຜ່ານບໍ່ເໝາະສົມ (ຢ່າງໜ້ອຍ 8 ຕົວ)';
    return 'ເກີດຂໍ້ຜິດພາດ: ' + m;
  }
  function showAuth(mode, msg) {
    const reg = mode === 'register';
    gate(`<div class="flex gap-2"><button onclick="BAuth.mode('login')" class="chip ${reg ? '' : 'chip-on'}">ເຂົ້າສູ່ລະບົບ</button><button onclick="BAuth.mode('register')" class="chip ${reg ? 'chip-on' : ''}">ສະໝັກໃໝ່</button></div>
      <form onsubmit="event.preventDefault();BAuth.submit('${mode}')" class="space-y-3">
      ${reg ? `<input id="a-name" class="${IN}" placeholder="ຊື່-ນາມສະກຸນ" required maxlength="80" autocomplete="name"><select id="a-role" class="${IN}" aria-label="ບົດບາດ"><option value="student">ນັກຮຽນ</option><option value="teacher">ຄູ</option></select>` : ''}
      <input id="a-email" type="email" class="${IN}" placeholder="ອີເມວ" required autocomplete="email">
      <input id="a-pass" type="password" class="${IN}" placeholder="ລະຫັດຜ່ານ (ຢ່າງໜ້ອຍ 8 ຕົວ)" required minlength="8" autocomplete="${reg ? 'new-password' : 'current-password'}">
      <button id="a-btn" class="w-full bg-orange-600 hover:bg-orange-500 rounded-xl py-3 font-bold text-sm">${reg ? 'ສະໝັກ' : 'ເຂົ້າສູ່ລະບົບ'}</button></form>
      ${reg ? '<p class="text-xs text-slate-400">ຫຼັງສະໝັກ ຕ້ອງລໍຖ້າ Admin ອະນຸມັດກ່ອນຈຶ່ງເຂົ້າໃຊ້ງານໄດ້.</p>' : ''}
      <p id="a-msg" class="text-sm text-amber-300" aria-live="polite">${esc(msg || '')}</p>`);
  }
  async function submit(mode) {
    const email = $('a-email').value.trim(), password = $('a-pass').value, btn = $('a-btn');
    btn.disabled = true; setMsg('ກຳລັງດຳເນີນການ...');
    try {
      if (mode === 'register') {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: $('a-name').value.trim(), role: $('a-role').value }, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (!data.session) showAuth('login', 'ສະໝັກສຳເລັດ! ກະລຸນາກວດອີເມວເພື່ອຢືນຢັນ ແລ້ວເຂົ້າສູ່ລະບົບ. ຈາກນັ້ນລໍຖ້າ Admin ອະນຸມັດ.');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error;
      }
    } catch (e) { setMsg(errText(e)); btn.disabled = false; }
  }
  const logout = () => sb.auth.signOut();

  // ----- session handling -----
  async function onSession(session) {
    if (!session) { me = null; profile = null; cleanupUI(); progressKey = GUEST; renderProgress(); showAuth('login'); return; }
    me = session.user;
    const { data, error } = await sb.from('profiles').select('*').eq('id', me.id).maybeSingle();
    if (error || !data) { gate(`<p class="text-sm text-amber-300">ບໍ່ພົບໂປຣໄຟລ໌ຜູ້ໃຊ້. ກະລຸນາຕິດຕໍ່ Admin.</p><button onclick="BAuth.logout()" class="bg-slate-700 px-4 py-2 rounded-xl text-sm">ອອກຈາກລະບົບ</button>`); return; }
    profile = data;
    if (data.status !== 'approved') {
      gate(`<p class="font-bold">${data.status === 'pending' ? '⏳ ບັນຊີລໍຖ້າ Admin ອະນຸມັດ' : '⛔ ບັນຊີຖືກປະຕິເສດ'}</p><p class="text-sm text-slate-300">${esc(data.email)} • ${RL[data.role] || ''}</p><div class="flex gap-2"><button onclick="BAuth.refresh()" class="bg-orange-600 px-4 py-2 rounded-xl text-sm font-bold">ກວດສະຖານະອີກຄັ້ງ</button><button onclick="BAuth.logout()" class="bg-slate-700 px-4 py-2 rounded-xl text-sm">ອອກຈາກລະບົບ</button></div>`);
      return;
    }
    const g = $('auth-gate'); if (g) g.classList.add('hidden');
    progressKey = GUEST + '_' + me.id; buildUI(); await syncProgress();
  }
  const refresh = async () => { const { data } = await sb.auth.getSession(); onSession(data.session); };

  // ----- role UI -----
  function addTab(id, icon, label) {
    if (!$('sec-' + id)) { const s = document.createElement('section'); s.id = 'sec-' + id; s.className = 'tab-content hidden space-y-6'; document.querySelector('main').appendChild(s); }
    if (!$('tab-btn-' + id)) {
      const d = document.createElement('button'); d.id = 'tab-btn-' + id; d.className = 'tab-btn py-3 px-3 text-center border-b-2 border-transparent text-slate-400 hover:text-slate-200 text-sm'; d.textContent = icon + ' ' + label; d.onclick = () => switchTab(id);
      document.querySelector('header nav > div').appendChild(d);
      const m = document.createElement('button'); m.id = 'mob-tab-' + id; m.className = 'flex-shrink-0 px-3 py-1 text-slate-400'; m.innerHTML = icon + '<br>' + esc(label); m.onclick = () => switchTab(id);
      document.querySelector('nav.fixed').appendChild(m);
    }
  }
  function buildUI() {
    const hdr = document.querySelector('header .max-w-6xl');
    let chip = $('user-chip'); if (!chip) { chip = document.createElement('div'); chip.id = 'user-chip'; chip.className = 'flex items-center gap-2 text-xs'; hdr.appendChild(chip); }
    chip.innerHTML = `<span class="hidden sm:inline text-slate-300">${esc(profile.full_name || profile.email)} · <b class="text-orange-400">${RL[profile.role]}</b></span><button onclick="BAuth.logout()" class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">ອອກ</button>`;
    if (profile.role === 'admin') addTab('admin', '👑', 'ຜູ້ໃຊ້');
    if (profile.role === 'admin' || profile.role === 'teacher') addTab('teacher', '👩‍🏫', 'ນັກຮຽນ');
  }
  function cleanupUI() { ['user-chip', 'tab-btn-admin', 'mob-tab-admin', 'sec-admin', 'tab-btn-teacher', 'mob-tab-teacher', 'sec-teacher'].forEach(i => { const e = $(i); if (e) e.remove(); }); }
  const head = (t, s) => `<div class="border-b border-slate-800 pb-4"><h2 class="text-2xl font-bold">${t}</h2><p class="text-sm text-slate-400 mt-1">${s}</p></div>`;

  async function loadAdmin() {
    const box = $('sec-admin'); if (!box) return;
    box.innerHTML = head('👑 ຈັດການຜູ້ໃຊ້', 'ອະນຸມັດ ປະຕິເສດ ແລະກຳນົດບົດບາດ') + '<p class="text-sm text-slate-400">ກຳລັງໂຫຼດ...</p>';
    const { data, error } = await sb.from('profiles').select('*');
    if (error) { box.innerHTML += `<p class="text-sm text-red-300">${esc(error.message)}</p>`; return; }
    const ord = { pending: 0, approved: 1, rejected: 2 }; data.sort((a, b) => (ord[a.status] - ord[b.status]) || String(b.created_at).localeCompare(String(a.created_at)));
    const pend = data.filter(u => u.status === 'pending').length;
    box.innerHTML = head('👑 ຈັດການຜູ້ໃຊ້', `ທັງໝົດ ${data.length} ຄົນ • ລໍຖ້າອະນຸມັດ ${pend} ຄົນ`) + '<div class="space-y-3">' + data.map(u => { const self = u.id === me.id;
      return `<div class="app-card rounded-2xl p-4 flex flex-wrap items-center gap-3 justify-between"><div class="min-w-0"><p class="font-bold text-sm truncate">${esc(u.full_name || '-')}${self ? ' (ຂ້ອຍ)' : ''}</p><p class="text-xs text-slate-400 truncate">${esc(u.email)}</p></div>
      <div class="flex flex-wrap items-center gap-2"><span class="chip">${ST[u.status] || esc(u.status)}</span>
      <select aria-label="ບົດບາດ" ${self ? 'disabled' : ''} onchange="BAuth.upd('${esc(u.id)}',{role:this.value})" class="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">${['student', 'teacher', 'admin'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${RL[r]}</option>`).join('')}</select>
      ${u.status !== 'approved' ? `<button onclick="BAuth.upd('${esc(u.id)}',{status:'approved'})" class="bg-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold">ອະນຸມັດ</button>` : ''}
      ${u.status !== 'rejected' && !self ? `<button onclick="BAuth.upd('${esc(u.id)}',{status:'rejected'})" class="bg-red-900/70 px-3 py-1.5 rounded-lg text-xs">ປະຕິເສດ</button>` : ''}</div></div>`; }).join('') + '</div>';
  }
  async function upd(id, patch) {
    if (id === me.id) return;
    const { error } = await sb.from('profiles').update(patch).eq('id', id);
    showToast(error ? 'ບໍ່ສຳເລັດ: ' + error.message : 'ບັນທຶກແລ້ວ'); loadAdmin();
  }
  async function loadTeacher() {
    const box = $('sec-teacher'); if (!box) return;
    box.innerHTML = head('👩‍🏫 ຄວາມຄືບໜ້ານັກຮຽນ', 'ເບິ່ງບົດຮຽນ ແລະຄະແນນຂອງນັກຮຽນທີ່ອະນຸມັດແລ້ວ') + '<p class="text-sm text-slate-400">ກຳລັງໂຫຼດ...</p>';
    const [p, g] = await Promise.all([sb.from('profiles').select('id,full_name,email').eq('role', 'student').eq('status', 'approved'), sb.from('progress').select('*')]);
    if (p.error || g.error) { box.innerHTML += `<p class="text-sm text-red-300">${esc((p.error || g.error).message)}</p>`; return; }
    const m = {}; g.data.forEach(r => m[r.user_id] = r); const total = LESSONS.length;
    const rows = p.data.map(u => { const r = m[u.id] || {}; return `<tr class="border-t border-slate-800"><td class="py-2 pr-3"><p class="font-bold">${esc(u.full_name || '-')}</p><p class="text-xs text-slate-400">${esc(u.email)}</p></td><td class="pr-3">${(r.lessons || []).length}/${total}</td><td class="pr-3">${r.score == null ? '-' : r.score + '%'}</td><td class="pr-3">${r.best == null ? '-' : r.best + '%'}</td><td>${r.attempts || 0}</td></tr>`; }).join('');
    box.innerHTML = head('👩‍🏫 ຄວາມຄືບໜ້ານັກຮຽນ', `ນັກຮຽນ ${p.data.length} ຄົນ`) + `<div class="app-card rounded-2xl p-4 overflow-x-auto"><table class="w-full text-sm text-left"><thead class="text-xs text-slate-400"><tr><th class="pb-2">ນັກຮຽນ</th><th>ບົດຮຽນ</th><th>ຫຼ້າສຸດ</th><th>ສູງສຸດ</th><th>ຄັ້ງ</th></tr></thead><tbody>${rows || '<tr><td class="py-3 text-slate-400" colspan="5">ຍັງບໍ່ມີນັກຮຽນ</td></tr>'}</tbody></table></div>`;
  }
  const _st = switchTab; switchTab = function (t) { _st(t); if (t === 'admin') loadAdmin(); if (t === 'teacher') loadTeacher(); };

  // ----- cloud progress sync (merge, never lose local) -----
  const _sp = saveProgress;
  saveProgress = function (d) { _sp(d); if (!me || !profile || profile.status !== 'approved') return; clearTimeout(pushTimer); pushTimer = setTimeout(push, 800); };
  async function push() {
    const d = getProgress();
    const { error } = await sb.from('progress').upsert({ user_id: me.id, lessons: d.lessons, score: d.score, best: d.best, attempts: d.attempts, updated_at: new Date().toISOString() });
    if (error) console.warn('progress sync failed', error.message);
  }
  async function syncProgress() {
    const { data } = await sb.from('progress').select('*').eq('user_id', me.id).maybeSingle(), l = getProgress();
    if (data) saveProgress({ lessons: [...new Set([...(data.lessons || []), ...l.lessons])].filter(x => LESSONS.some(z => z.id === x)), score: l.score != null ? l.score : data.score, best: Math.max(l.best || 0, data.best || 0) || null, attempts: Math.max(l.attempts || 0, data.attempts || 0) });
    else saveProgress(l);
    renderProgress();
  }

  window.BAuth = { mode: showAuth, submit, logout, refresh, upd };
  gate('<p class="text-sm text-slate-400">ກຳລັງໂຫຼດ...</p>');
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'TOKEN_REFRESHED') return;
    if (ev === 'SIGNED_IN' && me && session && session.user.id === me.id && profile && profile.status === 'approved') return; // tab refocus
    setTimeout(() => onSession(session), 0); // never await supabase calls inside this callback
  });
})();
