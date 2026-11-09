/* U2U · comunidad: reportes de publicaciones, moderación (admin) y reseñas verificadas
 *
 * REPORTES
 *  - Motivos: obscena, estafa, falsa, otro. Un usuario no puede reportar dos veces la misma publicación
 *    (la regla vive en el servidor y se conserva aunque el reporte sea descartado o el servidor reinicie).
 * ADMIN
 *  - El rol lo decide SOLO el servidor (cuenta definida con ADMIN_USER / ADMIN_PASS en auth.js).
 *    Cada evento admin:* comprueba socket.data.admin, que sale de la cuenta y nunca del cliente.
 * RESEÑAS
 *  - Solo el comprador de un pedido con entrega confirmada con PIN (status "completed"), una por pedido.
 *  - Se guardan con db.js (PostgreSQL o archivos); el promedio se calcula en el servidor.
 */
const store = require('./db');

const REASONS = { obscena: 1, estafa: 1, falsa: 1, otro: 1 };
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);

module.exports = function community(ctx) {
  const { io, accounts, products, orders, removeProduct, cancelPending, pushOrder } = ctx;

  // Datos desde db.js (PostgreSQL o archivos). R/V conservan la misma forma que antes para no tocar la lógica.
  const R = {
    data: {
      reports: store.rows('reports').sort((a, b) => a.ts - b.ts),
      removed: store.rows('removed').map((x) => ({ id: x.pid, uid: x.uid || '' })), // publicaciones eliminadas por moderación
      seq: 0,
    },
    save() {}, flush() {},
  };
  const V = { data: { reviews: store.rows('reviews').sort((a, b) => a.ts - b.ts) } };
  R.data.seq = R.data.reports.reduce((m, r) => Math.max(m, parseInt(String(r.id).slice(1), 10) || 0), 0);

  const reported = new Set(R.data.reports.map((r) => r.pid + '|' + r.reporterUid));
  const removed = new Set(R.data.removed.map((x) => x.id));
  const byOrder = new Map(); // orderId -> reseña (una por pedido)
  const agg = new Map();     // sellerUid -> { sum, n }

  function addAgg(r) {
    byOrder.set(r.orderId, r);
    const a = agg.get(r.sellerUid) || { sum: 0, n: 0 };
    a.sum += r.rating; a.n++;
    agg.set(r.sellerUid, a);
  }
  V.data.reviews.forEach(addAgg);

  const rating = (uid) => {
    const a = agg.get(uid);
    return a ? { avg: Math.round((a.sum / a.n) * 10) / 10, count: a.n } : { avg: 0, count: 0 };
  };
  const allRatings = () => { const o = {}; for (const uid of agg.keys()) o[uid] = rating(uid); return o; };

  // límite por usuario y tipo de acción (se guarda en socket.data)
  const hit = (me, key, max, ms) => {
    const now = Date.now();
    me[key] = (me[key] || []).filter((t) => now - t < ms);
    if (me[key].length >= max) return false;
    me[key].push(now);
    return true;
  };
  const markRemoved = (pid, uid) => {
    if (removed.has(pid)) return;
    removed.add(pid);
    R.data.removed.push({ id: pid, uid: uid || '' });
    store.removed.put({ pid, uid: uid || '' });
    if (R.data.removed.length > 5000) { const old = R.data.removed.shift(); removed.delete(old.id); store.removed.del(old.id); }
  };

  /* ---------- vista del panel admin ---------- */
  function adminView() {
    const cnt = new Map();
    R.data.reports.forEach((r) => cnt.set(r.pid, (cnt.get(r.pid) || 0) + 1));
    const reports = R.data.reports.slice(-400).reverse().map((r) => ({ ...r, count: cnt.get(r.pid), live: products.has(r.pid) }));
    return { reports, blocked: accounts.listBlocked() };
  }
  const pushAdmin = () => io.to('admin').emit('admin:reports', adminView());

  function resolve(match, status, resolution, by) {
    const now = Date.now();
    let n = 0;
    R.data.reports.forEach((r) => {
      if (r.status === 'open' && match(r)) { r.status = status; r.resolution = resolution; r.resolvedAt = now; r.resolvedBy = by; store.reports.put(r); n++; }
    });
    if (R.data.reports.length > 3000) { // recorte: se descartan los resueltos más antiguos
      let extra = R.data.reports.length - 3000;
      R.data.reports = R.data.reports.filter((r) => { const drop = extra > 0 && r.status !== 'open' && extra--; if (drop) store.reports.del(r.id); return !drop; });
    }
    R.save();
    return n;
  }

  // Solo el admin (decidido por el servidor) pasa este filtro
  const asAdmin = (socket, ack, fn) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const me = socket.data;
    const acc = me && me.uid ? accounts.getByUid(me.uid) : null;
    if (!me || !me.admin || !acc || acc.admin !== true) return reply({ error: 'No autorizado' });
    try { fn(reply, me); } catch (e) { console.error('[admin]', e.message); reply({ error: 'Error del servidor' }); }
  };

  return {
    isRemoved: (pid) => removed.has(pid),
    reviewed: (orderId) => byOrder.has(orderId),

    // Se llama al entrar (join), antes de enviar el catálogo
    onJoin(socket) {
      const me = socket.data;
      socket.emit('removed', R.data.removed.filter((x) => x.uid === me.uid).map((x) => x.id)); // para limpiar copias locales del dueño
      socket.emit('reported', R.data.reports.filter((r) => r.reporterUid === me.uid).map((r) => r.pid));
      socket.emit('ratings', allRatings());
      if (me.admin) socket.emit('admin:reports', adminView());
    },

    attach(socket) {
      /* ----- Reportar publicación ----- */
      socket.on('report:create', (d, ack) => {
        const reply = (o) => typeof ack === 'function' && ack(o);
        const me = socket.data;
        if (!me || !me.uid) return reply({ error: 'Primero entra con tu cuenta' });
        if (me.admin) return reply({ error: 'La cuenta oficial no reporta: modera desde el panel' });
        d = d || {};
        if (!hit(me, 'rpts', 10, 10 * 60e3)) return reply({ error: 'Has enviado muchos reportes seguidos. Espera unos minutos' });

        const pid = parseInt(d.pid, 10);
        const p = products.get(pid);
        if (!p) return reply({ error: 'Esta publicación ya no existe' });
        if (p.ownerUid === me.uid) return reply({ error: 'No puedes reportar tu propia publicación' });
        const reason = REASONS[d.reason] ? d.reason : null;
        if (!reason) return reply({ error: 'Elige un motivo' });
        const note = clean(d.note, 200);
        if (reason === 'otro' && note.length < 3) return reply({ error: 'Cuéntanos brevemente el motivo' });
        const key = pid + '|' + me.uid;
        if (reported.has(key)) return reply({ error: 'Ya reportaste esta publicación' });

        reported.add(key);
        R.data.reports.push({
          id: 'R' + (++R.data.seq), pid, pt: p.t, pdesc: String(p.desc || '').slice(0, 200), pcat: p.cat, pmode: p.mode,
          pprice: p.price, prent: p.rent, ownerUid: p.ownerUid, ownerName: p.ownerName,
          reporterUid: me.uid, reporterName: me.name, reason, note, ts: Date.now(), status: 'open',
        });
        store.reports.put(R.data.reports[R.data.reports.length - 1]);
        pushAdmin();
        reply({ ok: true });
      });

      /* ----- Acciones del administrador ----- */
      socket.on('admin:reports', (_d, ack) => asAdmin(socket, ack, (reply) => reply({ ok: true, ...adminView() })));

      // Eliminar publicación: desaparece al instante para todos y resuelve sus reportes
      socket.on('admin:delete', (d, ack) => asAdmin(socket, ack, (reply, me) => {
        const pid = parseInt((d || {}).pid, 10);
        if (!pid) return reply({ error: 'Publicación no válida' });
        const p = products.get(pid);
        const rep = R.data.reports.find((r) => r.pid === pid);
        if (!p && !rep) return reply({ error: 'Publicación no encontrada' });
        removeProduct(pid);
        markRemoved(pid, p ? p.ownerUid : rep.ownerUid);
        resolve((r) => r.pid === pid, 'actioned', 'deleted', me.name);
        R.save();
        pushAdmin();
        reply({ ok: true });
      }));

      socket.on('admin:dismiss', (d, ack) => asAdmin(socket, ack, (reply, me) => {
        const id = String((d || {}).id || '');
        const r = R.data.reports.find((x) => x.id === id);
        if (!r || r.status !== 'open') return reply({ error: 'Reporte no encontrado o ya resuelto' });
        resolve((x) => x.id === id, 'dismissed', 'dismissed', me.name);
        pushAdmin();
        reply({ ok: true });
      }));

      // Bloquear usuario: no puede iniciar sesión, se cierran sus conexiones y se eliminan sus publicaciones
      socket.on('admin:block', (d, ack) => asAdmin(socket, ack, (reply, me) => {
        const uid = String((d || {}).uid || '');
        const u = accounts.getByUid(uid);
        if (!u) return reply({ error: 'Usuario no encontrado' });
        if (u.admin) return reply({ error: 'No puedes bloquear al administrador' });
        accounts.setBlocked(uid, true);
        [...products.values()].filter((p) => p.ownerUid === uid).forEach((p) => { removeProduct(p.id); markRemoved(p.id, uid); });
        cancelPending((o) => o.buyerId === uid || o.ownerId === uid);
        resolve((r) => r.ownerUid === uid, 'actioned', 'blocked', me.name);
        R.save();
        io.in('u:' + uid).emit('blocked');
        io.in('u:' + uid).disconnectSockets(true);
        pushAdmin();
        reply({ ok: true });
      }));

      socket.on('admin:unblock', (d, ack) => asAdmin(socket, ack, (reply) => {
        const uid = String((d || {}).uid || '');
        if (!accounts.getByUid(uid)) return reply({ error: 'Usuario no encontrado' });
        accounts.setBlocked(uid, false);
        pushAdmin();
        reply({ ok: true });
      }));

      /* ----- Reseñas verificadas ----- */
      socket.on('review:create', (d, ack) => {
        const reply = (o) => typeof ack === 'function' && ack(o);
        const me = socket.data;
        if (!me || !me.uid) return reply({ error: 'Primero entra con tu cuenta' });
        d = d || {};
        if (!hit(me, 'rvs', 10, 10 * 60e3)) return reply({ error: 'Demasiadas reseñas seguidas. Espera unos minutos' });

        const o = orders.get(String(d.orderId || ''));
        if (o && o.ownerId === me.uid) return reply({ error: 'No puedes calificarte a ti mismo' });
        if (!o || o.buyerId !== me.uid) return reply({ error: 'Pedido no encontrado' });
        if (o.status !== 'completed') return reply({ error: 'Solo puedes calificar cuando la entrega ya se confirmó con el código' });
        if (byOrder.has(o.id)) return reply({ error: 'Ya calificaste este pedido' });
        const stars = Math.round(Number(d.rating));
        if (!(stars >= 1 && stars <= 5)) return reply({ error: 'Elige de 1 a 5 estrellas' });

        const r = {
          id: 'V' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          orderId: o.id, pid: o.pid, pt: o.t, mode: o.mode,
          sellerUid: o.ownerId, sellerName: o.ownerName, buyerUid: me.uid, buyerName: me.name,
          rating: stars, text: clean(d.text, 300), ts: Date.now(),
        };
        V.data.reviews.push(r);
        addAgg(r);
        store.reviews.put(r);
        pushOrder(o); // ambos ven el pedido como "reseña enviada"
        io.emit('rating', { uid: o.ownerId, ...rating(o.ownerId) });
        io.to('u:' + o.ownerId).emit('review:new', { from: me.name, rating: stars });
        reply({ ok: true });
      });

      socket.on('reviews:get', (d, ack) => {
        const reply = (o) => typeof ack === 'function' && ack(o);
        const me = socket.data;
        if (!me || !me.uid) return reply({ error: 'Primero entra con tu cuenta' });
        if (!hit(me, 'rvg', 40, 60e3)) return reply({ error: 'Vas muy rápido, espera un momento' });
        const uid = String((d || {}).uid || '');
        const list = V.data.reviews.filter((r) => r.sellerUid === uid).slice(-50).reverse()
          .map((r) => ({ id: r.id, buyerName: r.buyerName, rating: r.rating, text: r.text, pt: r.pt, mode: r.mode, ts: r.ts }));
        reply({ ok: true, list, ...rating(uid) });
      });
    },

    flush() {},
  };
};
