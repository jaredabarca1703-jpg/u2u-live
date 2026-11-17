/* v8.7.5 · recuperación de contraseña de punta a punta (modo archivos: sin DATABASE_URL, DATA_DIR temporal; HTTP real) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ENV_KEYS = ['DATABASE_URL', 'ADMIN_USER', 'ADMIN_PASS', 'EMAIL_PROVIDER', 'BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_DEV_MODE', 'EMAIL_DAILY_LIMIT', 'EMAIL_IP_PER_HOUR', 'REGISTRO_MANUAL'];
const H = 3600e3, wait = (ms) => new Promise((r) => setTimeout(r, ms));

function load() {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(ROOT) && !k.includes(path.sep + 'node_modules' + path.sep) && !k.includes(path.sep + 'tests' + path.sep)) delete require.cache[k];
  }
  return require(path.join(ROOT, 'server.js'));
}
async function start(env, opt) {
  opt = opt || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u2u-rc-'));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, { DATA_DIR: dir }, env || {});
  const S = load(), A = require(path.join(ROOT, 'auth.js')), codes = [], welcomed = [];
  if (!opt.raw) A.setMailer(async (m) => { codes.push(m.code); });
  await S.boot({ listen: false });
  A.onRegister((u) => welcomed.push(u.uid)); // cuenta las bienvenidas (solo al verificar)
  await new Promise((r) => S._test.server.listen(0, r));
  const base = 'http://127.0.0.1:' + S._test.server.address().port;
  const call = async (method, url, body, token) => {
    const r = await fetch(base + '/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) });
    return { status: r.status, ...(await r.json()) };
  };
  return { S, A, codes, welcomed, post: (u, b, t) => call('POST', u, b, t), get: (u, t) => call('GET', u, null, t), stop: () => S._test.close() };
}
const EMAIL = 'ana.prueba@upc.edu.pe', PW = 'Clave-segura-9', NEW = 'Nueva-clave-77';
const reg = (o) => ({ name: 'Ana Prueba', email: EMAIL, password: PW, cond: 'estudiante', career: 'Ing. Civil', cycle: 5, campus: 'Monterrico', terms: true, ...o });
async function account(t) { const r = await t.post('/register', reg()); await t.post('/verify', { code: t.codes[t.codes.length - 1] }, r.token); return r; }
function clock() {
  const real = Date.now, base = Math.floor(real() / H) * H + H / 2;
  let off = 0; Date.now = () => base + off;
  return { tick: (ms) => { off += ms; }, stop: () => { Date.now = real; } };
}

test('R1 · cambiar la clave limpia el bloqueo de login por intentos fallidos', async () => {
  const t = await start(); await account(t);
  let last;
  for (let i = 0; i < 5; i++) last = await t.post('/login', { id: EMAIL, password: 'mala-clave-' + i });
  assert.equal(last.status, 429);
  assert.equal((await t.post('/login', { id: EMAIL, password: PW })).status, 429); // bloqueada aunque la clave sea buena
  await t.post('/recover', { email: EMAIL });
  assert.equal((await t.post('/recover/reset', { email: EMAIL, code: t.codes[t.codes.length - 1], password: NEW })).ok, true);
  assert.equal((await t.post('/login', { id: EMAIL, password: NEW })).status, 200); // antes daba 429
  await t.stop();
});

test('R2 · si el correo no sale, /recover responde ok y no quema el cooldown', async () => {
  const t = await start(); await account(t);
  let calls = 0;
  t.A.setMailer(async () => { calls++; throw new Error('proveedor caído'); });
  const err = console.error; console.error = () => {};
  try {
    const a = await t.post('/recover', { email: EMAIL });
    assert.equal(a.ok, true);
    await wait(80); // el envío ocurre después de responder; al fallar libera el cooldown
    const b = await t.post('/recover', { email: EMAIL });
    assert.equal(b.ok, true);
    await wait(80);
    assert.equal(calls, 2); // el segundo intento sí volvió a enviar
  } finally { console.error = err; await t.stop(); }
});

test('R3 · misma respuesta (cuerpo y status) exista o no el correo', async () => {
  const t = await start(); await account(t);
  const a = await t.post('/recover', { email: EMAIL }), b = await t.post('/recover', { email: 'nadie.existe@upc.edu.pe' });
  assert.equal(a.status, b.status); assert.deepEqual(a, b);
  await t.stop();
});

test('R4 · el correo de recuperación usa su propia plantilla (asunto y cuerpo)', async () => {
  const realFetch = global.fetch, calls = [], log = console.log;
  global.fetch = (u, o) => (String(u).startsWith('https://api.brevo.com/') ? (calls.push(JSON.parse(o.body)), Promise.resolve({ ok: true, status: 201 })) : realFetch(u, o));
  console.log = () => {};
  const t = await start({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'clave-falsa', EMAIL_FROM: 'U2U <no-reply@ejemplo.com>', EMAIL_DEV_MODE: 'false' }, { raw: true });
  try {
    const r = await t.post('/register', reg());
    await t.post('/verify', { code: /(\d{6})$/.exec(calls[0].subject)[1] }, r.token);
    assert.match(calls[0].htmlContent, /Si no creaste una cuenta/); // el de registro sigue igual
    await t.post('/recover', { email: EMAIL });
    await wait(80);
    const m = calls[calls.length - 1];
    assert.match(m.subject, /restablecer/); assert.match(m.htmlContent, /tu contraseña no cambia/);
    assert.doesNotMatch(m.htmlContent, /Si no creaste una cuenta/);
  } finally { global.fetch = realFetch; console.log = log; await t.stop(); }
});

test('R5 · quien recupera la clave queda verificado y recibe la bienvenida una vez', async () => {
  const t = await start();
  const r = await t.post('/register', reg()); // sin verificar
  assert.equal(r.user.verified, false);
  await t.post('/recover', { email: EMAIL });
  assert.equal((await t.post('/recover/reset', { email: EMAIL, code: t.codes[t.codes.length - 1], password: NEW })).ok, true);
  const l = await t.post('/login', { id: EMAIL, password: NEW });
  assert.equal(l.status, 200);
  assert.equal((await t.get('/me', l.token)).user.verified, true);
  assert.equal(t.welcomed.length, 1);
  await t.stop();
});

test('código incorrecto 5 veces: hay que pedir uno nuevo y el viejo ya no sirve', async () => {
  const c = clock(), t = await start(); await account(t);
  try {
    await t.post('/recover', { email: EMAIL });
    const old = t.codes[t.codes.length - 1], wrong = old === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) assert.equal((await t.post('/recover/reset', { email: EMAIL, code: wrong, password: NEW })).code, 'CODE_INVALID');
    assert.equal((await t.post('/recover/reset', { email: EMAIL, code: old, password: NEW })).code, 'CODE_INVALID'); // agotado: ni el bueno sirve
    c.tick(61e3); // pasa el cooldown de 60 s
    await t.post('/recover', { email: EMAIL });
    const fresh = t.codes[t.codes.length - 1];
    assert.notEqual(fresh, old);
    if (fresh !== old) assert.equal((await t.post('/recover/reset', { email: EMAIL, code: old, password: NEW })).code, 'CODE_INVALID');
    assert.equal((await t.post('/recover/reset', { email: EMAIL, code: fresh, password: NEW })).ok, true);
  } finally { c.stop(); await t.stop(); }
});

test('tras el reset el token y el secret anteriores dejan de funcionar', async () => {
  const t = await start(), r = await account(t);
  await t.post('/recover', { email: EMAIL });
  assert.equal((await t.post('/recover/reset', { email: EMAIL, code: t.codes[t.codes.length - 1], password: NEW })).ok, true);
  assert.equal((await t.get('/me', r.token)).status, 401);
  assert.equal(t.A.check(r.user.uid, r.user.secret), null);
  await t.stop();
});
