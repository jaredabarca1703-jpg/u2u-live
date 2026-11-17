/* v8.7.5 · FASE 2: ids envenenados, anuncios borrados, pedidos de alquiler, pre-secuestro de correo, tope por IP y filas malas en db.js
   (modo archivos salvo la prueba de db.js, que usa un `pg` simulado; HTTP y Socket.io reales) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ENV_KEYS = ['DATABASE_URL', 'ADMIN_USER', 'ADMIN_PASS', 'EMAIL_PROVIDER', 'BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_DEV_MODE', 'EMAIL_DAILY_LIMIT', 'EMAIL_IP_PER_HOUR', 'REGISTRO_MANUAL', 'PUB_LIMIT_USER', 'STORAGE_LIMIT_MB', 'ORDER_TTL_HOURS'];

function load() {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(ROOT) && !k.includes(path.sep + 'node_modules' + path.sep) && !k.includes(path.sep + 'tests' + path.sep)) delete require.cache[k];
  }
  return require(path.join(ROOT, 'server.js'));
}
async function start(env, dir, pre) { // pre(dir): deja archivos de datos antes de arrancar
  dir = dir || fs.mkdtempSync(path.join(os.tmpdir(), 'u2u-f2-'));
  if (pre) pre(dir);
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, { DATA_DIR: dir }, env || {});
  const S = load(), A = require(path.join(ROOT, 'auth.js')), codes = [];
  A.setMailer(async (m) => { codes.push(m.code); });
  await S.boot({ listen: false });
  await new Promise((r) => S._test.server.listen(0, r));
  const base = 'http://127.0.0.1:' + S._test.server.address().port;
  const call = async (method, url, body, token) => {
    const r = await fetch(base + '/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) });
    return { status: r.status, ...(await r.json()) };
  };
  const post = (u, b, t) => call('POST', u, b, t), get = (u, t) => call('GET', u, null, t);
  const account = async (n) => {
    const r = await post('/register', { name: 'Usuario ' + n, email: 'user' + n + '@upc.edu.pe', password: 'Clave-segura-9', cond: 'estudiante', career: 'Ing. Civil', cycle: 5, campus: 'Monterrico', terms: true });
    assert.equal(r.status, 201);
    assert.equal((await post('/verify', { code: codes[codes.length - 1] }, r.token)).verified, true);
    return { uid: r.user.uid, secret: r.user.secret, token: r.token, name: r.user.name };
  };
  return { S, A, dir, base, codes, post, get, account, stop: () => S._test.close() };
}
function sio(base) {
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
const item = (o) => ({ t: 'Calculadora Casio', ph: ['data:image/png;base64,iVBORw0KGgo='], mode: 'venta', price: 80, cat: 'Calculadoras', cond: 'Usado', desc: 'prueba', ...o });
const owner = { uid: 'u_dueno', name: 'Dueño', admin: false };
const limaDay = (n) => new Date(Date.now() - 5 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 2.1 ids ---------- */
test('2.1 · un id gigante del cliente se descarta y el servidor asigna uno seguro', async () => {
  const t = await start();
  const r = await t.S._test.publish(owner, item({ id: Number.MAX_SAFE_INTEGER }));
  assert.equal(r.res.ok, true);
  assert.notEqual(r.res.id, Number.MAX_SAFE_INTEGER);
  assert.ok(Number.isSafeInteger(r.res.id) && r.res.id <= Date.now() + 864e5);
  await t.stop();
});

test('2.1 · tras reiniciar con una fila de id envenenado, 3 publicaciones salen con 3 ids distintos y seguros', async () => {
  const pre = (dir) => fs.writeFileSync(path.join(dir, 'u2u-products.json'), JSON.stringify({ version: 1, rows: [{ id: Number.MAX_SAFE_INTEGER, t: 'Envenenada', ph: ['data:image/png;base64,iVBORw0KGgo='], mode: 'venta', price: 1, rent: 0, dep: 0, car: [], cat: 'Herramientas', cond: 'Usado', cp: 0, desc: 'x', status: 'available', ownerUid: 'u_malo', ownerName: 'Malo', ts: Date.now() }] }));
  const t = await start({}, null, pre);
  const ids = [];
  for (let i = 0; i < 3; i++) { const r = await t.S._test.publish(owner, item({ t: 'Producto ' + i })); assert.equal(r.res.ok, true); ids.push(r.res.id); }
  assert.equal(new Set(ids).size, 3);
  ids.forEach((id) => assert.ok(Number.isSafeInteger(id) && id <= Date.now() + 864e5));
  await t.stop();
});

/* ---------- 2.3 resurrección ---------- */
test('2.3 · un anuncio eliminado no revive al volver a publicarlo (ni tras reiniciar)', async () => {
  const t = await start(), id = Date.now() - 5000;
  assert.equal((await t.S._test.publish(owner, item({ id }))).res.id, id);
  assert.equal(await t.S._test.removeProduct(id), true);
  const again = await t.S._test.publish(owner, item({ id }));
  assert.equal(again.res.ok, false); assert.equal(again.res.removed, true);
  const dir = t.dir; await t.stop();
  const t2 = await start({}, dir); // reinicio: los ids eliminados salen de deleted_at
  const again2 = await t2.S._test.publish(owner, item({ id }));
  assert.equal(again2.res.ok, false); assert.equal(again2.res.removed, true);
  await t2.stop();
});

/* ---------- 2.4 pedidos de alquiler ---------- */
test('2.4 · pausada, fechas inválidas, solapes y reservada: todo se rechaza en el servidor', async () => {
  const t = await start();
  const seller = await t.account(1), b1 = await t.account(2), b2 = await t.account(3);
  const pub = (await t.S._test.publish({ uid: seller.uid, name: seller.name, admin: false }, item({ mode: 'alquiler', price: 0, rent: 10, t: 'Taladro alquiler' }))).res;
  assert.equal(pub.ok, true);
  const s1 = await sio(t.base), s2 = await sio(t.base);
  s1.send('join', { uid: b1.uid, secret: b1.secret }); s2.send('join', { uid: b2.uid, secret: b2.secret });
  await wait(150);
  const ord = (s, o) => s.emit('order:create', { pid: pub.id, mode: 'alquiler', ...o });
  assert.match((await ord(s1, { from: '9999-12-31', to: '9999-12-31' })).error, /fechas/i);
  assert.match((await ord(s1, { from: limaDay(3), to: limaDay(2) })).error, /fechas/i);   // to < from
  assert.match((await ord(s1, { from: limaDay(-3), to: limaDay(2) })).error, /fechas/i);  // empieza en el pasado
  assert.match((await ord(s1, { from: '2026-02-30', to: '2026-03-02' })).error, /fechas/i); // día que no existe
  assert.match((await ord(s1, { from: limaDay(1), to: limaDay(70) })).error, /60 días/);
  const ok = await ord(s1, { from: limaDay(2), to: limaDay(4) });
  assert.equal(ok.ok, true); assert.equal(ok.order.days, 3); assert.equal(ok.order.total, 30);
  assert.match((await ord(s2, { from: limaDay(4), to: limaDay(6) })).error, /ya están reservadas/); // solape
  assert.equal((await ord(s2, { from: limaDay(5), to: limaDay(6) })).ok, true);                     // sin solape
  t.S._test.products.get(pub.id).status = 'paused';
  assert.match((await ord(s2, { from: limaDay(20), to: limaDay(21) })).error, /pausada/);
  t.S._test.products.get(pub.id).status = 'reserved';
  assert.match((await ord(s2, { from: limaDay(30), to: limaDay(31) })).error, /reservado/);
  s1.close(); s2.close(); await t.stop();
});

/* ---------- 2.7.1 pre-secuestro de correo ---------- */
test('2.7.1 · registrar un correo sin verificar lo reemplaza; una cuenta verificada responde 409', async () => {
  const t = await start();
  const reg = (o) => ({ name: 'Ana Prueba', email: 'victima@upc.edu.pe', password: 'Clave-atacante-1', cond: 'estudiante', career: 'Ing. Civil', cycle: 5, campus: 'Monterrico', terms: true, ...o });
  const a = await t.post('/register', reg());                       // atacante A reserva el correo
  assert.equal(a.status, 201);
  const b = await t.post('/register', reg({ password: 'Clave-victima-2' })); // la víctima B lo registra de verdad
  assert.equal(b.status, 201);
  assert.equal((await t.get('/me', a.token)).status, 401);          // el token de A ya no sirve
  assert.equal((await t.post('/login', { id: 'victima@upc.edu.pe', password: 'Clave-atacante-1' })).status, 401);
  assert.equal(b.user.uid, a.user.uid);                              // reutiliza uid: no choca con el índice único del correo
  assert.equal((await t.post('/verify', { code: t.codes[t.codes.length - 1] }, b.token)).verified, true);
  assert.equal((await t.post('/login', { id: 'victima@upc.edu.pe', password: 'Clave-victima-2' })).status, 200);
  const c = await t.post('/register', reg({ password: 'Otra-clave-3' })); // ya verificada: nadie la reemplaza
  assert.equal(c.status, 409);
  await t.stop();
});

/* ---------- 2.7.2 tope de correos por IP configurable ---------- */
test('2.7.2 · EMAIL_IP_PER_HOUR limita los envíos por IP', async () => {
  const t = await start({ EMAIL_IP_PER_HOUR: '2' });
  const r = [];
  for (let i = 0; i < 3; i++) r.push(await t.post('/recover', { email: 'persona' + i + '@upc.edu.pe' }));
  assert.equal(r[0].ok, true); assert.equal(r[1].ok, true);
  assert.equal(r[2].status, 429); assert.equal(r[2].code, 'RATE_LIMIT');
  await t.stop();
});

/* ---------- 2.2 db.js: una fila mal formada no bloquea el lote ---------- */
test('2.2 · db.js aísla una fila que lanza TypeError y guarda el resto (pg simulado)', async () => {
  const log = [], pgPath = require.resolve('pg');
  const run = (via) => (sql, params) => { log.push({ via, sql: String(sql), k: params && params[0] }); return Promise.resolve({ rows: [], rowCount: 0 }); };
  class FakePool { constructor() {} on() {} query(s, p) { return run('pool')(s, p); } async connect() { return { query: run('client'), release() {} }; } }
  const prev = require.cache[pgPath];
  require.cache[pgPath] = { id: pgPath, filename: pgPath, loaded: true, exports: { Pool: FakePool } };
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.DATABASE_URL = 'postgres://u:p@localhost:5432/x';
  for (const k of Object.keys(require.cache)) if (k.startsWith(ROOT) && !k.includes('node_modules') && !k.includes(path.sep + 'tests' + path.sep)) delete require.cache[k];
  const quiet = console.log, err = console.error; console.log = () => {}; console.error = () => {};
  try {
    const db = require(path.join(ROOT, 'db.js'));
    await db.init();
    db.users.put({ uid: 'ua', username: 'a', email: 'a@upc.edu.pe' });
    db.users.put({ uid: 'ub', email: 'b@upc.edu.pe' }); // sin username -> TypeError en el extractor
    db.users.put({ uid: 'uc', username: 'c', email: 'c@upc.edu.pe' });
    await db.flush(3000);
    const saved = log.filter((x) => x.via === 'pool' && /INSERT INTO users/.test(x.sql)).map((x) => x.k).sort();
    assert.deepEqual(saved, ['ua', 'uc']); // las dos filas buenas se guardaron una a una; la mala se omitió
  } finally {
    console.log = quiet; console.error = err; delete process.env.DATABASE_URL;
    if (prev) require.cache[pgPath] = prev; else delete require.cache[pgPath];
  }
});

/* ---------- 3.1 fotos: solo base64 para usuarios normales ---------- */
test('3.1 · un usuario normal no puede usar claves internas de foto; un admin sí', async () => {
  const t = await start();
  const r1 = await t.S._test.publish(owner, item({ ph: ['dron'] }));
  assert.equal(r1.res.ok, false); assert.match(r1.res.error, /Foto no válida/);
  const r2 = await t.S._test.publish({ uid: 'u_admin', name: 'Admin', admin: true }, item({ ph: ['dron'], t: 'Oficial' }));
  assert.equal(r2.res.ok, true);
  await t.stop();
});

/* ---------- 3.7 / 3.8 servidor ---------- */
const IMG = 'data:image/png;base64,iVBORw0KGgo=';
test('3.7 · product-removed lleva mod:true solo si lo quitó un moderador', async () => {
  const t = await start(), io = t.S._test.io, log = [], real = io.emit.bind(io);
  io.emit = (ev, ...a) => { log.push([ev, ...a]); return real(ev, ...a); };
  const a = (await t.S._test.publish(owner, item({ t: 'Uno' }))).res.id, b = (await t.S._test.publish(owner, item({ t: 'Dos' }))).res.id;
  await t.S._test.removeProduct(a);
  await t.S._test.removeProduct(b, { mod: true });
  const rem = log.filter((x) => x[0] === 'product-removed').map((x) => x[1]);
  assert.deepEqual(rem, [{ id: a, mod: false }, { id: b, mod: true }]);
  await t.stop();
});

test('3.7 · un reintento con el mismo cid no duplica el mensaje', async () => {
  const t = await start(), seller = await t.account(11), buyer = await t.account(12);
  const pub = (await t.S._test.publish({ uid: seller.uid, name: seller.name, admin: false }, item({ t: 'Para chat' }))).res;
  const s = await sio(t.base); s.send('join', { uid: buyer.uid, secret: buyer.secret }); await wait(150);
  const r1 = await s.emit('send', { pid: pub.id, text: 'Hola', cid: 'abc123' }), r2 = await s.emit('send', { pid: pub.id, text: 'Hola', cid: 'abc123' });
  assert.equal(r1.ok, true); assert.equal(r2.ok, true); assert.equal(r2.dup, true);
  await s.emit('send', { pid: pub.id, text: 'Otro', cid: 'zzz999' });
  assert.equal(t.S._test.convs.get(pub.id + '|' + buyer.uid).msgs.length, 2);
  s.close(); await t.stop();
});

test('3.8 · el producto publicado lleva ownerProfile (verificado, sin correo)', async () => {
  const t = await start(), seller = await t.account(21);
  const pub = (await t.S._test.publish({ uid: seller.uid, name: seller.name, admin: false }, item({ t: 'Con perfil' }))).res;
  const view = t.S._test.pubProduct(t.S._test.products.get(pub.id));
  assert.equal(view.ownerProfile.uid, seller.uid); assert.equal(view.ownerProfile.verified, true);
  assert.ok(!/@|email/i.test(JSON.stringify(view)), 'el payload no debe contener correos');
  await t.stop();
});

/* ---------- 4.1 saneamiento ---------- */
test('4.1 · nombres duplicados (aunque lleven caracteres invisibles) se rechazan; título y descripción salen limpios', async () => {
  const t = await start();
  const reg = (o) => ({ name: 'Ana Prueba', email: 'ana1@upc.edu.pe', password: 'Clave-segura-9', cond: 'estudiante', career: 'Ing. Civil', cycle: 5, campus: 'Monterrico', terms: true, ...o });
  assert.equal((await t.post('/register', reg())).status, 201);
  const dup = await t.post('/register', reg({ email: 'ana2@upc.edu.pe', name: 'Ana\u200B  Prueba' })); // cero ancho + espacios dobles
  assert.equal(dup.status, 409); assert.equal(dup.field, 'name');
  assert.equal((await t.post('/register', reg({ email: 'ana3@upc.edu.pe', name: 'Ana Prueba Quispe' }))).status, 201);
  const r = await t.S._test.publish(owner, item({ t: '<b>Calculadora</b> Casio', desc: 'Línea 1\nLínea <i>2</i>\u0007' }));
  const p = t.S._test.products.get(r.res.id);
  assert.ok(!/[<>]/.test(p.t + p.desc)); assert.match(p.desc, /\n/); assert.ok(!/\u0007/.test(p.desc));
  await t.stop();
});

/* ---------- 4.3 cabeceras ---------- */
test('4.3 · las respuestas llevan las cabeceras de seguridad', async () => {
  const t = await start();
  for (const url of ['/', '/api/health']) {
    const r = await fetch(t.base + url);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.equal(r.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.match(r.headers.get('permissions-policy'), /camera=\(\)/);
  }
  await t.stop();
});

/* ---------- 4.4 escalabilidad ---------- */
test('4.4 · history:more entrega mensajes anteriores de a 50 y solo a los participantes', async () => {
  const t = await start(), seller = await t.account(31), buyer = await t.account(32), other = await t.account(33);
  const pub = (await t.S._test.publish({ uid: seller.uid, name: seller.name, admin: false }, item({ t: 'Historial' }))).res;
  const key = pub.id + '|' + buyer.uid, base = Date.now() - 1e6;
  t.S._test.convs.set(key, { key, pid: pub.id, buyerId: buyer.uid, buyerName: buyer.name, ts: base, msgs: Array.from({ length: 120 }, (_, i) => ({ id: 'm' + i, uid: buyer.uid, from: 'buyer', name: buyer.name, text: 'msg ' + i, ts: base + i })) });
  const sb = await sio(t.base), so = await sio(t.base);
  sb.send('join', { uid: buyer.uid, secret: buyer.secret }); so.send('join', { uid: other.uid, secret: other.secret }); await wait(150);
  const r1 = await sb.emit('history:more', { key, before: base + 70 });   // 70 anteriores -> los últimos 50
  assert.equal(r1.ok, true); assert.equal(r1.msgs.length, 50); assert.equal(r1.msgs[0].id, 'm20'); assert.equal(r1.more, true);
  const r2 = await sb.emit('history:more', { key, before: base + 20 });
  assert.equal(r2.msgs.length, 20); assert.equal(r2.more, false);
  assert.ok((await so.emit('history:more', { key, before: base + 70 })).error);  // un tercero no puede leer
  sb.close(); so.close(); await t.stop();
});
