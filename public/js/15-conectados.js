/* U2U · Conectados ahora + sala grupal «Plaza UPC» (parte E)
   Depende de: 01-estado (esc, price, SEL, PR, ME, CAMP), 02-render (V, S, R, nav, hd, openP, M, X, onAfterRender),
   05-socket (sock, LV, uname), 08-ui-vivo (sellerIdx, RS, empty), 12-cuenta (campusIdx, lockMsg), 13-comision (comRestricted, comModal).
   Sin onclick con textos dinámicos: todo va por delegación con data-live="..." */
(() => {
  const LB = { list: [], loaded: false, loading: false, pid: null, picker: false, draft: '' };
  const users = () => (LV.pres && Array.isArray(LV.pres.users) ? LV.pres.users : []);
  const me = () => (LV.me ? LV.me.uid : null);
  const first = (n) => String(n || '').split(' ')[0];
  const ini = (n) => esc((String(n || '?')[0] || '?').toUpperCase());

  /* ---------- API pública ---------- */
  window.isOnline = (uid) => !!uid && users().some((u) => u.uid == uid);
  window.onlineDot = (uid) => (isOnline(uid) ? '<span class="text-emerald-600 text-[11px] font-semibold ml-1">● En línea</span>' : '');

  /* ---------- presencia -> SEL / RS (para abrir su perfil aunque aún no haya cargado sus productos) ---------- */
  window.livePresence = () => {
    users().forEach((u) => {
      if (!u || u.uid === me()) return;
      const k = u.cp >= 0 ? u.cp : campusIdx(u.campus), prev = RS[u.uid];
      const idx = sellerIdx(u.uid, u.name, k >= 0 ? k : (prev != null ? SEL[prev].cp : 0), u.official);
      if (idx !== ME) SEL[idx].prof = { career: u.career, cycle: u.cycle, campus: u.campus, verified: u.verified };
    });
    if (S.s === 'home') homeCardUpdate();
    else if (S.s === 'msgs' && MT === 'live') stripUpdate();
    else if (['detail', 'seller', 'lchat', 'lobby'].includes(S.s)) { if (S.s === 'lobby') stripUpdate(); else if (S.s === 'lchat') presUI(); else R(1); }
    else if (S.s === 'msgs') R(1);
  };

  /* ---------- tarjeta «Conectados ahora en U2U» en Inicio ---------- */
  const mini = (sp) => `<button data-live="open-p" data-pid="${+sp.id}" class="w-full flex items-center gap-2 text-left bg-slate-50 rounded-lg px-2 py-1.5"><span class="w-8 h-8 rounded-md overflow-hidden bg-white grid place-items-center shrink-0 text-base">${thumb(sp)}</span><span class="flex-1 min-w-0 text-[11px] font-semibold truncate">${esc(sp.t)}</span><span class="text-[11px] font-bold text-brand shrink-0">${price(sp)}</span></button>`;
  const thumb = (sp) => (/^(\/foto\/|data:image\/)/.test(sp.ph || '') ? `<img src="${esc(sp.ph)}" alt="" class="w-full h-full object-cover">` : esc(sp.e || '📦'));
  const uCard = (u) => {
    const sps = (u.sampleProducts || []).slice(0, 2);
    return `<div class="shrink-0 w-[236px] bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col gap-2">
 <div class="flex items-center gap-2"><div class="relative w-10 h-10 rounded-full bg-brand text-white grid place-items-center font-bold">${ini(u.name)}<span class="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></span></div>
  <div class="min-w-0"><p class="font-bold text-sm truncate">${esc(u.name)}${u.official ? ' <span class="text-[10px] font-bold text-brand">Oficial ✓</span>' : ''}</p><p class="text-[11px] text-slate-500 truncate">${esc(u.career || 'Estudiante UPC')}${u.campus ? ' · ' + esc(u.campus) : ''}</p></div></div>
 ${sps.length ? `<div class="flex flex-col gap-1">${sps.map(mini).join('')}</div><button data-live="seller" data-uid="${esc(u.uid)}" class="text-[11px] font-semibold text-brand text-left">Ver sus ${+u.activeCount} publicaci${u.activeCount == 1 ? 'ón' : 'ones'}</button>` : '<p class="text-[11px] text-slate-400 py-2">Explorando productos en campus</p>'}
 <button data-live="dm" data-uid="${esc(u.uid)}" class="btn !py-2 !text-xs mt-auto">💬 Chatear</button></div>`;
  };
  const homeCardH = () => {
    const otros = users().filter((u) => u.uid !== me()), n = esc(uname() || '');
    const msg = otros.length ? `¡Hola, ${n}! Aprovecha que tienes a estos estudiantes conectados ahora y fíjate en los productos que tienen en venta o alquiler.` : `¡Hola, ${n}! Sé el primero en saludar en la sala en vivo mientras se conectan más estudiantes UPC.`;
    return `<div id="live-card" class="mx-5 mt-5 rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
 <div class="flex items-center gap-2"><span class="relative flex w-2.5 h-2.5"><span class="animate-ping absolute inline-flex w-full h-full rounded-full bg-emerald-500 opacity-60"></span><span class="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500"></span></span><h3 class="font-extrabold text-navy">Conectados ahora en U2U</h3></div>
 <p class="text-xs text-slate-500 mt-1 leading-snug">${msg}</p>
 ${otros.length ? `<div class="flex gap-3 overflow-x-auto no-sb mt-3 pb-1">${otros.map(uCard).join('')}</div>` : ''}
 <button data-live="lobby" class="btn mt-3 !text-sm">👥 Entrar al chat grupal en vivo (Plaza UPC)</button></div>`;
  };
  const homeCardEligible = () => !!(window.io && LV.me && S.s === 'home' && !(F.q && F.q.trim()));
  function homeCardUpdate() {
    const v = $('#v'); if (!v || !homeCardEligible()) return;
    const old = v.querySelector('#live-card'), html = homeCardH();
    if (old) { old.outerHTML = html; return; }
    const ai = v.querySelector('div[style*="#6d28d9"]'); // bloque «U2U AI · tu asistente»
    if (ai) ai.insertAdjacentHTML('afterend', html);
  }

  /* ---------- sala grupal ---------- */
  const msgH = (m) => {
    const mine = m.uid === me(), p = m.product;
    return `<div data-mid="${esc(m.id)}" class="flex ${mine ? 'justify-end' : 'justify-start'} mb-2"><div class="max-w-[82%]">
 ${mine ? '' : `<p class="text-[10px] text-slate-400 ml-1">${esc(m.name)}${m.official ? ' · Oficial ✓' : ''}${m.career ? ' · ' + esc(m.career) : ''}</p>`}
 <div class="px-3 py-2 rounded-2xl text-sm break-words ${mine ? 'bg-brand text-white rounded-br-sm' : 'bg-white border rounded-bl-sm'}">${esc(m.text)}
  ${p ? `<button data-live="open-p" data-pid="${+p.id}" class="mt-2 w-full flex items-center gap-2 text-left rounded-xl p-2 ${mine ? 'bg-white/15' : 'bg-slate-50'}"><span class="w-10 h-10 rounded-lg overflow-hidden bg-white grid place-items-center shrink-0 text-lg">${thumb(p)}</span><span class="min-w-0"><span class="block text-xs font-bold truncate">${esc(p.t)}</span><span class="block text-xs ${mine ? 'text-white' : 'text-brand'} font-semibold">${price(p)}</span></span></button>` : ''}
  <p class="text-[9px] opacity-60 text-right mt-0.5 flex items-center justify-end gap-2">${LV.adm ? `<button data-live="del-msg" data-id="${esc(m.id)}" aria-label="Eliminar mensaje" class="opacity-70"><i data-lucide="trash-2" class="w-3 h-3"></i></button>` : ''}${tm(m.ts)}</p></div></div></div>`;
  };
  const feedH = () => (LB.list.length ? LB.list.map(msgH).join('') : `<p class="text-center text-xs text-slate-400 mt-10">${LB.loading ? 'Cargando…' : 'Aún no hay mensajes. ¡Saluda a los conectados!'}</p>`);
  const stripH = () => {
    const l = users();
    return l.length ? l.map((u) => `<button data-live="peek" data-uid="${esc(u.uid)}" class="shrink-0 flex flex-col items-center gap-1 w-14" aria-label="${esc(u.name)}"><span class="relative w-11 h-11 rounded-full bg-brand text-white grid place-items-center font-bold">${ini(u.name)}<span class="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></span></span><span class="text-[10px] text-slate-600 truncate w-full text-center">${esc(first(u.name))}</span></button>`).join('') : '<p class="text-xs text-slate-400">Nadie más conectado por ahora.</p>';
  };
  const pickerH = () => {
    const mine = PR.filter((p) => p.s === ME && p.id > 100 && p.status === 'available');
    return mine.length ? mine.map((p) => `<button data-live="attach" data-pid="${+p.id}" class="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-slate-50"><span class="w-8 h-8 rounded-md overflow-hidden bg-slate-100 grid place-items-center shrink-0">${pic(p)}</span><span class="flex-1 min-w-0 text-xs font-semibold truncate">${esc(p.t)}</span><span class="text-xs font-bold text-brand">${price(p)}</span></button>`).join('') : '<p class="text-xs text-slate-400 p-2">No tienes publicaciones activas para promocionar.</p>';
  };
  const attachedH = () => { const p = LB.pid && P(LB.pid); return p ? `<div class="flex items-center gap-2 text-xs bg-blue-50 rounded-lg px-2 py-1 mb-2"><span>📎</span><span class="flex-1 truncate font-semibold">${esc(p.t)}</span><button data-live="unattach" aria-label="Quitar producto">✕</button></div>` : ''; };
  const barH = () => {
    const lock = lockMsg();
    if (lock) return `<div class="lobby-lock rounded-xl bg-amber-50 border border-amber-200 text-amber-900 p-3 text-xs">${esc(lock)}</div>`;
    return `<div id="lobby-attached">${attachedH()}</div>
 ${LB.picker ? `<div id="lobby-picker" class="max-h-40 overflow-y-auto bg-white border rounded-xl mb-2 p-1">${pickerH()}</div>` : ''}
 <div class="flex gap-2 items-center"><button data-live="pick" class="shrink-0 px-2.5 py-2 rounded-xl bg-slate-100 text-xs font-semibold" aria-label="Adjuntar mi producto">📎 Mi producto</button>
  <input id="lobby-in" maxlength="240" value="${esc(LB.draft)}" placeholder="Escribe al grupo…" class="flex-1 min-w-0 bg-white border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30">
  <button data-live="lobby-send" class="shrink-0 w-10 h-10 rounded-xl bg-brand text-white grid place-items-center" aria-label="Enviar"><i data-lucide="send" class="w-4 h-4"></i></button></div>`;
  };
  window.lobbyH = () => {
    if (!LB.loaded && !LB.loading) setTimeout(loadLobby, 0);
    return `<div id="lobby-wrap"><p class="text-xs text-slate-500 mb-2">Plaza UPC · sala en vivo de todos los conectados</p>
 <div id="lobby-strip" class="flex gap-3 overflow-x-auto no-sb pb-2">${stripH()}</div>
 <div id="lobby-feed" class="h-[48vh] overflow-y-auto bg-slate-50 rounded-2xl p-3 my-2">${feedH()}</div>
 <div id="lobby-bar">${barH()}</div></div>`;
  };
  V.lobby = () => hd('Plaza UPC en vivo') + `<div class="p-5 pb-28">${lobbyH()}</div>`;

  const feedEl = () => document.querySelector('#lobby-feed');
  const toBottom = () => { const f = feedEl(); if (f) f.scrollTop = f.scrollHeight; };
  function stripUpdate() { const s = document.querySelector('#lobby-strip'); if (s) s.innerHTML = stripH(); }
  function loadLobby() {
    if (!sock || !sock.connected || LB.loading) return;
    LB.loading = true;
    sock.emit('lobby:history', {}, (r) => {
      LB.loading = false;
      if (r && r.ok) { LB.list = r.list || []; LB.loaded = true; }
      const f = feedEl(); if (f) { f.innerHTML = feedH(); lucide.createIcons(); toBottom(); }
    });
  }
  window.lobbyBind = (s) => { // lo llama 05-socket al crear el socket
    s.on('lobby:msg', (m) => {
      if (!LB.loaded) return; // al abrir la sala se pide el historial completo
      if (LB.list.some((x) => x.id === m.id)) return;
      LB.list.push(m); if (LB.list.length > 50) LB.list.shift();
      const f = feedEl(); if (!f) return;
      const near = f.scrollHeight - f.scrollTop - f.clientHeight < 80 || m.uid === me();
      if (f.querySelector('p.text-center')) f.innerHTML = '';
      f.insertAdjacentHTML('beforeend', msgH(m)); lucide.createIcons(); // sin R(): no se borra lo que escribe el usuario en #lobby-in
      if (near) toBottom();
    });
    s.on('lobby:deleted', (d) => {
      LB.list = LB.list.filter((x) => x.id !== d.id);
      const n = [...document.querySelectorAll('[data-mid]')].find((x) => x.dataset.mid === String(d.id)); if (n) n.remove();
    });
  };
  window.lobbyReset = () => { LB.list = []; LB.loaded = false; LB.loading = false; LB.pid = null; LB.picker = false; LB.draft = ''; };

  function lobbySend() {
    const m = lockMsg(); if (m) return toast(m);
    if (typeof comRestricted === 'function' && comRestricted()) { if (typeof comModal === 'function') comModal(); return; }
    if (!sock || !sock.connected) return toast('Sin conexión con el servidor, reintentando…');
    const inp = $('#lobby-in'); let text = ((inp && inp.value) || '').trim();
    if (!text && LB.pid) text = 'Mira lo que tengo 👇';
    if (!text) return toast('Escribe un mensaje');
    sock.emit('lobby:send', { text, pid: LB.pid || undefined }, (r) => {
      if (r && r.error) return toast(r.error);
      LB.draft = ''; LB.pid = null; LB.picker = false;
      const b = document.querySelector('#lobby-bar'); if (b) { b.innerHTML = barH(); lucide.createIcons(); }
    });
  }
  function peek(uid) {
    const u = users().find((x) => x.uid === uid); if (!u) return;
    const sps = u.sampleProducts || [];
    M(`<div class="bg-white w-full rounded-t-3xl p-5 pop"><div class="flex items-center gap-3 mb-3"><div class="w-12 h-12 rounded-full bg-brand text-white grid place-items-center font-bold text-lg">${ini(u.name)}</div><div class="min-w-0"><p class="font-bold truncate">${esc(u.name)}${u.official ? ' · Oficial ✓' : ''}</p><p class="text-xs text-slate-500 truncate">${esc(u.career || 'Estudiante UPC')}${u.campus ? ' · ' + esc(u.campus) : ''}</p></div></div>
 ${sps.length ? `<div class="flex flex-col gap-1.5">${sps.map(mini).join('')}</div>` : '<p class="text-sm text-slate-400 py-3">Aún no tiene publicaciones activas.</p>'}
 <div class="flex gap-2 mt-4">${u.uid !== me() ? `<button data-live="dm" data-uid="${esc(u.uid)}" class="btn flex-1 !py-2.5">💬 Chatear</button>` : ''}<button data-live="seller" data-uid="${esc(u.uid)}" class="chip flex-1 justify-center">Ver perfil</button></div></div>`);
  }
  function dm(uid) {
    const u = users().find((x) => x.uid === uid), sp = u && (u.sampleProducts || [])[0];
    X();
    if (sp) { if (!P(sp.id)) toast('Cargando la publicación…'); return openChat(sp.id); } // chat 1 a 1 sobre su primer producto (la clave es publicación|comprador)
    LB.draft = u ? '@' + first(u.name) + ' ' : '';
    toast('Aún no tiene publicaciones: salúdalo en la Plaza UPC');
    nav('lobby');
  }

  /* ---------- delegación de eventos ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-live]'); if (!b) return;
    const a = b.dataset.live, uid = b.dataset.uid, pid = +b.dataset.pid;
    if (a === 'open-p') { X(); return openP(pid); }
    if (a === 'seller') { X(); const i = RS[uid]; return i != null ? nav('seller', i) : toast('Perfil no disponible'); }
    if (a === 'dm') return dm(uid);
    if (a === 'lobby') { MT = 'live'; return nav('lobby'); }
    if (a === 'peek') return peek(uid);
    if (a === 'lobby-send') return lobbySend();
    if (a === 'pick') { LB.picker = !LB.picker; const bar = document.querySelector('#lobby-bar'); if (bar) { const t = ($('#lobby-in') || {}).value; if (t != null) LB.draft = t; bar.innerHTML = barH(); lucide.createIcons(); } return; }
    if (a === 'attach') { LB.picker = false; LB.pid = pid; const bar = document.querySelector('#lobby-bar'); if (bar) { const t = ($('#lobby-in') || {}).value; if (t != null) LB.draft = t; bar.innerHTML = barH(); lucide.createIcons(); } return; }
    if (a === 'unattach') { LB.pid = null; const at = document.querySelector('#lobby-attached'); if (at) at.innerHTML = ''; return; }
    if (a === 'del-msg') { if (!sock || !sock.connected) return toast('Sin conexión con el servidor'); return sock.emit('lobby:delete', { id: b.dataset.id }, (r) => { if (r && r.error) toast(r.error); }); }
  });
  document.addEventListener('input', (e) => { if (e.target && e.target.id === 'lobby-in') LB.draft = e.target.value; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id === 'lobby-in') { e.preventDefault(); lobbySend(); } });

  /* ---------- después de cada pintado ---------- */
  onAfterRender(() => {
    if (S.s === 'home') homeCardUpdate();
    if (feedEl()) toBottom();
  });
})();
