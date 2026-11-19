/* Auditoría lote 1 · pruebas sin servidor ni base de datos: opnumbers.js, env.js y la guarda de db.js.
 * Se ejecuta con el resto: npm test (node --test). No necesita red ni PostgreSQL. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const run = (code, env) => spawnSync(process.execPath, ['-e', code], { cwd: root, env: Object.assign({ PATH: process.env.PATH }, env || {}), encoding: 'utf8' });

/* ---- opnumbers.js ---- */
test('opnumbers: claim, release, has y normalize siguen igual', () => {
  const op = require('../opnumbers'); op.rebuild();
  assert.strictEqual(op.claim(' ab 12 34 '), true);
  assert.strictEqual(op.claim('AB1234'), false);
  assert.strictEqual(op.claim('xx'), false);               // formato inválido
  assert.strictEqual(op.has('ab1234'), true);
  assert.strictEqual(op.release('AB1234'), true);
  assert.strictEqual(op.has('AB1234'), false);
  assert.strictEqual(op.normalize('12 345 678'), '12345678');
});
test('opnumbers: rebuild(lista) como antes y rebuild(a, b) une varias listas', () => {
  const op = require('../opnumbers');
  assert.strictEqual(op.rebuild(['AAAA1', 'BBBB2']), 2);
  assert.strictEqual(op.rebuild(['AAAA1'], ['BBBB2', 'CCCC3']), 3);
  assert.strictEqual(op.rebuild(), 0);
  op.rebuild(['AAAA1']); assert.strictEqual(op.add(['ZZZZ9']), 2);
});
test('opnumbers: claimPersist consulta la base; si ya existía, el número queda como usado', async () => {
  const op = require('../opnumbers'); op.rebuild();
  const base = new Set();
  op.setStore({ claim: async (n) => { if (base.has(n)) return false; base.add(n); return true; }, release: async (n) => { base.delete(n); } });
  assert.strictEqual(await op.claimPersist('MMMM02', 'fee', 'o1'), true);
  op.rebuild();                                                    // otra instancia o reinicio: la RAM no lo sabe
  assert.strictEqual(await op.claimPersist('MMMM02', 'fee', 'o2'), false);
  assert.strictEqual(op.has('MMMM02'), true);
  await op.releasePersist('MMMM02'); assert.ok(!base.has('MMMM02'));
  op.setStore({ claim: async () => { throw new Error('base caída'); }, release: async () => {} });
  await assert.rejects(op.claimPersist('PPPP03'), /base caída/);
  assert.strictEqual(op.has('PPPP03'), false);                     // si la base falla, el número queda libre
  op.setStore(null);
});
test('opnumbers: dos claimPersist simultáneos del mismo número → solo uno gana', async () => {
  const op = require('../opnumbers'); op.rebuild();
  const r = await Promise.all([op.claimPersist('SAME11'), op.claimPersist('SAME11')]);
  assert.deepStrictEqual(r.slice().sort(), [false, true]);
});

/* ---- env.js: validate() ---- */
const val = (env) => run("const v=require('./env').validate({quiet:true});console.log(JSON.stringify(v.warnings)+'||'+v.summary)", env).stdout;
test('env.validate: valores numéricos y opciones inválidos se avisan', () => {
  const o = val({ PUB_LIMIT_USER: 'diez', COMMISSION_MODE: 'activo', COMMISSION_RATE: '3' });
  assert.match(o, /PUB_LIMIT_USER/); assert.match(o, /COMMISSION_MODE=/); assert.match(o, /COMMISSION_RATE/);
});
test('env.validate: producción sin correo configurado avisa que los códigos saldrán en el log', () => {
  assert.match(val({ RENDER: 'true', NODE_ENV: 'production', ADMIN_USER: 'a', ADMIN_PASS: '0123456789' }), /SALDRÁN EN EL LOG/);
  assert.doesNotMatch(val({ RENDER: 'true', NODE_ENV: 'production', ADMIN_USER: 'a', ADMIN_PASS: '0123456789', EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'k', EMAIL_FROM: 'x@y.z' }), /SALDRÁN/);
});
test('env.validate: el resumen nunca contiene valores secretos', () => {
  const o = val({ ADMIN_PASS: 'SuperSecreta999', BREVO_API_KEY: 'brevo-xyz', DATABASE_URL: 'postgresql://u:pw123@h/db', YAPE_NUMBER: '999111222' });
  assert.doesNotMatch(o, /SuperSecreta999|brevo-xyz|pw123|999111222/); assert.match(o, /ADMIN_PASS=sí/);
});
test('env.validate: STRICT_ENV=true convierte los avisos en error; sin él nunca lanza', () => {
  const code = "try{require('./env').validate({quiet:true});console.log('SIN ERROR')}catch(e){console.log('ERROR')}";
  assert.match(run(code, { STRICT_ENV: 'true', PUB_LIMIT_USER: 'x' }).stdout, /ERROR/);
  assert.match(run(code, { PUB_LIMIT_USER: 'x' }).stdout, /SIN ERROR/);
});

/* ---- db.js: guarda del modo archivos ---- */
const dbInit = (env) => run("const db=require('./db');db.init().then(()=>{console.log('ARRANCO '+db.mode);process.exit(0)},e=>{console.log('ERROR '+e.message.slice(0,40));process.exit(3)})", env).stdout;
test('db: sin DATABASE_URL en producción NO arranca en modo archivos', () => {
  assert.match(dbInit({ NODE_ENV: 'production' }), /ERROR Falta DATABASE_URL/);
  assert.match(dbInit({ RENDER: 'true' }), /ERROR Falta DATABASE_URL/);
});
test('db: con DATA_DIR, con ALLOW_FILE_DB=1 o en desarrollo sí arranca en modo archivos', () => {
  const d = path.join(os.tmpdir(), 'u2u-lote1-' + process.pid);
  assert.match(dbInit({ NODE_ENV: 'production', DATA_DIR: d }), /ARRANCO file/);
  assert.match(dbInit({ RENDER: 'true', ALLOW_FILE_DB: '1', DATA_DIR: d + '-b' }), /ARRANCO file/);
  assert.match(dbInit({ DATA_DIR: d + '-c' }), /ARRANCO file/);
});
require('node:test').after(() => setTimeout(() => process.exit(0), 100));
