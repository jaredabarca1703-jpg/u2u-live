/* U2U · servidor de tiempo real (Express + Socket.io)
 * - Sirve la app desde /public
 * - Cuentas con usuario/correo + contraseña (auth.js, crypto.scrypt) y sesión por token.
 *   El servidor emite a cada cuenta su identidad (uid público + secreto privado) y solo
 *   deja entrar al chat en vivo a cuentas registradas: nadie puede suplantar a otro.
 * - Cualquier usuario puede publicar, comprar, alquilar y chatear.
 * - Cuenta OFICIAL = la cuenta admin (ADMIN_USER/ADMIN_PASS) con nombre público OFFICIAL_NAME: vende el catálogo
 *   inicial (seed.json), recibe pedidos, confirma entregas con PIN, chatea y modera. No compra, no reporta, no se califica.
 * - Publicaciones: se guardan, se reenvían en vivo a todos y se entregan a quien entre después.
 * - Chat PRIVADO por producto: solo lo ven el interesado y el dueño de ese producto.
 * - Pedidos con CÓDIGO DE ENTREGA (estilo PedidosYa): al comprar se genera un PIN de 6 dígitos
 *   que solo ve el comprador. El dueño lo ingresa al entregar el producto y recién ahí se
 *   confirma la transacción.
 * - Cuentas, sesiones, publicaciones, pedidos, reportes y reseñas se guardan en PostgreSQL (DATABASE_URL) o,
 *   sin esa variable, en archivos JSON (db.js). Los chats también.
 * - v8.6.3 (bloque 3, protección de datos): NADA se borra por tope global (publicaciones, pedidos, chats ni mensajes).
 *   Tope por usuario (PUB_LIMIT_USER) y tope de espacio (STORAGE_LIMIT_MB) solo RECHAZAN lo nuevo.
 *   Las escrituras críticas (publicar, pedidos, reservas, bloqueos, reseñas) esperan a quedar guardadas antes de confirmar.
 *   Cada evento de Socket.io vuelve a comprobar cuenta, bloqueo y rol en el servidor (guard).
 * - v8.6.5 (bloque 5): cuentas nuevas con correo UPC sin verificar NO publican, reservan ni chatean (code NOT_VERIFIED);
 *   la bienvenida de la cuenta oficial se envía al VERIFICAR (auth.js llama a sendWelcome), no al crear la cuenta.
 */
require('./env'); // variables de entorno: .env en tu PC, panel Environment en Render (ver env.js)

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const db = require('./db');
const accounts = require('./auth');

const app = express();
app.set('trust proxy', 1); // Render va detrás de un proxy: así req.ip es la IP real (límite de intentos)
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6 }); // 1 MB por mensaje (fotos incluidas)

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.send('ok'));

const MAX_PHOTOS = 3, MAX_PHOTO = 250000, MAX_TOTAL = 620000; // fotos (caracteres base64): el cliente las reduce a 1024 px y ≤150 KB c/u
const MAX_PIN_FAILS = 5, LOCK_MS = 5 * 60 * 1000;             // 5 intentos y bloqueo de 5 minutos
const CATS = ['Cámaras', 'Laptops', 'Calculadoras', 'Herramientas', 'Libros', 'Audio', 'Ropa'];
const MODES = ['venta', 'alquiler', 'ambos'];
const CONDS = ['Nuevo', 'Semi nuevo', 'Usado'];
const CAREERS = ['Ing. Civil', 'Arquitectura', 'Sistemas', 'Negocios', 'Comunicaciones', 'Diseño de Moda', 'Salud'];
const ACTIVE = new Set(['available', 'paused', 'reserved']); // cuentan para PUB_LIMIT_USER (vendidas y eliminadas no)

/* Variables de entorno con valor por defecto: si falta o es inválida, el servidor arranca igual con el valor por defecto */
const envInt = (name, def) => { const n = parseInt(process.env[name], 10); return Number.isFinite(n) && n > 0 ? n : def; };
const pubLimit = () => envInt('PUB_LIMIT_USER', 10);
const storageLimit = () => envInt('STORAGE_LIMIT_MB', 400);

const convs = new Map();    // "pid|buyerId" -> { key, pid, buyerId, buyerName, msgs: [] }
const products = new Map(); // id -> publicación (catálogo compartido)
const owners = new Map();   // pid -> uid del dueño
const orders = new Map();   // id -> pedido
const quotas = new Map();   // uid -> contadores de límites (sobreviven a re-join y a varios sockets del mismo usuario)
let lastId = Date.now();
let OFFICIAL = null;       // cuenta oficial (la admin): { uid, name } o null; se define en boot()

const ownerOf = (pid) => owners.get(pid);
const ownerOfConv = (c) => (c.pid === 0 ? OFFICIAL && OFFICIAL.uid : ownerOf(c.pid)); // pid 0 = chat directo con la cuenta oficial
const presence = () => {
  const r = io.sockets.adapter.rooms;
  return {
    total: io.engine.clientsCount,
    uids: [...r.keys()].filter((k) => k.startsWith('u:')).map((k) => k.slice(2)), // quién está en línea
  };
};
const num = (v, max) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
const fail = (code, error) => ({ ok: false, code, error });
const notVerified = () => fail('NOT_VERIFIED', 'Verifica tu correo UPC para publicar, reservar o chatear.');
function quotaOf(uid) {
  let q = quotas.get(uid);
  if (!q) {
    if (quotas.size > 5000) quotas.clear();
    q = { hits: [], pubs: [], ords: [] }; quotas.set(uid, q);
  }
  return q;
}

/* ---------- Validación por evento: cuenta, bloqueo y rol salen SIEMPRE del servidor ---------- */
function guard(socket) {
  const me = socket.data;
  if (!me || !me.uid) return { err: { ok: false, code: 'FORBIDDEN', error: 'Primero entra con tu nombre' } };
  const acc = accounts.getByUid(me.uid);
  if (!acc) return { err: fail('ACCOUNT_DELETED', 'Tu cuenta ya no existe') };
  if (acc.blocked) { socket.emit('blocked'); socket.disconnect(true); return { err: fail('USER_BLOCKED', 'Tu cuenta fue bloqueada') }; }
  me.admin = acc.admin === true; // el rol no se arrastra: se recalcula de la cuenta en cada evento
  me.verified = accounts.isVerified(acc); // idem: cuentas nuevas sin verificar no publican, reservan ni chatean
  return { me, acc };
}

/* ---------- Espacio en la base de datos (STORAGE_LIMIT_MB) ---------- */
const storage = { mb: null, at: 0, busy: false, warnAt: 0 };
async function refreshStorage(force) {
  if (storage.busy || (!force && Date.now() - storage.at < 15000)) return;
  storage.busy = true;
  try {
    const u = await db.usage(); // null sin PostgreSQL (modo archivos): no hay medición y no se rechaza nada
    if (u) {
      storage.mb = u.mb;
      const lim = storageLimit();
      if (u.mb >= lim) console.warn('[db] ALMACENAMIENTO LLENO: ' + u.mb + ' MB de ' + lim + ' MB. Se rechazan publicaciones nuevas (STORAGE_FULL). No se borra nada.');
      else if (u.mb >= lim * 0.9) console.warn('[db] ATENCIÓN: ' + u.mb + ' MB de ' + lim + ' MB. Cerca del tope de publicaciones nuevas.');
    }
    storage.at = Date.now();
  } catch (e) { console.error('[db] no se pudo medir el espacio:', e.message); }
  finally { storage.busy = false; }
}
const storageFull = () => storage.mb !== null && storage.mb >= storageLimit();

/* ---------- Publicaciones ---------- */
function cleanProduct(d, me) {
  d = d || {};
  const t = String(d.t || '').trim().slice(0, 60);
  if (t.length < 3) return { error: 'Título muy corto' };
  const mode = MODES.includes(d.mode) ? d.mode : 'venta';
  const price = num(d.price, 1e6), rent = num(d.rent, 1e5), dep = num(d.dep, 1e6);
  if (mode !== 'alquiler' && !price) return { error: 'Falta el precio de venta' };
  if (mode !== 'venta' && !rent) return { error: 'Falta el precio de alquiler' };
  const ph = Array.isArray(d.ph) ? d.ph.slice(0, MAX_PHOTOS) : [];
  if (!ph.length) return { error: 'Falta al menos una foto' };
  let total = 0;
  for (const f of ph) {
    // solo claves internas de la app (cam, dron...) o imágenes en base64: nunca URLs externas
    const okKey = typeof f === 'string' && /^[a-z0-9]{2,12}$/.test(f);
    const okImg = typeof f === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f) && f.length <= MAX_PHOTO;
    if (!okKey && !okImg) return { error: 'Foto no válida o muy pesada' };
    total += f.length;
  }
  if (total > MAX_TOTAL) return { error: 'Las fotos pesan demasiado' };

  let id = parseInt(d.id, 10);
  if (!Number.isSafeInteger(id) || id <= 1000) id = 0;
  const cond = d.cond === 'Como nuevo' ? 'Semi nuevo' : d.cond; // compatibilidad con publicaciones antiguas
  const car = [...new Set(Array.isArray(d.car) ? d.car : [])].filter((c) => CAREERS.includes(c)).slice(0, CAREERS.length);
  return {
    p: {
      id, t, ph, mode, price, rent, dep, car,
      cat: CATS.includes(d.cat) ? d.cat : 'Herramientas',
      cond: CONDS.includes(cond) ? cond : 'Usado',
      cp: Math.min(3, Math.max(0, parseInt(d.cp, 10) || 0)),
      desc: String(d.desc || '').trim().slice(0, 500) || 'Sin descripción',
      status: 'available', // available | reserved | sold
      ownerUid: me.uid, ownerName: me.name, ts: Date.now(),
      official: me.admin === true, // la insignia "Oficial ✓" la decide el servidor, nunca el cliente
    },
  };
}

const activeCount = (uid) => { let n = 0; for (const p of products.values()) if (p.ownerUid === uid && ACTIVE.has(p.status)) n++; return n; };

/* Publicar: validación + topes + guardado. La comprobación y el registro en memoria son síncronos (sin await entre medio);
   la respuesta de éxito solo sale cuando la publicación ya quedó guardada. Devuelve { res: ack, p?: publicación nueva }. */
async function publish(me, d) {
  if (me.verified === false) return { res: notVerified() };
  const r = cleanProduct(d, me);
  if (r.error) return { res: { ok: false, error: r.error } };
  const p = r.p;
  if (p.id && community.isRemoved(p.id)) return { res: { ok: false, error: 'Esta publicación fue eliminada por moderación', removed: true } };
  if (p.id) {
    const ow = owners.get(p.id);
    if (ow && ow !== me.uid) return { res: { ok: false, error: 'Publicación duplicada' } }; // nadie puede apropiarse de un id
    if (products.has(p.id)) return { res: { ok: true, id: p.id }, dup: true };               // reenvío idempotente
  }
  if (me.admin !== true && activeCount(me.uid) >= pubLimit()) {
    return { res: fail('PUB_LIMIT', 'Llegaste al límite de ' + pubLimit() + ' publicaciones activas. Cuando vendas o elimines alguna podrás publicar otra.') };
  }
  if (storageFull()) {
    if (Date.now() - storage.warnAt > 60000) { storage.warnAt = Date.now(); console.warn('[server] publicación rechazada (STORAGE_FULL): ' + storage.mb + ' MB de ' + storageLimit() + ' MB'); }
    return { res: fail('STORAGE_FULL', 'U2U llegó a su límite de espacio y por ahora no acepta publicaciones nuevas. Inténtalo más tarde.') };
  }
  if (!p.id) p.id = lastId = Math.max(Date.now(), lastId + 1);
  owners.set(p.id, me.uid);
  products.set(p.id, p);
  try { await db.products.put(p, { sync: true }); }
  catch (e) {
    products.delete(p.id); owners.delete(p.id);
    console.error('[server] no se pudo guardar la publicación:', e.message);
    return { res: { ok: false, error: 'No se pudo guardar tu publicación. Inténtalo de nuevo.' } };
  }
  refreshStorage(); // medición actualizada (máx. cada 15 s) para el próximo tope
  return { res: { ok: true, id: p.id }, p };
}

// Cambia el estado, avisa a todos y espera a que quede guardado. Resuelve true/false (nunca lanza).
function setStatus(p, status) {
  if (p.status === status) return Promise.resolve(true);
  p.status = status;
  io.emit('product-status', { id: p.id, status }); // todos ven el cambio al instante
  return db.products.put(p, { sync: true }).then(() => true, (e) => { console.error('[server] no se pudo guardar el estado de una publicación:', e.message); return false; });
}

/* ---------- Pedidos con código de entrega ---------- */
function newPin() {
  const used = new Set([...orders.values()].filter((o) => o.status === 'pending').map((o) => o.pin));
  let pin;
  do { pin = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); } while (used.has(pin));
  return pin;
}
function newOrderId() {
  let id;
  do { id = 'U2U-' + String(crypto.randomInt(0, 1000000)).padStart(6, '0'); } while (orders.has(id));
  return id;
}
// El PIN solo lo ve el comprador y mientras el pedido está pendiente. Nunca llega al dueño.
function view(o, uid) {
  const v = { ...o };
  delete v.pin; delete v.fails; delete v.lockedUntil;
  if (uid === o.buyerId && o.status === 'pending') v.pin = o.pin;
  v.locked = !!(o.lockedUntil && o.lockedUntil > Date.now());
  v.reviewed = community.reviewed(o.id); // ya tiene reseña (una por pedido)
  return v;
}
// la foto del pedido es copia de la de la publicación: no se duplica en la base (se vuelve a enlazar al cargar)
// con sync=true espera a que quede guardado y resuelve true/false (nunca lanza)
function saveOrder(o, sync) {
  const row = /^data:/.test(o.ph) ? { ...o, ph: '' } : o;
  if (!sync) { db.orders.put(row); return Promise.resolve(true); }
  return db.orders.put(row, { sync: true }).then(() => true, (e) => { console.error('[server] no se pudo guardar un pedido:', e.message); return false; });
}
function pushOrder(o, saved) {
  if (!saved) saveOrder(o); // todo cambio de un pedido pasa por aquí: queda guardado (cola). Con saved=true ya se guardó con sync
  io.to('u:' + o.buyerId).emit('order', view(o, o.buyerId));
  io.to('u:' + o.ownerId).emit('order', view(o, o.ownerId));
}

/* ---------- Moderación: eliminar publicaciones y cancelar pedidos pendientes ---------- */
// Resuelve cuando todos los cambios quedaron guardados
function cancelPending(match) {
  const jobs = [];
  for (const o of orders.values()) {
    if (o.status !== 'pending' || !match(o)) continue;
    o.status = 'cancelled'; o.doneAt = Date.now(); o.cancelledBy = 'admin';
    const p = products.get(o.pid);
    if (p && o.mode === 'compra' && p.status === 'reserved') jobs.push(setStatus(p, 'available'));
    jobs.push(saveOrder(o, true).then((ok) => { pushOrder(o, true); return ok; }));
  }
  return Promise.all(jobs);
}
// Eliminación por moderación: sale del catálogo pero la fila NO se borra de la base (se marca con deleted_at)
async function removeProduct(pid) {
  await cancelPending((o) => o.pid === pid);
  const p = products.get(pid);
  if (!p) return false;
  products.delete(pid);
  io.emit('product-removed', { id: pid }); // desaparece al instante para todos
  try { await db.products.put({ ...p, deleted_at: Date.now() }, { sync: true }); }
  catch (e) { console.error('[server] no se pudo guardar la eliminación de una publicación:', e.message); }
  return true;
}
let community; // se crea en boot(), cuando la base de datos ya cargó

io.on('connection', (socket) => {
  socket.data = {};
  community.attach(socket); // reportes, panel admin y reseñas
  io.emit('presence', presence()); // avisa a todos que alguien abrió el enlace

  /* Entrada: la identidad (uid + secreto) la emitió el servidor al registrarse o iniciar sesión. */
  socket.on('join', (d) => {
    d = d || {};
    const uid = String(d.uid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
    const secret = String(d.secret || '').slice(0, 64);
    const chk = accounts.check(uid, secret); // solo cuentas registradas, con el secreto que emitió el servidor
    if (!chk) return socket.emit('denied');
    if (chk.blocked) return socket.emit('blocked'); // cuenta bloqueada por moderación
    const acc = chk.u;
    const name = acc.name; // el nombre sale de la cuenta, no del cliente

    if (socket.data.uid) socket.leave('u:' + socket.data.uid);
    // los contadores de límites son del USUARIO (no del socket): volver a entrar no los reinicia
    socket.data = Object.assign(quotaOf(uid), { uid, name, admin: acc.admin === true }); // admin sale de la cuenta (servidor), nunca del cliente
    socket.leave('admin');
    socket.join('u:' + uid);
    if (socket.data.admin) socket.join('admin');
    socket.emit('official', OFFICIAL); // nombre público de la cuenta oficial (nunca su usuario de login)

    // Todo lo privado: solo MIS conversaciones y MIS pedidos (como comprador o como dueño)
    socket.emit('history', [...convs.values()].filter((c) => c.buyerId === uid || ownerOfConv(c) === uid));
    socket.emit('orders', [...orders.values()].filter((o) => o.buyerId === uid || o.ownerId === uid).map((o) => view(o, uid)));
    community.onJoin(socket); // publicaciones eliminadas, mis reportes, promedios y (si es admin) el panel
    socket.emit('products', [...products.values()]); // catálogo compartido (público)
    io.emit('presence', presence());
  });

  /* Nueva publicación -> se guarda (y solo entonces se confirma) y se reenvía a todos los demás conectados */
  socket.on('new-product', async (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket);
    if (g.err) return reply(g.err);
    const me = g.me;

    const now = Date.now();
    me.pubs = (me.pubs || []).filter((t) => now - t < 60000);
    if (me.pubs.length >= 5) return reply({ ok: false, error: 'Demasiadas publicaciones seguidas, espera un minuto' });
    me.pubs.push(now);

    const r = await publish(me, d);
    if (!r.p) { const i = me.pubs.lastIndexOf(now); if (i >= 0) me.pubs.splice(i, 1); } // rechazada o repetida: no gasta cupo por minuto
    if (r.p) socket.broadcast.emit('new-product', r.p); // a todos los demás
    reply(r.res);
  });

  /* Chat privado: solo entre el interesado y el dueño del producto */
  socket.on('send', (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket);
    if (g.err) return reply(g.err);
    const me = g.me;
    if (me.verified === false) return reply(notVerified());
    d = d || {};

    const text = String(d.text || '').trim().slice(0, 500);
    if (!text) return reply({ error: 'Mensaje vacío' });

    const now = Date.now();
    me.hits = (me.hits || []).filter((t) => now - t < 10000);
    if (me.hits.length >= 15) return reply({ error: 'Vas muy rápido, espera un momento' });
    me.hits.push(now);

    const pid = parseInt(d.pid, 10) || 0; // pid 0 = chat directo con la cuenta oficial (bienvenida y ayuda)
    const owner = pid === 0 ? OFFICIAL && OFFICIAL.uid : ownerOf(pid);
    if (!owner) return reply({ error: pid === 0 ? 'La cuenta oficial no está disponible ahora' : 'Esta publicación ya no está disponible' });
    if (pid && community.isRemoved(pid)) return reply({ error: 'Esta publicación fue eliminada' });

    let buyerId, from;
    if (owner === me.uid) {
      buyerId = String(d.buyerId || '');
      if (!convs.has(pid + '|' + buyerId)) return reply({ error: 'Conversación no encontrada' });
      from = 'seller';
    } else {
      buyerId = me.uid;
      from = 'buyer';
    }
    const key = pid + '|' + buyerId;

    let c = convs.get(key);
    if (!c) {
      c = { key, pid, buyerId, buyerName: me.name, msgs: [] }; // las conversaciones nunca se descartan por tope
      convs.set(key, c);
    }
    if (from === 'buyer') c.buyerName = me.name;

    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      uid: me.uid, from, name: me.name, text, ts: Date.now(),
    };
    c.msgs.push(msg); // los mensajes tampoco se descartan por tope (el bloque 7a los pasa a su propia tabla)
    c.ts = msg.ts; db.convs.put(c); // el chat queda guardado

    io.to('u:' + buyerId).to('u:' + owner).emit('msg', {
      conv: { key, pid, buyerId, buyerName: c.buyerName },
      msg,
    });
    reply({ ok: true });
  });

  /* Crear pedido: se reserva el producto y se genera el código de entrega (solo para el comprador).
     La reserva se decide en la parte síncrona; solo se confirma cuando pedido y reserva quedaron guardados. */
  socket.on('order:create', async (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket);
    if (g.err) return reply(g.err);
    const me = g.me;
    d = d || {};

    if (me.verified === false) return reply(notVerified());
    if (me.admin) return reply({ error: 'La cuenta oficial vende y modera: no compra ni alquila' });
    const now = Date.now();
    me.ords = (me.ords || []).filter((t) => now - t < 60000);
    if (me.ords.length >= 5) return reply({ error: 'Demasiados pedidos seguidos, espera un minuto' });

    const pid = parseInt(d.pid, 10);
    const p = products.get(pid);
    const ownerId = ownerOf(pid);
    if (!p || !ownerId) return reply({ error: 'Producto de ejemplo: compra publicaciones de otros estudiantes' });
    if (ownerId === me.uid) return reply({ error: 'No puedes comprar tu propia publicación' });
    if (p.status === 'sold') return reply({ error: 'Este producto ya fue vendido' });

    const mode = d.mode === 'alquiler' ? 'alquiler' : 'compra';
    if (mode === 'compra' && p.mode === 'alquiler') return reply({ error: 'Este producto solo se alquila' });
    if (mode === 'alquiler' && p.mode === 'venta') return reply({ error: 'Este producto solo se vende' });
    if (mode === 'compra' && p.status === 'reserved') return reply({ error: 'Otro estudiante ya inició la compra de este producto' });

    const dup = [...orders.values()].find((o) => o.pid === pid && o.buyerId === me.uid && o.mode === mode && o.status === 'pending');
    if (dup) return reply({ error: 'Ya tienes un pedido pendiente por este producto' });

    // El monto lo calcula el servidor (no se confía en el cliente)
    const del = d.del === 'home' ? 'home' : 'meet';
    let days = 1, from = '', to = '', base = p.price;
    if (mode === 'alquiler') {
      const a = new Date(d.from), b = new Date(d.to);
      days = Math.min(60, Math.max(1, Math.round((b - a) / 864e5) + 1 || 1));
      from = String(d.from || '').slice(0, 10); to = String(d.to || '').slice(0, 10);
      base = p.rent * days;
    }
    const total = base + 10 + (del === 'home' ? 15 : 0);

    const o = {
      id: newOrderId(), pid, t: p.t, ph: p.ph[0] || '', mode, total, days, del, from, to,
      cp: Math.min(3, Math.max(0, parseInt(d.cp, 10) || 0)),
      status: 'pending', buyerId: me.uid, buyerName: me.name, ownerId, ownerName: p.ownerName,
      ts: now, doneAt: 0, pin: newPin(), fails: 0, lockedUntil: 0,
    };
    orders.set(o.id, o); // sin await entre las comprobaciones y este registro: nadie más puede reservar lo mismo
    me.ords.push(now);
    const reserve = mode === 'compra';

    const saved = await Promise.all([saveOrder(o, true), reserve ? setStatus(p, 'reserved') : true]);
    if (!saved.every(Boolean)) { // no quedó guardado: se deshace y NO se confirma
      orders.delete(o.id);
      o.status = 'cancelled'; o.doneAt = Date.now(); o.cancelledBy = 'system'; saveOrder(o); // si llegó a escribirse, queda cancelado
      if (reserve) await setStatus(p, 'available');
      return reply({ ok: false, error: 'No se pudo guardar tu pedido. Inténtalo de nuevo.' });
    }
    pushOrder(o, true);
    reply({ ok: true, order: view(o, me.uid) });
  });

  /* Confirmar entrega: SOLO el dueño, ingresando el código que le muestra el comprador */
  socket.on('order:confirm', async (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket);
    if (g.err) return reply(g.err);
    const me = g.me;
    d = d || {};
    const o = orders.get(String(d.id || ''));
    if (!o || o.ownerId !== me.uid) return reply({ error: 'Pedido no encontrado' });
    if (o.status !== 'pending') return reply({ error: 'Este pedido ya no está pendiente' });

    const now = Date.now();
    if (o.lockedUntil > now) {
      return reply({ error: 'Demasiados intentos. Espera ' + Math.ceil((o.lockedUntil - now) / 60000) + ' min e inténtalo de nuevo' });
    }
    const pin = String(d.pin || '').replace(/\D/g, '').slice(0, 6);
    if (pin.length !== 6) return reply({ error: 'El código tiene 6 dígitos' });

    const a = Buffer.from(pin), b = Buffer.from(o.pin);
    if (!crypto.timingSafeEqual(a, b)) {
      o.fails++;
      if (o.fails >= MAX_PIN_FAILS) {
        o.fails = 0; o.lockedUntil = now + LOCK_MS;
        await saveOrder(o, true); // el bloqueo y los intentos fallidos sobreviven a un reinicio
        pushOrder(o, true);
        return reply({ error: 'Código incorrecto. Pedido bloqueado 5 minutos por seguridad' });
      }
      await saveOrder(o, true);
      return reply({ error: 'Código incorrecto (' + (MAX_PIN_FAILS - o.fails) + ' intentos restantes)' });
    }

    o.status = 'completed'; o.doneAt = now; o.fails = 0;
    const p = products.get(o.pid);
    const sell = !!(p && o.mode === 'compra');
    const saved = await Promise.all([saveOrder(o, true), sell ? setStatus(p, 'sold') : true]);
    if (!saved.every(Boolean)) { // no quedó guardado: el pedido sigue pendiente y se puede reintentar
      o.status = 'pending'; o.doneAt = 0; saveOrder(o);
      if (sell) await setStatus(p, 'reserved');
      return reply({ ok: false, error: 'No se pudo guardar la entrega. Inténtalo de nuevo.' });
    }
    pushOrder(o, true);
    reply({ ok: true });
  });

  /* Cancelar un pedido pendiente (comprador o dueño): libera la reserva */
  socket.on('order:cancel', async (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket);
    if (g.err) return reply(g.err);
    const me = g.me;
    const o = orders.get(String((d || {}).id || ''));
    if (!o || (o.buyerId !== me.uid && o.ownerId !== me.uid)) return reply({ error: 'Pedido no encontrado' });
    if (o.status !== 'pending') return reply({ error: 'Este pedido ya no está pendiente' });
    o.status = 'cancelled'; o.doneAt = Date.now(); o.cancelledBy = me.uid;
    const p = products.get(o.pid);
    const free = !!(p && o.mode === 'compra');
    const saved = await Promise.all([saveOrder(o, true), free ? setStatus(p, 'available') : true]);
    if (!saved.every(Boolean)) {
      o.status = 'pending'; o.doneAt = 0; delete o.cancelledBy; saveOrder(o);
      if (free) await setStatus(p, 'reserved');
      return reply({ ok: false, error: 'No se pudo guardar la cancelación. Inténtalo de nuevo.' });
    }
    pushOrder(o, true);
    reply({ ok: true });
  });

  socket.on('leave', () => {
    if (socket.data.uid) socket.leave('u:' + socket.data.uid);
    socket.leave('admin');
    socket.data = {};
    io.emit('presence', presence());
  });

  socket.on('disconnect', () => io.emit('presence', presence()));
});

/* ---------- Cuenta oficial: catálogo inicial (seed.json) y bienvenida ---------- */
function seedCatalog() {
  if (!OFFICIAL) return console.log('[seed] sin cuenta admin (ADMIN_USER/ADMIN_PASS): no se crea el catálogo oficial');
  let list;
  try { list = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8')); } catch (e) { return console.error('[seed] no se pudo leer seed.json:', e.message); }
  const me = { uid: OFFICIAL.uid, name: OFFICIAL.name, admin: true };
  let made = 0, had = 0, gone = 0;
  list.forEach((d, i) => {
    const id = parseInt(d.id, 10);
    if (!(id > 0 && id <= 1000)) return console.error('[seed] id inválido: ' + d.id);
    if (community.isRemoved(id)) { gone++; return; } // lo eliminaste desde el panel: no se vuelve a crear
    if (products.has(id)) { had++; return; }          // ya existe: no se duplica
    const r = cleanProduct(d, me);
    if (r.error) return console.error('[seed] producto ' + id + ' omitido: ' + r.error);
    const p = r.p; p.id = id; p.ts = Date.now() + i; p.official = true;
    products.set(id, p); owners.set(id, OFFICIAL.uid); db.products.put(p); made++;
  });
  console.log('[seed] catálogo oficial: ' + made + ' creados · ' + had + ' ya existían · ' + gone + ' eliminados desde el panel (no se recrean)');
}
// Al VERIFICAR su correo (auth.js → onRegister), la cuenta oficial le escribe un mensaje de bienvenida (chat directo, pid 0)
function sendWelcome(u) {
  if (!OFFICIAL || u.admin) return;
  const key = '0|' + u.uid;
  if (convs.has(key)) return;
  const first = String(u.name).split(' ')[0].slice(0, 16);
  const text = '¡Hola ' + first + '! 👋 Soy ' + OFFICIAL.name + '. Bienvenido a U2U. Tip para tu primera publicación: toca + Publicar, sube fotos nítidas con buena luz (hasta 3), pon un título claro con marca y modelo y un precio justo. Entrega siempre en un punto seguro del campus. Si tienes dudas, escríbeme por aquí.';
  const msg = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), uid: OFFICIAL.uid, from: 'seller', name: OFFICIAL.name, text, ts: Date.now() };
  const c = { key, pid: 0, buyerId: u.uid, buyerName: u.name, msgs: [msg], ts: msg.ts, welcome: true };
  convs.set(key, c);
  db.convs.put(c);
}

const PORT = process.env.PORT || 3000;

/* Arranque: primero la base de datos (o los archivos), luego cuentas, comunidad y el servidor */
async function boot(opt) {
  opt = opt || {};
  await db.init();
  const rows = db.rows('products');
  rows.forEach((p) => { lastId = Math.max(lastId, p.id); }); // los ids de eliminadas también cuentan: nunca se reutilizan
  rows.filter((p) => !p.deleted_at).sort((a, b) => a.ts - b.ts).forEach((p) => { products.set(p.id, p); owners.set(p.id, p.ownerUid); });
  db.rows('orders').sort((a, b) => a.ts - b.ts).forEach((o) => { const p = products.get(o.pid); if (!o.ph && p && p.ph[0]) o.ph = p.ph[0]; orders.set(o.id, o); });
  accounts.mount(app); // /api/register, /api/login, /api/me, /api/logout
  community = require('./community')({ io, accounts, products, orders, removeProduct, cancelPending, pushOrder, guard });
  OFFICIAL = accounts.official();
  db.rows('convs').sort((a, b) => (a.ts || 0) - (b.ts || 0)).forEach((c) => convs.set(c.key, c)); // chats guardados
  if (OFFICIAL) for (const p of products.values()) if (p.ownerUid === OFFICIAL.uid) { p.official = true; p.ownerName = OFFICIAL.name; }
  seedCatalog();                       // crea solo lo que falta (sin duplicar ni recrear lo eliminado)
  accounts.onRegister(sendWelcome);    // bienvenida automática a cada cuenta al verificar su correo
  await refreshStorage(true);          // mide el espacio al arrancar y cada 10 min (solo con PostgreSQL)
  setInterval(() => refreshStorage(true), 10 * 60e3).unref();
  if (opt.listen !== false) server.listen(PORT, () => console.log('U2U en vivo escuchando en el puerto ' + PORT));
}

if (require.main === module) {
  ['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => { db.flush().then(() => process.exit(0), () => process.exit(1)); })); // guarda lo pendiente al apagar
  boot().catch((e) => { console.error('[boot] no se pudo iniciar:', e.message); process.exit(1); });
}

/* Para las pruebas (tests/bloque03.test.js): no las usa la app */
module.exports = {
  boot,
  _test: {
    publish, products, orders, convs, db, io, server,
    setStorageMb: (mb) => { storage.mb = mb; storage.at = Date.now(); },
    close: async () => { io.close(); await db.flush(); },
  },
};
