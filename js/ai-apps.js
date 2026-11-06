// Bounma AI v3.4 - open AI apps (app first, web as fallback) and hand a prompt over.
// ONE table to maintain: edit APPS below if an app changes its package name / link.
(function () {
  'use strict';
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const $ = id => document.getElementById(id);

  // web: normal website | q: URL that pre-fills a prompt (only where the service supports it)
  // pkg: Android package (forces the installed app, falls back to web) | ios: custom URL scheme (optional, see iOS mode)
  const APPS = [
    { id: 'chatgpt', name: 'ChatGPT', by: 'OpenAI', tag: 'ແຊັດທົ່ວໄປ • ຂຽນ • ວິເຄາະ • ສ້າງຮູບ', badge: 'GPT', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', btn: 'bg-emerald-600 hover:bg-emerald-500',
      web: 'https://chatgpt.com/', q: 'https://chatgpt.com/?q=', pkg: 'com.openai.chatgpt', ios: 'chatgpt://' },
    { id: 'gemini', name: 'Google Gemini', by: 'Google', tag: 'ວາງແຜນ • ຮ່າງ • ເຊື່ອມ Google', badge: 'GEM', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30', btn: 'bg-blue-600 hover:bg-blue-500',
      web: 'https://gemini.google.com/app', pkg: 'com.google.android.apps.bard', ios: 'googlegemini://' },
    { id: 'claude', name: 'Claude', by: 'Anthropic', tag: 'ຂຽນຍາວ • ອ່ານເອກະສານ • ໂຄ້ດ', badge: 'CL', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30', btn: 'bg-amber-600 hover:bg-amber-500',
      web: 'https://claude.ai/new', q: 'https://claude.ai/new?q=', pkg: 'com.anthropic.claude', ios: 'claude://' },
    { id: 'perplexity', name: 'Perplexity', by: 'Perplexity AI', tag: 'ຄົ້ນຄວ້າ • ມີແຫຼ່ງອ້າງອີງ', badge: 'PX', cls: 'bg-teal-500/20 text-teal-300 border-teal-500/30', btn: 'bg-teal-600 hover:bg-teal-500',
      web: 'https://www.perplexity.ai/', q: 'https://www.perplexity.ai/search?q=', pkg: 'ai.perplexity.app.android' },
    { id: 'copilot', name: 'Microsoft Copilot', by: 'Microsoft', tag: 'ເຊື່ອມ Word / Excel / Windows', badge: 'CP', cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', btn: 'bg-indigo-600 hover:bg-indigo-500',
      web: 'https://copilot.microsoft.com/', q: 'https://copilot.microsoft.com/?q=', pkg: 'com.microsoft.copilot' },
    { id: 'deepseek', name: 'DeepSeek', by: 'DeepSeek', tag: 'ຄະນິດ • ເຫດຜົນ • ໂຄ້ດ', badge: 'DS', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/30', btn: 'bg-sky-600 hover:bg-sky-500',
      web: 'https://chat.deepseek.com/', pkg: 'com.deepseek.chat' },
    { id: 'notebooklm', name: 'NotebookLM', by: 'Google', tag: 'ຖາມ-ຕອບຈາກເອກະສານຂອງເຮົາ', badge: 'NB', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30', btn: 'bg-purple-600 hover:bg-purple-500',
      web: 'https://notebooklm.google.com/', pkg: 'com.google.android.apps.labs.language.tailwind' },
    { id: 'aistudio', name: 'Google AI Studio', by: 'Google', tag: 'ເອົາ Gemini API Key ຟຣີ (ເວັບເທົ່ານັ້ນ)', badge: 'KEY', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30', btn: 'bg-orange-600 hover:bg-orange-500',
      web: 'https://aistudio.google.com/', webOnly: true }
  ];
  const byId = id => APPS.find(a => a.id === id);
  const SEND_IDS = ['chatgpt', 'gemini', 'claude', 'perplexity', 'copilot', 'deepseek'];
  const pref = { get: () => { try { return localStorage.getItem('bounma_ios_mode') || 'link'; } catch (_) { return 'link'; } }, set: v => { try { localStorage.setItem('bounma_ios_mode', v); } catch (_) {} } };

  function copy(text) {
    if (!text) return;
    if (typeof copyText === 'function') { copyText(text); return; }
    try { navigator.clipboard.writeText(text); } catch (_) {}
  }
  const webUrl = (app, prompt) => {
    if (prompt && app.q) { const u = app.q + encodeURIComponent(prompt); if (u.length <= 1900) return u; }
    return app.web;
  };
  function intentUrl(url, pkg) {
    const u = new URL(url), fb = encodeURIComponent(url);
    return 'intent://' + u.host + u.pathname + u.search + '#Intent;scheme=https;package=' + pkg + ';S.browser_fallback_url=' + fb + ';end';
  }
  // Open an app. prompt is optional; it is always copied to the clipboard as a safety net.
  function open(id, prompt) {
    const app = byId(id); if (!app) return;
    const p = (prompt || '').trim();
    if (p) copy(p);
    const url = webUrl(app, p);
    if (p && !(app.q && url !== app.web)) { if (typeof showToast === 'function') showToast('ຄັດລອກ Prompt ແລ້ວ — ເປີດແອັບແລ້ວກົດວາງ (Paste)'); }
    if (app.webOnly) { window.open(url, '_blank', 'noopener,noreferrer'); return; }
    if (isAndroid && app.pkg) { location.href = intentUrl(url, app.pkg); return; }
    if (isIOS) {
      if (pref.get() === 'scheme' && app.ios) {
        location.href = app.ios;
        setTimeout(() => { if (!document.hidden) location.href = url; }, 1500);
      } else location.href = url; // universal link: opens the app when installed, otherwise Safari
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  function storeUrl(app) { return isAndroid && app.pkg ? 'https://play.google.com/store/apps/details?id=' + app.pkg : ''; }

  function renderGrid() {
    const host = $('ai-apps-grid'); if (!host) return;
    host.innerHTML = APPS.map(a => {
      const st = storeUrl(a);
      return '<div class="app-card p-5 rounded-2xl border border-slate-800 flex flex-col gap-3">' +
        '<div class="flex items-center gap-3"><div class="w-11 h-11 rounded-xl ' + a.cls + ' flex items-center justify-center font-bold text-xs border" aria-hidden="true">' + a.badge + '</div>' +
        '<div class="min-w-0"><h3 class="font-bold text-white text-sm">' + a.name + '</h3><p class="text-xs text-slate-400">' + a.by + ' • ' + a.tag + '</p></div></div>' +
        '<div class="flex gap-2 mt-auto"><button type="button" data-open="' + a.id + '" class="flex-1 py-2.5 ' + a.btn + ' text-white text-xs font-bold rounded-xl">' + (a.webOnly ? 'ເປີດເວັບ' : 'ເປີດແອັບ') + '</button>' +
        (a.webOnly ? '' : '<a href="' + a.web + '" target="_blank" rel="noopener noreferrer" class="px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-xl">ເວັບ</a>') +
        (st ? '<a href="' + st + '" target="_blank" rel="noopener noreferrer" class="px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-xl" title="ຕິດຕັ້ງຈາກ Play Store">⬇︎</a>' : '') + '</div></div>';
    }).join('');
    host.querySelectorAll('[data-open]').forEach(b => b.onclick = () => open(b.getAttribute('data-open')));
    const m = $('ios-mode-box');
    if (m) {
      m.classList.toggle('hidden', !isIOS);
      m.innerHTML = '<p class="text-xs font-bold mb-2">📱 iPhone: ວິທີເປີດແອັບ</p>' +
        ['link|ລິ້ງມາດຕະຖານ (ແນະນຳ — ປອດໄພ)', 'scheme|ເປີດຜ່ານ URL ຂອງແອັບ (ຖ້າບໍ່ມີແອັບອາດຂຶ້ນ error)'].map(x => { const [v, t] = x.split('|'); return '<label class="flex items-center gap-2 text-xs text-slate-300 py-1"><input type="radio" name="ios-mode" value="' + v + '" class="accent-orange-500" ' + (pref.get() === v ? 'checked' : '') + '> ' + t + '</label>'; }).join('');
      m.querySelectorAll('input').forEach(i => i.onchange = () => { pref.set(i.value); if (typeof showToast === 'function') showToast('ບັນທຶກແລ້ວ'); });
    }
  }
  // chips "send to AI" - used by Prompt Builder and Tutor.  getText() returns the text to send.
  function sendRow(hostId, getText, label) {
    const host = $(hostId); if (!host) return;
    host.innerHTML = '<p class="text-[11px] text-slate-400 mb-1.5">' + (label || 'ສົ່ງໄປໃຫ້ AI ສ້າງເລີຍ:') + '</p><div class="flex flex-wrap gap-1.5">' +
      SEND_IDS.map(id => { const a = byId(id); return '<button type="button" data-send="' + id + '" class="text-xs font-bold text-white ' + a.btn + ' rounded-xl px-3 py-2">' + a.name.replace('Microsoft ', '').replace('Google ', '') + ' ↗</button>'; }).join('') + '</div>';
    host.querySelectorAll('[data-send]').forEach(b => b.onclick = () => {
      const t = (typeof getText === 'function' ? getText() : getText) || '';
      if (!t.trim()) { if (typeof showToast === 'function') showToast('ຍັງບໍ່ມີຂໍ້ຄວາມໃຫ້ສົ່ງ'); return; }
      if (/\[[^\]\n]{2,}\]/.test(t) && typeof BPrompt !== 'undefined' && BPrompt.hasPlaceholders(t) && !confirm('ຍັງມີຂໍ້ຄວາມໃນ [ ] ທີ່ຍັງບໍ່ໄດ້ແກ້. ສົ່ງຕໍ່ເລີຍບໍ?')) return;
      open(b.getAttribute('data-send'), t);
    });
  }
  window.BAI = { APPS, open, sendRow, renderGrid, isIOS, isAndroid };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderGrid); else renderGrid();
})();
