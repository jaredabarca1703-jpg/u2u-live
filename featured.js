/* U2U · destacar una publicación (parte C, servidor). Sin dependencias de Express: la lógica se prueba sola.
 *
 * MODOS (FEATURE_MODE): off (defecto) = nada se puede solicitar · free = el dueño solicita y el admin activa SIN cobro (piloto)
 *   · paid = el dueño paga por Yape (FEATURE_PRICE soles), reporta el pago y el admin aprueba.
 *   Con modo off el admin aún puede rechazar y consultar, pero no aprobar ni destacar.
 * SOLICITUD (tabla featured, una fila por solicitud; montos en céntimos):
 *   { id, pid, ownerUid, ownerName, t, kind:'request'|'grant', amount, status, opNumber, senderName, createdAt, reportedAt, verifiedAt,
 *     activatedAt, until, refundDue, rejectReason, canceledAt, cancelReason }
 *   Estados guardados: requested (free) · pending_payment y payment_reported (paid) · active · rejected · canceled.
 *   «expired» NO se guarda: una solicitud active con until <= ahora se MUESTRA como expired (se calcula por fecha, sin temporizadores).
 * VIGENCIA: vive en products.data.featuredUntil (ms). Destacada = featuredUntil > ahora. Renovar SUMA días al vencimiento vigente.
 * CUPO: máximo MAX_FEATURED publicaciones vigentes a la vez (code FEATURE_FULL). Renovar una ya vigente no ocupa un cupo nuevo.
 * ORDEN: order(lista) pone primero las vigentes, con rotación estable por hora: puntaje = (hash32(id) ^ hora) >>> 0 ascendente.
 * CANCELACIÓN: onGone(pid, motivo) cancela las solicitudes abiertas o vigentes de una publicación que se eliminó, se vendió o se pausó.
 *   refundDue=true si había dinero de por medio (monto > 0 y la solicitud estaba aprobada o con pago reportado): se resuelve a mano.
 * Los números de operación se reservan en opnumbers.js (el MISMO registro que las comisiones). Número de operación y titular:
 *   solo admin y el propio usuario; nunca en logs. */
const crypto = require('crypto');
const opn = require('./opnumbers');

const DAY = 86400e3;
const OPEN = new Set(['requested', 'pending_payment', 'payment_reported']);
const STATUSES = new Set([...OPEN, 'active', 'rejected', 'canceled', 'expired']);
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const no = (status, code, error, field) => ({ status, body: { ok: false, code, error, ...(field ? { field } : {}) } });
const intIn = (v, def, max) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 1 && n <= max ? n : def; };

function hash32(id) { // numérico: Math.abs(id) >>> 0 · texto: FNV-1a de 32 bits
  if (typeof id === 'number' && Number.isFinite(id)) return Math.abs(id) >>> 0;
  let h = 0x811c9dc5;
  const s = String(id);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
const score = (id, hour) => (hash32(id) ^ hour) >>> 0;

module.exports = function createFeatured(ctx) {
  const { products, saveProduct, saveFeatured } = ctx; // saveProduct(p) y saveFeatured(r): guardan (sync) y resuelven true/false, nunca lanzan
  const env = ctx.env || process.env, now = ctx.now || Date.now;
  const emitTo = ctx.emitTo || (() => {}), broadcast = ctx.broadcast || (() => {});
  const isVerified = ctx.isVerified || (() => true);

  const mode = () => { const m = String(env.FEATURE_MODE || 'off').trim().toLowerCase(); return m === 'free' || m === 'paid' ? m : 'off'; };
  const days = () => intIn(env.FEATURE_DAYS, 7, 90);
  const max = () => intIn(env.MAX_FEATURED, 6, 100);
  const priceCents = () => { const x = parseFloat(env.FEATURE_PRICE); return x > 0 && x <= 1000 ? Math.round(x * 100) : 200; };
  const yape = () => { const number = String(env.YAPE_NUMBER || '').trim(), holder = String(env.YAPE_HOLDER || '').trim(); return number ? { number, holder } : null; };
  const usable = () => mode() === 'free' || (mode() === 'paid' && !!yape()); // paid sin YAPE_NUMBER: nadie puede solicitar ni pagar

  /* ---------- solicitudes en memoria ---------- */
  const recs = new Map();  // id -> solicitud
  const byPid = new Map(); // pid -> Set(id)
  function index(r) { recs.set(r.id, r); let s = byPid.get(r.pid); if (!s) byPid.set(r.pid, (s = new Set())); s.add(r.id); }
  function unindex(r) { recs.delete(r.id); const s = byPid.get(r.pid); if (s) { s.delete(r.id); if (!s.size) byPid.delete(r.pid); } }
  const recsOf = (pid) => [...(byPid.get(pid) || [])].map((id) => recs.get(id)).filter(Boolean);
  const newId = () => 'F' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');

  const isFeatured = (p, at) => !!(p && p.featuredUntil > (at || now()));
  const countActive = (at) => { let n = 0; for (const p of products.values()) if (isFeatured(p, at)) n++; return n; };
  const st = (r, at) => (r.status === 'active' && r.until <= at ? 'expired' : r.status); // «expirado» se calcula, no se guarda
  const mine = (r, at) => ({ id: r.id, pid: r.pid, t: r.t, amount: r.amount, status: st(r, at), until: r.until || 0, createdAt: r.createdAt, rejectReason: r.rejectReason || '', refundDue: !!r.refundDue });

  /* ---------- orden del catálogo: vigentes primero, rotación estable por hora ---------- */
  function order(list, at) {
    at = at || now();
    const hour = Math.floor(at / 3600000), f = [], rest = [];
    for (const p of list) (isFeatured(p, at) ? f : rest).push(p);
    f.sort((a, b) => score(a.id, hour) - score(b.id, hour) || (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
    return f.concat(rest);
  }

  /* ---------- cancelación: la publicación se eliminó, se vendió o se pausó ---------- */
  function cancelFor(pid, reason) { // parte síncrona; devuelve las promesas de guardado
    const at = now(), jobs = [], p = products.get(pid), was = isFeatured(p, at);
    if (p && reason !== 'deleted' && p.featuredUntil) p.featuredUntil = 0; // vendida o pausada: deja de estar destacada (setStatus guarda el producto justo después)
    for (const r of recsOf(pid)) {
      if (!(OPEN.has(r.status) || (r.status === 'active' && r.until > at))) continue; // lo ya vencido o rechazado no se toca
      const prev = r.status;
      r.status = 'canceled'; r.canceledAt = at; r.cancelReason = reason;
      r.refundDue = r.amount > 0 && (prev === 'active' || prev === 'payment_reported'); // había dinero de por medio: lo resuelve el dueño a mano
      jobs.push(saveFeatured(r));
      emitTo(r.ownerUid, 'featured', mine(r, at));
      if (r.refundDue) console.log('[destacados] cancelada con devolución pendiente: ' + r.id + ' (' + reason + ')');
    }
    if (was) broadcast('product-featured', { id: pid, featured: false, until: 0 });
    return jobs;
  }
  const onGone = (pid, reason) => { // nunca lanza: lo llaman setStatus (venta) y removeProduct, que no deben romperse por esto
    try { return Promise.all(cancelFor(pid, reason)).then(() => true); }
    catch (e) { console.error('[destacados] no se pudo cancelar: ' + e.message); return Promise.resolve(false); }
  };

  /* ---------- crear la solicitud (dueño) ---------- */
  const hits = new Map();  // uid -> marcas de tiempo (máx. 3 solicitudes por hora)
  const rhits = new Map(); // uid -> marcas de tiempo (máx. 5 reportes de pago por hora)
  async function request(u, body) {
    if (!usable()) return no(403, 'FORBIDDEN', 'Destacar publicaciones no está disponible por ahora.');
    if (u.admin) return no(403, 'FORBIDDEN', 'La cuenta oficial destaca desde el panel de administración.');
    const pid = parseInt((body || {}).pid, 10), p = Number.isSafeInteger(pid) ? products.get(pid) : null;
    if (!p || p.ownerUid !== u.uid) return no(404, 'NOT_FOUND', 'Publicación no encontrada', 'pid');
    if (p.status !== 'available') return no(409, 'INVALID', 'Solo puedes destacar publicaciones disponibles (no reservadas, pausadas ni vendidas).', 'pid');
    if (recsOf(pid).some((r) => OPEN.has(r.status))) return no(409, 'INVALID', 'Esta publicación ya tiene una solicitud abierta.', 'pid');
    const at = now(), h = (hits.get(u.uid) || []).filter((x) => at - x < 3600e3);
    if (h.length >= 3) { const r = no(429, 'RATE_LIMIT', 'Hiciste muchas solicitudes. Intenta de nuevo en un rato.'); r.body.retry = Math.ceil((3600e3 - (at - h[0])) / 1000); return r; }
    const paid = mode() === 'paid';
    const r = { id: newId(), pid, ownerUid: u.uid, ownerName: p.ownerName, t: p.t, kind: 'request', amount: paid ? priceCents() : 0, status: paid ? 'pending_payment' : 'requested', opNumber: '', senderName: '', createdAt: at, reportedAt: 0, verifiedAt: 0, activatedAt: 0, until: 0, refundDue: false, rejectReason: '' };
    index(r); h.push(at); hits.set(u.uid, h); // sin await entre comprobar y registrar: no hay dos solicitudes abiertas de la misma publicación
    if (!(await saveFeatured(r))) { unindex(r); h.pop(); return no(500, 'INVALID', 'No se pudo guardar tu solicitud. Inténtalo de nuevo.'); }
    console.log('[destacados] solicitud ' + r.status + ' ' + r.id);
    return { status: 200, body: { ok: true, featured: mine(r, at), ...(paid ? { yape: yape() } : {}) } };
  }

  /* ---------- el dueño reporta su pago de Yape (solo paid) ---------- */
  async function reportYape(uid, id, body) {
    const r = recs.get(String(id || ''));
    if (!r || r.ownerUid !== uid || !usable() || mode() !== 'paid') return no(404, 'NOT_FOUND', 'No encontramos una solicitud pendiente de pago');
    if (r.status === 'payment_reported') return no(409, 'INVALID', 'Ya reportaste este pago. Espera la revisión.');
    if (r.status !== 'pending_payment') return no(409, 'INVALID', 'Esta solicitud ya no admite reportar un pago.');
    const at = now(), h = (rhits.get(uid) || []).filter((x) => at - x < 3600e3);
    if (h.length >= 5) { const e = no(429, 'RATE_LIMIT', 'Reportaste muchas veces. Intenta de nuevo en un rato.'); e.body.retry = Math.ceil((3600e3 - (at - h[0])) / 1000); return e; }
    h.push(at); rhits.set(uid, h);
    body = body || {};
    const name = clean(body.senderName, 60), opRaw = opn.normalize(body.operationNumber);
    if (name.length < 2) return no(400, 'INVALID', 'Escribe el nombre o celular del titular (2 a 60 caracteres).', 'senderName');
    if (!opRaw) return no(400, 'INVALID', 'Número de operación no válido (4 a 20 letras o números).', 'operationNumber');
    if (!opn.claim(opRaw)) return no(400, 'INVALID', 'Ese número de operación ya fue usado', 'operationNumber'); // el mismo registro que las comisiones; sin await entre comprobar y reservar
    const prev = { ...r };
    Object.assign(r, { status: 'payment_reported', reportedAt: at, opNumber: opRaw, senderName: name });
    if (!(await saveFeatured(r))) { Object.assign(r, prev); opn.release(opRaw); return no(500, 'INVALID', 'No se pudo guardar tu reporte. Inténtalo de nuevo.'); }
    if (r.status === 'canceled') return no(409, 'INVALID', 'La publicación dejó de estar disponible. Si ya pagaste, lo resolveremos contigo.');
    console.log('[destacados] pago reportado en ' + r.id);
    return { status: 200, body: { ok: true, featured: mine(r, at) } };
  }

  /* ---------- activar: lo comparten approve y grant (síncrono hasta guardar; si no se guarda, se deshace todo) ---------- */
  async function activate(r, p, nDays, kind) {
    const at = now(), was = isFeatured(p, at);
    if (!was && countActive(at) >= max()) return no(409, 'FEATURE_FULL', 'Ya hay ' + max() + ' publicaciones destacadas. Inténtalo cuando venza alguna.');
    const prev = { ...r }, prevUntil = p.featuredUntil || 0;
    const until = (was ? p.featuredUntil : at) + nDays * DAY; // renovar SUMA al vencimiento vigente
    p.featuredUntil = until;
    Object.assign(r, { status: 'active', until, activatedAt: at, verifiedAt: r.amount > 0 ? at : 0, rejectReason: '' });
    const saved = await Promise.all([saveProduct(p), saveFeatured(r)]);
    if (r.status !== 'active') return no(409, 'INVALID', 'La publicación dejó de estar disponible mientras se activaba.'); // se vendió o eliminó durante el guardado
    if (!saved.every(Boolean)) {
      for (const k of Object.keys(r)) delete r[k];
      Object.assign(r, prev); p.featuredUntil = prevUntil;
      saveProduct(p); saveFeatured(r); // intenta dejar la base como estaba
      return no(500, 'INVALID', 'No se pudo guardar. Inténtalo de nuevo.');
    }
    broadcast('product-featured', { id: p.id, featured: true, until });
    emitTo(r.ownerUid, 'featured', mine(r, at));
    console.log('[destacados] ' + kind + ' ' + r.id + ' (' + nDays + ' días)');
    return { status: 200, body: { ok: true, status: 'active', until } };
  }

  /* ---------- acciones del administrador ---------- */
  const notAdmin = (a) => (!a || a.admin !== true ? no(403, 'FORBIDDEN', 'No autorizado') : null);
  async function approve(admin, id) {
    const na = notAdmin(admin); if (na) return na;
    const m = mode();
    if (m === 'off') return no(403, 'FORBIDDEN', 'Destacados está apagado (FEATURE_MODE=off).');
    const r = recs.get(String(id || ''));
    if (!r) return no(404, 'NOT_FOUND', 'Solicitud no encontrada');
    if (!(r.status === 'payment_reported' || (r.status === 'requested' && m === 'free'))) {
      return no(409, 'INVALID', r.status === 'requested' ? 'Esta solicitud gratuita no se aprueba en modo de pago. Usa «Destacar» desde el panel.' : 'Solo se aprueban solicitudes con pago reportado (o gratuitas en modo free).');
    }
    const p = products.get(r.pid);
    if (!p) return no(404, 'NOT_FOUND', 'La publicación ya no existe');
    return activate(r, p, days(), 'aprobada');
  }
  async function reject(admin, id, body) {
    const na = notAdmin(admin); if (na) return na;
    const r = recs.get(String(id || ''));
    if (!r) return no(404, 'NOT_FOUND', 'Solicitud no encontrada');
    if (!OPEN.has(r.status)) return no(409, 'INVALID', 'Solo se rechazan solicitudes abiertas');
    const reason = clean((body || {}).reason, 200);
    if (reason.length < 3) return no(400, 'INVALID', 'Escribe el motivo (mínimo 3 letras).', 'reason');
    const prev = { ...r }, at = now();
    Object.assign(r, { status: 'rejected', rejectReason: reason }); // el número de operación queda bloqueado (no se libera)
    if (!(await saveFeatured(r))) { for (const k of Object.keys(r)) delete r[k]; Object.assign(r, prev); return no(500, 'INVALID', 'No se pudo guardar. Inténtalo de nuevo.'); }
    emitTo(r.ownerUid, 'featured', mine(r, at));
    console.log('[destacados] rechazada ' + r.id);
    return { status: 200, body: { ok: true, status: 'rejected' } };
  }
  async function grant(admin, pidRaw, body) { // el admin destaca sin solicitud ni cobro (p. ej. las publicaciones oficiales)
    const na = notAdmin(admin); if (na) return na;
    if (mode() === 'off') return no(403, 'FORBIDDEN', 'Destacados está apagado (FEATURE_MODE=off).');
    const pid = parseInt(pidRaw, 10), p = Number.isSafeInteger(pid) ? products.get(pid) : null;
    if (!p) return no(404, 'NOT_FOUND', 'Publicación no encontrada');
    if (p.status !== 'available' && p.status !== 'reserved') return no(409, 'INVALID', 'Solo se destacan publicaciones disponibles.');
    const raw = (body || {}).days, n = raw === undefined || raw === null || raw === '' ? days() : parseInt(raw, 10);
    if (!(Number.isInteger(n) && n >= 1 && n <= 90)) return no(400, 'INVALID', 'Los días van de 1 a 90.', 'days');
    const at = now();
    const r = { id: newId(), pid, ownerUid: p.ownerUid, ownerName: p.ownerName, t: p.t, kind: 'grant', amount: 0, status: 'requested', opNumber: '', senderName: '', createdAt: at, reportedAt: 0, verifiedAt: 0, activatedAt: 0, until: 0, refundDue: false, rejectReason: '' };
    index(r);
    const res = await activate(r, p, n, 'concedida');
    if (res.status !== 200) unindex(r);
    return res;
  }

  /* ---------- consultas ---------- */
  function myFeatured(uid) {
    const at = now(), list = [...recs.values()].filter((r) => r.ownerUid === uid).sort((a, b) => b.createdAt - a.createdAt).slice(0, 100).map((r) => mine(r, at));
    const y = mode() === 'paid' && list.some((x) => x.status === 'pending_payment') ? yape() : null;
    return { status: 200, body: { ok: true, mode: usable() ? mode() : 'off', items: list, ...(y ? { yape: y } : {}) } };
  }
  function listAdmin(admin, status) {
    const na = notAdmin(admin); if (na) return na;
    const at = now(), m = mode(), want = STATUSES.has(status) ? status : null;
    let review = 0, refunds = 0, collected = 0;
    const list = [];
    for (const r of recs.values()) {
      const s = st(r, at), pending = s === 'payment_reported' || (s === 'requested' && m === 'free');
      if (pending) review++;
      if (r.refundDue) refunds++; else if (r.verifiedAt > 0) collected += r.amount;
      if (!want || s === want) list.push({ id: r.id, pid: r.pid, t: r.t, ownerUid: r.ownerUid, ownerName: r.ownerName, kind: r.kind || 'request', amount: r.amount, status: s, opNumber: r.opNumber, senderName: r.senderName, rejectReason: r.rejectReason || '', refundDue: !!r.refundDue, cancelReason: r.cancelReason || '', createdAt: r.createdAt, reportedAt: r.reportedAt, verifiedAt: r.verifiedAt, activatedAt: r.activatedAt, until: r.until || 0, _p: pending });
    }
    list.sort((a, b) => (b._p - a._p) || b.createdAt - a.createdAt); // pendientes de revisión primero
    list.forEach((x) => { delete x._p; });
    return { status: 200, body: { ok: true, mode: m, summary: { reviewCount: review, activeNow: countActive(at), max: max(), refundDueCount: refunds, collected }, items: list.slice(0, 500) } };
  }
  const config = () => ({ status: 200, body: { ok: true, mode: usable() ? mode() : 'off', price: usable() && mode() === 'paid' ? priceCents() : 0, days: days(), max: max(), active: countActive(now()) } }); // price en céntimos (0 si es gratis)

  /* ---------- arranque: reconstruir desde las filas guardadas ---------- */
  function rebuild(rows) { // llamar DESPUÉS de commission.js → rebuild (este suma sus números al registro, no lo reemplaza) y con los productos ya cargados
    recs.clear(); byPid.clear();
    const ops = [];
    for (const r of rows || []) { if (!r || !r.id) continue; index(r); if (r.opNumber) ops.push(r.opNumber); }
    opn.add(ops);
    let swept = 0;
    for (const pid of [...byPid.keys()]) { // solicitudes que quedaron huérfanas (la publicación se eliminó o vendió con el servidor apagado)
      const p = products.get(pid);
      if (!p) swept += cancelFor(pid, 'deleted').length;
      else if (p.status === 'sold' || p.status === 'paused') swept += cancelFor(pid, p.status).length;
    }
    if (swept) console.log('[destacados] ' + swept + ' solicitud(es) canceladas al arrancar (publicación ya no disponible)');
    return { total: recs.size, ops: ops.length, swept };
  }
  function describe() { // una línea de log al arrancar (sin números ni nombres)
    const m = mode();
    console.log('[destacados] modo=' + m + (m !== 'off' ? ' · ' + days() + ' días · máx. ' + max() + (m === 'paid' ? ' · precio ' + priceCents() + ' céntimos' : '') : ''));
    if (m === 'paid' && !yape()) console.warn('[destacados] FEATURE_MODE=paid pero falta YAPE_NUMBER: destacados queda desactivado');
    if (String(env.FEATURE_MODE || '').trim() && !['off', 'free', 'paid'].includes(String(env.FEATURE_MODE).trim().toLowerCase())) console.warn('[destacados] FEATURE_MODE no válido: se usa off');
  }

  /* ---------- rutas REST (se registran ANTES de accounts.mount: su router responde 404 a cualquier /api/... desconocido) ---------- */
  function mount(app, accounts) {
    const express = require('express');
    const json = express.json({ limit: '8kb' });
    const h = (fn) => async (req, res) => {
      res.set('Cache-Control', 'no-store');
      try {
        const u = accounts.userFromReq(req);
        if (!u) return res.status(401).json({ ok: false, code: 'FORBIDDEN', error: 'Sesión no válida' });
        const r = await fn(u, req);
        res.status(r.status || 200).json(r.body);
      } catch (e) { console.error('[destacados] error:', e.message); res.status(500).json({ ok: false, code: 'INVALID', error: 'Error del servidor. Intenta de nuevo.' }); }
    };
    const needVerified = (u) => (u.admin || isVerified(u) ? null : no(403, 'NOT_VERIFIED', 'Verifica tu correo UPC para continuar.'));
    app.post('/api/featured/request', json, h(async (u, req) => needVerified(u) || request(u, req.body)));
    app.post('/api/featured/:id/report-yape', json, h(async (u, req) => needVerified(u) || reportYape(u.uid, req.params.id, req.body)));
    app.post('/api/admin/featured/:id/approve', json, h((u, req) => approve(u, req.params.id)));
    app.post('/api/admin/featured/:id/reject', json, h((u, req) => reject(u, req.params.id, req.body)));
    app.post('/api/admin/featured/:pid/grant', json, h((u, req) => grant(u, req.params.pid, req.body)));
    app.get('/api/me/featured', h((u) => myFeatured(u.uid)));
    app.get('/api/admin/featured', h((u, req) => listAdmin(u, String(req.query.status || ''))));
    app.get('/api/config/featured', h(() => config()));
  }

  return { mode, days, max, isFeatured, countActive, order, onGone, request, reportYape, approve, reject, grant, myFeatured, listAdmin, config, rebuild, describe, mount };
};
module.exports.hash32 = hash32;
module.exports.score = score;
