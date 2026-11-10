/* Bloque 6 · envío, límites, borrado a 72 h y registro manual (modo archivos: sin DATABASE_URL, DATA_DIR temporal; HTTP real) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ENV_KEYS = ['DATABASE_URL', 'ADMIN_USER', 'ADMIN_PASS', 'EMAIL_PROVIDER', 'BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_DEV_MODE', 'EMAIL_DAILY_LIMIT', 'REGISTRO_MANUAL'];
const H = 3600e3;

function load() { // carga el servidor desde cero (como un reinicio)
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(ROOT) && !k.includes(path.sep + 'node_modules' + path.sep) && !k.includes(path.sep + 'tests' + path.sep)) delete require.cache[k];
  }
  return require(path.join(ROOT, 'server.js'));
}
// opt.raw: no captura el correo (se usa el envío real del servidor: consola o proveedor); opt.dir: reutiliza la carpeta de datos
async function start(env, opt) {
  opt = opt || {};
  const dir = opt.dir || fs.mkdtempSync(path.join(os.tmpdir(), 'u2u-b6-'));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, { DATA_DIR: dir }, env || {});
  const S = load(), A = require(path.join(ROOT, 'auth.js')), codes = [];
  if (!opt.raw) A.setMailer(async (m) => { codes.push(m.code); });
  await S.boot({ listen: false });
  await new Promise((r) => S._test.server.listen(0, r));
  const base = 'http://127.0.0.1:' + S._test.server.address().port;
  const call = async (method, url, body, token) => {
    const r = await fetch(base + '/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) });
    return { status: r.status, ...(await r.json()) };
  };
  return { S, A, dir, codes, post: (u, b, t) => call('POST', u, b, t), get: (u, t) => call('GET', u, null, t), stop: () => S._test.close() };
}
const reg = (o) => ({ name: 'Ana Prueba', email: 'ana.prueba@upc.edu.pe', password: 'Clave-segura-9', cond: 'estudiante', career: 'Ing. Civil', cycle: 5, campus: 'Monterrico', terms: true, ...o });
function clock() { // reloj simulado, a mitad de hora (no cruza el límite de la ventana horaria)
  const real = Date.now, base = Math.floor(real() / H) * H + H / 2;
  let off = 0; Date.now = () => base + off;
  return { tick: (ms) => { off += ms; }, stop: () => { Date.now = real; } };
}
function spyLog() { // captura console.log (modo consola)
  const lines = [], orig = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  return { lines, stop: () => { console.log = orig; } };
}
const usersFile = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'u2u-users.json'), 'utf8')).rows;

test('límite por correo: 5 envíos por hora; el sexto se bloquea', async () => {
  const c = clock(), t = await start();
  try {
    const r = await t.post('/register', reg()); // envío 1
    for (let i = 0; i < 4; i++) { c.tick(61e3); assert.equal((await t.post('/resend', {}, r.token)).ok, true); } // envíos 2 a 5
    c.tick(61e3);
    const x = await t.post('/resend', {}, r.token);
    assert.equal(x.status, 429); assert.equal(x.code, 'RATE_LIMIT');
    assert.equal(t.codes.length, 5);
  } finally { c.stop(); await t.stop(); }
});

test('límite diario: al llegar al tope «Hoy se alcanzó el límite, vuelve mañana»', async () => {
  const t = await start({ EMAIL_DAILY_LIMIT: '3' });
  for (let i = 1; i <= 3; i++) assert.equal((await t.post('/register', reg({ email: 'alumno' + i + '@upc.edu.pe' }))).status, 201);
  const x = await t.post('/register', reg({ email: 'alumno4@upc.edu.pe' }));
  assert.equal(x.status, 429); assert.match(x.error, /Hoy se alcanzó el límite, vuelve mañana/);
  assert.equal(t.codes.length, 3);
  await t.stop();
});

test('sin proveedor (o con EMAIL_DEV_MODE=true) no cae: el código sale en consola, sin el correo', async () => {
  for (const env of [{ EMAIL_PROVIDER: 'brevo' }, { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'k', EMAIL_FROM: 'a@b.com', EMAIL_DEV_MODE: 'true' }]) {
    const spy = spyLog(), t = await start(env, { raw: true });
    try {
      const r = await t.post('/register', reg());
      const code = (/: (\d{6}) ·/.exec(spy.lines.join('\n')) || [])[1];
      assert.equal(r.status, 201); assert.equal(r.sent, true); assert.ok(code);
      assert.ok(!spy.lines.join('\n').includes('ana.prueba@upc.edu.pe'));
      assert.equal((await t.post('/verify', { code }, r.token)).ok, true);
    } finally { spy.stop(); await t.stop(); }
  }
});

test('con proveedor Brevo: envía por fetch con la clave; si el proveedor falla la cuenta igual se crea', async () => {
  const realFetch = global.fetch, calls = [];
  let status = 201;
  global.fetch = (u, o) => (String(u).startsWith('https://api.brevo.com/') ? (calls.push({ u: String(u), o }), Promise.resolve({ ok: status < 300, status })) : realFetch(u, o));
  const spy = spyLog(), t = await start({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'clave-falsa', EMAIL_FROM: 'U2U <no-reply@ejemplo.com>', EMAIL_DEV_MODE: 'false' }, { raw: true });
  try {
    const r = await t.post('/register', reg());
    const body = JSON.parse(calls[0].o.body), code = /(\d{6})$/.exec(body.subject)[1];
    assert.equal(calls[0].o.headers['api-key'], 'clave-falsa'); assert.equal(body.sender.email, 'no-reply@ejemplo.com'); assert.equal(body.to[0].email, 'ana.prueba@upc.edu.pe');
    assert.equal((await t.post('/verify', { code }, r.token)).ok, true);
    status = 500; // el proveedor cae
    const f = await t.post('/register', reg({ email: 'luis@upc.edu.pe' }));
    assert.equal(f.status, 201); assert.equal(f.sent, false);
  } finally { global.fetch = realFetch; spy.stop(); await t.stop(); }
});

test('sin verificar se borra a las 72 h (al consultar y al iniciar); verificadas no', async () => {
  const c = clock();
  let t = await start();
  try {
    const a = await t.post('/register', reg()), b = await t.post('/register', reg({ email: 'bea@upc.edu.pe' })), d = await t.post('/register', reg({ email: 'dani@upc.edu.pe' }));
    await t.post('/verify', { code: t.codes[1] }, b.token); // Bea verifica
    c.tick(72 * H + 1000);
    assert.equal((await t.post('/resend', { email: 'ana.prueba@upc.edu.pe' })).ok, true); // al consultar: Ana ya no existe
    assert.equal(t.A.getByUid(a.user.uid), null);
    assert.ok(t.A.getByUid(b.user.uid)); // la verificada se queda
    await t.S._test.db.flush();
    assert.ok(!usersFile(t.dir).some((x) => x.uid === a.user.uid));
    const dir = t.dir; await t.stop();
    t = await start({}, { dir }); // al iniciar: Dani (sin verificar, 72 h) se borra
    assert.equal(t.A.getByUid(d.user.uid), null); assert.ok(t.A.getByUid(b.user.uid));
    assert.equal((await t.post('/register', reg())).status, 201); // el correo de Ana quedó libre
  } finally { c.stop(); await t.stop(); }
});

test('REGISTRO_MANUAL: la cuenta queda pendiente (sin código) hasta que la admin la aprueba', async () => {
  const c = clock(), t = await start({ REGISTRO_MANUAL: 'true', ADMIN_USER: 'admin_test', ADMIN_PASS: 'clave-admin-123456' });
  try {
    const r = await t.post('/register', reg());
    assert.equal(r.status, 201); assert.equal(r.pending, true); assert.equal(t.codes.length, 0);
    assert.equal((await t.post('/verify', { code: '123456' }, r.token)).code, 'NOT_VERIFIED');
    c.tick(73 * H); assert.equal(t.A.sweep(), 0); // las pendientes no vencen a las 72 h
    assert.equal((await t.get('/admin/pending', r.token)).code, 'FORBIDDEN'); // una cuenta normal no puede
    const adm = await t.post('/login', { id: 'admin_test', password: 'clave-admin-123456' });
    assert.equal((await t.get('/admin/pending', adm.token)).pending[0].uid, r.user.uid);
    assert.equal(t.S._test.convs.has('0|' + r.user.uid), false);
    assert.equal((await t.post('/admin/approve', { uid: r.user.uid }, adm.token)).ok, true);
    assert.equal(t.A.isVerified(t.A.getByUid(r.user.uid)), true); assert.equal(t.S._test.convs.has('0|' + r.user.uid), true); // bienvenida al aprobar
  } finally { c.stop(); await t.stop(); }
});
