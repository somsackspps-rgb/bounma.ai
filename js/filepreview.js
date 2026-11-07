// Bounma AI v3.5 - file preview (image / PDF / video / audio / text), image compression, thumbnails.
(function () {
  'use strict';
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const EXT = { pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', md: 'text/markdown', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'video/mp4' };
  const guessMime = (name, type) => type || EXT[(String(name).split('.').pop() || '').toLowerCase()] || '';
  function iconFor(mime, name) {
    const t = guessMime(name, mime);
    if (t.startsWith('image/')) return '🖼️'; if (t === 'application/pdf') return '📕'; if (t.includes('wordprocessing')) return '📝';
    if (t.includes('spreadsheet') || t === 'text/csv') return '📊'; if (t.includes('presentation')) return '📽️';
    if (t.startsWith('audio/')) return '🎵'; if (t.startsWith('video/')) return '🎬'; if (t.startsWith('text/')) return '📄'; return '📎';
  }
  const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
  async function bitmap(file) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) { return await createImageBitmap(file); }
  }
  // Shrinks photos so chat files stay small on the free Supabase plan. GIFs and tiny images are left untouched.
  async function compressImage(file, opt) {
    const o = Object.assign({ max: 1600, quality: 0.8 }, opt || {});
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    try {
      const bmp = await bitmap(file), s = Math.min(1, o.max / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(bmp, 0, 0, w, h); if (bmp.close) bmp.close();
      const blob = await toBlob(c, 'image/jpeg', o.quality);
      if (blob && (s < 1 || blob.size < file.size)) return new File([blob], String(file.name).replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (_) { /* keep original */ }
    return file;
  }
  // small JPEG data URL (<= ~10 KB) shown in chat so nobody downloads the full file just to see what it is
  async function makeThumb(file) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return null;
    try {
      const bmp = await bitmap(file);
      for (const [side, q] of [[160, 0.6], [120, 0.5], [90, 0.45]]) {
        const s = Math.min(1, side / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', q);
        if (url.length <= 11000) { if (bmp.close) bmp.close(); return url; }
      }
      if (bmp.close) bmp.close();
    } catch (_) { /* no thumb */ }
    return null;
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name || 'file'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('script load failed')); document.head.appendChild(s); });
  }
  async function renderPdf(blob, body) {
    if (!window.pdfjsLib) await loadScript(PDFJS);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const pdf = await window.pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
    body.innerHTML = '<div class="text-xs text-slate-400 mb-2">PDF • ' + pdf.numPages + ' ໜ້າ</div><div id="pv-pages" class="space-y-3"></div><div class="text-center mt-3"><button id="pv-more" type="button" class="chip hidden">ໂຫຼດໜ້າເພີ່ມ</button></div>';
    const host = body.querySelector('#pv-pages'), more = body.querySelector('#pv-more'); let next = 1;
    async function draw(n) {
      for (let i = 0; i < n && next <= pdf.numPages; i++, next++) {
        const page = await pdf.getPage(next), base = page.getViewport({ scale: 1 });
        const width = Math.max(240, Math.min(body.clientWidth - 16, 900)), scale = (width / base.width) * Math.min(2, window.devicePixelRatio || 1);
        const vp = page.getViewport({ scale }), c = document.createElement('canvas');
        c.width = Math.floor(vp.width); c.height = Math.floor(vp.height); c.className = 'w-full rounded-lg bg-white'; host.appendChild(c);
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      }
      more.classList.toggle('hidden', next > pdf.numPages);
    }
    more.onclick = () => draw(5);
    await draw(3);
  }
  let current = null;
  function close() {
    if (!current) return; try { current.urls.forEach(u => URL.revokeObjectURL(u)); } catch (_) {}
    document.removeEventListener('keydown', current.esc); current.box.remove(); current = null;
  }
  // spec: { name, type, size, load: () => Promise<Blob> }
  async function open(spec) {
    close();
    const box = document.createElement('div');
    box.className = 'fixed inset-0 z-[90] bg-black/85 flex items-end sm:items-center justify-center p-0 sm:p-4';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'ຕົວຢ່າງໄຟລ໌');
    box.innerHTML = '<div class="app-card w-full sm:max-w-3xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden">' +
      '<div class="flex items-center gap-2 p-3 border-b border-slate-800"><div class="min-w-0 flex-1"><p class="font-bold text-sm truncate">' + iconFor(spec.type, spec.name) + ' ' + esc(spec.name) + '</p><p class="text-[11px] text-slate-400">' + (spec.size ? fmtSize(spec.size) : '') + '</p></div>' +
      '<button id="pv-dl" type="button" class="chip" disabled>⬇︎ ດາວໂຫຼດ</button><button id="pv-x" type="button" class="chip" aria-label="ປິດ">✕</button></div>' +
      '<div id="pv-body" class="p-3 overflow-auto flex-1 min-h-[160px]"><p class="text-sm text-slate-400"><span class="spin"></span> ກຳລັງໂຫຼດໄຟລ໌...</p></div></div>';
    const esc2 = e => { if (e.key === 'Escape') close(); };
    current = { box, urls: [], esc: esc2 };
    box.addEventListener('click', e => { if (e.target === box) close(); });
    document.addEventListener('keydown', esc2); document.body.appendChild(box);
    box.querySelector('#pv-x').onclick = close; box.querySelector('#pv-x').focus();
    const body = box.querySelector('#pv-body'), dl = box.querySelector('#pv-dl'), me = current;
    let blob;
    try { blob = await spec.load(); } catch (e) { if (current === me) body.innerHTML = '<p class="text-sm text-red-300">ໂຫຼດໄຟລ໌ບໍ່ໄດ້: ' + esc(e.message || e) + '</p>'; return; }
    if (current !== me) return;
    dl.disabled = false; dl.onclick = () => download(blob, spec.name);
    const type = guessMime(spec.name, spec.type || blob.type).toLowerCase(), url = URL.createObjectURL(blob); me.urls.push(url);
    if (type.startsWith('image/')) body.innerHTML = '<img alt="" class="max-w-full mx-auto rounded-xl" src="' + url + '">';
    else if (type.startsWith('video/')) body.innerHTML = '<video controls playsinline class="w-full rounded-xl" src="' + url + '"></video>';
    else if (type.startsWith('audio/')) body.innerHTML = '<audio controls class="w-full" src="' + url + '"></audio>';
    else if (type === 'application/pdf') {
      try { await renderPdf(blob, body); }
      catch (_) {
        if (current !== me) return;
        if (!mobile) body.innerHTML = '<iframe title="PDF" class="w-full h-[70vh] rounded-xl bg-white" src="' + url + '"></iframe>';
        else body.innerHTML = '<p class="text-sm text-slate-300 mb-3">ເບິ່ງຕົວຢ່າງໃນແອັບບໍ່ໄດ້ (ຕ້ອງມີອິນເຕີເນັດເພື່ອໂຫຼດຕົວອ່ານ PDF)</p><a class="chip inline-block" target="_blank" rel="noopener" href="' + url + '">ເປີດ PDF ໃນແທັບໃໝ່</a>';
      }
    } else if (type.startsWith('text/')) {
      const t = await blob.text(), pre = document.createElement('pre');
      pre.className = 'text-xs whitespace-pre-wrap break-words bg-slate-950/70 rounded-xl p-3'; pre.textContent = t.slice(0, 200000) + (t.length > 200000 ? '\n\n… (ສະແດງ 200,000 ຕົວອັກສອນທຳອິດ)' : '');
      body.innerHTML = ''; body.appendChild(pre);
    } else body.innerHTML = '<div class="text-center py-8"><p class="text-5xl mb-3">' + iconFor(type, spec.name) + '</p><p class="text-sm text-slate-300">ໄຟລ໌ Word / Excel / PowerPoint ເບິ່ງຕົວຢ່າງໃນແອັບບໍ່ໄດ້</p><p class="text-xs text-slate-500 mt-1">ກົດ “ດາວໂຫຼດ” ແລ້ວເປີດດ້ວຍແອັບ Office</p></div>';
  }
  window.BView = { open, close, compressImage, makeThumb, download, iconFor, guessMime, fmtSize, mobile };
})();
