/* v8.7.0 · parche de prioridad alta (modo archivos: sin DATABASE_URL, DATA_DIR temporal; HTTP y Socket.io reales, sin dependencias nuevas)
 *  1) fotos fuera del catálogo (URL /foto/:pid/:n con caché)  2) vencimiento de pedidos pendientes  3) mensajes en su propia tabla */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function load() { // carga el servidor desde cero (como un reinicio)
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(ROOT) && !k.includes(path.sep + 'node_modules' + path.sep) && !k.includes(path.sep + 'tests' + path.sep)) delete require.cache[k];
  }
  return require(path.join(ROOT, 'server.js'));
}
async function start(env, dir) {
  dir = dir || fs.mkdtempSync(path.join(os.tmpdir(), 'u2u-p870-'));
  for (const k of ['DATABASE_URL', 'ADMIN_USER', 'ADMIN_PASS', 'PUB_LIMIT_USER', 'STORAGE_LIMIT_MB', 'ORDER_TTL_HOURS']) delete process.env[k];
  Object.assign(process.env, { DATA_DIR: dir }, env || {});
  const S = load(), codes = [];
  require(path.join(ROOT, 'auth.js')).setMailer(async (m) => { codes.push(m.code); });
  await S.boot({ listen: false });
  await new Promise((r) => S._test.server.listen(0, r));
  const base = 'http://127.0.0.1:' + S._test.server.address().port;
  const post = async (url, body, token) => {
    const r = await fetch(base + '/api' + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
    return { status: r.status, ...(await r.json()) };
  };
  // cuenta nueva ya verificada: { uid, secret }
  const account = async (n) => {
    const r = await post('/register', { name: 'Usuario ' + n, email: 'user' + n + '@upc.edu.pe', password: 'Clave-segura-9', cond: 'estudiante', career: 'Ing. Civil', cycle: 5, campus: 'Monterrico', terms: true });
    assert.equal(r.status, 201);
    const v = await post('/verify', { code: codes[codes.length - 1] }, r.token);
    assert.equal(v.verified, true);
    return { uid: r.user.uid, secret: r.user.secret };
  };
  return { S, dir, base, post, account, stop: () => S._test.close() };
}
function sio(base) { // cliente mínimo del protocolo de Socket.io (WebSocket global de Node 22)
  return new Promise((ok, no) => {
    const ws = new WebSocket(base.replace('http', 'ws') + '/socket.io/?EIO=4&transport=websocket'), acks = new Map();
    let n = 0;
    ws.onerror = () => no(new Error('ws'));
    ws.onmessage = (ev) => {
      const m = String(ev.data);
      if (m === '2') return ws.send('3');
      if (m[0] === '0') return ws.send('40');
      if (m.startsWith('40')) {
        return ok({
          send: (name, data) => ws.send('42' + JSON.stringify([name, data])),
          emit: (name, data) => new Promise((r) => { const id = ++n; acks.set(id, r); ws.send('42' + id + JSON.stringify([name, data])); }),
          close: () => ws.close(),
        });
      }
      const a = /^43(\d+)([\s\S]*)$/.exec(m);
      if (a && acks.has(+a[1])) { acks.get(+a[1])(JSON.parse(a[2])[0]); acks.delete(+a[1]); }
    };
  });
}
const rows = (dir, t) => JSON.parse(fs.readFileSync(path.join(dir, 'u2u-' + t + '.json'), 'utf8')).rows;
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
const item = (ph) => ({ t: 'Calculadora Casio', ph, mode: 'venta', price: 80, cat: 'Calculadoras', cond: 'Usado', desc: 'prueba' });
const owner = { uid: 'u_dueno', name: 'Dueño', admin: false };

/* ---------------- 1 · fotos fuera del catálogo ---------------- */

test('el catálogo no lleva base64: las fotos viajan como URL y se sirven con caché y 304', async () => {
  const t = await start();
  const big = 'data:image/jpeg;base64,' + JPG.toString('base64');
  const r = await t.S._test.publish(owner, item([big, 'cam']));
  assert.equal(r.res.ok, true);
  const id = r.res.id;

  const pub = t.S._test.pubProduct(t.S._test.products.get(id));
  assert.deepEqual(pub.ph, ['/foto/' + id + '/0', 'cam']); // base64 → URL; las claves internas quedan igual
  assert.ok(!JSON.stringify(pub).includes('data:image')); // nada de base64 en lo que va por Socket.io
  assert.ok(t.S._test.products.get(id).ph[0].startsWith('data:')); // la base de datos conserva la foto original

  const ok = await fetch(t.base + '/foto/' + id + '/0');
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'image/jpeg');
  assert.match(ok.headers.get('cache-control'), /max-age=\d+/);
  assert.deepEqual(Buffer.from(await ok.arrayBuffer()), JPG); // los bytes de la foto salen idénticos
  const again = await fetch(t.base + '/foto/' + id + '/0', { headers: { 'If-None-Match': ok.headers.get('etag') } });
  assert.equal(again.status, 304); // el navegador no vuelve a descargarla

  for (const u of ['/foto/' + id + '/1', '/foto/' + id + '/9', '/foto/' + id + '/-1', '/foto/999999/0', '/foto/abc/0']) {
    assert.equal((await fetch(t.base + u)).status, 404, u); // clave interna, índice fuera de rango o publicación inexistente
  }
  await t.stop();
});

test('la foto del pedido también viaja como URL (nunca base64)', async () => {
  const t = await start();
  const r = await t.S._test.publish(owner, item(['data:image/jpeg;base64,' + JPG.toString('base64')]));
  const o = { id: 'U2U-000001', pid: r.res.id, t: 'x', ph: t.S._test.products.get(r.res.id).ph[0], mode: 'compra', status: 'pending', buyerId: 'u_b', ownerId: 'u_dueno', ts: Date.now() };
  const v = t.S._test.view(o, 'u_b');
  assert.equal(v.ph, '/foto/' + r.res.id + '/0');
  assert.ok(typeof v.expiresAt === 'number' && v.expiresAt > Date.now());
  await t.stop();
});

/* ---------------- 2 · vencimiento de pedidos ---------------- */

test('un pedido pendiente vence a las 48 h, libera la reserva y deja constancia; uno reciente no se toca', async () => {
  const t = await start();
  const A = await t.S._test.publish(owner, item(['cam'])), B = await t.S._test.publish(owner, item(['cam']));
  const pa = t.S._test.products.get(A.res.id), pb = t.S._test.products.get(B.res.id);
  const now = Date.now(), H = 3600e3;
  const mk = (id, p, ts, extra) => { const o = { id, pid: p.id, t: p.t, ph: 'cam', mode: 'compra', total: 100, status: 'pending', buyerId: 'u_b', buyerName: 'B', ownerId: 'u_dueno', ownerName: 'D', ts, doneAt: 0, pin: '123456', fails: 0, lockedUntil: 0, ...extra }; t.S._test.orders.set(id, o); return o; };
  const viejo = mk('U2U-111111', pa, now - 49 * H), nuevo = mk('U2U-222222', pb, now - 47 * H);
  pa.status = 'reserved'; pb.status = 'reserved';

  await t.S._test.expireOrders(now);
  assert.equal(viejo.status, 'cancelled'); assert.equal(viejo.cancelledBy, 'timeout'); assert.ok(viejo.doneAt > 0);
  assert.equal(pa.status, 'available'); // se puede volver a reservar
  assert.equal(nuevo.status, 'pending'); assert.equal(pb.status, 'reserved'); // 47 h: sigue vigente
  assert.equal(rows(t.dir, 'orders').find((o) => o.id === 'U2U-111111').status, 'cancelled'); // quedó guardado en disco

  await t.S._test.expireOrders(now + 2 * H); // pasan 2 h más: ahora vence el segundo
  assert.equal(nuevo.status, 'cancelled'); assert.equal(pb.status, 'available');
  await t.stop();
});

test('un alquiler con fecha de inicio futura no vence antes de tiempo, y ORDER_TTL_HOURS se respeta', async () => {
  const t = await start({ ORDER_TTL_HOURS: '1' });
  const A = await t.S._test.publish(owner, item(['cam']));
  const p = t.S._test.products.get(A.res.id), now = Date.now(), H = 3600e3;
  const inicio = new Date(now + 10 * 24 * H).toISOString().slice(0, 10); // alquiler que empieza en 10 días
  const base = { pid: p.id, t: p.t, ph: 'cam', total: 50, status: 'pending', buyerId: 'u_b', ownerId: 'u_dueno', ts: now - 5 * H, doneAt: 0, pin: '654321', fails: 0, lockedUntil: 0 };
  const alq = { ...base, id: 'U2U-333333', mode: 'alquiler', from: inicio, to: inicio };
  const cmp = { ...base, id: 'U2U-444444', mode: 'compra', from: '', to: '' };
  t.S._test.orders.set(alq.id, alq); t.S._test.orders.set(cmp.id, cmp);
  await t.S._test.expireOrders(now);
  assert.equal(cmp.status, 'cancelled'); // TTL de 1 h: la compra de hace 5 h venció
  assert.equal(alq.status, 'pending');   // el alquiler empieza en 10 días: sigue vigente
  await t.stop();
});

/* ---------------- 3 · mensajes en su propia tabla ---------------- */

test('cada mensaje es una fila de messages, queda guardado antes de confirmar y sobrevive a un reinicio', async () => {
  let t = await start();
  const dir = t.dir;
  const A = await t.account(1), B = await t.account(2);
  const sa = await sio(t.base), sb = await sio(t.base);
  sa.send('join', A); sb.send('join', B);
  const pub = await sa.emit('new-product', item(['cam']));
  assert.equal(pub.ok, true);
  const key = pub.id + '|' + B.uid;

  const ack = await sb.emit('send', { pid: pub.id, text: 'Hola, ¿sigue disponible?' });
  assert.equal(ack.ok, true);
  const guardados = rows(dir, 'messages'); // ya está en disco cuando llega el ack
  assert.equal(guardados.length, 1);
  assert.equal(guardados[0].key, key); assert.equal(guardados[0].text, 'Hola, ¿sigue disponible?'); assert.equal(guardados[0].from, 'buyer');
  assert.equal(rows(dir, 'convs').find((c) => c.key === key).msgs, undefined); // la fila de la conversación ya no lleva mensajes

  const resp = await sa.emit('send', { pid: pub.id, buyerId: B.uid, text: 'Sí, está disponible' });
  assert.equal(resp.ok, true);
  assert.equal(rows(dir, 'messages').length, 2);
  sa.close(); sb.close();
  await t.stop();

  t = await start({}, dir); // reinicio con los mismos archivos
  const c = t.S._test.convs.get(key);
  assert.deepEqual(c.msgs.map((m) => m.text), ['Hola, ¿sigue disponible?', 'Sí, está disponible']);
  assert.ok(c.msgs.every((m) => m.key === undefined)); // al cliente le llega la misma forma de siempre
  await t.stop();
});

test('si el mensaje no se puede guardar: ack con error, no se entrega ni queda en memoria, y se puede reintentar', async () => {
  const t = await start();
  const A = await t.account(1), B = await t.account(2);
  const sa = await sio(t.base), sb = await sio(t.base);
  sa.send('join', A); sb.send('join', B);
  const pub = await sa.emit('new-product', item(['cam']));
  const key = pub.id + '|' + B.uid;

  const real = t.S._test.db.messages.put;
  t.S._test.db.messages.put = async () => { throw new Error('disco lleno (simulado)'); };
  const bad = await sb.emit('send', { pid: pub.id, text: 'no debería quedar' });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /No se pudo enviar/);
  assert.equal(t.S._test.convs.has(key), false); // nada en memoria que el disco no tenga

  t.S._test.db.messages.put = real; // el disco vuelve: el reintento funciona
  const good = await sb.emit('send', { pid: pub.id, text: 'ahora sí' });
  assert.equal(good.ok, true);
  assert.deepEqual(t.S._test.convs.get(key).msgs.map((m) => m.text), ['ahora sí']);
  sa.close(); sb.close();
  await t.stop();
});

test('migración: los mensajes guardados dentro de la conversación pasan a messages sin perder ni duplicar nada', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u2u-p870-mig-'));
  const legacy = [
    { key: '0|u_x', pid: 0, buyerId: 'u_x', buyerName: 'X', ts: 30, welcome: true, msgs: [
      { id: 'm2', uid: 'u_x', from: 'buyer', name: 'X', text: 'segundo', ts: 20 },
      { id: 'm1', uid: 'u_admin', from: 'seller', name: 'Oficial', text: 'primero', ts: 10 },
      { id: 'm3', uid: 'u_admin', from: 'seller', name: 'Oficial', text: 'tercero', ts: 30 },
    ] },
    { key: '5|u_y', pid: 5, buyerId: 'u_y', buyerName: 'Y', ts: 1, msgs: [] }, // conversación vacía: no se muestra, pero la fila se conserva
  ];
  fs.writeFileSync(path.join(dir, 'u2u-convs.json'), JSON.stringify({ version: 1, rows: legacy }));

  let t = await start({}, dir);
  assert.deepEqual(t.S._test.convs.get('0|u_x').msgs.map((m) => m.text), ['primero', 'segundo', 'tercero']); // en orden de hora
  assert.equal(t.S._test.convs.has('5|u_y'), false);
  assert.equal(rows(dir, 'messages').length, 3);
  assert.ok(rows(dir, 'messages').every((m) => m.key === '0|u_x'));
  assert.ok(rows(dir, 'convs').every((c) => c.msgs === undefined)); // las filas ya no cargan mensajes
  assert.equal(rows(dir, 'convs').length, 2); // no se perdió ninguna conversación
  assert.equal(t.S._test.convs.get('0|u_x').welcome, true); // los demás campos se conservan
  await t.stop();

  t = await start({}, dir); // repetir es seguro
  assert.equal(rows(dir, 'messages').length, 3);
  assert.equal(t.S._test.convs.get('0|u_x').msgs.length, 3);
  await t.stop();
});
