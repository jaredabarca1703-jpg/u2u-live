/* Bloque 7 · login por correo, recuperación, cambio de contraseña y perfil (modo archivos: sin DATABASE_URL, DATA_DIR temporal; HTTP real) */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ENV_KEYS = ['DATABASE_URL', 'ADMIN_USER', 'ADMIN_PASS', 'EMAIL_PROVIDER', 'BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_DEV_MODE', 'EMAIL_DAILY_LIMIT', 'REGISTRO_MANUAL'];

function load() { // carga el servidor desde cero (como un reinicio)
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(ROOT) && !k.includes(path.sep + 'node_modules' + path.sep) && !k.includes(path.sep + 'tests' + path.sep)) delete require.cache[k];
  }
  return require(path.join(ROOT, 'server.js'));
}
async function start(env, legacy) { // legacy: cuentas anteriores al bloque 5 que ya están en el archivo de datos
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u2u-b7-'));
  if (legacy) fs.writeFileSync(path.join(dir, 'u2u-users.json'), JSON.stringify({ version: 1, rows: legacy }));
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
  return { S, A, base, codes, post: (u, b, t) => call('POST', u, b, t), put: (u, b, t) => call('PUT', u, b, t), get: (u, t) => call('GET', u, null, t), stop: () => S._test.close() };
}
const reg = (o) => ({ name: 'Ana Prueba', email: 'ana.prueba@upc.edu.pe', password: 'Clave-segura-9', cond: 'estudiante', career: 'Ing. Civil', cycle: 5, campus: 'Monterrico', terms: true, ...o });
async function account(t, o) { // cuenta nueva ya verificada
  const r = await t.post('/register', reg(o));
  await t.post('/verify', { code: t.codes[t.codes.length - 1] }, r.token);
  return r;
}
function legacyRow(pw) {
  const salt = crypto.randomBytes(16), k = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return { uid: 'u_legacy000001', secret: 'a'.repeat(48), username: 'jared_old', email: 'jared@gmail.com', name: 'Jared', createdAt: 1700000000000, hash: ['scrypt', 16384, 8, 1, salt.toString('base64'), k.toString('base64')].join('$') };
}
function wsOpen(base, uid, secret) { // socket real; closed = promesa que se cumple cuando el servidor lo desconecta
  return new Promise((ok, no) => {
    const ws = new WebSocket(base.replace('http', 'ws') + '/socket.io/?EIO=4&transport=websocket');
    const closed = new Promise((r) => { ws.onclose = r; });
    ws.onerror = () => no(new Error('ws'));
    ws.onmessage = (ev) => {
      const m = String(ev.data);
      if (m === '2') return ws.send('3');
      if (m[0] === '0') return ws.send('40');
      if (m.startsWith('40')) { ws.send('42' + JSON.stringify(['join', { uid, secret }])); ok({ closed, close: () => ws.close() }); }
    };
  });
}

test('login por correo; con usuario solo entran cuentas anteriores y la oficial', async () => {
  const t = await start({ ADMIN_USER: 'admin_test', ADMIN_PASS: 'clave-admin-123456' }, [legacyRow('Clave-legacy-1')]);
  const r = await account(t);
  const l = await t.post('/login', { id: 'ana.prueba@upc.edu.pe', password: 'Clave-segura-9' });
  assert.equal(l.status, 200); assert.equal(l.user.email, 'ana.prueba@upc.edu.pe'); assert.equal(l.user.career, 'Ing. Civil'); assert.equal(l.user.username, undefined);
  assert.equal((await t.post('/login', { id: r.user.uid, password: 'Clave-segura-9' })).status, 401); // cuenta nueva: el usuario interno no entra
  assert.equal((await t.post('/login', { id: 'jared_old', password: 'Clave-legacy-1' })).status, 200); // legacy sigue por usuario
  assert.equal((await t.post('/login', { id: 'admin_test', password: 'clave-admin-123456' })).status, 200); // la oficial también
  await t.stop();
});

test('PUT /api/me edita nombre, carrera, ciclo y sede (validado) y guarda la nueva versión de términos', async () => {
  const t = await start(), r = await account(t);
  const bad = await t.put('/me', { career: 'Astrología' }, r.token);
  assert.equal(bad.status, 400); assert.equal(bad.field, 'career');
  assert.equal((await t.put('/me', { cycle: 11 }, r.token)).field, 'cycle');
  assert.equal((await t.put('/me', { campus: 'Callao' }, r.token)).field, 'campus');
  const ok = await t.put('/me', { name: 'Ana P', career: 'Sistemas', cycle: 7, campus: 'Villa' }, r.token);
  assert.deepEqual([ok.user.name, ok.user.career, ok.user.cycle, ok.user.campus], ['Ana P', 'Sistemas', '7', 'Villa']);
  t.A.getByUid(r.user.uid).terms.version = '0.9'; // términos viejos
  await t.put('/me', { terms: true }, r.token);
  assert.equal(t.A.getByUid(r.user.uid).terms.version, '1.0');
  await t.stop();
});

test('recuperación: la respuesta es igual exista o no el correo y solo envía a cuentas reales', async () => {
  const t = await start(), r = await account(t);
  const n = t.codes.length;
  const a = await t.post('/recover', { email: 'ana.prueba@upc.edu.pe' }), b = await t.post('/recover', { email: 'nadie.existe@upc.edu.pe' });
  assert.deepEqual(a, b); assert.equal(t.codes.length, n + 1); // solo la cuenta real recibió código
  const x = await t.post('/recover/reset', { email: 'ana.prueba@upc.edu.pe', code: '000000', password: 'Nueva-clave-77' });
  const y = await t.post('/recover/reset', { email: 'nadie.existe@upc.edu.pe', code: '000000', password: 'Nueva-clave-77' });
  assert.deepEqual(x, y); assert.equal(x.code, 'CODE_INVALID');
  assert.equal((await t.get('/me', r.token)).status, 200); // un intento fallido no toca la cuenta
  await t.stop();
});

test('recuperar contraseña revoca sesiones, rota el secret y desconecta los sockets viejos', async () => {
  const t = await start(), r = await account(t);
  const l2 = await t.post('/login', { id: 'ana.prueba@upc.edu.pe', password: 'Clave-segura-9' }), s1 = r.user.secret;
  const ws = await wsOpen(t.base, r.user.uid, s1);
  await t.post('/recover', { email: 'ana.prueba@upc.edu.pe' });
  assert.equal((await t.post('/recover/reset', { email: 'ana.prueba@upc.edu.pe', code: t.codes[t.codes.length - 1], password: 'Nueva-clave-77' })).ok, true);
  assert.equal((await t.get('/me', r.token)).status, 401); assert.equal((await t.get('/me', l2.token)).status, 401); // sesiones viejas revocadas
  assert.equal(t.A.check(r.user.uid, s1), null); // secret viejo ya no sirve
  assert.equal((await Promise.race([ws.closed.then(() => 'cerrado'), new Promise((x) => setTimeout(() => x('abierto'), 3000))])), 'cerrado');
  assert.equal((await t.post('/login', { id: 'ana.prueba@upc.edu.pe', password: 'Clave-segura-9' })).status, 401);
  const n = await t.post('/login', { id: 'ana.prueba@upc.edu.pe', password: 'Nueva-clave-77' });
  assert.equal(n.status, 200); assert.notEqual(n.user.secret, s1);
  await t.stop();
});

test('cambiar contraseña con sesión: pide la actual, rota el secret y deja solo la sesión nueva', async () => {
  const t = await start(), r = await account(t);
  const l2 = await t.post('/login', { id: 'ana.prueba@upc.edu.pe', password: 'Clave-segura-9' });
  assert.equal((await t.post('/me/password', { current: 'mala-clave-1', password: 'Nueva-clave-77' }, r.token)).field, 'current');
  const c = await t.post('/me/password', { current: 'Clave-segura-9', password: 'Nueva-clave-77' }, r.token);
  assert.equal(c.ok, true); assert.notEqual(c.user.secret, r.user.secret);
  assert.equal((await t.get('/me', r.token)).status, 401); assert.equal((await t.get('/me', l2.token)).status, 401);
  assert.equal((await t.get('/me', c.token)).status, 200);
  await t.stop();
});

test('pendientes de registro manual: solo la admin los lista y aprueba', async () => {
  const t = await start({ REGISTRO_MANUAL: 'true', ADMIN_USER: 'admin_test', ADMIN_PASS: 'clave-admin-123456' });
  const r = await t.post('/register', reg());
  assert.equal((await t.get('/admin/pending', r.token)).code, 'FORBIDDEN');
  assert.equal((await t.post('/admin/approve', { uid: r.user.uid }, r.token)).code, 'FORBIDDEN');
  const adm = await t.post('/login', { id: 'admin_test', password: 'clave-admin-123456' });
  assert.equal((await t.get('/admin/pending', adm.token)).pending.length, 1);
  assert.equal((await t.post('/admin/approve', { uid: r.user.uid }, adm.token)).ok, true);
  await t.stop();
});
