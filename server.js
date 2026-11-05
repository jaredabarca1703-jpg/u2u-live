/* U2U · servidor de tiempo real (Express + Socket.io)
 * - Sirve la app desde /public
 * - Sin registro: cada dispositivo entra con nombre + rol (buyer | seller)
 * - Chat: un comprador escribe sobre un producto; los vendedores conectados (y el dueño
 *   de la publicación) lo reciben al instante y cualquiera puede responder.
 * - Publicaciones: lo que alguien publica con "+" se guarda en el servidor, se reenvía a
 *   todos los demás en vivo y se entrega a quien entre después.
 * - Todo vive en memoria (se borra al reiniciar el servidor): ideal para demo.
 */
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6 }); // 1 MB por mensaje (fotos incluidas)

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.send('ok'));

const MAX_CONVS = 500;  // conversaciones guardadas en memoria
const MAX_MSGS = 200;   // mensajes por conversación
const MAX_PRODUCTS = 50; // publicaciones guardadas (las más antiguas se descartan)
const MAX_PHOTOS = 3, MAX_PHOTO = 250000, MAX_TOTAL = 450000; // tamaños de fotos (caracteres base64)
const CATS = ['Cámaras', 'Laptops', 'Calculadoras', 'Herramientas', 'Libros', 'Audio', 'Ropa'];
const MODES = ['venta', 'alquiler', 'ambos'];
const CONDS = ['Nuevo', 'Como nuevo', 'Usado'];

const convs = new Map();    // key "pid|buyerId" -> { key, pid, buyerId, buyerName, msgs: [] }
const products = new Map(); // id -> publicación
let lastId = Date.now();

const presence = () => {
  const s = io.sockets.adapter.rooms.get('sellers');
  return { sellers: s ? s.size : 0, total: io.engine.clientsCount };
};
const num = (v, max) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
const ownerOf = (pid) => (products.get(pid) || {}).ownerUid;

/* Valida y limpia una publicación recibida (nunca confiamos en el cliente) */
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
  return {
    p: {
      id, t, ph, mode, price, rent, dep,
      cat: CATS.includes(d.cat) ? d.cat : 'Herramientas',
      cond: CONDS.includes(d.cond) ? d.cond : 'Usado',
      cp: Math.min(3, Math.max(0, parseInt(d.cp, 10) || 0)),
      desc: String(d.desc || '').trim().slice(0, 500) || 'Sin descripción',
      ownerUid: me.uid, ownerName: me.name, ts: Date.now(),
    },
  };
}

io.on('connection', (socket) => {
  socket.data = {};
  io.emit('presence', presence()); // avisa a todos que alguien abrió el enlace

  // Entrada sin fricción: solo nombre + rol
  socket.on('join', (d) => {
    d = d || {};
    const uid = String(d.uid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'u_' + String(socket.id).slice(0, 8);
    const name = String(d.name || '').trim().slice(0, 24) || 'Anónimo';
    const role = d.role === 'seller' ? 'seller' : 'buyer';

    if (socket.data.uid) socket.leave('u:' + socket.data.uid);
    socket.leave('sellers');

    socket.data = { uid, name, role, hits: [], pubs: [] };
    socket.join('u:' + uid);
    if (role === 'seller') socket.join('sellers');

    // Historial: el vendedor ve todo; los demás, lo suyo y lo de sus publicaciones
    const list = [...convs.values()].filter((c) => role === 'seller' || c.buyerId === uid || ownerOf(c.pid) === uid);
    socket.emit('history', list);
    socket.emit('products', [...products.values()]); // catálogo compartido
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

    // Reenvío idempotente: si ya existe con ese id y es mío, no se duplica
    const ex = p.id && products.get(p.id);
    if (ex) return reply(ex.ownerUid === me.uid ? { ok: true, id: ex.id } : { error: 'Publicación duplicada' });

    if (!p.id) p.id = lastId = Math.max(Date.now(), lastId + 1);
    me.pubs.push(now);
    products.set(p.id, p);
    if (products.size > MAX_PRODUCTS) products.delete(products.keys().next().value);

    socket.broadcast.emit('new-product', p); // a todos los demás
    reply({ ok: true, id: p.id });
  });

  socket.on('send', (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const me = socket.data;
    if (!me || !me.uid) return reply({ error: 'Primero entra con tu nombre' });
    d = d || {};

    const text = String(d.text || '').trim().slice(0, 500);
    if (!text) return reply({ error: 'Mensaje vacío' });

    // anti-spam básico: 15 mensajes cada 10 s
    const now = Date.now();
    me.hits = (me.hits || []).filter((t) => now - t < 10000);
    if (me.hits.length >= 15) return reply({ error: 'Vas muy rápido, espera un momento' });
    me.hits.push(now);

    const pid = parseInt(d.pid, 10);
    if (!pid) return reply({ error: 'Producto inválido' });

    // Responde como vendedor: un vendedor, o el dueño de la publicación. Si no, es un comprador.
    const isOwner = ownerOf(pid) === me.uid;
    let buyerId, from;
    if (d.buyerId && String(d.buyerId) !== me.uid) {
      if (me.role !== 'seller' && !isOwner) return reply({ error: 'No puedes responder esta conversación' });
      buyerId = String(d.buyerId);
      from = 'seller';
    } else {
      if (isOwner) return reply({ error: 'Esta es tu propia publicación' });
      buyerId = me.uid;
      from = 'buyer';
    }
    const key = pid + '|' + buyerId;

    let c = convs.get(key);
    if (!c) {
      if (from !== 'buyer') return reply({ error: 'Conversación no encontrada' });
      if (convs.size >= MAX_CONVS) convs.delete(convs.keys().next().value);
      c = { key, pid, buyerId, buyerName: me.name, msgs: [] };
      convs.set(key, c);
    }
    if (from === 'buyer') c.buyerName = me.name;

    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      uid: me.uid,
      from,
      name: me.name,
      text,
      ts: Date.now(),
    };
    c.msgs.push(msg);
    if (c.msgs.length > MAX_MSGS) c.msgs.shift();

    // Llega al comprador, a todos los vendedores conectados y al dueño de la publicación
    let to = io.to('u:' + buyerId).to('sellers');
    const owner = ownerOf(pid);
    if (owner) to = to.to('u:' + owner);
    to.emit('msg', { conv: { key, pid, buyerId, buyerName: c.buyerName }, msg });
    reply({ ok: true });
  });

  // Cerrar sesión: deja de recibir mensajes y de contar como vendedor en línea
  socket.on('leave', () => {
    if (socket.data.uid) socket.leave('u:' + socket.data.uid);
    socket.leave('sellers');
    socket.data = {};
    io.emit('presence', presence());
  });

  socket.on('disconnect', () => io.emit('presence', presence()));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('U2U en vivo escuchando en el puerto ' + PORT));
