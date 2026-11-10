/* Bloque 5 · correo UPC + código (modo archivos: sin DATABASE_URL, DATA_DIR temporal; HTTP y Socket.io reales, sin dependencias nuevas) */
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
async function start(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u2u-b5-'));
  for (const k of ['DATABASE_URL', 'ADMIN_USER', 'ADMIN_PASS', 'PUB_LIMIT_USER', 'STORAGE_LIMIT_MB']) delete process.env[k];
  Object.assign(process.env, { DATA_DIR: dir }, env || {});
  const S = load(), codes = [];
  require(path.join(ROOT, 'auth.js')).setMailer(async (m) => { codes.push(m.code); }); // captura el código (sin consola)
  await S.boot({ listen: false });
  await new Promise((r) => S._test.server.listen(0, r));
  const base = 'http://127.0.0.1:' + S._test.server.address().port;
  const post = async (url, body, token) => {
    const r = await fetch(base + '/api' + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
    return { status: r.status, ...(await r.json()) };
  };
  return { S, dir, base, codes, post, stop: () => S._test.close() };
}
const ana = (o) => ({ name: 'Ana Prueba', email: 'ana.prueba@upc.edu.pe', password: 'Clave-segura-9', cond: 'estudiante', career: 'Ing. Civil', cycle: 5, campus: 'Monterrico', terms: true, visibility: { career: true }, ...o });
const wrong = (code) => (code === '000000' ? '111111' : '000000');
async function later(ms, fn) { // adelanta el reloj (vencimientos y esperas) sin esperar de verdad
  const real = Date.now; Date.now = () => real() + ms;
  try { return await fn(); } finally { Date.now = real; }
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

test('gmail y subdominios se rechazan; solo upc.edu.pe exacto (y en minúsculas) pasa', async () => {
  const t = await start();
  for (const email of ['ana@gmail.com', 'x@upc.edu.pe.otro.com', 'x@alum.upc.edu.pe', 'x@@upc.edu.pe']) {
    const r = await t.post('/register', ana({ email }));
    assert.equal(r.status, 400); assert.equal(r.field, 'email'); assert.equal(r.code, 'INVALID');
  }
  const ok = await t.post('/register', ana({ email: ' Ana.Prueba@UPC.EDU.PE ' }));
  assert.equal(ok.status, 201); assert.equal(ok.user.verified, false);
  assert.equal((await t.post('/register', ana({ email: 'ana.prueba@upc.edu.pe' }))).status, 409); // un correo = una cuenta
  await t.stop();
});

test('el código se guarda como hash, el perfil público no filtra datos y no hay bienvenida antes de verificar', async () => {
  const t = await start({ ADMIN_USER: 'admin_test', ADMIN_PASS: 'clave-admin-123456' });
  const r = await t.post('/register', ana());
  const row = JSON.parse(fs.readFileSync(path.join(t.dir, 'u2u-users.json'), 'utf8')).rows.find((x) => x.uid === r.user.uid);
  assert.ok(row.verify.h && row.verify.code === undefined && row.verify.h !== t.codes[0]);
  assert.equal(row.terms.version, '1.0'); assert.ok(row.terms.at > 0);
  const pubp = require(path.join(ROOT, 'auth.js')).publicProfile(require(path.join(ROOT, 'auth.js')).getByUid(r.user.uid));
  assert.deepEqual(pubp, { uid: r.user.uid, name: 'Ana Prueba', official: false, career: 'Ing. Civil' }); // sin correo, usuario, ciclo ni sede (no los hizo visibles)
  assert.equal(t.S._test.convs.has('0|' + r.user.uid), false);
  assert.equal((await t.post('/verify', { code: t.codes[0] }, r.token)).ok, true);
  assert.equal(t.S._test.convs.has('0|' + r.user.uid), true); // bienvenida solo tras verificar
  await t.stop();
});

test('código vencido falla (a los 10 min) y pedir otro lo reemplaza', async () => {
  const t = await start();
  const r = await t.post('/register', ana());
  const v = await later(10 * 60e3 + 1000, () => t.post('/verify', { code: t.codes[0] }, r.token));
  assert.equal(v.code, 'CODE_EXPIRED');
  await later(61e3, async () => assert.equal((await t.post('/resend', {}, r.token)).ok, true));
  assert.equal((await later(61e3, () => t.post('/verify', { code: t.codes[1] }, r.token))).ok, true);
  await t.stop();
});

test('5 códigos mal bloquean (aunque luego llegue el correcto) hasta pedir otro', async () => {
  const t = await start();
  const r = await t.post('/register', ana());
  let last;
  for (let i = 0; i < 5; i++) last = await t.post('/verify', { email: 'ana.prueba@upc.edu.pe', code: wrong(t.codes[0]) });
  assert.equal(last.code, 'RATE_LIMIT');
  assert.equal((await t.post('/verify', { code: t.codes[0] }, r.token)).code, 'RATE_LIMIT'); // el correcto ya no sirve
  await later(61e3, async () => await t.post('/resend', {}, r.token)); // código nuevo: intentos en 0
  assert.equal((await later(61e3, () => t.post('/verify', { code: t.codes[1] }, r.token))).ok, true);
  await t.stop();
});

test('reenvío: máximo uno cada 60 s', async () => {
  const t = await start();
  const r = await t.post('/register', ana());
  const x = await t.post('/resend', {}, r.token);
  assert.equal(x.status, 429); assert.equal(x.code, 'RATE_LIMIT'); assert.ok(x.retry > 0 && x.retry <= 60);
  assert.equal(t.codes.length, 1); // no se envió otro
  assert.equal((await later(61e3, () => t.post('/resend', {}, r.token))).ok, true);
  assert.equal(t.codes.length, 2);
  await t.stop();
});

test('sin verificar no publica, reserva ni chatea (socket real); verificado sí publica', async () => {
  const t = await start();
  const r = await t.post('/register', ana());
  const c = await sio(t.base);
  c.send('join', { uid: r.user.uid, secret: r.user.secret });
  const item = { t: 'Calculadora Casio', ph: ['cam'], mode: 'venta', price: 50, cat: 'Calculadoras', cond: 'Usado', desc: 'prueba' };
  assert.equal((await c.emit('new-product', item)).code, 'NOT_VERIFIED');
  assert.equal((await c.emit('order:create', { pid: 1 })).code, 'NOT_VERIFIED');
  assert.equal((await c.emit('send', { pid: 0, text: 'hola' })).code, 'NOT_VERIFIED');
  assert.equal(t.S._test.products.size, 0);
  await t.post('/verify', { code: t.codes[0] }, r.token);
  assert.equal((await c.emit('new-product', item)).ok, true);
  c.close(); await t.stop();
});
