/* U2U · servidor de tiempo real (Express + Socket.io)
 * - Sirve la app desde /public
 * - Sin registro: cada dispositivo entra con nombre + rol (buyer | seller)
 * - Un comprador escribe sobre un producto; TODOS los vendedores conectados lo reciben
 *   y cualquiera puede responder. El comprador ve la respuesta al instante.
 * - Todo vive en memoria (se borra al reiniciar el servidor): ideal para demo.
 */
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e5 });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.send('ok'));

const MAX_CONVS = 500; // conversaciones guardadas en memoria
const MAX_MSGS = 200;  // mensajes por conversación
const convs = new Map(); // key "pid|buyerId" -> { key, pid, buyerId, buyerName, msgs: [] }

const presence = () => {
  const s = io.sockets.adapter.rooms.get('sellers');
  return { sellers: s ? s.size : 0, total: io.engine.clientsCount };
};

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

    socket.data = { uid, name, role, hits: [] };
    socket.join('u:' + uid);
    if (role === 'seller') socket.join('sellers');

    // Historial: el vendedor ve todo; el comprador solo lo suyo
    const list = [...convs.values()].filter((c) => role === 'seller' || c.buyerId === uid);
    socket.emit('history', list);
    io.emit('presence', presence());
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

    const buyerId = me.role === 'buyer' ? me.uid : String(d.buyerId || '');
    if (!buyerId) return reply({ error: 'Falta el comprador' });
    const key = pid + '|' + buyerId;

    let c = convs.get(key);
    if (!c) {
      if (me.role !== 'buyer') return reply({ error: 'Conversación no encontrada' });
      if (convs.size >= MAX_CONVS) convs.delete(convs.keys().next().value);
      c = { key, pid, buyerId, buyerName: me.name, msgs: [] };
      convs.set(key, c);
    }
    if (me.role === 'buyer') c.buyerName = me.name;

    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      uid: me.uid,
      from: me.role,
      name: me.name,
      text,
      ts: Date.now(),
    };
    c.msgs.push(msg);
    if (c.msgs.length > MAX_MSGS) c.msgs.shift();

    // Llega al comprador (todos sus dispositivos) y a todos los vendedores conectados
    io.to('u:' + buyerId).to('sellers').emit('msg', {
      conv: { key, pid, buyerId, buyerName: c.buyerName },
      msg,
    });
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
