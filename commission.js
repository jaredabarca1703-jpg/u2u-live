/* U2U · comisión del 3 % por venta (parte A, servidor). Sin dependencias de Express: la lógica se prueba sola.
 *
 * FLUJO: al confirmar la entrega con el PIN (evento order:confirm o POST /api/orders/:id/confirm) se calcula la comisión sobre
 *   el PRECIO del producto guardado al reservar (o.baseCents; nunca sobre los S/ 10 ni S/ 15 del total). Vive en orders.data.commission
 *   = { amount, rate, base, status, createdAt, reportedAt, paidAt, opNumber, senderName, rejectReason } (céntimos enteros). El campo status del
 *   pedido NO cambia. Estados: pending_commission → commission_reported → completed; rejected (el admin la devuelve con motivo), waived, shadow.
 * MODOS (COMMISSION_MODE): off = nada cambia · shadow = registra la comisión como 'shadow' (solo la ve el admin; no restringe ni muestra nada)
 *   · active = flujo completo. Una comisión 'shadow' nunca se cobra de forma retroactiva.
 * BLOQUEO (COMMISSION_BLOCK_SCOPE, solo en active, por vendedor con comisión abierta = pending_commission | commission_reported | rejected):
 *   all (defecto) = no puede enviar mensajes · new = no puede publicar, reservar ni abrir chats nuevos (sí responder en chats abiertos).
 *   En ambos casos SIEMPRE puede escribirle a la cuenta oficial. can_message se DERIVA de las comisiones abiertas (no se guarda).
 * Datos personales (número de operación y titular): solo admin y el propio usuario; nunca en logs ni en el pedido que viaja por Socket.io. */
const crypto = require('crypto');
const opn = require('./opnumbers');

const OPEN = new Set(['pending_commission', 'commission_reported', 'rejected']);
const STATUSES = new Set(['pending_commission', 'commission_reported', 'rejected', 'completed', 'waived', 'shadow']);
const bps = (rate) => Math.round(rate * 10000);
const feeCents = (baseCents, rate) => Math.round(baseCents * bps(rate) / 10000); // al céntimo más cercano: S/ 33.33 → 100, S/ 1.00 → 3
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const no = (status, code, error, field) => ({ status, body: { ok: false, code, error, ...(field ? { field } : {}) } });
const FEE_MSG = 'Envío de mensajes restringido. Por favor, reporta tu comisión pendiente';

module.exports = function createCommission(ctx) {
  const { orders, products, saveOrder, pushOrder, setStatus, emitTo } = ctx;
  const env = ctx.env || process.env, now = ctx.now || Date.now;
  const isVerified = ctx.isVerified || (() => true);
  const MAX_FAILS = ctx.maxPinFails || 5, LOCK_MS = ctx.lockMs || 5 * 60e3;

  const mode = () => { const m = String(env.COMMISSION_MODE || 'off').trim().toLowerCase(); return m === 'shadow' || m === 'active' ? m : 'off'; };
  const rate = () => { const r = parseFloat(env.COMMISSION_RATE); return r > 0 && r <= 0.5 ? r : 0.03; };
  const scope = () => (String(env.COMMISSION_BLOCK_SCOPE || 'all').trim().toLowerCase() === 'new' ? 'new' : 'all');
  const active = () => mode() === 'active';
  const yape = () => { const number = String(env.YAPE_NUMBER || '').trim(), holder = String(env.YAPE_HOLDER || '').trim(); return number ? { number, holder } : null; };

  /* ---------- comisiones abiertas por vendedor (se reconstruye al arrancar y se actualiza en cada cambio) ---------- */
  const open = new Map(); // sellerUid -> Set(orderId)
  const isOpen = (o) => !!(o.commission && OPEN.has(o.commission.status));
  function track(o) {
    const s = open.get(o.ownerId);
    if (isOpen(o)) { if (s) s.add(o.id); else open.set(o.ownerId, new Set([o.id])); }
    else if (s) { s.delete(o.id); if (!s.size) open.delete(o.ownerId); }
  }
  function rebuild() {
    open.clear();
    const ops = [];
    for (const o of orders.values()) { track(o); if (o.commission && o.commission.opNumber) ops.push(o.commission.opNumber); }
    opn.rebuild(ops);
    return open.size;
  }
  const items = (uid) => [...(open.get(uid) || [])].map((id) => orders.get(id)).filter(Boolean).sort((a, b) => a.commission.createdAt - b.commission.createdAt);
  const canMessage = (uid) => !active() || !open.has(uid);
  const due = (uid) => (active() ? items(uid).reduce((s, o) => s + o.commission.amount, 0) : 0);
  const snapshot = (uid) => ({
    can_message: canMessage(uid), due: due(uid),
    items: active() ? items(uid).map((o) => ({ orderId: o.id, t: o.t, amount: o.commission.amount, status: o.commission.status, rejectReason: o.commission.rejectReason || '' })) : [],
  });
  const notify = (uid) => { if (active() && typeof emitTo === 'function') emitTo(uid, 'commission', snapshot(uid)); };
  const mine = (o) => (o.commission && o.commission.status !== 'shadow' ? { amount: o.commission.amount, status: o.commission.status } : null); // lo único que ve el usuario

  /* ---------- cumplimiento del bloqueo (el servidor decide; el cliente solo muestra) ---------- */
  function restrict(uid, a) { // a = { action: 'message' | 'publish' | 'order', toOfficial?, chatExists? } → null si puede, o el error FEE_DUE
    if (!active() || !open.has(uid)) return null;
    if (a.action === 'message') {
      if (a.toOfficial) return null;
      if (scope() === 'all' || !a.chatExists) return { ok: false, code: 'FEE_DUE', error: FEE_MSG };
      return null;
    }
    if (scope() === 'new' && (a.action === 'publish' || a.action === 'order')) return { ok: false, code: 'FEE_DUE', error: 'Tienes una comisión pendiente. Repórtala para volver a publicar o reservar.' };
    return null;
  }

  /* ---------- crear la comisión (síncrono; se guarda junto con el pedido completado) ---------- */
  const baseCentsOf = (o) => (Number.isInteger(o.baseCents) ? o.baseCents : Math.max(0, Math.round((Number(o.total) || 0) - 10 - (o.del === 'home' ? 15 : 0)) * 100)); // pedidos anteriores sin baseCents
  function create(o) {
    const m = mode();
    if (m === 'off' || o.commission) return null; // una sola comisión por pedido
    const base = baseCentsOf(o), r = rate(), amount = feeCents(base, r);
    if (amount < 1) return null;
    o.commission = { amount, rate: r, base, status: m === 'shadow' ? 'shadow' : 'pending_commission', createdAt: now(), reportedAt: 0, paidAt: 0, opNumber: '', senderName: '', rejectReason: '' };
    track(o);
    return o.commission;
  }

  /* ---------- confirmar entrega: la usan order:confirm (Socket.io) y POST /api/orders/:id/confirm ---------- */
  const inflight = new Map(); // orderId -> promesa (un doble clic no confirma dos veces ni responde antes de guardar)
  function confirmDelivery(id, uid, rawPin) {
    id = String(id || '');
    const o = orders.get(id);
    if (!o || o.ownerId !== uid) return Promise.resolve({ ok: false, status: 404, code: 'NOT_FOUND', error: 'Pedido no encontrado' });
    if (inflight.has(id)) return inflight.get(id);
    const p = doConfirm(o, rawPin).finally(() => inflight.delete(id));
    inflight.set(id, p);
    return p;
  }
  async function doConfirm(o, rawPin) {
    if (o.status === 'completed') return { ok: true, already: true, order: o, commission: mine(o) }; // idempotente: no crea otra comisión
    if (o.status !== 'pending') return { ok: false, status: 409, code: 'INVALID', error: 'Este pedido ya no está pendiente' };
    const t = now();
    if (o.lockedUntil > t) return { ok: false, status: 429, code: 'RATE_LIMIT', error: 'Demasiados intentos. Espera ' + Math.ceil((o.lockedUntil - t) / 60000) + ' min e inténtalo de nuevo' };
    const pin = String(rawPin == null ? '' : rawPin).replace(/\D/g, '').slice(0, 6);
    if (pin.length !== 6) return { ok: false, status: 400, code: 'INVALID', error: 'El código tiene 6 dígitos' };
    const a = Buffer.from(pin), b = Buffer.from(String(o.pin));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      o.fails++;
      if (o.fails >= MAX_FAILS) {
        o.fails = 0; o.lockedUntil = t + LOCK_MS;
        await saveOrder(o, true); // el bloqueo y los intentos fallidos sobreviven a un reinicio
        pushOrder(o, true);
        return { ok: false, status: 429, code: 'RATE_LIMIT', error: 'Código incorrecto. Pedido bloqueado ' + Math.round(LOCK_MS / 60000) + ' minutos por seguridad' };
      }
      await saveOrder(o, true);
      return { ok: false, status: 400, code: 'CODE_INVALID', error: 'Código incorrecto (' + (MAX_FAILS - o.fails) + ' intentos restantes)' };
    }
    // código correcto: sin await hasta aquí → el pedido pasa a completado y la comisión nace en la misma sección síncrona
    o.status = 'completed'; o.doneAt = t; o.fails = 0;
    const cm = create(o);
    const p = products.get(o.pid), sell = !!(p && o.mode === 'compra');
    const saved = await Promise.all([saveOrder(o, true), sell ? setStatus(p, 'sold') : true]);
    if (!saved.every(Boolean)) { // no quedó guardado: el pedido sigue pendiente y se puede reintentar
      o.status = 'pending'; o.doneAt = 0;
      if (cm) { delete o.commission; track(o); }
      saveOrder(o);
      if (sell) await setStatus(p, 'reserved');
      return { ok: false, status: 500, code: 'INVALID', error: 'No se pudo guardar la entrega. Inténtalo de nuevo.' };
    }
    pushOrder(o, true);
    if (cm) { notify(o.ownerId); console.log('[comision] comisión ' + cm.status + ' creada en ' + o.id + ' (' + cm.amount + ' céntimos)'); }
    return { ok: true, order: o, commission: mine(o) };
  }

  /* ---------- el vendedor reporta su pago de Yape ---------- */
  const hits = new Map(); // uid -> marcas de tiempo (máx. 5 reportes por hora)
  async function reportYape(uid, id, body) {
    const o = orders.get(String(id || ''));
    if (!o || o.ownerId !== uid || !active() || !o.commission || !OPEN.has(o.commission.status)) return no(404, 'NOT_FOUND', 'No encontramos una comisión pendiente en ese pedido');
    const cm = o.commission;
    if (cm.status === 'commission_reported') return no(409, 'INVALID', 'Ya reportaste este pago. Espera la revisión.');
    const t = now(), h = (hits.get(uid) || []).filter((x) => t - x < 3600e3);
    if (h.length >= 5) { const r = no(429, 'RATE_LIMIT', 'Reportaste muchas veces. Intenta de nuevo en un rato.'); r.body.retry = Math.ceil((3600e3 - (t - h[0])) / 1000); return r; }
    h.push(t); hits.set(uid, h);
    body = body || {};
    const name = clean(body.senderName, 60), opRaw = opn.normalize(body.operationNumber);
    if (name.length < 2) return no(400, 'INVALID', 'Escribe el nombre o celular del titular (2 a 60 caracteres).', 'senderName');
    if (!opRaw) return no(400, 'INVALID', 'Número de operación no válido (4 a 20 letras o números).', 'operationNumber');
    if (!opn.claim(opRaw)) return no(400, 'INVALID', 'Ese número de operación ya fue usado', 'operationNumber'); // sin await entre comprobar y reservar
    const prev = { ...cm };
    Object.assign(cm, { status: 'commission_reported', reportedAt: t, opNumber: opRaw, senderName: name, rejectReason: '' });
    track(o);
    if (!(await saveOrder(o, true))) { // no quedó guardado: se deshace todo y el número vuelve a quedar libre
      Object.assign(cm, prev); opn.release(opRaw); track(o);
      return no(500, 'INVALID', 'No se pudo guardar tu reporte. Inténtalo de nuevo.');
    }
    notify(uid);
    console.log('[comision] pago reportado en ' + o.id);
    return { status: 200, body: { ok: true, commission: mine(o) } };
  }

  /* ---------- acciones del administrador ---------- */
  async function adminAct(kind, admin, id, body) {
    if (!admin || admin.admin !== true) return no(403, 'FORBIDDEN', 'No autorizado');
    const o = orders.get(String(id || ''));
    if (!o || !o.commission || o.commission.status === 'shadow') return no(404, 'NOT_FOUND', 'Comisión no encontrada');
    const cm = o.commission, st = cm.status, t = now();
    const reason = clean((body || {}).reason, 200);
    if (kind === 'approve' && st !== 'commission_reported') return no(409, 'INVALID', 'Solo se aprueban comisiones con pago reportado');
    if (kind === 'reject' && st !== 'commission_reported') return no(409, 'INVALID', 'Solo se rechazan comisiones con pago reportado');
    if (kind === 'waive' && !OPEN.has(st)) return no(409, 'INVALID', 'Solo se perdonan comisiones abiertas');
    if ((kind === 'reject' || kind === 'waive') && reason.length < 3) return no(400, 'INVALID', 'Escribe el motivo (mínimo 3 letras).', 'reason');
    const prev = { ...cm };
    if (kind === 'approve') Object.assign(cm, { status: 'completed', paidAt: t, rejectReason: '' });
    else if (kind === 'reject') Object.assign(cm, { status: 'rejected', rejectReason: reason }); // el número de operación queda bloqueado
    else Object.assign(cm, { status: 'waived', note: reason, paidAt: 0 });
    track(o);
    if (!(await saveOrder(o, true))) { for (const k of Object.keys(cm)) delete cm[k]; Object.assign(cm, prev); track(o); return no(500, 'INVALID', 'No se pudo guardar. Inténtalo de nuevo.'); }
    notify(o.ownerId);
    console.log('[comision] ' + kind + ' en ' + o.id);
    return { status: 200, body: { ok: true, status: cm.status } };
  }

  /* ---------- consultas ---------- */
  function listAdmin(admin, status) {
    if (!admin || admin.admin !== true) return no(403, 'FORBIDDEN', 'No autorizado');
    const want = STATUSES.has(status) ? status : null;
    let potential = 0, collected = 0, pending = 0, reported = 0;
    const list = [];
    for (const o of orders.values()) {
      const c = o.commission; if (!c) continue;
      if (c.status === 'shadow') potential += c.amount;
      else if (c.status === 'completed') collected += c.amount;
      else if (OPEN.has(c.status)) { pending += c.amount; if (c.status === 'commission_reported') reported++; }
      if (!want || c.status === want) list.push({ orderId: o.id, t: o.t, mode: o.mode, sellerUid: o.ownerId, sellerName: o.ownerName, amount: c.amount, rate: c.rate, base: c.base, status: c.status, opNumber: c.opNumber, senderName: c.senderName, rejectReason: c.rejectReason || '', note: c.note || '', createdAt: c.createdAt, reportedAt: c.reportedAt, paidAt: c.paidAt });
    }
    list.sort((a, b) => (b.status === 'commission_reported') - (a.status === 'commission_reported') || b.createdAt - a.createdAt); // pendientes de revisión primero
    return { status: 200, body: { ok: true, mode: mode(), summary: { potentialShadow: potential, collected, pendingCharge: pending, reportedCount: reported }, items: list.slice(0, 500) } };
  }
  const myCommissions = (uid) => {
    const snap = snapshot(uid), y = active() && snap.items.length ? yape() : null;
    return { status: 200, body: { ok: true, mode: mode() === 'shadow' ? 'off' : mode(), can_message: snap.can_message, due: snap.due, items: snap.items, ...(y ? { yape: y } : {}) } };
  };
  const config = (user) => ({ status: 200, body: { ok: true, mode: mode() === 'shadow' && !(user && user.admin) ? 'off' : mode(), rate: rate() } });

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
      } catch (e) { console.error('[comision] error:', e.message); res.status(500).json({ ok: false, code: 'INVALID', error: 'Error del servidor. Intenta de nuevo.' }); }
    };
    const needVerified = (u) => (u.admin || isVerified(u) ? null : no(403, 'NOT_VERIFIED', 'Verifica tu correo UPC para continuar.'));
    app.post('/api/orders/:id/confirm', json, h(async (u, req) => {
      const nv = needVerified(u); if (nv) return nv;
      const r = await confirmDelivery(req.params.id, u.uid, (req.body || {}).code);
      if (!r.ok) return { status: r.status, body: { ok: false, code: r.code, error: r.error } };
      return { status: 200, body: { ok: true, ...(r.already ? { already: true } : {}), commission: r.commission, ...(r.commission && active() && yape() ? { yape: yape() } : {}) } };
    }));
    app.post('/api/orders/:id/report-yape', json, h(async (u, req) => needVerified(u) || reportYape(u.uid, req.params.id, req.body)));
    for (const k of ['approve', 'reject', 'waive']) app.post('/api/admin/orders/:id/' + k, json, h((u, req) => adminAct(k, u, req.params.id, req.body)));
    app.get('/api/admin/commissions', h((u, req) => listAdmin(u, String(req.query.status || ''))));
    app.get('/api/me/commissions', h((u) => myCommissions(u.uid)));
    app.get('/api/config/commission', h((u) => config(u)));
  }

  function describe() { // una línea de log al arrancar (sin números ni nombres)
    const m = mode();
    console.log('[comision] modo=' + m + (m !== 'off' ? ' · tasa=' + Math.round(rate() * 1000) / 10 + '% · alcance=' + scope() : ''));
    if (m === 'active' && !yape()) console.warn('[comision] COMMISSION_MODE=active pero falta YAPE_NUMBER: los vendedores no verán a dónde pagar');
    if (String(env.COMMISSION_MODE || '').trim() && !['off', 'shadow', 'active'].includes(String(env.COMMISSION_MODE).trim().toLowerCase())) console.warn('[comision] COMMISSION_MODE no válido: se usa off');
  }

  return { mode, rate, scope, feeCents, create, confirmDelivery, reportYape, adminAct, listAdmin, myCommissions, config, restrict, canMessage, due, snapshot, notify, rebuild, mount, describe };
};
module.exports.feeCents = feeCents;
