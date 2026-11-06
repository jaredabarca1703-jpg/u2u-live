/* U2U · servidor de tiempo real (Express + Socket.io)
 * - Sirve la app desde /public
 * - Sin registro ni roles: cada dispositivo entra con un nombre y una identidad propia
 *   (uid público + secreto privado) para que nadie pueda suplantar a otro.
 * - Cualquier usuario puede publicar, comprar, alquilar y chatear.
 * - Publicaciones: se guardan, se reenvían en vivo a todos y se entregan a quien entre después.
 * - Chat PRIVADO por producto: solo lo ven el interesado y el dueño de ese producto.
 * - Pedidos con CÓDIGO DE ENTREGA (estilo PedidosYa): al comprar se genera un PIN de 6 dígitos
 *   que solo ve el comprador. El dueño lo ingresa al entregar el producto y recién ahí se
 *   confirma la transacción.
 * - Todo vive en memoria (se borra al reiniciar el servidor): ideal para demo.
 */
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6 }); // 1 MB por mensaje (fotos incluidas)

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.send('ok'));

const MAX_CONVS = 500, MAX_MSGS = 200, MAX_PRODUCTS = 50, MAX_ORDERS = 1000;
const MAX_PHOTOS = 3, MAX_PHOTO = 250000, MAX_TOTAL = 450000; // tamaños de fotos (caracteres base64)
const MAX_PIN_FAILS = 5, LOCK_MS = 5 * 60 * 1000;             // 5 intentos y bloqueo de 5 minutos
const CATS = ['Cámaras', 'Laptops', 'Calculadoras', 'Herramientas', 'Libros', 'Audio', 'Ropa'];
const MODES = ['venta', 'alquiler', 'ambos'];
const CONDS = ['Nuevo', 'Semi nuevo', 'Usado'];
const CAREERS = ['Ing. Civil', 'Arquitectura', 'Sistemas', 'Negocios', 'Comunicaciones', 'Diseño de Moda', 'Salud'];

const convs = new Map();    // "pid|buyerId" -> { key, pid, buyerId, buyerName, msgs: [] }
const products = new Map(); // id -> publicación (catálogo compartido)
const owners = new Map();   // pid -> uid del dueño
const orders = new Map();   // id -> pedido
const auth = new Map();     // uid -> secreto
let lastId = Date.now();

const ownerOf = (pid) => owners.get(pid);
const presence = () => {
  const r = io.sockets.adapter.rooms;
  return {
    total: io.engine.clientsCount,
    uids: [...r.keys()].filter((k) => k.startsWith('u:')).map((k) => k.slice(2)), // quién está en línea
  };
};
const num = (v, max) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));

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
    },
  };
}

function setStatus(p, status) {
  if (p.status === status) return;
  p.status = status;
  io.emit('product-status', { id: p.id, status }); // todos ven el cambio al instante
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
  return v;
}
function pushOrder(o) {
  io.to('u:' + o.buyerId).emit('order', view(o, o.buyerId));
  io.to('u:' + o.ownerId).emit('order', view(o, o.ownerId));
}

io.on('connection', (socket) => {
  socket.data = {};
  io.emit('presence', presence()); // avisa a todos que alguien abrió el enlace

  /* Entrada sin fricción: solo nombre. La identidad (uid + secreto) la genera el dispositivo. */
  socket.on('join', (d) => {
    d = d || {};
    const uid = String(d.uid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
    const secret = String(d.secret || '').slice(0, 64);
    if (uid.length < 6 || secret.length < 16) return socket.emit('denied');
    const known = auth.get(uid);
    if (known && known !== secret) return socket.emit('denied'); // intento de suplantación
    if (!known) {
      auth.set(uid, secret);
      if (auth.size > 5000) auth.delete(auth.keys().next().value);
    }
    const name = String(d.name || '').trim().slice(0, 24) || 'Anónimo';

    if (socket.data.uid) socket.leave('u:' + socket.data.uid);
    socket.data = { uid, name, hits: [], pubs: [], ords: [] };
    socket.join('u:' + uid);

    // Todo lo privado: solo MIS conversaciones y MIS pedidos (como comprador o como dueño)
    socket.emit('history', [...convs.values()].filter((c) => c.buyerId === uid || ownerOf(c.pid) === uid));
    socket.emit('orders', [...orders.values()].filter((o) => o.buyerId === uid || o.ownerId === uid).map((o) => view(o, uid)));
    socket.emit('products', [...products.values()]); // catálogo compartido (público)
    io.emit('presence', presence());
  });

  /* Nueva publicación -> se guarda y se reenvía a todos los demás conectados */
  socket.on('new-product', (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const me = socket.data;
    if (!me || !me.uid) return reply({ error: 'Primero entra con tu nombre' });

    const now = Date.now();
    me.pubs = (me.pubs || []).filter((t) => now - t < 60000);
    if (me.pubs.length >= 5) return reply({ error: 'Demasiadas publicaciones seguidas, espera un minuto' });

    const r = cleanProduct(d, me);
    if (r.error) return reply({ error: r.error });
    const p = r.p;

    if (p.id) {
      const ow = owners.get(p.id);
      if (ow && ow !== me.uid) return reply({ error: 'Publicación duplicada' }); // nadie puede apropiarse de un id
      if (products.has(p.id)) return reply({ ok: true, id: p.id });               // reenvío idempotente
    } else {
      p.id = lastId = Math.max(Date.now(), lastId + 1);
    }
    me.pubs.push(now);
    owners.set(p.id, me.uid);
    products.set(p.id, p);
    if (products.size > MAX_PRODUCTS) products.delete(products.keys().next().value);

    socket.broadcast.emit('new-product', p); // a todos los demás
    reply({ ok: true, id: p.id });
  });

  /* Chat privado: solo entre el interesado y el dueño del producto */
  socket.on('send', (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const me = socket.data;
    if (!me || !me.uid) return reply({ error: 'Primero entra con tu nombre' });
    d = d || {};

    const text = String(d.text || '').trim().slice(0, 500);
    if (!text) return reply({ error: 'Mensaje vacío' });

    const now = Date.now();
    me.hits = (me.hits || []).filter((t) => now - t < 10000);
    if (me.hits.length >= 15) return reply({ error: 'Vas muy rápido, espera un momento' });
    me.hits.push(now);

    const pid = parseInt(d.pid, 10);
    const owner = ownerOf(pid);
    if (!pid || !owner) return reply({ error: 'Producto de ejemplo: chatea con publicaciones de otros estudiantes' });

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
      if (convs.size >= MAX_CONVS) convs.delete(convs.keys().next().value);
      c = { key, pid, buyerId, buyerName: me.name, msgs: [] };
      convs.set(key, c);
    }
    if (from === 'buyer') c.buyerName = me.name;

    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      uid: me.uid, from, name: me.name, text, ts: Date.now(),
    };
    c.msgs.push(msg);
    if (c.msgs.length > MAX_MSGS) c.msgs.shift();

    io.to('u:' + buyerId).to('u:' + owner).emit('msg', {
      conv: { key, pid, buyerId, buyerName: c.buyerName },
      msg,
    });
    reply({ ok: true });
  });

  /* Crear pedido: se reserva el producto y se genera el código de entrega (solo para el comprador) */
  socket.on('order:create', (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const me = socket.data;
    if (!me || !me.uid) return reply({ error: 'Primero entra con tu nombre' });
    d = d || {};

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

    if (orders.size >= MAX_ORDERS) orders.delete(orders.keys().next().value);
    const o = {
      id: newOrderId(), pid, t: p.t, ph: p.ph[0] || '', mode, total, days, del, from, to,
      cp: Math.min(3, Math.max(0, parseInt(d.cp, 10) || 0)),
      status: 'pending', buyerId: me.uid, buyerName: me.name, ownerId, ownerName: p.ownerName,
      ts: now, doneAt: 0, pin: newPin(), fails: 0, lockedUntil: 0,
    };
    orders.set(o.id, o);
    me.ords.push(now);
    if (mode === 'compra') setStatus(p, 'reserved');

    pushOrder(o);
    reply({ ok: true, order: view(o, me.uid) });
  });

  /* Confirmar entrega: SOLO el dueño, ingresando el código que le muestra el comprador */
  socket.on('order:confirm', (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const me = socket.data;
    if (!me || !me.uid) return reply({ error: 'Primero entra con tu nombre' });
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
        pushOrder(o);
        return reply({ error: 'Código incorrecto. Pedido bloqueado 5 minutos por seguridad' });
      }
      return reply({ error: 'Código incorrecto (' + (MAX_PIN_FAILS - o.fails) + ' intentos restantes)' });
    }

    o.status = 'completed'; o.doneAt = now; o.fails = 0;
    const p = products.get(o.pid);
    if (p && o.mode === 'compra') setStatus(p, 'sold');
    pushOrder(o);
    reply({ ok: true });
  });

  /* Cancelar un pedido pendiente (comprador o dueño): libera la reserva */
  socket.on('order:cancel', (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const me = socket.data;
    if (!me || !me.uid) return reply({ error: 'Primero entra con tu nombre' });
    const o = orders.get(String((d || {}).id || ''));
    if (!o || (o.buyerId !== me.uid && o.ownerId !== me.uid)) return reply({ error: 'Pedido no encontrado' });
    if (o.status !== 'pending') return reply({ error: 'Este pedido ya no está pendiente' });
    o.status = 'cancelled'; o.doneAt = Date.now(); o.cancelledBy = me.uid;
    const p = products.get(o.pid);
    if (p && o.mode === 'compra') setStatus(p, 'available');
    pushOrder(o);
    reply({ ok: true });
  });

  socket.on('leave', () => {
    if (socket.data.uid) socket.leave('u:' + socket.data.uid);
    socket.data = {};
    io.emit('presence', presence());
  });

  socket.on('disconnect', () => io.emit('presence', presence()));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('U2U en vivo escuchando en el puerto ' + PORT));
