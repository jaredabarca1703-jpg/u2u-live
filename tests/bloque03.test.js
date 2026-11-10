/* Bloque 3 · protección de datos (modo archivos: sin DATABASE_URL, DATA_DIR temporal) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const sep = path.sep;

// Carga el servidor desde cero (como un reinicio): limpia la caché de módulos del proyecto
function load() {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(ROOT) && !k.includes(sep + 'node_modules' + sep) && !k.includes(sep + 'tests' + sep)) delete require.cache[k];
  }
  return require(path.join(ROOT, 'server.js'));
}
function setup(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u2u-b3-'));
  delete process.env.DATABASE_URL; delete process.env.ADMIN_USER; delete process.env.ADMIN_PASS;
  delete process.env.PUB_LIMIT_USER; delete process.env.STORAGE_LIMIT_MB;
  Object.assign(process.env, { DATA_DIR: dir }, env || {});
  return dir;
}
const item = (n) => ({ t: 'Calculadora ' + n, ph: ['cam'], mode: 'venta', price: 50 + n, cat: 'Calculadoras', cond: 'Usado', desc: 'prueba ' + n });
const user = (uid) => ({ uid, name: 'Usuario ' + uid, admin: false });

test('60 publicaciones con 3 cuentas no se borran y sobreviven a un reinicio', async () => {
  setup({ PUB_LIMIT_USER: '20' }); // 3 cuentas x 20 = 60 (el tope por defecto es 10)
  let S = load();
  await S.boot({ listen: false });
  for (const uid of ['u_a', 'u_b', 'u_c']) {
    for (let i = 0; i < 20; i++) assert.equal((await S._test.publish(user(uid), item(i))).res.ok, true);
  }
  assert.equal(S._test.products.size, 60); // nada se descartó (antes el tope era 50)
  await S._test.close();
  S = load(); // reinicio
  await S.boot({ listen: false });
  assert.equal(S._test.products.size, 60);
  await S._test.close();
});

test('tope por usuario (10): rechaza la 11 con PUB_LIMIT, libera al vender y el admin está exento', async () => {
  setup();
  const S = load();
  await S.boot({ listen: false });
  for (let i = 0; i < 10; i++) assert.equal((await S._test.publish(user('u_a'), item(i))).res.ok, true);
  const r = (await S._test.publish(user('u_a'), item(10))).res;
  assert.equal(r.code, 'PUB_LIMIT');
  const first = [...S._test.products.values()][0];
  first.status = 'sold'; // las vendidas no cuentan
  assert.equal((await S._test.publish(user('u_a'), item(11))).res.ok, true);
  assert.equal((await S._test.publish({ uid: 'u_admin', name: 'Oficial', admin: true }, item(12))).res.ok, true);
  await S._test.close();
});

test('espacio lleno: rechaza lo nuevo con STORAGE_FULL y no borra nada', async () => {
  setup();
  const S = load();
  await S.boot({ listen: false });
  await S._test.publish(user('u_a'), item(1));
  S._test.setStorageMb(401);
  assert.equal((await S._test.publish(user('u_b'), item(2))).res.code, 'STORAGE_FULL');
  assert.equal(S._test.products.size, 1);
  await S._test.close();
});
