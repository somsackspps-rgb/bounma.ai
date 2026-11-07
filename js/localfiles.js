// Bounma AI v3.4 - classroom attachments are kept on the user's own device (IndexedDB), never on Supabase.
(function () {
  'use strict';
  const DB = 'bounma-files', ST = 'files', MAX = 50 * 1024 * 1024;
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('IndexedDB not supported'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore(ST, { keyPath: 'id' }); s.createIndex('room', 'room'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error); };
  }));
  async function run(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(ST, mode); let out;
      const rq = fn(t.objectStore(ST)); if (rq) rq.onsuccess = () => { out = rq.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted'));
    });
  }
  const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(16).slice(2);
  const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  async function put(room, file) {
    if (file.size > MAX) throw new Error('ໄຟລ໌ໃຫຍ່ເກີນ ' + fmtSize(MAX));
    const id = uid();
    await run('readwrite', s => s.put({ id, room, name: file.name, type: file.type || 'application/octet-stream', size: file.size, blob: file, created: Date.now(), kind: 'own' }));
    return id;
  }
  // downloaded shared files are cached on the device, so opening them again costs no Supabase bandwidth
  async function putCached(id, room, blob, name) {
    await run('readwrite', s => s.put({ id, room, name: name || 'file', type: blob.type || 'application/octet-stream', size: blob.size, blob, created: Date.now(), kind: 'cache' }));
    trimCache();
  }
  async function trimCache(max) {
    try {
      const all = await run('readonly', s => s.getAll()), c = (all || []).filter(r => r.kind === 'cache').sort((a, b) => a.created - b.created);
      let tot = c.reduce((n, r) => n + r.size, 0); const cap = max || 150 * 1048576;
      for (const r of c) { if (tot <= cap) break; await remove(r.id); tot -= r.size; }
    } catch (_) { /* ignore */ }
  }
  const get = id => run('readonly', s => s.get(id));
  const remove = id => run('readwrite', s => s.delete(id));
  async function has(id) { try { return !!(await get(id)); } catch (_) { return false; } }

  function triggerDownload(rec) {
    const url = URL.createObjectURL(rec.blob), a = document.createElement('a');
    a.href = url; a.download = rec.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function download(id) { const rec = await get(id); if (!rec) return false; triggerDownload(rec); return true; }
  // images -> lightbox (no popup blocking); pdf -> new tab with download fallback; others -> download
  async function view(id) {
    const rec = await get(id); if (!rec) return false;
    if (rec.type.startsWith('image/')) {
      const url = URL.createObjectURL(rec.blob);
      const box = document.createElement('div');
      box.className = 'fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-4'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      box.innerHTML = '<img alt="" class="max-w-full max-h-full rounded-xl"><button class="fixed top-4 right-4 bg-slate-800 rounded-full w-10 h-10 text-lg" aria-label="ປິດ">✕</button>';
      box.querySelector('img').src = url;
      const close = () => { box.remove(); URL.revokeObjectURL(url); document.removeEventListener('keydown', esc); };
      const esc = e => { if (e.key === 'Escape') close(); };
      box.onclick = e => { if (e.target === box || e.target.tagName === 'BUTTON') close(); };
      document.addEventListener('keydown', esc); document.body.appendChild(box); box.querySelector('button').focus();
    } else if (rec.type === 'application/pdf') {
      const url = URL.createObjectURL(rec.blob), w = window.open(url, '_blank');
      if (!w) triggerDownload(rec);
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } else triggerDownload(rec);
    return true;
  }
  async function persist() { try { return !!(navigator.storage && navigator.storage.persist && await navigator.storage.persist()); } catch (_) { return false; } }
  // marker stored in group_messages.attachment_path:  local:<id>|<name>|<size>|<mime>
  const mark = (id, f) => 'local:' + id + '|' + encodeURIComponent(f.name).slice(0, 180) + '|' + f.size + '|' + (f.type || '');
  function parse(p) {
    if (!p || p.indexOf('local:') !== 0) return null;
    const a = p.slice(6).split('|');
    let name = a[1] || 'file'; try { name = decodeURIComponent(name); } catch (_) {}
    return { id: a[0], name, size: +a[2] || 0, type: a[3] || '' };
  }
  window.BFiles = { MAX, put, putCached, trimCache, get, remove, has, view, download, persist, mark, parse, fmtSize, supported: !!window.indexedDB };
})();
