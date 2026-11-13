/* U2U · Destacados · pantallas (parte D, v8.7.4)
 * Script clásico. Con FEATURE_MODE=off (o sin cargar la configuración) NO se ve nada.
 * El orden del catálogo lo decide el servidor; aquí solo se respeta (ver featCmp en 03-local-publicar.js).
 * Sin onclick con datos de usuario: todo va con data-df y un solo listener delegado. */
(function () {
  const DAY = 864e5;
  const D = { cfg: null, mine: {}, yape: null, busy: false, rank: {}, adm: null, admLoading: false, admErr: '', cur: null };
  const on = () => !!(D.cfg && D.cfg.mode && D.cfg.mode !== 'off');
  const paid = () => on() && D.cfg.mode === 'paid';
  const days = () => (D.cfg && D.cfg.days) || 7;
  const money = (c) => sol((c || 0) / 100);
  const fOn = (p) => !!(p && p.featured && (!p.fUntil || p.fUntil > Date.now()));
  const left = (u) => { const d = Math.max(1, Math.ceil((u - Date.now()) / DAY)); return 'vence en ' + d + ' día' + (d > 1 ? 's' : ''); };
  const fdate = (t) => (t ? new Date(t).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const tk = () => (typeof tkGet === 'function' ? tkGet() : null);
  const hot = () => ['detail', 'profile', 'admin'].includes(S.s);

  /* ---------- datos ---------- */
  function setItems(list) {
    D.mine = {};
    (list || []).forEach((x) => { if (!D.mine[x.pid] || x.createdAt > D.mine[x.pid].createdAt) D.mine[x.pid] = x; });
  }
  function upsert(x) { if (x && x.pid && (!D.mine[x.pid] || x.createdAt >= D.mine[x.pid].createdAt)) D.mine[x.pid] = x; }
  async function load() {
    if (!window.io || !LV.me || !tk()) return;
    const [c, m] = await Promise.all([api('config/featured', null, tk()), api('me/featured', null, tk())]);
    if (c.ok && c.j && c.j.ok) D.cfg = c.j;
    if (m.ok && m.j && m.j.ok) { setItems(m.j.items); D.yape = m.j.yape || null; if (m.j.mode === 'off' && D.cfg) D.cfg.mode = 'off'; }
    if (hot()) R(1);
  }
  function reset() { D.cfg = null; D.mine = {}; D.yape = null; D.adm = null; D.cur = null; D.busy = false; }
  const stOf = (x) => (x ? (x.status === 'active' && x.until && x.until <= Date.now() ? 'expired' : x.status) : null);
  function stInfo(x) {
    const s = stOf(x);
    if (s === 'requested') return ['Pendiente', 'bg-amber-100 text-amber-700', 'Esperando revisión del equipo U2U.'];
    if (s === 'pending_payment') return ['Pendiente', 'bg-amber-100 text-amber-700', 'Falta reportar tu pago de Yape.'];
    if (s === 'payment_reported') return ['En revisión', 'bg-sky-100 text-sky-700', 'Estamos verificando tu pago. Te avisaremos aquí.'];
    if (s === 'active') return ['Activo', 'bg-emerald-100 text-emerald-700', left(x.until)];
    if (s === 'rejected') return ['Rechazado', 'bg-red-100 text-red-600', x.rejectReason ? 'Motivo: ' + x.rejectReason : 'Sin motivo indicado.'];
    if (s === 'canceled' && x.refundDue) return ['Cancelado', 'bg-slate-100 text-slate-600', 'Si ya pagaste, el equipo U2U te contactará para el reembolso.'];
    return null; // vencido o cancelado sin dinero: se puede volver a destacar
  }
  const open = (x) => ['requested', 'pending_payment', 'payment_reported', 'active'].includes(stOf(x));
  const mineP = (p) => !!(p && p.s === ME && p.own && p.id > 100 && LV.me && !LV.adm);
  const canAsk = (p) => on() && mineP(p) && p.status === 'available' && !open(D.mine[p.id]);

  /* ---------- bloque en el detalle ---------- */
  function detailH(p) {
    const x = D.mine[p.id], i = stInfo(x), chip = fOn(p) ? '<span class="df-chip text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Destacado ⭐</span>' : '';
    let own = '';
    if (mineP(p)) {
      const st = i ? `<div class="flex items-center gap-2 flex-wrap"><span class="text-[10px] font-bold px-2 py-1 rounded-full ${i[1]}">${i[0]}</span><span class="text-xs text-slate-600">${esc(i[2])}</span></div>` : '';
      const btn = canAsk(p) ? `<button data-df="open" data-pid="${p.id}" class="btn !py-2.5 !text-sm mt-2">⭐ ${stOf(x) === 'rejected' ? 'Volver a solicitar destacado' : 'Destacar'}</button>` : (stOf(x) === 'pending_payment' && on() ? `<button data-df="open" data-pid="${p.id}" class="btn !py-2.5 !text-sm mt-2">Reportar mi pago</button>` : '');
      if (st || btn) own = `<div class="mt-3 rounded-2xl p-3 border border-amber-200 bg-amber-50"><p class="text-xs font-bold text-amber-800 mb-1">Destacar publicación</p>${st}${btn}</div>`;
    } else if (LV.adm && p.official && on() && p.status !== 'sold') {
      own = `<button data-df="grant" data-pid="${p.id}" class="chip mt-3">⭐ Destacar sin cobro</button>`;
    }
    return (chip || own) ? `<div id="df-box">${chip ? `<div class="mt-2">${chip}</div>` : ''}${own}</div>` : '';
  }

  /* ---------- decorar lo que pinta la app (tarjetas, detalle, mis publicaciones) ---------- */
  function decorate() {
    try {
      if (!on()) return;
      const v = $('#v'); if (!v) return;
      v.querySelectorAll('[onclick^="openP("]').forEach((el) => {
        const m = /openP\((\d+)\)/.exec(el.getAttribute('onclick') || ''), box = el.querySelector('.aspect-square');
        if (!m || !box) return;
        const p = P(+m[1]); if (!p) return;
        if (fOn(p) && !box.querySelector('.df-chip')) box.insertAdjacentHTML('beforeend', '<span class="df-chip absolute top-9 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 shadow-sm">Destacado ⭐</span>');
        if (S.s === 'profile' && PT === 'pub' && mineP(p) && !el.querySelector('.df-own')) {
          const x = D.mine[p.id], i = stInfo(x);
          el.insertAdjacentHTML('beforeend', `<div class="df-own mt-1" data-stop="1">${i ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${i[1]}">${i[0]}${stOf(x) === 'active' ? ' · ' + left(x.until) : ''}</span>` : ''}${canAsk(p) ? `<button data-df="open" data-pid="${p.id}" class="chip !py-1 !px-3 !text-[11px] mt-1 w-full">⭐ Destacar</button>` : ''}</div>`);
        }
      });
      if (S.s === 'detail') {
        const p = P(S.a), h1 = v.querySelector('h1');
        if (p && h1 && !v.querySelector('#df-box')) { const row = h1.parentElement; if (row) row.insertAdjacentHTML('afterend', detailH(p)); }
      }
    } catch (e) { /* la interfaz principal nunca debe romperse por esto */ }
  }

  /* ---------- ventana del dueño ---------- */
  const lb = 'text-xs font-semibold text-slate-600';
  const intro = () => paid()
    ? `Tu publicación saldrá primero durante ${days()} días por ${money(D.cfg.price)}. Destacar aumenta la visibilidad; no garantiza la venta.`
    : `Tu publicación saldrá primero durante ${days()} días (gratis durante el piloto). Destacar aumenta la visibilidad; no garantiza la venta.`;
  function modalH() {
    const c = D.cur, p = P(c.pid), t = p ? esc(p.t) : 'tu publicación';
    const shell = (inner) => `<div class="bg-white w-full rounded-t-3xl p-6 pop max-h-[92%] overflow-y-auto no-sb" role="dialog" aria-modal="true" aria-labelledby="dft"><p id="dft" class="font-bold text-lg text-navy">⭐ Destacar publicación</p><p class="text-xs text-slate-500 truncate">${t}</p>${inner}</div>`;
    if (c.step === 'done') return shell(`<div class="mt-4 rounded-2xl bg-emerald-50 text-emerald-800 p-4 text-sm">${paid() ? 'Recibimos tu reporte de pago. Queda <b>En revisión</b>; te avisaremos cuando el equipo U2U lo apruebe.' : 'Tu solicitud fue enviada. Queda <b>Pendiente</b> hasta que el equipo U2U la revise.'}</div><button data-df="close" class="btn mt-4">Listo</button>`);
    if (c.step === 'pay') {
      const y = D.yape || {};
      if (!y.number) return shell(`<p class="text-sm text-slate-600 mt-4">No pudimos cargar los datos de pago. Cierra e inténtalo de nuevo en un momento.</p><button data-df="close" class="btn mt-4">Cerrar</button>`);
      return shell(`<p class="text-sm text-slate-600 mt-3">${intro()}</p>
        <ol class="mt-3 text-sm text-slate-700 space-y-2 list-decimal pl-5"><li>Yapea <b>${money(D.cfg.price)}</b> a este número${y.holder ? ' (titular: <b>' + esc(y.holder) + '</b>)' : ''}:</li></ol>
        <div class="mt-2 flex items-center gap-2"><span class="flex-1 text-center text-2xl font-black tracking-wider text-navy bg-blue-50 rounded-2xl py-3 select-all">${esc(y.number)}</span><button data-df="copy" class="chip !py-3">Copiar número</button></div>
        <p class="text-sm text-slate-700 mt-3">2. Escribe los datos de tu pago:</p>
        <label class="${lb} block mt-2" for="df_op">Número de operación de Yape</label><input id="df_op" data-dff="op" class="inp !mb-0" maxlength="24" autocomplete="off" autocapitalize="characters" value="${esc(c.f.op)}"><p data-dfe="operationNumber" role="alert" class="text-red-500 text-xs min-h-[1.1rem] mb-1"></p>
        <label class="${lb} block" for="df_nm">Nombre o celular del titular</label><input id="df_nm" data-dff="nm" class="inp !mb-0" maxlength="60" autocomplete="off" value="${esc(c.f.nm)}"><p data-dfe="senderName" role="alert" class="text-red-500 text-xs min-h-[1.1rem] mb-1"></p>
        <p data-dfe="_" role="alert" class="text-red-500 text-xs min-h-[1.1rem]"></p>
        <button id="df-go" data-df="send" class="btn mt-1">Ya pagué, enviar</button><button data-df="close" class="w-full py-3 text-slate-500 font-semibold">Ahora no</button>`);
    }
    return shell(`<p class="text-sm text-slate-600 mt-3">${intro()}</p><p data-dfe="_" role="alert" class="text-red-500 text-xs min-h-[1.1rem] mt-2"></p>
      <button id="df-go" data-df="ask" class="btn mt-1">${paid() ? 'Solicitar destacado' : 'Solicitar destacado (gratis durante el piloto)'}</button><button data-df="close" class="w-full py-3 text-slate-500 font-semibold">Ahora no</button>`);
  }
  function errTxt(r) {
    const j = r.j || {};
    if (r.status === 0) return { t: 'No hay conexión con el servidor. Reintenta en unos segundos.' };
    if (r.status === 401) { sessionOut('Tu sesión expiró. Inicia sesión de nuevo.'); return { t: '' }; }
    let t = j.error || 'No se pudo completar. Intenta de nuevo.';
    if (j.code === 'RATE_LIMIT' && j.retry) t += ' (en ' + Math.max(1, Math.ceil(j.retry / 60)) + ' min)';
    return { t, f: j.field };
  }
  const setErr = (f, t) => { document.querySelectorAll('[data-dfe]').forEach((e) => { if (e.dataset.dfe === (f || '_')) e.textContent = t || ''; else if (!f) e.textContent = ''; }); };
  const clearErr = () => document.querySelectorAll('[data-dfe]').forEach((e) => { e.textContent = ''; });
  function busy(b) { D.busy = b; const g = $('#df-go'); if (g) { g.disabled = b; g.dataset.t = g.dataset.t || g.textContent; g.textContent = b ? 'Enviando…' : g.dataset.t; } }
  function openM(pid) {
    if (!on()) return;
    const x = D.mine[pid], pay = paid() && stOf(x) === 'pending_payment';
    D.cur = { pid: +pid, step: pay ? 'pay' : 'ask', f: { op: '', nm: '' } };
    M(modalH());
  }
  async function ask() {
    if (D.busy || !D.cur) return; busy(true); clearErr();
    const r = await api('featured/request', { pid: D.cur.pid }, tk());
    busy(false);
    if (r.ok && r.j && r.j.ok) { upsert(r.j.featured); if (r.j.yape) D.yape = r.j.yape; D.cur.step = paid() && r.j.featured.status === 'pending_payment' ? 'pay' : 'done'; M(modalH()); if (hot()) R(1); return; }
    const e = errTxt(r); setErr('_', e.t);
  }
  async function send() {
    if (D.busy || !D.cur) return; const c = D.cur;
    const op = c.f.op.toUpperCase().replace(/\s+/g, ''), nm = c.f.nm.trim(); let bad = false; clearErr();
    if (!/^[A-Z0-9]{4,20}$/.test(op)) { setErr('operationNumber', 'Número de operación no válido (4 a 20 letras o números).'); bad = true; }
    if (nm.length < 2) { setErr('senderName', 'Escribe el nombre o celular del titular (2 a 60 caracteres).'); bad = true; }
    if (bad) return;
    const x = D.mine[c.pid]; if (!x) return setErr('_', 'No encontramos tu solicitud. Cierra e inténtalo de nuevo.');
    busy(true);
    const r = await api('featured/' + encodeURIComponent(x.id) + '/report-yape', { operationNumber: op, senderName: nm }, tk());
    busy(false);
    if (r.ok && r.j && r.j.ok) { upsert(r.j.featured); c.step = 'done'; M(modalH()); if (hot()) R(1); return; }
    const e = errTxt(r); setErr(e.f === 'operationNumber' || e.f === 'senderName' ? e.f : '_', e.t);
  }
  function copyNum() {
    const n = (D.yape && D.yape.number) || ''; if (!n) return;
    const ok = () => toast('Número copiado');
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(n).then(ok, () => toast('No se pudo copiar: mantén pulsado el número')); } catch (e) { /* sigue */ }
    toast('Mantén pulsado el número para copiarlo');
  }

  /* ---------- panel admin ---------- */
  async function admLoad() {
    if (D.admLoading || !LV.adm) return; D.admLoading = true; D.admErr = '';
    const r = await api('admin/featured', null, tk()); D.admLoading = false;
    if (r.ok && r.j && r.j.ok) D.adm = r.j; else D.admErr = (r.j && r.j.error) || 'No se pudo cargar. Intenta de nuevo.';
    if (S.s === 'admin') R(1);
  }
  const SL = { requested: 'Pendiente (gratis)', pending_payment: 'Esperando pago', payment_reported: 'Pago reportado', active: 'Activo', rejected: 'Rechazado', canceled: 'Cancelado', expired: 'Vencido' };
  function admCard(x) {
    const free = D.adm.mode === 'free', pend = x.status === 'payment_reported' || (x.status === 'requested' && free), canRej = pend || x.status === 'pending_payment' || x.status === 'requested';
    return `<div class="border rounded-2xl p-3 mb-3 ${pend ? 'border-amber-300 bg-amber-50/40' : ''}"><div class="flex items-start justify-between gap-2"><p class="font-bold text-sm min-w-0 truncate">${esc(x.t)}</p><span class="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">${SL[x.status] || esc(x.status)}</span></div>
      <p class="text-xs text-slate-500 mt-1">Dueño: <b>${esc(x.ownerName)}</b> · ${fdate(x.createdAt)}${x.kind === 'grant' ? ' · Sin cobro' : x.amount ? ' · ' + money(x.amount) : ''}</p>
      ${x.opNumber ? `<p class="text-xs bg-slate-50 rounded-xl p-2 mt-2">Operación: <b>${esc(x.opNumber)}</b> · Titular: <b>${esc(x.senderName)}</b></p>` : ''}
      ${x.status === 'active' && x.until ? `<p class="text-xs text-emerald-700 mt-1">Activo · ${left(x.until)}</p>` : ''}${x.rejectReason ? `<p class="text-xs text-red-600 mt-1">Motivo: ${esc(x.rejectReason)}</p>` : ''}${x.refundDue ? '<p class="text-xs font-bold text-red-600 mt-1">Reembolso pendiente: concílialo en Yape</p>' : ''}
      ${canRej ? `<div class="grid grid-cols-2 gap-2 mt-3">${pend ? `<button class="chip !bg-emerald-50 !text-emerald-700" data-df="ok" data-id="${esc(x.id)}">✓ Aprobar</button>` : '<span></span>'}<button class="chip !bg-red-50 !text-red-600" data-df="rej" data-id="${esc(x.id)}">Rechazar</button></div>` : ''}</div>`;
  }
  function admBody() {
    const top = '<div class="flex justify-end mb-2"><button type="button" data-df="refresh" class="chip">↻ Actualizar</button></div>';
    if (!D.adm) { if (!D.admLoading && !D.admErr) admLoad(); return top + (D.admErr ? `<p class="text-sm text-red-500 text-center">${esc(D.admErr)}</p>` : skRows(3)); }
    const s = D.adm.summary, off = PR.filter((p) => p.official && p.status !== 'sold');
    return top + `<div class="flex items-center justify-between mb-3"><b class="text-navy">${s.activeNow}/${s.max} activos</b><span class="text-xs text-slate-500">${s.reviewCount} por revisar${s.refundDueCount ? ' · ' + s.refundDueCount + ' reembolso(s)' : ''}</span></div>
      ${D.adm.mode === 'off' ? '<p class="text-xs bg-amber-50 text-amber-800 rounded-xl p-2 mb-3">FEATURE_MODE=off: puedes rechazar y consultar, no aprobar ni destacar.</p>' : ''}
      ${D.adm.items.map(admCard).join('') || empty('star', 'Aún no hay solicitudes', 'Cuando un estudiante pida destacar una publicación aparecerá aquí.')}
      ${off.length ? `<h3 class="font-bold mt-5 mb-2">Publicaciones oficiales</h3>${off.map((p) => `<div class="border rounded-2xl p-3 mb-2 flex items-center gap-3"><div class="w-12 h-12 rounded-xl overflow-hidden shrink-0">${pic(p)}</div><div class="flex-1 min-w-0"><p class="font-bold text-sm truncate">${esc(p.t)}</p>${fOn(p) ? '<p class="text-[11px] text-amber-600 font-semibold">Destacado ⭐</p>' : ''}</div><button class="chip" data-df="grant" data-pid="${p.id}">Destacar sin cobro</button></div>`).join('')}` : ''}`;
  }
  /* pestaña «Destacados» en la misma barra del panel de moderación (junto a «Comisiones» de 13-comision.js, si está) */
  const _adm = V.admin;
  V.admin = function (a) {
    const h = _adm.call(this, a);
    if (!LV.adm || !on()) return h;
    const m = /grid grid-cols-(\d) bg-slate-100 rounded-xl p-1 text-\[11px\] font-semibold mb-4">/.exec(h);
    if (!m) return h;
    const i = m.index, j = h.indexOf('</div>', i), n = D.adm && D.adm.summary && D.adm.summary.reviewCount;
    const btn = `<button type="button" data-df="tab" class="py-2 rounded-lg ${AT === 'feat' ? 'bg-white shadow text-brand' : 'text-slate-500'}">Destacados${n ? ' (' + n + ')' : ''}</button>`;
    const head = h.slice(0, i) + m[0].replace('grid-cols-' + m[1], 'grid-cols-' + (+m[1] + 1)) + h.slice(i + m[0].length, j) + btn + '</div>';
    return AT === 'feat' ? head + admBody() + '</div>' : head + h.slice(j + 6);
  };
  async function admAct(path, body, okMsg) {
    if (D.busy) return; D.busy = true;
    const r = await api(path, body || {}, tk()); D.busy = false;
    if (r.ok && r.j && r.j.ok) { toast(okMsg); D.adm = null; D.admErr = ''; if (S.s === 'admin') R(1); return true; }
    toast(errTxt(r).t || 'No se pudo completar'); return false;
  }
  async function admReject(id) {
    M(`<div class="bg-white w-full rounded-t-3xl p-6 pop" role="dialog" aria-modal="true" aria-labelledby="dfr"><p id="dfr" class="font-bold text-lg text-navy">Rechazar destacado</p><p class="text-xs text-slate-500 mb-2">El dueño verá este motivo.</p><textarea id="df_rs" maxlength="200" class="inp h-20 resize-none" placeholder="Motivo (obligatorio)"></textarea><p data-dfe="_" role="alert" class="text-red-500 text-xs min-h-[1.1rem]"></p><button id="df-go" class="btn" data-df="rej-go" data-id="${esc(id)}">Rechazar</button><button class="w-full py-3 text-slate-500 font-semibold" data-df="close">Cancelar</button></div>`);
  }
  async function rejGo(id) {
    const reason = (($('#df_rs') || {}).value || '').trim();
    if (reason.length < 3) return setErr('_', 'Escribe el motivo (mínimo 3 letras).');
    busy(true); const r = await api('admin/featured/' + encodeURIComponent(id) + '/reject', { reason }, tk()); busy(false);
    if (r.ok && r.j && r.j.ok) { X(); toast('Solicitud rechazada'); D.adm = null; if (S.s === 'admin') R(1); return; }
    setErr('_', errTxt(r).t);
  }

  /* ---------- un solo listener para todos los botones ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-df]'); if (!b) { if (e.target.closest('[data-stop]')) e.stopPropagation(); return; }
    e.stopPropagation(); e.preventDefault();
    const a = b.dataset.df, pid = +b.dataset.pid, id = b.dataset.id;
    if (a === 'open') openM(pid);
    else if (a === 'ask') ask();
    else if (a === 'send') send();
    else if (a === 'copy') copyNum();
    else if (a === 'close') X();
    else if (a === 'tab') { AT = 'feat'; D.adm = null; D.admErr = ''; R(1); }
    else if (a === 'refresh') { D.adm = null; D.admErr = ''; R(1); }
    else if (a === 'ok') admAct('admin/featured/' + encodeURIComponent(id) + '/approve', {}, 'Destacado aprobado');
    else if (a === 'rej') admReject(id);
    else if (a === 'rej-go') rejGo(id);
    else if (a === 'grant') askConfirm({ title: '¿Destacar sin cobro?', msg: 'Saldrá primero durante ' + days() + ' días.', ok: 'Sí, destacar', no: 'Volver', icon: 'star' }).then((y) => { if (y) admAct('admin/featured/' + pid + '/grant', {}, 'Publicación destacada'); });
  }, true);
  document.addEventListener('input', (e) => { const f = e.target && e.target.dataset && e.target.dataset.dff; if (f && D.cur) { D.cur.f[f] = e.target.value; setErr(f === 'op' ? 'operationNumber' : 'senderName', ''); } });

  /* ---------- ganchos: catálogo, orden, sockets y ciclo de sesión ---------- */
  const _ar = addRemote; addRemote = function (d) {
    const r = _ar(d);
    if (d && d.id) { const p = P(d.id); if (p) { const was = fOn(p); p.featured = !!d.featured; p.fUntil = d.featured ? (+d.featuredUntil || p.fUntil || 0) : 0; return r || was !== fOn(p); } }
    return r;
  };
  const _op = onProducts; onProducts = function (list) { D.rank = {}; (list || []).forEach((d, i) => { D.rank[d.id] = i; }); return _op(list); };
  window.featCmp = (a, b) => { // orden del servidor: destacadas vigentes primero y, entre ellas, el orden (rotación) que mandó el servidor
    if (!on() || F.sort !== 'd' || F.q) return 0;
    const fa = fOn(a), fb = fOn(b); if (fa !== fb) return fa ? -1 : 1;
    return fa ? (D.rank[a.id] ?? 1e9) - (D.rank[b.id] ?? 1e9) : 0;
  };
  const _R2 = R; R = function (keep) { _R2(keep); decorate(); };
  const _gr = gridR; gridR = function () { _gr(); decorate(); };
  const _ao = authOk; authOk = function (j, dest) { const r = _ao(j, dest); load(); return r; };
  const _so = sessionOut; sessionOut = function (m) { reset(); return _so(m); };
  if (typeof sock !== 'undefined' && sock) {
    sock.on('connect', () => { if (LV.me) load(); });
    sock.on('product-featured', (d) => { const p = P(d && d.id); if (!p) return; p.featured = !!d.featured; p.fUntil = d.featured ? (+d.until || 0) : 0; refreshCatalog(); if (S.s === 'detail' && S.a == d.id) R(1); });
    sock.on('featured', (x) => {
      if (!x || !x.pid) return; const old = D.mine[x.pid]; upsert(x);
      if (!old || old.status !== x.status) {
        if (x.status === 'active') toast('⭐ Tu publicación ya está destacada');
        else if (x.status === 'rejected') toast('Tu solicitud de destacado fue rechazada');
        else if (x.status === 'canceled') toast('Tu destacado se canceló');
      }
      if (hot()) R(1);
    });
  }
  /* el vencimiento no avisa en vivo: cada minuto se comparan las fechas y, si algo venció, se repinta */
  setInterval(() => { if (!on() || !LV.me) return; if (Object.values(D.mine).some((x) => x.status === 'active' && x.until && x.until <= Date.now() && !x.seen) || PR.some((p) => p.featured && p.fUntil && p.fUntil <= Date.now() && !p.fGone)) { Object.values(D.mine).forEach((x) => { if (x.status === 'active' && x.until <= Date.now()) x.seen = 1; }); PR.forEach((p) => { if (p.featured && p.fUntil && p.fUntil <= Date.now()) p.fGone = 1; }); if (S.s === 'home') gridR(); else if (hot()) R(1); } }, 60000);
  window.DF = { state: D, fOn, load };
})();
