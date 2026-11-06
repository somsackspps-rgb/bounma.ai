// Bounma AI v3.4 - PWA: install button (Android/iOS/desktop) + "new version" notice
(function () {
  'use strict';
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const inApp = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|Messenger|Zalo/i.test(ua);
  const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  const $ = id => document.getElementById(id);
  let deferred = null, updating = false;

  const toast = m => { if (typeof showToast === 'function') showToast(m); };

  // ---------- install ----------
  function steps(list) {
    return '<ol class="space-y-3 text-sm text-slate-200 list-decimal pl-5">' + list.map(s => '<li>' + s + '</li>').join('') + '</ol>';
  }
  function modalBody() {
    if (inApp) {
      return '<p class="text-sm text-amber-300 mb-3">⚠️ ກຳລັງເປີດຜ່ານແອັບ (Facebook / Line / TikTok ...) ຕິດຕັ້ງບໍ່ໄດ້ຢູ່ບ່ອນນີ້</p>' +
        steps(['ກົດປຸ່ມ <b>⋮ / ⋯</b> ມຸມຂວາ', 'ເລືອກ <b>ເປີດໃນ Browser</b> (Safari ຫຼື Chrome)', 'ກັບມາກົດປຸ່ມ “ຕິດຕັ້ງແອັບ” ອີກຄັ້ງ']);
    }
    if (isIOS) {
      return '<p class="text-xs text-slate-400 mb-3">iPhone / iPad ບໍ່ອະນຸຍາດໃຫ້ຕິດຕັ້ງດ້ວຍປຸ່ມໂດຍກົງ — ເຮັດຕາມ 3 ຂັ້ນຕອນນີ້ (ໃຊ້ Safari ແນະນຳທີ່ສຸດ):</p>' +
        steps(['ກົດປຸ່ມ <b>ແບ່ງປັນ (Share)</b> <span class="inline-block px-1.5 border border-slate-500 rounded">⬆︎</span> ທີ່ແຖບລຸ່ມ (ຫຼືແຖບເທິງຂອງ iPad)',
          'ເລື່ອນລົງ ແລ້ວເລືອກ <b>“ເພີ່ມໃສ່ໜ້າຈໍຫຼັກ / Add to Home Screen”</b>',
          'ກົດ <b>ເພີ່ມ / Add</b> — ໄອຄອນບຸນມາຈະປາກົດໃນໜ້າຈໍຫຼັກ']);
    }
    if (isAndroid) {
      return '<p class="text-xs text-slate-400 mb-3">ຖ້າບໍ່ມີໜ້າຕ່າງຕິດຕັ້ງຂຶ້ນມາ ໃຫ້ເຮັດດ້ວຍມື (Chrome):</p>' +
        steps(['ກົດເມນູ <b>⋮</b> ມຸມຂວາເທິງ', 'ເລືອກ <b>“ຕິດຕັ້ງແອັບ / Install app”</b> ຫຼື <b>“ເພີ່ມໃສ່ໜ້າຈໍຫຼັກ”</b>', 'ກົດ <b>ຕິດຕັ້ງ</b>']);
    }
    return '<p class="text-xs text-slate-400 mb-3">ຄອມພິວເຕີ (Chrome / Edge):</p>' +
      steps(['ເບິ່ງທີ່ແຖບ URL ດ້ານຂວາ ຈະມີໄອຄອນ <b>ຕິດຕັ້ງ (⊕ / ຈໍພ້ອມລູກສອນ)</b>', 'ກົດ ແລ້ວເລືອກ <b>ຕິດຕັ້ງ / Install</b>']);
  }
  function openModal() {
    let m = $('install-modal');
    if (!m) {
      m = document.createElement('div'); m.id = 'install-modal';
      m.className = 'fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/70';
      m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'install-title');
      m.addEventListener('click', e => { if (e.target === m) closeModal(); });
      document.body.appendChild(m);
    }
    m.innerHTML = '<div class="app-card w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">' +
      '<div class="flex items-center gap-3"><img src="assets/bounma-mascot-128.png" alt="" class="w-12 h-12 object-contain"><div><h2 id="install-title" class="font-extrabold text-lg">ຕິດຕັ້ງ ບຸນມາ AI</h2><p class="text-xs text-slate-400">ໃຊ້ໄດ້ເໝືອນແອັບ • ເປີດໄວ • ໃຊ້ Offline ໄດ້ບາງສ່ວນ</p></div></div>' +
      modalBody() +
      '<button id="install-close" class="w-full bg-slate-700 hover:bg-slate-600 rounded-xl py-2.5 text-sm font-bold">ປິດ</button></div>';
    $('install-close').onclick = closeModal; m.classList.remove('hidden');
    $('install-close').focus();
  }
  function closeModal() { const m = $('install-modal'); if (m) m.classList.add('hidden'); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  async function install() {
    if (deferred) {
      deferred.prompt();
      try { const r = await deferred.userChoice; if (r && r.outcome === 'accepted') toast('ກຳລັງຕິດຕັ້ງ...'); } catch (_) {}
      deferred = null; return;
    }
    openModal();
  }

  function refreshButtons() {
    const show = !isStandalone();
    document.querySelectorAll('[data-install-btn]').forEach(b => b.classList.toggle('hidden', !show));
  }
  function mountButtons() {
    const hdr = document.querySelector('header > div');
    if (hdr && !$('install-btn')) {
      const b = document.createElement('button');
      b.id = 'install-btn'; b.type = 'button'; b.setAttribute('data-install-btn', '');
      b.className = 'bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl px-3.5 py-2 flex items-center gap-1.5 shadow-lg shadow-orange-600/20';
      b.innerHTML = '<span aria-hidden="true">📲</span><span>ຕິດຕັ້ງແອັບ</span>';
      b.onclick = install;
      const dev = hdr.lastElementChild; hdr.insertBefore(b, dev);
    }
    refreshButtons();
  }

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refreshButtons(); });
  window.addEventListener('appinstalled', () => { deferred = null; toast('ຕິດຕັ້ງບຸນມາ AI ແລ້ວ 🎉'); refreshButtons(); });
  if (window.matchMedia) { try { matchMedia('(display-mode: standalone)').addEventListener('change', refreshButtons); } catch (_) {} }

  // ---------- update notice ----------
  function showUpdate(worker) {
    if ($('update-bar')) return;
    const bar = document.createElement('div'); bar.id = 'update-bar'; bar.setAttribute('role', 'status');
    bar.className = 'fixed bottom-20 md:bottom-4 inset-x-3 md:left-auto md:right-4 md:w-96 z-[75] app-card rounded-2xl p-3 flex items-center gap-3 border border-orange-500/40 shadow-2xl';
    bar.innerHTML = '<span class="text-xl" aria-hidden="true">✨</span><div class="flex-1 text-xs"><b class="block text-sm">ມີເວີຊັນໃໝ່</b>ກົດອັບເດດເພື່ອໃຊ້ຟີເຈີຣ໌ລ່າສຸດ</div>' +
      '<button id="update-go" class="bg-orange-600 hover:bg-orange-500 rounded-lg px-3 py-2 text-xs font-bold">ອັບເດດ</button><button id="update-later" class="text-slate-400 text-xs px-1" aria-label="ປິດ">✕</button>';
    document.body.appendChild(bar);
    $('update-go').onclick = () => { updating = true; worker.postMessage({ type: 'SKIP_WAITING' }); };
    $('update-later').onclick = () => bar.remove();
  }
  async function register() {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdate(nw); });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload(); });
      const check = () => reg.update().catch(() => {});
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    } catch (e) { console.warn('SW registration failed', e); }
  }

  window.BPWA = { install, register, openInstallHelp: openModal, isIOS, isAndroid, isStandalone };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButtons); else mountButtons();
})();
