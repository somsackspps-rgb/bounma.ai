// Bounma AI auth (Supabase) v3.2. Loaded after the main script.
(function () {
  const C = window.BOUNMA_CONFIG || {};
  if (!(C.url && C.key && window.supabase)) { console.warn('Supabase not configured: running in guest (local-only) mode.'); return; }
  const sb = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RL = { admin: 'Admin', teacher: 'ຄູ', student: 'ນັກຮຽນ' }, ST = { pending: 'ລໍຖ້າອະນຸມັດ', approved: 'ອະນຸມັດແລ້ວ', rejected: 'ຖືກປະຕິເສດ' };
  const IN = 'w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-emerald-500/70';
  const GUEST = 'bounmaAI_v3_progress';
  const LOGO = 'assets/bounma-mascot-128.png';
  let me = null, profile = null, pushTimer = null, seq = 0, busy = false, recovering = false, pollTimer = null;

  // ================= Animated AI-circuit background (canvas) =================
  const Circuit = (function () {
    const G = 40, DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    let cv, ctx, base, W = 0, H = 0, dpr = 1, paths = [], pulses = [], raf = 0, last = 0, rt = 0;
    const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = a => a[Math.floor(Math.random() * a.length)];

    function makePath(cols, rows) {
      let x = Math.floor(Math.random() * cols), y = Math.floor(Math.random() * rows), di = Math.floor(Math.random() * 8);
      const pts = [[x * G, y * G]], steps = 4 + Math.floor(Math.random() * 7);
      for (let s = 0; s < steps; s++) {
        const run = 1 + Math.floor(Math.random() * 4), d = DIRS[di];
        x += d[0] * run; y += d[1] * run; pts.push([x * G, y * G]);
        di = (di + pick([-2, -1, 1, 2]) + 8) % 8;
      }
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      return { pts, cum, total: cum[cum.length - 1] };
    }
    function posAt(p, d) {
      let i = 1; while (i < p.cum.length - 1 && p.cum[i] < d) i++;
      const t = (d - p.cum[i - 1]) / ((p.cum[i] - p.cum[i - 1]) || 1), a = p.pts[i - 1], b = p.pts[i];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    function drawBase() {
      base = document.createElement('canvas'); base.width = W * dpr; base.height = H * dpr;
      const b = base.getContext('2d'); b.scale(dpr, dpr);
      b.lineCap = 'round'; b.lineJoin = 'round';
      // traces
      paths.forEach(p => {
        b.strokeStyle = 'rgba(34,197,94,0.13)'; b.lineWidth = 1.2; b.beginPath();
        p.pts.forEach((q, i) => i ? b.lineTo(q[0], q[1]) : b.moveTo(q[0], q[1])); b.stroke();
        [p.pts[0], p.pts[p.pts.length - 1]].forEach((q, k) => {
          b.strokeStyle = 'rgba(34,197,94,0.22)'; b.beginPath(); b.arc(q[0], q[1], k ? 3.2 : 2.2, 0, 6.2832); b.stroke();
          if (!k) { b.fillStyle = 'rgba(34,197,94,0.18)'; b.fill(); }
        });
      });
      // chips (processing units)
      const chips = Math.max(3, Math.round(W * H / 90000));
      for (let c = 0; c < chips; c++) {
        const s = pick([2, 3]) * G, x = Math.round(rnd(0, W - s) / G) * G, y = Math.round(rnd(0, H - s) / G) * G;
        b.strokeStyle = 'rgba(34,197,94,0.16)'; b.lineWidth = 1.2; b.strokeRect(x, y, s, s);
        b.strokeStyle = 'rgba(34,197,94,0.09)'; b.strokeRect(x + 8, y + 8, s - 16, s - 16);
        b.fillStyle = 'rgba(34,197,94,0.07)'; b.fillRect(x + s / 2 - 5, y + s / 2 - 5, 10, 10);
        for (let k = 1; k < s / G * 2; k++) { const o = k * G / 2; [[x + o, y - 6, x + o, y], [x + o, y + s, x + o, y + s + 6], [x - 6, y + o, x, y + o], [x + s, y + o, x + s + 6, y + o]].forEach(l => { b.beginPath(); b.moveTo(l[0], l[1]); b.lineTo(l[2], l[3]); b.stroke(); }); }
      }
    }
    function build() {
      const r = cv.getBoundingClientRect(); W = Math.max(320, Math.round(r.width)); H = Math.max(320, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = W * dpr; cv.height = H * dpr; ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.ceil(W / G), rows = Math.ceil(H / G), n = Math.min(44, Math.round(cols * rows / 26));
      paths = Array.from({ length: n }, () => makePath(cols, rows));
      pulses = Array.from({ length: Math.max(6, Math.round(n / 2.2)) }, () => ({ p: pick(paths), d: -rnd(0, 300), v: rnd(55, 130) }));
      drawBase(); frame(0, true);
    }
    function frame(ts, once) {
      ctx.clearRect(0, 0, W, H); ctx.drawImage(base, 0, 0, W, H);
      if (reduce()) return;
      const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
      pulses.forEach(u => {
        u.d += u.v * dt;
        if (u.d > u.p.total + 90) { u.p = pick(paths); u.d = -rnd(0, 240); u.v = rnd(55, 130); }
        if (u.d < 0) return;
        for (let k = 0; k < 9; k++) { // fading tail
          const d = Math.min(u.p.total, u.d) - k * 7; if (d < 0) break; const q = posAt(u.p, d);
          ctx.fillStyle = 'rgba(74,222,128,' + (0.34 * (1 - k / 9)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(q[0], q[1], 2.1 - k * 0.12, 0, 6.2832); ctx.fill();
        }
        if (u.d <= u.p.total) { const h = posAt(u.p, u.d), g = ctx.createRadialGradient(h[0], h[1], 0, h[0], h[1], 11); g.addColorStop(0, 'rgba(134,239,172,0.55)'); g.addColorStop(1, 'rgba(34,197,94,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h[0], h[1], 11, 0, 6.2832); ctx.fill(); }
      });
      if (!once && raf) raf = requestAnimationFrame(frame);
    }
    function start() { if (!cv || raf || reduce()) return; last = 0; raf = requestAnimationFrame(frame); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    return {
      init(c) {
        cv = c; build();
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (cv && cv.isConnected) { const was = raf; stop(); build(); if (was) start(); } }, 200); });
        document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (cv && cv.isConnected && !$('auth-gate').classList.contains('hidden')) start(); });
      }, start, stop
    };
  })();

  // ================= Gate (login overlay) =================
  function setAppInert(on) { document.querySelectorAll('header, main, footer, nav.fixed').forEach(e => { try { e.inert = on; } catch (_) {} if (on) e.setAttribute('aria-hidden', 'true'); else e.removeAttribute('aria-hidden'); }); }
  function ensureGate() {
    let g = $('auth-gate');
    if (!g) {
      const st = document.createElement('style');
      st.textContent = '#auth-card,#auth-card:hover{transform:none!important}#auth-card input:focus{outline:none;box-shadow:0 0 0 3px rgba(34,197,94,.18)}@keyframes authIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}#auth-card>*{animation:authIn .35s ease both}.spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:sp .7s linear infinite;vertical-align:-2px;margin-right:6px}@keyframes sp{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
      g = document.createElement('div'); g.id = 'auth-gate'; g.className = 'fixed inset-0 z-[60] bg-slate-950 overflow-y-auto';
      g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-label', 'ເຂົ້າສູ່ລະບົບ');
      g.innerHTML = '<canvas id="auth-bg" aria-hidden="true" class="fixed inset-0 w-full h-full pointer-events-none"></canvas><div aria-hidden="true" class="fixed inset-0 pointer-events-none" style="background:radial-gradient(ellipse at 50% 45%,rgba(2,6,23,.05),rgba(2,6,23,.7) 85%)"></div><div class="relative min-h-full flex items-center justify-center p-4"><div id="auth-card" class="app-card rounded-3xl p-6 w-full max-w-md space-y-4 border-emerald-500/15"></div></div>';
      document.body.appendChild(g); Circuit.init($('auth-bg'));
    }
    return g;
  }
  function gate(html, focusId) {
    const g = ensureGate();
    $('auth-card').innerHTML = `<div class="flex items-center gap-3"><img src="${LOGO}" class="w-12 h-12 object-contain" alt=""><div><h1 class="font-extrabold text-xl">ບຸນມາ AI</h1><p class="text-xs text-slate-400">ແພລດຟອມຮຽນຮູ້ AI</p></div></div>${html}`;
    g.classList.remove('hidden'); document.body.style.overflow = 'hidden'; setAppInert(true); Circuit.start();
    if (focusId && $(focusId)) $(focusId).focus({ preventScroll: true });
  }
  function hideGate() { const g = $('auth-gate'); if (g) g.classList.add('hidden'); document.body.style.overflow = ''; setAppInert(false); Circuit.stop(); clearInterval(pollTimer); pollTimer = null; }
  const setMsg = (t, ok) => { const m = $('a-msg'); if (m) { m.textContent = t; m.className = 'text-sm ' + (ok ? 'text-emerald-300' : 'text-amber-300'); } };
  const isNet = e => /failed to fetch|networkerror|load failed|network request/i.test((e && e.message) || '') || !navigator.onLine;
  function errText(e) {
    const m = (e && e.message) || '';
    if (isNet(e)) return 'ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້ ກະລຸນາກວດອິນເຕີເນັດ ແລ້ວລອງໃໝ່';
    if (/invalid login/i.test(m)) return 'ອີເມວ ຫຼືລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ';
    if (/not confirmed/i.test(m)) return 'ຍັງບໍ່ໄດ້ຢືນຢັນອີເມວ ກະລຸນາກວດກ່ອງຈົດໝາຍ';
    if (/already registered|already been registered/i.test(m)) return 'ອີເມວນີ້ມີບັນຊີແລ້ວ ກະລຸນາເຂົ້າສູ່ລະບົບ';
    if (/rate limit|too many|seconds/i.test(m)) return 'ພະຍາຍາມຫຼາຍເກີນໄປ ກະລຸນາລໍຖ້າສັກຄູ່ ແລ້ວລອງໃໝ່';
    if (/same as the old|different from the old/i.test(m)) return 'ລະຫັດຜ່ານໃໝ່ຕ້ອງແຕກຕ່າງຈາກລະຫັດເກົ່າ';
    if (/password/i.test(m)) return 'ລະຫັດຜ່ານບໍ່ເໝາະສົມ (ຢ່າງໜ້ອຍ 8 ຕົວ)';
    return 'ເກີດຂໍ້ຜິດພາດ: ' + m;
  }
  const pwField = (id, ph, ac) => `<div class="relative"><input id="${id}" type="password" class="${IN} pr-16" placeholder="${ph}" required minlength="8" autocomplete="${ac}"><button type="button" onclick="BAuth.toggle()" class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-emerald-300 px-2 py-1" aria-label="ສະແດງ ຫຼືເຊື່ອງລະຫັດຜ່ານ">ສະແດງ</button></div>`;
  function showAuth(mode, msg, ok) {
    const reg = mode === 'register', fg = mode === 'forgot', rs = mode === 'reset';
    const tabs = (reg || mode === 'login') ? `<div class="flex gap-2"><button type="button" onclick="BAuth.mode('login')" class="chip ${reg ? '' : 'chip-on'}">ເຂົ້າສູ່ລະບົບ</button><button type="button" onclick="BAuth.mode('register')" class="chip ${reg ? 'chip-on' : ''}">ສະໝັກໃໝ່</button></div>` : `<h2 class="font-bold">${rs ? 'ຕັ້ງລະຫັດຜ່ານໃໝ່' : 'ລືມລະຫັດຜ່ານ'}</h2>`;
    const label = rs ? 'ບັນທຶກລະຫັດຜ່ານໃໝ່' : fg ? 'ສົ່ງລິ້ງຕັ້ງລະຫັດຜ່ານ' : reg ? 'ສະໝັກ' : 'ເຂົ້າສູ່ລະບົບ';
    gate(`${tabs}
      <form onsubmit="event.preventDefault();BAuth.submit('${mode}')" class="space-y-3" novalidate>
      ${reg ? `<input id="a-name" class="${IN}" placeholder="ຊື່-ນາມສະກຸນ" required maxlength="80" autocomplete="name"><select id="a-role" class="${IN}" aria-label="ບົດບາດ"><option value="student">ນັກຮຽນ</option><option value="teacher">ຄູ</option></select>` : ''}
      ${rs ? '' : `<input id="a-email" type="email" class="${IN}" placeholder="ອີເມວ" required autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false">`}
      ${fg ? '' : pwField('a-pass', rs ? 'ລະຫັດຜ່ານໃໝ່ (ຢ່າງໜ້ອຍ 8 ຕົວ)' : 'ລະຫັດຜ່ານ (ຢ່າງໜ້ອຍ 8 ຕົວ)', reg || rs ? 'new-password' : 'current-password')}
      ${(reg || rs) ? `<input id="a-pass2" type="password" class="${IN}" placeholder="ຢືນຢັນລະຫັດຜ່ານ" required minlength="8" autocomplete="new-password">` : ''}
      <button id="a-btn" type="submit" class="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 rounded-xl py-3 font-bold text-sm">${label}</button></form>
      ${mode === 'login' ? `<button type="button" onclick="BAuth.mode('forgot')" class="text-xs text-slate-400 hover:text-emerald-300 underline">ລືມລະຫັດຜ່ານ?</button>` : ''}
      ${fg ? `<button type="button" onclick="BAuth.mode('login')" class="text-xs text-slate-400 hover:text-emerald-300 underline">← ກັບຄືນ</button>` : ''}
      ${reg ? '<p class="text-xs text-slate-400">ຫຼັງສະໝັກ ຕ້ອງລໍຖ້າ Admin ອະນຸມັດກ່ອນຈຶ່ງເຂົ້າໃຊ້ງານໄດ້.</p>' : ''}
      <p id="a-msg" class="text-sm ${ok ? 'text-emerald-300' : 'text-amber-300'}" role="status" aria-live="polite">${esc(msg || '')}</p>`, rs ? 'a-pass' : (reg ? 'a-name' : 'a-email'));
  }
  function toggle() { ['a-pass', 'a-pass2'].forEach(id => { const i = $(id); if (i) i.type = i.type === 'password' ? 'text' : 'password'; }); const b = document.querySelector('#auth-card button[aria-label^="ສະແດງ"]'); const p = $('a-pass'); if (b && p) b.textContent = p.type === 'password' ? 'ສະແດງ' : 'ເຊື່ອງ'; }
  async function submit(mode) {
    if (busy) return;
    const val = id => ($(id) ? $(id).value : ''), email = val('a-email').trim(), password = val('a-pass'), btn = $('a-btn'), label = btn.textContent;
    if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMsg('ກະລຸນາໃສ່ອີເມວໃຫ້ຖືກຕ້ອງ');
    if (mode !== 'forgot' && password.length < 8) return setMsg('ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 8 ຕົວ');
    if ((mode === 'register' || mode === 'reset') && password !== val('a-pass2')) return setMsg('ລະຫັດຜ່ານທັງສອງຊ່ອງບໍ່ກົງກັນ');
    if (mode === 'register' && !val('a-name').trim()) return setMsg('ກະລຸນາໃສ່ຊື່-ນາມສະກຸນ');
    busy = true; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>ກຳລັງດຳເນີນການ...'; setMsg('');
    try {
      if (mode === 'register') {
        // A registration is a separate identity flow. Clear any prior local session
        // so the previous account cannot remain attached to the new registration.
        const { data: existingSession } = await sb.auth.getSession();
        if (existingSession && existingSession.session) {
          const { error: clearError } = await sb.auth.signOut({ scope: 'local' });
          if (clearError) throw clearError;
        }
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: val('a-name').trim(), role: val('a-role') === 'teacher' ? 'teacher' : 'student' }, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('User already registered');
        if (data.session) {
          const { error: clearNewSessionError } = await sb.auth.signOut({ scope: 'local' });
          if (clearNewSessionError) throw clearNewSessionError;
        }
        showAuth('login', 'ສະໝັກສຳເລັດ! ກະລຸນາຢືນຢັນອີເມວ (ຖ້າລະບົບກຳນົດ) ແລ້ວລໍຖ້າ Admin ອະນຸມັດ.', true);
      } else if (mode === 'forgot') {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error;
        showAuth('login', 'ຖ້າອີເມວນີ້ມີໃນລະບົບ ເຮົາໄດ້ສົ່ງລິ້ງຕັ້ງລະຫັດຜ່ານໃໝ່ໃຫ້ແລ້ວ ກະລຸນາກວດອີເມວ.', true);
      } else if (mode === 'reset') {
        const { error } = await sb.auth.updateUser({ password }); if (error) throw error;
        recovering = false; showToast('ປ່ຽນລະຫັດຜ່ານແລ້ວ'); await refresh();
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error;
      }
    } catch (e) { const b2 = $('a-btn'); if (b2) { b2.disabled = false; b2.textContent = label; } setMsg(errText(e)); }
    busy = false;
  }
  const logout = async () => {
    if (busy) return;
    try {
      const { error } = await sb.auth.signOut({ scope: 'local' });
      if (error) throw error;
      // The SIGNED_OUT event normally updates the screen; refresh explicitly
      // as a fallback for browsers where the event is delayed.
      me = null; profile = null; seq++; clearTimeout(pushTimer);
      cleanupUI(); hideGate(); progressKey = GUEST; renderProgress(); showAuth('login');
    } catch (e) {
      console.error('Logout failed:', e);
      showToast('ອອກຈາກລະບົບບໍ່ສຳເລັດ: ' + (e.message || 'ກະລຸນາລອງໃໝ່'));
    }
  };

  // ================= Session handling (race-safe) =================
  const retryBtns = '<div class="flex gap-2"><button onclick="BAuth.refresh()" class="bg-emerald-700 px-4 py-2 rounded-xl text-sm font-bold">ລອງໃໝ່</button><button onclick="BAuth.logout()" class="bg-slate-700 px-4 py-2 rounded-xl text-sm">ອອກຈາກລະບົບ</button></div>';
  async function fetchProfile(uid) { try { return await sb.from('profiles').select('*').eq('id', uid).maybeSingle(); } catch (e) { return { error: e }; } }
  async function onSession(session) {
    const my = ++seq;
    if (!session) { me = null; profile = null; clearTimeout(pushTimer); hideGate(); cleanupUI(); progressKey = GUEST; renderProgress(); showAuth('login'); return; }
    if (me && me.id !== session.user.id) profile = null;
    me = session.user;
    if (!profile) gate('<p class="text-sm text-slate-400"><span class="spin"></span>ກຳລັງໂຫຼດ...</p>');
    const { data, error } = await fetchProfile(me.id);
    if (my !== seq) return; // a newer session event superseded this one
    if (error) { gate(`<p class="text-sm text-amber-300">${esc(isNet(error) ? 'ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້ ກະລຸນາກວດອິນເຕີເນັດ' : 'ໂຫຼດໂປຣໄຟລ໌ບໍ່ສຳເລັດ: ' + error.message)}</p>${retryBtns}`); return; }
    if (!data) { gate(`<p class="text-sm text-amber-300">ບໍ່ພົບໂປຣໄຟລ໌ຜູ້ໃຊ້. ກະລຸນາຕິດຕໍ່ Admin.</p>${retryBtns}`); return; }
    if (data.status === undefined) { gate(`<p class="text-sm text-amber-300">ຖານຂໍ້ມູນຍັງຕັ້ງຄ່າບໍ່ຄົບ (ບໍ່ມີຖັນ status). ໃຫ້ Admin ຣັນໄຟລ໌ supabase_setup.sql ໃນ Supabase.</p>${retryBtns}`); return; }
    profile = data;
    if (data.status !== 'approved') {
      cleanupUI();
      gate(`<p class="font-bold">${data.status === 'pending' ? '⏳ ບັນຊີລໍຖ້າ Admin ອະນຸມັດ' : '⛔ ບັນຊີຖືກປະຕິເສດ'}</p><p class="text-sm text-slate-300">${esc(data.email)} • ${RL[data.role] || ''}</p>${data.status === 'pending' ? '<p class="text-xs text-slate-400">ໜ້ານີ້ກວດສະຖານະອັດຕະໂນມັດທຸກ 20 ວິນາທີ.</p>' : ''}<div class="flex gap-2"><button onclick="BAuth.refresh()" class="bg-emerald-700 px-4 py-2 rounded-xl text-sm font-bold">ກວດສະຖານະອີກຄັ້ງ</button><button onclick="BAuth.logout()" class="bg-slate-700 px-4 py-2 rounded-xl text-sm">ອອກຈາກລະບົບ</button></div>`);
      clearInterval(pollTimer); if (data.status === 'pending') pollTimer = setInterval(() => { if (!document.hidden) refresh(); }, 20000);
      return;
    }
    hideGate(); progressKey = GUEST + '_' + me.id; buildUI();
    try { await syncProgress(); } catch (e) { console.warn('progress sync failed', e); renderProgress(); }
  }
  const refresh = async () => { try { const { data } = await sb.auth.getSession(); await onSession(data.session); } catch (e) { console.warn(e); } };

  // ================= Role UI =================
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
    chip.innerHTML = `<span class="hidden sm:inline text-slate-300">${esc(profile.full_name || profile.email)} · <b class="text-orange-400">${RL[profile.role] || ''}</b></span><button onclick="BAuth.logout()" class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">ອອກ</button>`;
    if (profile.role === 'admin') addTab('admin', '👑', 'ຜູ້ໃຊ້');
    if (profile.role === 'admin' || profile.role === 'teacher') addTab('teacher', '👩‍🏫', 'ນັກຮຽນ');
    addTab('classroom', '💬', 'ຫ້ອງຮຽນ');
    const dash = $('sec-dashboard'); if (dash) { let h = $('dash-hello'); if (!h) { h = document.createElement('p'); h.id = 'dash-hello'; h.className = 'text-lg font-bold'; dash.insertBefore(h, dash.firstChild); } h.textContent = 'ສະບາຍດີ, ' + (profile.full_name || profile.email) + ' 👋'; }
    if (location.hash === '#admin' && profile.role === 'admin') switchTab('admin'); else if (location.hash === '#teacher' && profile.role !== 'student') switchTab('teacher');
  }
  function cleanupUI() { ['user-chip', 'dash-hello', 'tab-btn-admin', 'mob-tab-admin', 'sec-admin', 'tab-btn-teacher', 'mob-tab-teacher', 'sec-teacher', 'tab-btn-classroom', 'mob-tab-classroom', 'sec-classroom'].forEach(i => { const e = $(i); if (e) e.remove(); }); }
  const head = (t, s) => `<div class="border-b border-slate-800 pb-4"><h2 class="text-2xl font-bold">${t}</h2><p class="text-sm text-slate-400 mt-1">${s}</p></div>`;

  // ----- Admin panel -----
  let adminData = [], adminFilter = 'pending', adminQ = '', updating = false;
  const ord = { pending: 0, approved: 1, rejected: 2 }, rank = s => (s in ord ? ord[s] : 3);
  async function loadAdmin() {
    const box = $('sec-admin'); if (!box) return;
    box.innerHTML = head('👑 ຈັດການຜູ້ໃຊ້', 'ອະນຸມັດ ປະຕິເສດ ແລະກຳນົດບົດບາດ') + '<p class="text-sm text-slate-400"><span class="spin"></span>ກຳລັງໂຫຼດ...</p>';
    let res; try { res = await sb.from('profiles').select('*'); } catch (e) { res = { error: e }; }
    if (res.error) { box.innerHTML = head('👑 ຈັດການຜູ້ໃຊ້', '') + `<p class="text-sm text-red-300">${esc(isNet(res.error) ? 'ເຊື່ອມຕໍ່ບໍ່ໄດ້' : res.error.message)}</p><button onclick="BAuth.reload()" class="chip mt-2">ລອງໃໝ່</button>`; return; }
    adminData = res.data || [];
    if (adminData.length && adminData[0].status === undefined) { box.innerHTML = head('👑 ຈັດການຜູ້ໃຊ້', '') + '<p class="text-sm text-red-300">ຖານຂໍ້ມູນບໍ່ມີຖັນ status — ກະລຸນາຣັນ supabase_setup.sql ກ່ອນ.</p>'; return; }
    box.innerHTML = head('👑 ຈັດການຜູ້ໃຊ້', '<span id="adm-sub"></span>') + `<div class="flex flex-wrap gap-2 items-center"><div id="adm-filters" class="flex flex-wrap gap-2"></div><input id="adm-q" type="search" placeholder="ຄົ້ນຫາຊື່ ຫຼືອີເມວ" oninput="BAuth.search(this.value)" class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm flex-1 min-w-[160px]"></div><div id="adm-list" class="space-y-3"></div>`;
    $('adm-q').value = adminQ; renderAdminList();
  }
  function renderAdminList() {
    const list = $('adm-list'); if (!list) return;
    const cnt = s => adminData.filter(u => s === 'all' || u.status === s).length;
    $('adm-sub').textContent = `ທັງໝົດ ${adminData.length} ຄົນ • ລໍຖ້າອະນຸມັດ ${cnt('pending')} ຄົນ`;
    $('adm-filters').innerHTML = [['pending', 'ລໍຖ້າ'], ['approved', 'ອະນຸມັດແລ້ວ'], ['rejected', 'ຖືກປະຕິເສດ'], ['all', 'ທັງໝົດ']].map(f => `<button onclick="BAuth.filter('${f[0]}')" class="chip ${adminFilter === f[0] ? 'chip-on' : ''}">${f[1]} (${cnt(f[0])})</button>`).join('');
    const q = adminQ.trim().toLowerCase();
    const rows = adminData.filter(u => (adminFilter === 'all' || u.status === adminFilter) && (!q || (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)))
      .sort((a, b) => (rank(a.status) - rank(b.status)) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
    list.innerHTML = rows.length ? rows.map(u => { const self = u.id === me.id;
      return `<div class="app-card rounded-2xl p-4 flex flex-wrap items-center gap-3 justify-between"><div class="min-w-0"><p class="font-bold text-sm truncate">${esc(u.full_name || '-')}${self ? ' (ຂ້ອຍ)' : ''}</p><p class="text-xs text-slate-400 truncate">${esc(u.email)}</p></div>
      <div class="flex flex-wrap items-center gap-2"><span class="chip">${ST[u.status] || esc(u.status)}</span>
      <select aria-label="ບົດບາດ" ${self || updating ? 'disabled' : ''} onchange="BAuth.upd('${esc(u.id)}',{role:this.value})" class="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">${['student', 'teacher', 'admin'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${RL[r]}</option>`).join('')}</select>
      ${u.status !== 'approved' ? `<button ${updating ? 'disabled' : ''} onclick="BAuth.upd('${esc(u.id)}',{status:'approved'})" class="bg-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold">ອະນຸມັດ</button>` : ''}
      ${u.status !== 'rejected' && !self ? `<button ${updating ? 'disabled' : ''} onclick="BAuth.upd('${esc(u.id)}',{status:'rejected'})" class="bg-red-900/70 px-3 py-1.5 rounded-lg text-xs">ປະຕິເສດ</button>` : ''}</div></div>`; }).join('')
      : '<p class="text-sm text-slate-400 py-6 text-center">ບໍ່ມີລາຍການ</p>';
  }
  async function upd(id, patch) {
    if (updating || !me || id === me.id) { renderAdminList(); return; }
    const u = adminData.find(x => x.id === id) || {};
    if (patch.role === 'admin' && !confirm('ແຕ່ງຕັ້ງ ' + (u.email || '') + ' ເປັນ Admin? Admin ມີສິດຈັດການຜູ້ໃຊ້ທັງໝົດ.')) { renderAdminList(); return; }
    if (patch.status === 'rejected' && !confirm('ປະຕິເສດບັນຊີ ' + (u.email || '') + ' ?')) { renderAdminList(); return; }
    updating = true; renderAdminList();
    let res; try { res = await sb.from('profiles').update(patch).eq('id', id).select('id,role,status'); } catch (e) { res = { error: e }; }
    updating = false;
    if (res.error) showToast('ບໍ່ສຳເລັດ: ' + (isNet(res.error) ? 'ເຊື່ອມຕໍ່ບໍ່ໄດ້' : res.error.message));
    else if (!res.data || !res.data.length) showToast('ບໍ່ສຳເລັດ: ບໍ່ມີສິດແກ້ໄຂ (ກວດ RLS / ຣັນ supabase_setup.sql)');
    else { Object.assign(u, res.data[0]); showToast('ບັນທຶກແລ້ວ'); }
    renderAdminList();
  }

  // ----- Teacher panel -----
  async function loadTeacher() {
    const box = $('sec-teacher'); if (!box) return;
    box.innerHTML = head('👩‍🏫 ຄວາມຄືບໜ້ານັກຮຽນ', 'ເບິ່ງບົດຮຽນ ແລະຄະແນນຂອງນັກຮຽນທີ່ອະນຸມັດແລ້ວ') + '<p class="text-sm text-slate-400"><span class="spin"></span>ກຳລັງໂຫຼດ...</p>';
    let p, g; try { [p, g] = await Promise.all([sb.from('profiles').select('id,full_name,email').eq('role', 'student').eq('status', 'approved'), sb.from('progress').select('*')]); } catch (e) { p = { error: e }; g = {}; }
    if (p.error || g.error) { box.innerHTML += `<p class="text-sm text-red-300">${esc((p.error || g.error).message)}</p>`; return; }
    const m = {}; (g.data || []).forEach(r => m[r.user_id] = r); const total = LESSONS.length;
    const rows = p.data.map(u => { const r = m[u.id] || {}; return `<tr class="border-t border-slate-800"><td class="py-2 pr-3"><p class="font-bold">${esc(u.full_name || '-')}</p><p class="text-xs text-slate-400">${esc(u.email)}</p></td><td class="pr-3">${(r.lessons || []).length}/${total}</td><td class="pr-3">${r.score == null ? '-' : r.score + '%'}</td><td class="pr-3">${r.best == null ? '-' : r.best + '%'}</td><td>${r.attempts || 0}</td></tr>`; }).join('');
    box.innerHTML = head('👩‍🏫 ຄວາມຄືບໜ້ານັກຮຽນ', `ນັກຮຽນ ${p.data.length} ຄົນ`) + `<div class="app-card rounded-2xl p-4 overflow-x-auto"><table class="w-full text-sm text-left"><thead class="text-xs text-slate-400"><tr><th class="pb-2">ນັກຮຽນ</th><th>ບົດຮຽນ</th><th>ຫຼ້າສຸດ</th><th>ສູງສຸດ</th><th>ຄັ້ງ</th></tr></thead><tbody>${rows || '<tr><td class="py-3 text-slate-400" colspan="5">ຍັງບໍ່ມີນັກຮຽນ</td></tr>'}</tbody></table></div>`;
  }
  const _st = switchTab; switchTab = function (t) { _st(t); if (t === 'admin') loadAdmin(); if (t === 'teacher') loadTeacher(); };


  // ================= Classrooms & real-time group chat =================
  let roomRows = [], activeRoom = null, roomChannel = null, messageRows = [], roomBusy = false;
  const ROOM_BUCKET = 'classroom-files';
  const initials = n => (String(n || '?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || '?');
  const fmtTime = v => { try { return new Date(v).toLocaleString('lo-LA',{dateStyle:'short',timeStyle:'short'}); } catch (_) { return v || ''; } };
  function roomShell() {
    let box = $('sec-classroom');
    if (!box) { box=document.createElement('section'); box.id='sec-classroom'; box.className='tab-content hidden space-y-6'; document.querySelector('main').appendChild(box); }
    return box;
  }
  async function loadClassroom() {
    const box=roomShell();
    box.innerHTML=head('💬 ຫ້ອງຮຽນ','ຫ້ອງສົນທະນາ ແລະການຮຽນຮ່ວມກັນ')+'<p class="text-sm text-slate-400"><span class="spin"></span> ກຳລັງໂຫຼດຫ້ອງຮຽນ...</p>';
    const {data,error}=await sb.from('classroom_groups').select('id,name,description,join_code,created_by,created_at').order('created_at',{ascending:false});
    if(error){box.innerHTML=head('💬 ຫ້ອງຮຽນ','')+`<p class="text-sm text-red-300">ໂຫຼດຫ້ອງຮຽນບໍ່ສຳເລັດ: ${esc(error.message)}. ກວດວ່າໄດ້ຣັນ SQL ສ່ວນ Classroom ແລ້ວ.</p>`;return;}
    roomRows=data||[];
    const canTeach=profile && ['teacher','admin'].includes(profile.role);
    box.innerHTML=head('💬 ຫ້ອງຮຽນ',canTeach?'ສ້າງກຸ່ມ ແລະຈັດການການສົນທະນາ':'ໃສ່ລະຫັດທີ່ຄູສົ່ງໃຫ້ ເພື່ອເຂົ້າກຸ່ມ')+
      `<form id="avatar-form" class="app-card rounded-2xl p-3 flex flex-wrap items-center gap-3"><div class="w-11 h-11 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center font-bold">${profile.avatar_url?`<img src="${esc(profile.avatar_url)}" class="w-full h-full object-cover">`:esc(initials(profile.full_name))}</div><div class="flex-1 min-w-[150px]"><p class="text-sm font-bold">ຮູບໂປຣໄຟລ໌</p><p class="text-xs text-slate-400">ຮູບ JPG, PNG ຫຼື WebP ບໍ່ເກີນ 2 MB</p><input id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp" class="text-xs mt-1"></div><button class="chip">ບັນທຶກຮູບ</button></form>`+
      (canTeach?`<form id="room-create" class="app-card rounded-2xl p-4 space-y-3"><h3 class="font-bold">＋ ສ້າງກຸ່ມຮຽນ</h3><input id="room-name" class="${IN}" maxlength="80" placeholder="ຊື່ກຸ່ມ / ຫົວຂໍ້ຫ້ອງຮຽນ" required><textarea id="room-desc" class="${IN}" rows="2" maxlength="300" placeholder="ລາຍລະອຽດ (ບໍ່ບັງຄັບ)"></textarea><button class="bg-orange-600 hover:bg-orange-500 rounded-xl px-4 py-2 text-sm font-bold">ສ້າງກຸ່ມ</button></form>`:'')+
      `<form id="room-join" class="app-card rounded-2xl p-4 flex flex-wrap gap-2"><input id="room-code" class="${IN} flex-1 min-w-[180px]" placeholder="ລະຫັດເຂົ້າກຸ່ມ" maxlength="12" required><button class="bg-emerald-700 rounded-xl px-4 py-2 text-sm font-bold">ເຂົ້າກຸ່ມ</button></form><div id="room-list" class="grid md:grid-cols-2 gap-3"></div><div id="room-chat"></div>`;
    $('avatar-form').onsubmit=uploadAvatar;
    if(canTeach) $('room-create').onsubmit=createRoom;
    $('room-join').onsubmit=joinRoom;
    renderRoomList();
  }
  async function uploadAvatar(ev){
    ev.preventDefault(); const file=$('avatar-file').files[0]; if(!file)return showToast('ກະລຸນາເລືອກຮູບກ່ອນ');
    if(file.size>2*1024*1024)return showToast('ຮູບຕ້ອງມີຂະໜາດບໍ່ເກີນ 2 MB');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))return showToast('ຮອງຮັບ JPG, PNG ແລະ WebP');
    const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg', path=me.id+'/avatar.'+ext;
    const {error:upErr}=await sb.storage.from('profile-avatars').upload(path,file,{upsert:true,contentType:file.type});
    if(upErr)return showToast('ອັບໂຫຼດຮູບບໍ່ສຳເລັດ: '+upErr.message);
    const {data}=sb.storage.from('profile-avatars').getPublicUrl(path);
    const avatarUrl=data.publicUrl+'?v='+Date.now();
    const {error}=await sb.from('profiles').update({avatar_url:avatarUrl}).eq('id',me.id);
    if(error)return showToast('ບັນທຶກຮູບບໍ່ສຳເລັດ: '+error.message);
    profile.avatar_url=avatarUrl; showToast('ອັບเดດຮູບໂປຣໄຟລ໌ແລ້ວ'); await loadClassroom();
    if(activeRoom){const id=activeRoom.id; openRoom(id);}
  }
  async function createRoom(ev){
    ev.preventDefault(); if(roomBusy)return; roomBusy=true;
    const name=$('room-name').value.trim(), description=$('room-desc').value.trim();
    const {data,error}=await sb.from('classroom_groups').insert({name,description,created_by:me.id}).select('id,name,join_code').single();
    roomBusy=false;
    if(error){showToast('ສ້າງກຸ່ມບໍ່ສຳເລັດ: '+error.message);return;}
    showToast('ສ້າງກຸ່ມແລ້ວ • ລະຫັດ: '+data.join_code);
    await loadClassroom(); openRoom(data.id);
  }
  async function joinRoom(ev){
    ev.preventDefault(); const code=$('room-code').value.trim().toUpperCase(); if(!code)return;
    const {data,error}=await sb.rpc('join_classroom_by_code',{p_code:code});
    if(error){showToast('ເຂົ້າກຸ່ມບໍ່ສຳເລັດ: '+error.message);return;}
    showToast('ເຂົ້າກຸ່ມຮຽນແລ້ວ'); await loadClassroom(); if(data) openRoom(data);
  }
  function renderRoomList(){
    const el=$('room-list'); if(!el)return;
    el.innerHTML=roomRows.length?roomRows.map(r=>`<button type="button" onclick="BAuth.openRoom('${r.id}')" class="app-card rounded-2xl p-4 text-left hover:border-orange-500/50 border border-slate-700"><div class="font-bold">${esc(r.name)}</div><p class="text-xs text-slate-400 mt-1">${esc(r.description||'ບໍ່ມີລາຍລະອຽດ')}</p>${profile.role!=='student'?`<p class="text-xs text-orange-300 mt-2">ລະຫັດເຊີນ: <b>${esc(r.join_code||'')}</b></p>`:''}</button>`).join(''):'<p class="text-sm text-slate-400">ທ່ານຍັງບໍ່ມີກຸ່ມຮຽນ</p>';
  }
  async function openRoom(id){
    const r=roomRows.find(x=>x.id===id); if(!r)return;
    activeRoom=r; messageRows=[];
    if(roomChannel){await sb.removeChannel(roomChannel);roomChannel=null;}
    const chat=$('room-chat'); if(!chat)return;
    chat.innerHTML=`<div class="app-card rounded-2xl p-4 space-y-3"><div class="flex flex-wrap justify-between gap-2"><div><h3 class="font-bold text-lg">${esc(r.name)}</h3><p class="text-xs text-slate-400">${esc(r.description||'')}</p></div>${profile.role!=='student'?`<button onclick="BAuth.announce()" class="chip">📢 ປະກາດ</button>`:''}</div><div id="room-messages" class="space-y-3 max-h-[55vh] overflow-y-auto p-2 bg-slate-950/50 rounded-xl"><p class="text-sm text-slate-400">ກຳລັງໂຫຼດຂໍ້ຄວາມ...</p></div><form id="room-send" class="space-y-2"><textarea id="room-text" class="${IN}" rows="2" maxlength="4000" placeholder="ພິມຂໍ້ຄວາມ..." ></textarea><div class="flex flex-wrap items-center justify-between gap-2"><label class="text-xs text-slate-400">ແນບຮູບພາບ / PDF <input id="room-file" type="file" accept="image/*,application/pdf" class="block text-xs mt-1"></label><button class="bg-emerald-700 rounded-xl px-5 py-2 text-sm font-bold">ສົ່ງ</button></div></form></div>`;
    $('room-send').onsubmit=sendMessage;
    await loadMessages();
    roomChannel=sb.channel('room-updates-'+me.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'group_messages'},payload=>{
      if(payload.new.sender_id!==me.id){notifyMessage(payload.new); if(activeRoom && payload.new.group_id===activeRoom.id) loadMessages();}
    }).subscribe();
  }
  async function loadMessages(){
    if(!activeRoom)return;
    const {data,error}=await sb.from('group_messages').select('id,group_id,sender_id,body,message_type,attachment_path,created_at,profiles(full_name,avatar_url)').eq('group_id',activeRoom.id).order('created_at',{ascending:true}).limit(200);
    const el=$('room-messages'); if(!el)return;
    if(error){el.innerHTML=`<p class="text-sm text-red-300">${esc(error.message)}</p>`;return;}
    messageRows=data||[];
    const rendered=await Promise.all(messageRows.map(async m=>{
      let attachment='';
      if(m.attachment_path){const {data:signed}=await sb.storage.from(ROOM_BUCKET).createSignedUrl(m.attachment_path,3600); if(signed?.signedUrl){const url=esc(signed.signedUrl);attachment=m.message_type==='image'?`<a href="${url}" target="_blank" rel="noopener"><img src="${url}" class="max-w-full max-h-64 rounded-xl mt-2" alt="attached image"></a>`:`<a href="${url}" target="_blank" rel="noopener" class="text-sky-300 underline block mt-2">📄 ເປີດໄຟລ໌ PDF</a>`;}}
      const who=m.profiles?.full_name|| (m.sender_id===me.id?profile.full_name:'ສະມາຊິກ');
      const announcement=m.message_type==='announcement';
      return `<div class="flex gap-2 ${m.sender_id===me.id?'flex-row-reverse':''}"><div class="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">${m.profiles?.avatar_url?`<img src="${esc(m.profiles.avatar_url)}" class="w-full h-full object-cover">`:esc(initials(who))}</div><div class="max-w-[82%]"><div class="text-[11px] text-slate-400 ${m.sender_id===me.id?'text-right':''}">${esc(who)} · ${fmtTime(m.created_at)}</div><div class="rounded-2xl px-3 py-2 mt-1 ${announcement?'bg-orange-900/50 border border-orange-500/40':'bg-slate-800'}">${announcement?'<b class="text-orange-300">📢 ປະກາດ</b><br>':''}${esc(m.body||'').replace(/\n/g,'<br>')}${attachment}</div></div></div>`;
    }));
    el.innerHTML=rendered.join('')||'<p class="text-sm text-slate-400 text-center py-5">ຍັງບໍ່ມີຂໍ້ຄວາມ</p>';
    el.scrollTop=el.scrollHeight;
  }
  async function sendMessage(ev){
    ev.preventDefault(); if(!activeRoom||roomBusy)return;
    const body=$('room-text').value.trim(), file=$('room-file').files[0]; if(!body&&!file)return;
    roomBusy=true; let path=null, type='text';
    try{
      if(file){
        if(file.size>10*1024*1024)throw new Error('ຂະໜາດໄຟລ໌ຕ້ອງບໍ່ເກີນ 10 MB');
        if(!(file.type.startsWith('image/')||file.type==='application/pdf'))throw new Error('ຮອງຮັບສະເພາະຮູບພາບ ແລະ PDF');
        const safe=file.name.replace(/[^\w.\-ก-๙]/g,'_').slice(-90), key=activeRoom.id+'/'+me.id+'/'+Date.now()+'_'+safe;
        const {error:upErr}=await sb.storage.from(ROOM_BUCKET).upload(key,file,{upsert:false,contentType:file.type}); if(upErr)throw upErr;
        path=key; type=file.type==='application/pdf'?'pdf':'image';
      }
      const {error}=await sb.from('group_messages').insert({group_id:activeRoom.id,sender_id:me.id,body, message_type:type,attachment_path:path});
      if(error)throw error;
      $('room-text').value=''; $('room-file').value=''; await loadMessages();
    }catch(e){showToast('ສົ່ງບໍ່ສຳເລັດ: '+e.message);}
    finally{roomBusy=false;}
  }
  async function announce(){
    if(!activeRoom||!['teacher','admin'].includes(profile.role))return;
    const body=prompt('ຂໍ້ຄວາມປະກາດ:'); if(!body||!body.trim())return;
    const {error}=await sb.from('group_messages').insert({group_id:activeRoom.id,sender_id:me.id,body:body.trim(),message_type:'announcement'});
    if(error)showToast('ປະກາດບໍ່ສຳເລັດ: '+error.message); else await loadMessages();
  }
  function notifyMessage(m){
    const note='ມີຂໍ້ຄວາມໃໝ່ໃນ '+(activeRoom?.name||'ຫ້ອງຮຽນ');
    if(typeof Notification!=='undefined'&&Notification.permission==='granted'&&document.hidden){try{new Notification('Bounma AI',{body:note,icon:LOGO});}catch(_){}}
    if(typeof showToast==='function')showToast(note);
  }
  async function requestRoomNotifications(){if(typeof Notification!=='undefined'&&Notification.permission==='default'){try{await Notification.requestPermission();}catch(_){}}}
  const _switchTabForRooms=switchTab;
  switchTab=function(t){_switchTabForRooms(t); if(t==='classroom'){requestRoomNotifications();loadClassroom();}};

  // ================= Cloud progress sync (merge, never lose local) =================
  const _sp = saveProgress;
  saveProgress = function (d) { _sp(d); if (!me || !profile || profile.status !== 'approved') return; clearTimeout(pushTimer); pushTimer = setTimeout(push, 800); };
  async function push() {
    if (!me) return;
    const d = getProgress();
    try { const { error } = await sb.from('progress').upsert({ user_id: me.id, lessons: d.lessons, score: d.score, best: d.best, attempts: d.attempts, updated_at: new Date().toISOString() }); if (error) console.warn('progress sync failed', error.message); }
    catch (e) { console.warn('progress sync failed', e); }
  }
  async function syncProgress() {
    const { data } = await sb.from('progress').select('*').eq('user_id', me.id).maybeSingle(), l = getProgress();
    if (data) saveProgress({ lessons: [...new Set([...(data.lessons || []), ...l.lessons])].filter(x => LESSONS.some(z => z.id === x)), score: l.score != null ? l.score : data.score, best: Math.max(l.best || 0, data.best || 0) || null, attempts: Math.max(l.attempts || 0, data.attempts || 0) });
    else saveProgress(l);
    renderProgress();
  }

  window.BAuth = { mode: showAuth, submit, logout, refresh, upd, toggle, openRoom, announce, reload: loadAdmin, filter: f => { adminFilter = f; renderAdminList(); }, search: v => { adminQ = v; renderAdminList(); } };
  gate('<p class="text-sm text-slate-400"><span class="spin"></span>ກຳລັງໂຫຼດ...</p>');
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'TOKEN_REFRESHED') return;
    if (ev === 'PASSWORD_RECOVERY') { recovering = true; setTimeout(() => showAuth('reset'), 0); return; }
    if (recovering) return; // keep the "set new password" form until it is submitted
    if (ev === 'SIGNED_IN' && me && session && session.user.id === me.id && profile && profile.status === 'approved') return; // tab refocus
    setTimeout(() => onSession(session), 0); // never await supabase calls inside this callback
  });
})();
