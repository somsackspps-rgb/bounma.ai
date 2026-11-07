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
    try { await handlePendingJoin(); } catch (e) { console.warn('pending join failed', e); }
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
    box.innerHTML = head('👑 ຈັດການຜູ້ໃຊ້', '<span id="adm-sub"></span>') + `<div id="adm-storage"></div><div class="flex flex-wrap gap-2 items-center"><div id="adm-filters" class="flex flex-wrap gap-2"></div><input id="adm-q" type="search" placeholder="ຄົ້ນຫາຊື່ ຫຼືອີເມວ" oninput="BAuth.search(this.value)" class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm flex-1 min-w-[160px]"></div><div id="adm-list" class="space-y-3"></div>`;
    $('adm-q').value = adminQ; renderAdminList(); loadStorageCard();
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
      ${u.status !== 'rejected' && !self ? `<button ${updating ? 'disabled' : ''} onclick="BAuth.upd('${esc(u.id)}',{status:'rejected'})" class="bg-red-900/70 px-3 py-1.5 rounded-lg text-xs">ປະຕິເສດ</button>` : ''}
      ${!self ? `<button ${updating ? 'disabled' : ''} data-del-user="${esc(u.id)}" class="bg-slate-800 border border-red-500/50 text-red-300 hover:bg-red-900/60 px-3 py-1.5 rounded-lg text-xs" aria-label="ລຶບຜູ້ໃຊ້">🗑 ລຶບ</button>` : ''}</div></div>`; }).join('')
      : '<p class="text-sm text-slate-400 py-6 text-center">ບໍ່ມີລາຍການ</p>';
    list.querySelectorAll('[data-del-user]').forEach(b => b.onclick = () => delUser(b.getAttribute('data-del-user')));
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

  // Permanent delete needs the service role, so it runs in the Supabase Edge Function "delete-user" (see README).
  async function delUser(id) {
    if (updating || !me || id === me.id) return;
    const u = adminData.find(x => x.id === id); if (!u) return;
    const typed = prompt('⚠️ ລຶບຜູ້ໃຊ້ຖາວອນ: ' + (u.email || '') + '\n\n• ບັນຊີເຂົ້າລະບົບ, ຄວາມຄືບໜ້າ ແລະຂໍ້ຄວາມຂອງຜູ້ນີ້ຈະຖືກລຶບ\n• ຫ້ອງຮຽນທີ່ຜູ້ນີ້ສ້າງຈະຖືກໂອນໃຫ້ທ່ານ\n• ກູ້ຄືນບໍ່ໄດ້\n\nພິມອີເມວຂອງຜູ້ໃຊ້ເພື່ອຢືນຢັນ:');
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== String(u.email || '').toLowerCase()) { showToast('ອີເມວບໍ່ກົງກັນ — ຍົກເລີກ'); return; }
    updating = true; renderAdminList();
    let res; try { res = await sb.functions.invoke('delete-user', { body: { user_id: id } }); } catch (e) { res = { error: e }; }
    updating = false;
    if (res.error) {
      let msg = res.error.message || '';
      try { const b = await res.error.context.json(); if (b && b.error) msg = b.error; } catch (_) {}
      if (/Failed to send|relay|not found|404|FunctionsFetchError/i.test(msg)) msg = 'ຍັງບໍ່ໄດ້ deploy Edge Function “delete-user” (ເບິ່ງ README ຂັ້ນຕອນທີ 3)';
      showToast('ລຶບບໍ່ສຳເລັດ: ' + msg); renderAdminList(); return;
    }
    adminData = adminData.filter(x => x.id !== id);
    const t = res.data && res.data.transferred_rooms; showToast('ລຶບຜູ້ໃຊ້ແລ້ວ' + (t ? ' • ໂອນ ' + t + ' ຫ້ອງຮຽນໃຫ້ທ່ານ' : ''));
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
    const keep=pendingOpen||(activeRoom&&activeRoom.id); pendingOpen=null; // keep the open room when the tab is re-entered / reloaded
    if(keep&&roomRows.some(x=>x.id===keep)) openRoom(keep); else activeRoom=null;
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
  // ----- v3.4: room helpers (rename, share link, members, local attachments, paging) -----
  const PAGE = 50, MSG_SEL = 'id,group_id,sender_id,body,message_type,attachment_path,created_at,profiles(full_name,avatar_url)';
  const PEND_KEY = 'bounma_pending_join';
  let members = [], hasOlder = false, pendingOpen = null;
  const isStaff = () => !!profile && ['teacher', 'admin'].includes(profile.role);
  const isAdminU = () => !!profile && profile.role === 'admin';
  const canRename = r => !!r && (isAdminU() || r.created_by === (me && me.id));
  const safeUrl = u => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : ''; } catch (_) { return ''; } };
  const fsize = n => (window.BFiles ? BFiles.fmtSize(n) : Math.round(n / 1024) + ' KB');
  const roomLink = r => { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('join', r.join_code); return u.toString(); };
  // a shared link ?join=CODE is remembered, so it still works after login / sign-up / admin approval
  (function captureJoin() {
    try {
      const u = new URL(location.href), j = (u.searchParams.get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      if (!j) return;
      localStorage.setItem(PEND_KEY, JSON.stringify({ code: j, t: Date.now() }));
      u.searchParams.delete('join'); history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (_) {}
  })();
  async function handlePendingJoin() {
    let p = null; try { p = JSON.parse(localStorage.getItem(PEND_KEY)); } catch (_) {}
    if (!p || !p.code) return;
    try { localStorage.removeItem(PEND_KEY); } catch (_) {}
    if (Date.now() - p.t > 7 * 864e5) return;
    const { data, error } = await sb.rpc('join_classroom_by_code', { p_code: p.code });
    if (error) { showToast('ເຂົ້າຫ້ອງຕາມລິ້ງບໍ່ໄດ້: ' + (/invalid/i.test(error.message) ? 'ລະຫັດຫ້ອງບໍ່ຖືກຕ້ອງ' : error.message)); return; }
    pendingOpen = data || null; switchTab('classroom'); showToast('ເຂົ້າຮ່ວມຫ້ອງຮຽນແລ້ວ');
  }
  function roomHead() {
    const r = activeRoom; if (!r) return '';
    const btn = (act, t) => `<button type="button" onclick="BAuth.${act}()" class="chip">${t}</button>`;
    return `<div class="flex flex-wrap justify-between gap-2"><div class="min-w-0"><h3 class="font-bold text-lg break-words">${esc(r.name)}</h3><p class="text-xs text-slate-400">${esc(r.description || '')}</p></div><div class="flex flex-wrap gap-2 items-start">${btn('members', '👥 ສະມາຊິກ')}${btn('profile', '👤 ໂປຣໄຟລ໌')}${isStaff() ? btn('share', '🔗 ແບ່ງປັນລິ້ງ') : ''}${canRename(r) ? btn('rename', '✏️ ແກ້ຊື່') : ''}${isStaff() ? btn('announce', '📢 ປະກາດ') : ''}</div></div>`;
  }
  async function renameRoom() {
    const r = activeRoom; if (!r || !canRename(r)) return;
    const name = (prompt('ຊື່ຫ້ອງຮຽນໃໝ່:', r.name) || '').trim(); if (!name) return;
    if (name.length > 80) return showToast('ຊື່ຍາວເກີນ 80 ຕົວອັກສອນ');
    const d = prompt('ຄຳອະທິບາຍຫ້ອງ (ປ່ອຍວ່າງ = ບໍ່ປ່ຽນ):', r.description || ''); const description = d === null ? r.description : d.trim().slice(0, 300);
    if (name === r.name && description === r.description) return;
    const { data, error } = await sb.from('classroom_groups').update({ name, description }).eq('id', r.id).select('id,name,description');
    if (error) return showToast('ແກ້ຊື່ບໍ່ສຳເລັດ: ' + error.message);
    if (!data || !data.length) return showToast('ບໍ່ມີສິດແກ້ໄຂຫ້ອງນີ້');
    r.name = data[0].name; r.description = data[0].description; renderRoomList(); const h = $('room-head'); if (h) h.innerHTML = roomHead(); showToast('ແກ້ຊື່ຫ້ອງແລ້ວ');
  }
  async function shareRoom() {
    const r = activeRoom; if (!r || !isStaff() || !r.join_code) return;
    const url = roomLink(r), text = 'ເຂົ້າຮ່ວມຫ້ອງຮຽນ “' + r.name + '” ໃນບຸນມາ AI';
    if (navigator.share) { try { await navigator.share({ title: r.name, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    if (typeof copyText === 'function') copyText(text + '\n' + url); else showToast(url);
  }
  const canRemoveMember = m => !!m && me && m.user_id !== me.id && (m.role === 'student' ? isStaff() : isAdminU());
  async function toggleMembers() {
    const r = activeRoom, box = $('room-members'); if (!r || !box) return;
    if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden'); box.innerHTML = '<p class="text-sm text-slate-400"><span class="spin"></span> ກຳລັງໂຫຼດສະມາຊິກ...</p>';
    const { data, error } = await sb.rpc('list_group_members', { p_group: r.id });
    if (error) { box.innerHTML = `<p class="text-sm text-red-300">${esc(error.message)} — ກວດວ່າໄດ້ຣັນ SQL v3.4 ແລ້ວ</p>`; return; }
    members = data || []; renderMembers();
  }
  function renderMembers() {
    const box = $('room-members'); if (!box) return;
    const ord = { admin: 0, teacher: 1, student: 2 };
    const rows = [...members].sort((a, b) => ((ord[a.role] ?? 3) - (ord[b.role] ?? 3)) || String(a.full_name || '').localeCompare(String(b.full_name || '')));
    box.innerHTML = `<div class="flex items-center justify-between"><h4 class="font-bold text-sm">👥 ສະມາຊິກ ${rows.length} ຄົນ</h4><button type="button" onclick="BAuth.members()" class="text-xs text-slate-400">ປິດ</button></div><div class="space-y-2 max-h-64 overflow-y-auto">` +
      rows.map(m => `<div class="flex items-center gap-2 bg-slate-900/60 rounded-xl p-2"><div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">${m.avatar_url ? `<img src="${esc(m.avatar_url)}" alt="" class="w-full h-full object-cover">` : esc(initials(m.full_name))}</div><div class="min-w-0 flex-1"><p class="text-sm font-bold truncate">${esc(m.full_name || '-')}${me && m.user_id === me.id ? ' (ຂ້ອຍ)' : ''}</p><p class="text-[11px] text-slate-400 truncate">${esc(RL[m.role] || '')}${m.email ? ' • ' + esc(m.email) : ''}</p></div>${canRemoveMember(m) ? `<button type="button" data-rm="${esc(m.user_id)}" class="bg-red-900/70 hover:bg-red-800 rounded-lg px-2.5 py-1.5 text-xs">ເອົາອອກ</button>` : ''}</div>`).join('') + '</div>';
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => removeMember(b.getAttribute('data-rm')));
  }
  async function removeMember(uid) {
    const m = members.find(x => x.user_id === uid), r = activeRoom; if (!m || !r || !canRemoveMember(m)) return;
    if (!confirm('ເອົາ ' + (m.full_name || m.email || 'ຜູ້ໃຊ້') + ' ອອກຈາກຫ້ອງ “' + r.name + '” ?')) return;
    const { error } = await sb.rpc('remove_group_member', { p_group: r.id, p_user: uid });
    if (error) return showToast('ບໍ່ສຳເລັດ: ' + error.message);
    if (m.user_id === r.created_by) r.created_by = me.id; // server moved ownership to the admin
    members = members.filter(x => x.user_id !== uid); renderMembers(); showToast('ເອົາອອກຈາກຫ້ອງແລ້ວ');
  }
  let openSeq = 0;
  async function openRoom(id) {
    const r = roomRows.find(x => x.id === id); if (!r) return;
    const my = ++openSeq; activeRoom = r; messageRows = []; members = [];
    if (roomChannel) { const old = roomChannel; roomChannel = null; try { await sb.removeChannel(old); } catch (_) {} }
    const chat = $('room-chat'); if (!chat || my !== openSeq) return;
    chat.innerHTML = `<div class="app-card rounded-2xl p-4 space-y-3"><div id="room-head">${roomHead()}</div><div id="room-members" class="hidden bg-slate-950/50 rounded-xl p-3 space-y-2"></div>` +
      `<div id="room-messages" class="space-y-3 max-h-[55vh] overflow-y-auto p-2 bg-slate-950/50 rounded-xl"><p class="text-sm text-slate-400">ກຳລັງໂຫຼດຂໍ້ຄວາມ...</p></div>` +
      `<form id="room-send" class="space-y-2"><textarea id="room-text" class="${IN}" rows="2" maxlength="4000" placeholder="ພິມຂໍ້ຄວາມ..."></textarea>` +
      `<div class="grid sm:grid-cols-2 gap-2"><label class="text-xs text-slate-400">📎 ແນບໄຟລ໌<input id="room-file" type="file" class="block text-xs mt-1 w-full"></label><label class="text-xs text-slate-400">🔗 ແນບລິ້ງ (Google Drive ... ໃຫ້ເພື່ອນເປີດໄດ້)<input id="room-link" type="text" inputmode="url" autocapitalize="none" autocomplete="off" maxlength="500" placeholder="https://..." class="${IN} !py-2 mt-1"></label></div>` +
      `<div class="text-xs text-slate-300 space-y-1.5 bg-slate-950/40 rounded-xl p-2.5"><label class="flex items-start gap-2"><input type="radio" name="share-mode" value="share" checked class="mt-0.5 accent-emerald-500"><span>📤 <b>ແຊຣ໌ໃຫ້ສະມາຊິກ</b> ເບິ່ງ/ດາວໂຫຼດໄດ້ <span class="text-slate-500">(ເກັບຊົ່ວຄາວ, ≤ 5 MB, ຮູບຖືກບີບອັດອັດຕະໂນມັດ)</span></span></label><label class="flex items-start gap-2"><input type="radio" name="share-mode" value="local" class="mt-0.5 accent-emerald-500"><span>💾 <b>ເກັບໃນເຄື່ອງຂ້ອຍເທົ່ານັ້ນ</b> <span class="text-slate-500">(ບໍ່ຂຶ້ນເຊີບເວີ, ຄົນອື່ນເຫັນແຕ່ຊື່ໄຟລ໌, ≤ 50 MB)</span></span></label><p class="text-slate-500">ໄຟລ໌ໃຫຍ່ກວ່າ 5 MB: ວາງລິ້ງ Drive ຢູ່ຊ່ອງດ້ານຂ້າງ</p></div><div id="room-usage" class="text-[11px] text-slate-500"></div>` +
      `<div class="flex justify-end"><button id="room-send-btn" class="bg-emerald-700 hover:bg-emerald-600 rounded-xl px-5 py-2 text-sm font-bold">ສົ່ງ</button></div></form></div>`;
    $('room-send').onsubmit = sendMessage;
    $('room-messages').onclick = onMessageClick;
    await loadMessages('latest'); refreshUsage();
    if (my !== openSeq) return;
    roomChannel = sb.channel('room-updates-' + me.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, payload => {
      if (payload.new.sender_id !== me.id) { notifyMessage(payload.new); if (activeRoom && payload.new.group_id === activeRoom.id) loadMessages('new'); }
    }).subscribe();
  }
  async function loadMessages(mode) {
    if (!activeRoom) return; const gid = activeRoom.id;
    let q = sb.from('group_messages').select(MSG_SEL).eq('group_id', gid);
    if (mode === 'older' && messageRows.length) q = q.lt('created_at', messageRows[0].created_at).order('created_at', { ascending: false }).limit(PAGE);
    else if (mode === 'new' && messageRows.length) q = q.gte('created_at', messageRows[messageRows.length - 1].created_at).order('created_at', { ascending: true }).limit(200);
    else { mode = 'latest'; q = q.order('created_at', { ascending: false }).limit(PAGE); }
    const { data, error } = await q;
    if (!activeRoom || activeRoom.id !== gid) return;
    const el = $('room-messages'); if (!el) return;
    if (error) { el.innerHTML = `<p class="text-sm text-red-300">${esc(error.message)}</p>`; return; }
    let rows = data || []; await loadFileMeta(rows); if (!activeRoom || activeRoom.id !== gid) return;
    if (mode === 'older') { rows = rows.reverse(); hasOlder = rows.length === PAGE; messageRows = rows.concat(messageRows); }
    else if (mode === 'new') { const have = new Set(messageRows.map(m => m.id)); messageRows = messageRows.concat(rows.filter(m => !have.has(m.id))); }
    else { rows = rows.reverse(); hasOlder = rows.length === PAGE; messageRows = rows; }
    renderMessages(mode);
  }
  function attachHtml(m) {
    const p = m.attachment_path; if (!p) return '';
    const lf = window.BFiles ? BFiles.parse(p) : null;
    if (lf) return `<div class="mt-2 rounded-xl bg-slate-900/70 border border-slate-700 p-2 text-xs" data-lf="${esc(lf.id)}"><div class="font-bold break-all">📎 ${esc(lf.name)}</div><div class="text-slate-400">${esc(fsize(lf.size))} • <span class="lf-state">ກຳລັງກວດ...</span></div><div class="lf-actions hidden gap-2 mt-1"><button type="button" class="chip" data-act="open-local" data-id="${esc(lf.id)}">ເປີດ</button><button type="button" class="chip" data-act="save-local" data-id="${esc(lf.id)}">ບັນທຶກ</button></div></div>`;
    if (m.message_type === 'shared_file' && /^rf:/.test(p)) {
      const id = p.slice(3), fm = fileMeta.get(id);
      if (!fm) return '<div class="mt-2 text-xs text-slate-400">📎 ໄຟລ໌ (ບໍ່ພົບຂໍ້ມູນ)</div>';
      const gone = !!fm.deleted_at || new Date(fm.expires_at) < new Date(), days = Math.max(0, Math.ceil((new Date(fm.expires_at) - Date.now()) / 864e5));
      const thumb = fm.thumb && /^data:image\/jpeg;base64,/.test(fm.thumb) && !gone ? `<img src="${esc(fm.thumb)}" alt="" class="w-full max-h-40 object-cover cursor-pointer" data-act="view-shared" data-id="${esc(id)}">` : '';
      const canDel = !gone && me && (fm.uploader_id === me.id || isStaff());
      return `<div class="mt-2 rounded-xl bg-slate-900/70 border border-slate-700 overflow-hidden text-xs">${thumb}<div class="p-2"><div class="font-bold break-all">${window.BView ? BView.iconFor(fm.mime, fm.name) : '📎'} ${esc(fm.name)}</div><div class="text-slate-400">${esc(fsize(fm.size_bytes))} • ${gone ? 'ໝົດອາຍຸ / ຖືກລຶບແລ້ວ' : 'ເຫຼືອ ' + (Number.isFinite(days) ? days : '?') + ' ວັນ'}</div>` +
        (gone ? '' : `<div class="flex flex-wrap gap-2 mt-1.5"><button type="button" class="chip" data-act="view-shared" data-id="${esc(id)}">👁 ເບິ່ງ</button><button type="button" class="chip" data-act="dl-shared" data-id="${esc(id)}">⬇︎ ດາວໂຫຼດ</button>${canDel ? `<button type="button" class="chip" data-act="del-shared" data-id="${esc(id)}" aria-label="ລຶບໄຟລ໌">🗑</button>` : ''}</div>`) + '</div></div>';
    }
    if (m.message_type === 'link') { const u = safeUrl(p); let host = ''; try { host = new URL(u).hostname; } catch (_) {} return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow" class="text-sky-300 underline block mt-2 break-all">🔗 ${esc(host)} — ເປີດລິ້ງ</a>` : ''; }
    return `<button type="button" class="chip mt-2" data-act="open-legacy" data-path="${esc(p)}">📎 ເປີດໄຟລ໌ແນບ (ເກົ່າ)</button>`;
  }
  function msgHtml(m) {
    const mine = me && m.sender_id === me.id, who = (m.profiles && m.profiles.full_name) || (mine ? profile.full_name : 'ສະມາຊິກ'), ann = m.message_type === 'announcement', av = m.profiles && m.profiles.avatar_url;
    return `<div class="flex gap-2 ${mine ? 'flex-row-reverse' : ''}"><div class="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">${av ? `<img src="${esc(av)}" alt="" class="w-full h-full object-cover">` : esc(initials(who))}</div><div class="max-w-[82%] min-w-0"><div class="text-[11px] text-slate-400 ${mine ? 'text-right' : ''}">${esc(who)} · ${fmtTime(m.created_at)}</div><div class="rounded-2xl px-3 py-2 mt-1 break-words ${ann ? 'bg-orange-900/50 border border-orange-500/40' : 'bg-slate-800'}">${ann ? '<b class="text-orange-300">📢 ປະກາດ</b><br>' : ''}${esc(m.body || '').replace(/\n/g, '<br>')}${attachHtml(m)}</div></div></div>`;
  }
  function renderMessages(mode) {
    const el = $('room-messages'); if (!el) return;
    const prevH = el.scrollHeight, prevTop = el.scrollTop, nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    el.innerHTML = (hasOlder ? '<div class="text-center"><button type="button" data-act="older" class="chip">⬆︎ ໂຫຼດຂໍ້ຄວາມກ່ອນໜ້າ</button></div>' : '') +
      (messageRows.map(msgHtml).join('') || '<p class="text-sm text-slate-400 text-center py-5">ຍັງບໍ່ມີຂໍ້ຄວາມ</p>');
    if (mode === 'older') el.scrollTop = el.scrollHeight - prevH; else if (mode === 'keep') el.scrollTop = prevTop; else if (mode === 'latest' || nearBottom) el.scrollTop = el.scrollHeight;
    hydrateLocal();
  }
  async function hydrateLocal() {
    const nodes = document.querySelectorAll('#room-messages [data-lf]');
    for (const n of nodes) {
      const ok = window.BFiles ? await BFiles.has(n.getAttribute('data-lf')) : false;
      const s = n.querySelector('.lf-state'), a = n.querySelector('.lf-actions');
      if (s) s.textContent = ok ? 'ໄຟລ໌ຢູ່ໃນເຄື່ອງນີ້' : 'ໄຟລ໌ຢູ່ໃນເຄື່ອງຜູ້ສົ່ງ — ເຄື່ອງນີ້ເປີດບໍ່ໄດ້';
      if (a) { a.classList.toggle('hidden', !ok); a.classList.toggle('flex', ok); }
    }
  }
  async function onMessageClick(ev) {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const act = b.getAttribute('data-act');
    try {
      if (act === 'older') { b.disabled = true; await loadMessages('older'); }
      else if (act === 'open-local') {
        const rec = await BFiles.get(b.getAttribute('data-id'));
        if (!rec) showToast('ບໍ່ພົບໄຟລ໌ໃນເຄື່ອງນີ້'); else if (window.BView) BView.open({ name: rec.name, type: rec.type, size: rec.size, load: async () => rec.blob }); else BFiles.view(rec.id);
      }
      else if (act === 'view-shared') { const id = b.getAttribute('data-id'), fm = fileMeta.get(id); if (fm && window.BView) BView.open({ name: fm.name, type: fm.mime, size: fm.size_bytes, load: () => loadShared(id) }); }
      else if (act === 'dl-shared') { const id = b.getAttribute('data-id'), fm = fileMeta.get(id); b.disabled = true; try { BView.download(await loadShared(id), fm.name); } finally { b.disabled = false; } }
      else if (act === 'del-shared') await deleteShared(b.getAttribute('data-id'));
      else if (act === 'save-local') { if (!(await BFiles.download(b.getAttribute('data-id')))) showToast('ບໍ່ພົບໄຟລ໌ໃນເຄື່ອງນີ້'); }
      else if (act === 'open-legacy') {
        const w = window.open('about:blank', '_blank'); const { data, error } = await sb.storage.from(ROOM_BUCKET).createSignedUrl(b.getAttribute('data-path'), 3600);
        if (error || !data || !data.signedUrl) { if (w) w.close(); showToast('ເປີດໄຟລ໌ບໍ່ໄດ້'); } else if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
      }
    } catch (e) { showToast('ບໍ່ສຳເລັດ: ' + friendly(e)); }
  }
  // ----- v3.5: shared files (temporary, capped), preview, profile sheet -----
  const fileMeta = new Map();
  const SHARE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/csv', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'audio/mpeg', 'audio/mp4', 'video/mp4']);
  let LIM = null;
  const DEFAULT_LIM = { room_quota: 104857600, max_file: 5242880, max_image: 3145728, expire_days: 14, daily_files: 30, msgs_per_min: 20 };
  async function loadLimits() {
    if (LIM) return LIM;
    try { const { data } = await sb.rpc('bounma_limits'); const r = Array.isArray(data) ? data[0] : data; LIM = Object.assign({}, DEFAULT_LIM, r || {}); } catch (_) { LIM = Object.assign({}, DEFAULT_LIM); }
    return LIM;
  }
  const friendly = e => {
    const m = String((e && e.message) || e || '');
    if (/ROOM_QUOTA/.test(m)) return 'ພື້ນທີ່ໄຟລ໌ຂອງຫ້ອງເຕັມ — ລຶບໄຟລ໌ເກົ່າ ຫຼືໃຊ້ລິ້ງ Drive ແທນ';
    if (/DAILY_LIMIT/.test(m)) return 'ອັບໂຫຼດໄຟລ໌ຄົບຈຳນວນຕໍ່ 24 ຊົ່ວໂມງແລ້ວ — ລອງໃໝ່ພາຍຫຼັງ ຫຼືໃຊ້ລິ້ງ Drive';
    if (/FILE_TYPE/.test(m)) return 'ປະເພດໄຟລ໌ນີ້ບໍ່ອະນຸຍາດ (ຮອງຮັບ: ຮູບ, PDF, Word, Excel, PowerPoint, TXT, CSV, MP3, MP4)';
    if (/FILE_TOO_LARGE/.test(m)) return 'ໄຟລ໌ໃຫຍ່ເກີນກຳນົດ — ໃຊ້ລິ້ງ Drive ແທນ';
    if (/RATE_LIMIT/.test(m)) return 'ສົ່ງໄວເກີນໄປ ກະລຸນາລໍຖ້າແປບໜຶ່ງ';
    if (isNet(e)) return 'ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້ ກວດອິນເຕີເນັດ';
    return m;
  };
  async function refreshUsage() {
    const el = $('room-usage'); if (!el || !activeRoom) return;
    const { data, error } = await sb.rpc('room_storage_usage', { p_group: activeRoom.id });
    if (error) { el.textContent = ''; return; }
    const u = Array.isArray(data) ? data[0] : data; if (!u) return;
    const pct = Math.min(100, Math.round((u.used_bytes / u.room_quota) * 100));
    el.innerHTML = `ໄຟລ໌ທີ່ແຊຣ໌ໃນຫ້ອງ: ${esc(fsize(u.used_bytes))} / ${esc(fsize(u.room_quota))} (${pct}%) • ລຶບອັດຕະໂນມັດຫຼັງ ${u.expire_days} ວັນ` + (pct >= 90 ? ' <b class="text-amber-300">— ໃກ້ເຕັມ</b>' : '');
  }
  async function loadFileMeta(rows) {
    const ids = [...new Set((rows || []).filter(m => m.message_type === 'shared_file' && /^rf:/.test(m.attachment_path || '')).map(m => m.attachment_path.slice(3)))].filter(id => !fileMeta.has(id) || !fileMeta.get(id).deleted_at);
    if (!ids.length) return;
    const { data } = await sb.from('room_files').select('id,name,mime,size_bytes,thumb,expires_at,deleted_at,uploader_id').in('id', ids);
    (data || []).forEach(f => fileMeta.set(f.id, f));
  }
  async function loadShared(id) {
    const fm = fileMeta.get(id); if (!fm || !activeRoom) throw new Error('ບໍ່ພົບຂໍ້ມູນໄຟລ໌');
    const cached = window.BFiles ? await BFiles.get('rf-' + id).catch(() => null) : null;
    if (cached && cached.blob) return cached.blob;
    const { data, error } = await sb.storage.from(ROOM_BUCKET).download(activeRoom.id + '/' + id);
    if (error || !data) throw new Error(error ? (error.message || 'ດາວໂຫຼດບໍ່ສຳເລັດ') : 'ດາວໂຫຼດບໍ່ສຳເລັດ');
    const blob = new Blob([data], { type: fm.mime || data.type }); if (window.BFiles) BFiles.putCached('rf-' + id, activeRoom.id, blob, fm.name).catch(() => {});
    return blob;
  }
  // upload a file for every member: compress images, register metadata (server enforces limits), then upload the bytes
  async function shareUpload(file) {
    const L = await loadLimits();
    const f = file.type.startsWith('image/') && window.BView ? await BView.compressImage(file) : file;
    const mime = (window.BView ? BView.guessMime(f.name, f.type) : f.type) || '';
    if (!SHARE_TYPES.has(mime)) throw new Error('ປະເພດໄຟລ໌ນີ້ບໍ່ອະນຸຍາດ (ຮອງຮັບ: ຮູບ, PDF, Word, Excel, PowerPoint, TXT, CSV, MP3, MP4) — ໃຊ້ “ເກັບໃນເຄື່ອງ” ຫຼືລິ້ງ Drive');
    const max = mime.startsWith('image/') ? L.max_image : L.max_file;
    if (f.size > max) throw new Error('ໄຟລ໌ໃຫຍ່ກວ່າ ' + fsize(max) + ' — ໃຊ້ລິ້ງ Drive ແທນ ຫຼືເລືອກ “ເກັບໃນເຄື່ອງ”');
    const id = (crypto.randomUUID ? crypto.randomUUID() : null); if (!id) throw new Error('ເບົາເຊີເກົ່າເກີນໄປ');
    const thumb = window.BView ? await BView.makeThumb(f) : null;
    const { error: e1 } = await sb.from('room_files').insert({ id, group_id: activeRoom.id, uploader_id: me.id, name: f.name.slice(0, 200), mime, size_bytes: f.size, thumb });
    if (e1) throw new Error(friendly(e1));
    const { error: e2 } = await sb.storage.from(ROOM_BUCKET).upload(activeRoom.id + '/' + id, f, { contentType: mime, upsert: false });
    if (e2) { try { await sb.rpc('mark_room_file_deleted', { p_id: id }); } catch (_) {} throw new Error(friendly(e2)); }
    if (window.BFiles) BFiles.putCached('rf-' + id, activeRoom.id, f, f.name).catch(() => {});
    return id;
  }
  async function deleteShared(id) {
    const fm = fileMeta.get(id); if (!fm) return;
    if (!confirm('ລຶບໄຟລ໌ “' + fm.name + '” ອອກຈາກຫ້ອງ? (ສະມາຊິກຈະເປີດບໍ່ໄດ້ອີກ)')) return;
    const { data: path, error } = await sb.rpc('mark_room_file_deleted', { p_id: id });
    if (error) return showToast('ລຶບບໍ່ສຳເລັດ: ' + error.message);
    try { await sb.storage.from(ROOM_BUCKET).remove([path]); } catch (_) { /* cleanup job will retry */ }
    if (window.BFiles) BFiles.remove('rf-' + id).catch(() => {});
    fm.deleted_at = new Date().toISOString(); renderMessages('keep'); refreshUsage(); showToast('ລຶບໄຟລ໌ແລ້ວ');
  }
  // ----- profile sheet (edit name + photo without leaving the chat) -----
  function openProfileSheet() {
    if (!profile) return; let m = $('profile-sheet'); if (m) m.remove();
    m = document.createElement('div'); m.id = 'profile-sheet'; m.className = 'fixed inset-0 z-[85] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'ps-title');
    m.innerHTML = `<form id="ps-form" class="app-card w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4"><h3 id="ps-title" class="font-bold text-lg">👤 ແກ້ໄຂໂປຣໄຟລ໌</h3>` +
      `<div class="flex items-center gap-3"><div id="ps-av" class="w-16 h-16 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-lg">${profile.avatar_url ? `<img src="${esc(profile.avatar_url)}" alt="" class="w-full h-full object-cover">` : esc(initials(profile.full_name))}</div>` +
      `<label class="text-xs text-slate-400 flex-1">ຮູບໂປຣໄຟລ໌ (ຈະຖືກຍ່ອໃຫ້ນ້ອຍອັດຕະໂນມັດ)<input id="ps-file" type="file" accept="image/jpeg,image/png,image/webp" class="block text-xs mt-1 w-full"></label></div>` +
      `<label class="block text-xs text-slate-400">ຊື່ທີ່ສະແດງ<input id="ps-name" class="${IN} mt-1" maxlength="60" required value="${esc(profile.full_name || '')}"></label>` +
      `<div class="flex gap-2 justify-end"><button type="button" id="ps-cancel" class="bg-slate-700 rounded-xl px-4 py-2 text-sm font-bold">ຍົກເລີກ</button><button id="ps-save" class="bg-emerald-700 hover:bg-emerald-600 rounded-xl px-5 py-2 text-sm font-bold">ບັນທຶກ</button></div></form>`;
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    document.body.appendChild(m); $('ps-cancel').onclick = () => m.remove(); $('ps-form').onsubmit = saveProfileSheet; $('ps-name').focus();
    $('ps-file').onchange = () => { const f = $('ps-file').files[0]; if (f) { const u = URL.createObjectURL(f); $('ps-av').innerHTML = `<img alt="" class="w-full h-full object-cover" src="${u}">`; } };
  }
  async function saveProfileSheet(ev) {
    ev.preventDefault(); const name = $('ps-name').value.trim(), file = $('ps-file').files[0];
    if (name.length < 2) return showToast('ຊື່ຕ້ອງມີຢ່າງໜ້ອຍ 2 ຕົວອັກສອນ');
    const btn = $('ps-save'); btn.disabled = true;
    try {
      const patch = { full_name: name };
      if (file) patch.avatar_url = await uploadAvatarFile(file);
      const { error } = await sb.from('profiles').update(patch).eq('id', me.id); if (error) throw error;
      Object.assign(profile, patch); buildUI();
      const m = $('profile-sheet'); if (m) m.remove(); showToast('ບັນທຶກໂປຣໄຟລ໌ແລ້ວ');
      if (activeRoom) { loadMessages('latest'); if (!$('room-members').classList.contains('hidden')) { members = members.map(x => x.user_id === me.id ? Object.assign({}, x, { full_name: profile.full_name, avatar_url: profile.avatar_url }) : x); renderMembers(); } }
    } catch (e) { showToast('ບັນທຶກບໍ່ສຳເລັດ: ' + friendly(e)); btn.disabled = false; }
  }
  // avatar: shrink to 384 px JPEG (a few tens of KB) before uploading
  async function uploadAvatarFile(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('ຮອງຮັບ JPG, PNG ແລະ WebP');
    if (file.size > 10 * 1024 * 1024) throw new Error('ຮູບໃຫຍ່ເກີນ 10 MB');
    const small = window.BView ? await BView.compressImage(file, { max: 384, quality: 0.85 }) : file;
    if (small.size > 2 * 1024 * 1024) throw new Error('ຮູບຍັງໃຫຍ່ເກີນ 2 MB');
    const ext = small.type === 'image/png' ? 'png' : small.type === 'image/webp' ? 'webp' : 'jpg', path = me.id + '/avatar.' + ext;
    const { error } = await sb.storage.from('profile-avatars').upload(path, small, { upsert: true, contentType: small.type }); if (error) throw error;
    const stale = ['jpg', 'png', 'webp'].filter(x => x !== ext).map(x => me.id + '/avatar.' + x); sb.storage.from('profile-avatars').remove(stale).catch(() => {});
    return sb.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
  }
  async function uploadAvatar(ev) {
    ev.preventDefault(); const file = $('avatar-file').files[0]; if (!file) return showToast('ກະລຸນາເລືອກຮູບກ່ອນ');
    try {
      const url = await uploadAvatarFile(file);
      const { error } = await sb.from('profiles').update({ avatar_url: url }).eq('id', me.id); if (error) throw error;
      profile.avatar_url = url; showToast('ອັບເດດຮູບໂປຣໄຟລ໌ແລ້ວ'); await loadClassroom();
    } catch (e) { showToast('ອັບໂຫຼດຮູບບໍ່ສຳເລັດ: ' + friendly(e)); }
  }
  // ----- admin: storage overview + cleanup -----
  async function loadStorageCard() {
    const el = $('adm-storage'); if (!el) return;
    const { data, error } = await sb.rpc('admin_storage_summary');
    if (error || !data) { el.innerHTML = ''; return; }
    const rooms = (data.rooms || []).filter(r => r.bytes > 0).map(r => `${esc(r.name)} ${esc(fsize(r.bytes))}`).join(' • ');
    el.innerHTML = `<div class="app-card rounded-2xl p-4 flex flex-wrap items-center gap-3 justify-between"><div class="text-xs"><p class="font-bold text-sm">🗄️ ໄຟລ໌ແຊຣ໌ໃນຫ້ອງ: ${data.active_files} ໄຟລ໌ • ${esc(fsize(data.active_bytes))} <span class="text-slate-500">(ແຜນຟຣີ Storage 1 GB)</span></p><p class="text-slate-400 mt-1">${rooms || 'ຍັງບໍ່ມີໄຟລ໌'}${data.expired_pending ? ' • <b class="text-amber-300">ລໍຖ້າລຶບ ' + data.expired_pending + ' ໄຟລ໌</b>' : ''}</p></div><button id="adm-clean" class="chip">🧹 ລ້າງໄຟລ໌ໝົດອາຍຸ</button></div>`;
    $('adm-clean').onclick = async () => {
      const b = $('adm-clean'); b.disabled = true;
      let r; try { r = await sb.functions.invoke('cleanup-files', { body: {} }); } catch (e) { r = { error: e }; }
      if (r.error) showToast('ລ້າງບໍ່ສຳເລັດ — ຍັງບໍ່ໄດ້ deploy Edge Function “cleanup-files” (ເບິ່ງ README)'); else showToast('ລຶບແລ້ວ ' + ((r.data && r.data.removed) || 0) + ' ໄຟລ໌');
      loadStorageCard();
    };
  }

  async function sendMessage(ev) {
    ev.preventDefault(); if (!activeRoom || roomBusy) return;
    const body = $('room-text').value.trim(), file = $('room-file').files[0], linkRaw = ($('room-link').value || '').trim();
    if (!body && !file && !linkRaw) return;
    let link = '';
    if (linkRaw) { link = safeUrl(/^[a-z]+:\/\//i.test(linkRaw) ? linkRaw : 'https://' + linkRaw); if (!link) return showToast('ລິ້ງຕ້ອງເປັນ https://'); if (link.length > 500) return showToast('ລິ້ງຍາວເກີນ 500 ຕົວອັກສອນ'); }
    roomBusy = true; const btn = $('room-send-btn'); if (btn) btn.disabled = true; let savedId = null, savedRemote = null, sent = false;
    try {
      const base = { group_id: activeRoom.id, sender_id: me.id }, rows = [];
      const mode = (document.querySelector('input[name=share-mode]:checked') || {}).value || 'share';
      if (file && mode === 'share') {
        const rid = await shareUpload(file); savedRemote = rid;
        rows.push({ ...base, body, message_type: 'shared_file', attachment_path: 'rf:' + rid });
        if (link) rows.push({ ...base, body: '', message_type: 'link', attachment_path: link });
      } else if (file) {
        if (!window.BFiles || !BFiles.supported) throw new Error('ເບົາເຊີນີ້ບໍ່ຮອງຮັບການເກັບໄຟລ໌ໃນເຄື່ອງ');
        if (file.size > BFiles.MAX) throw new Error('ໄຟລ໌ໃຫຍ່ເກີນ ' + fsize(BFiles.MAX));
        savedId = await BFiles.put(activeRoom.id, file);
        rows.push({ ...base, body, message_type: 'file', attachment_path: BFiles.mark(savedId, file) });
        if (link) rows.push({ ...base, body: '', message_type: 'link', attachment_path: link });
      } else if (link) rows.push({ ...base, body, message_type: 'link', attachment_path: link });
      else rows.push({ ...base, body, message_type: 'text', attachment_path: null });
      for (const row of rows) { const { error } = await sb.from('group_messages').insert(row); if (error) throw error; sent = true; }
      if (savedId && window.BFiles) BFiles.persist();
      $('room-text').value = ''; $('room-file').value = ''; $('room-link').value = ''; await loadMessages('new'); if (savedRemote) refreshUsage();
    } catch (e) {
      if (savedId && !sent && window.BFiles) { try { await BFiles.remove(savedId); } catch (_) {} }
      if (savedRemote && !sent) { try { const { data: pth } = await sb.rpc('mark_room_file_deleted', { p_id: savedRemote }); if (pth) await sb.storage.from(ROOM_BUCKET).remove([pth]); } catch (_) {} }
      showToast('ສົ່ງບໍ່ສຳເລັດ: ' + friendly(e));
    } finally { roomBusy = false; if (btn) btn.disabled = false; }
  }
  async function announce(){
    if(!activeRoom||!['teacher','admin'].includes(profile.role))return;
    const body=prompt('ຂໍ້ຄວາມປະກາດ:'); if(!body||!body.trim())return;
    const {error}=await sb.from('group_messages').insert({group_id:activeRoom.id,sender_id:me.id,body:body.trim(),message_type:'announcement'});
    if(error)showToast('ປະກາດບໍ່ສຳເລັດ: '+error.message); else await loadMessages('new');
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

  window.BAuth = { mode: showAuth, submit, logout, refresh, upd, toggle, openRoom, announce, del: delUser, members: toggleMembers, profile: openProfileSheet, share: shareRoom, rename: renameRoom, reload: loadAdmin, filter: f => { adminFilter = f; renderAdminList(); }, search: v => { adminQ = v; renderAdminList(); } };
  gate('<p class="text-sm text-slate-400"><span class="spin"></span>ກຳລັງໂຫຼດ...</p>');
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'TOKEN_REFRESHED') return;
    if (ev === 'PASSWORD_RECOVERY') { recovering = true; setTimeout(() => showAuth('reset'), 0); return; }
    if (recovering) return; // keep the "set new password" form until it is submitted
    if (ev === 'SIGNED_IN' && me && session && session.user.id === me.id && profile && profile.status === 'approved') return; // tab refocus
    setTimeout(() => onSession(session), 0); // never await supabase calls inside this callback
  });
})();
