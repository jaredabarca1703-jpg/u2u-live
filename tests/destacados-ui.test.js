/* Parte D · pruebas de la interfaz de destacados (node:test, sin navegador: el script real corre en un contexto simulado) */
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function boot() {
  const handlers = {}, calls = [], shown = [], errs = {};
  const ctx = vm.createContext({ console, setInterval: () => 0, Date, Math, Promise, encodeURIComponent, Object, Array, String, Number, RegExp });
  ctx.window = ctx; ctx.calls = calls; ctx.shown = shown; ctx.errs = errs;
  ctx.document = {
    addEventListener: (t, f) => { handlers[t] = f; },
    querySelectorAll: () => [{ dataset: {}, set textContent(v) { } }],
    getElementById: () => null,
  };
  ctx.handlers = handlers;
  vm.runInContext(`
    var sock = null; const ME = 0, SEL = [{}], PR = []; let PT = 'pub';
    let S = { s: 'home', a: null }, F = { sort: 'd', q: '' }, LV = { me: { uid: 'u1' }, adm: false };
    const sol = n => 'S/ ' + n, esc = s => String(s), $ = () => null, tkGet = () => 'tok', pic = () => '', empty = () => '', skRows = () => '', hd = t => t;
    const P = id => PR.find(p => p.id == id);
    function api(p, b) { calls.push([p, b]); return Promise.resolve({ ok: true, status: 200, j: { ok: true, featured: { id: 'F1', pid: 101, status: 'payment_reported', until: 0, createdAt: 5 } } }); }
    function M(h) { shown.push(h); } function X() {} function toast() {} function R() {} function gridR() {} function nav() {} function refreshCatalog() {}
    function askConfirm() { return Promise.resolve(false); } function sessionOut() {}
    function addRemote(d) { return false; } function onProducts(l) {} function authOk() {}
    let AT = 'open';
    const V = { admin: () => '<div class="sticky">H</div><div class="p-5 pb-28"><div class="grid grid-cols-5 bg-slate-100 rounded-xl p-1 text-[11px] font-semibold mb-4"><button>Pendientes</button><button data-com="tab">Comisiones</button></div>BODY</div>' };
  `, ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', '14-destacados.js'), 'utf8'), ctx);
  return { ctx, handlers, calls, shown, run: (c) => vm.runInContext(c, ctx) };
}

test('orden: destacadas vigentes primero, con el orden del servidor; sin efecto si está apagado, hay búsqueda u otro orden', () => {
  const t = boot();
  t.run(`DF.state.cfg = { mode: 'free', days: 7 }; DF.state.rank = { 1: 0, 2: 1, 3: 2 };`);
  const r = t.run(`[
    featCmp({ id: 2, featured: true, fUntil: Date.now() + 1e6 }, { id: 3 }),
    featCmp({ id: 3 }, { id: 1, featured: true, fUntil: Date.now() + 1e6 }),
    featCmp({ id: 2, featured: true, fUntil: Date.now() + 1e6 }, { id: 1, featured: true, fUntil: Date.now() + 1e6 }),
    featCmp({ id: 2, featured: true, fUntil: Date.now() - 1 }, { id: 3 }),
    (F.sort = 'p', featCmp({ id: 2, featured: true }, { id: 3 })),
    (F.sort = 'd', F.q = 'dron', featCmp({ id: 2, featured: true }, { id: 3 })),
    (F.q = '', DF.state.cfg.mode = 'off', featCmp({ id: 2, featured: true }, { id: 3 }))
  ]`);
  assert.deepStrictEqual([...r], [-1, 1, 1, 0, 0, 0, 0]);
});

test('el catálogo toma featured y featuredUntil del servidor', () => {
  const t = boot();
  t.run(`PR.push({ id: 7, s: 1 }); addRemote({ id: 7, featured: true, featuredUntil: Date.now() + 5e5 });`);
  assert.strictEqual(t.run(`DF.fOn(P(7))`), true);
  t.run(`addRemote({ id: 7 });`);
  assert.strictEqual(t.run(`DF.fOn(P(7))`), false);
});

test('pago: valida en el cliente sin llamar al servidor y no permite doble envío', async () => {
  const t = boot();
  t.run(`DF.state.cfg = { mode: 'paid', price: 200, days: 7 }; DF.state.yape = { number: '999000111', holder: 'U2U' };
    DF.state.mine[101] = { id: 'F1', pid: 101, status: 'pending_payment', createdAt: 1, until: 0 };`);
  const click = (data) => t.handlers.click({ target: { closest: (s) => (s === '[data-df]' ? { dataset: data } : null) }, stopPropagation() {}, preventDefault() {} });
  click({ df: 'open', pid: '101' });
  assert.ok(/Copiar número/.test(t.shown[t.shown.length - 1]) && /999000111/.test(t.shown[t.shown.length - 1]));
  click({ df: 'send' }); // campos vacíos
  assert.strictEqual(t.calls.length, 0);
  t.handlers.input({ target: { dataset: { dff: 'op' }, value: 'ab 12 cd' } });
  t.handlers.input({ target: { dataset: { dff: 'nm' }, value: 'Ana' } });
  click({ df: 'send' }); click({ df: 'send' }); // doble clic
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(t.calls.length, 1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(t.calls[0])), ['featured/F1/report-yape', { operationNumber: 'AB12CD', senderName: 'Ana' }]);
});

test('con FEATURE_MODE=off la ventana no se abre', () => {
  const t = boot();
  t.run(`DF.state.cfg = { mode: 'off' };`);
  t.handlers.click({ target: { closest: () => ({ dataset: { df: 'open', pid: '101' } }) }, stopPropagation() {}, preventDefault() {} });
  assert.strictEqual(t.shown.length, 0);
});

test('panel admin: «Destacados» se suma a la barra de pestañas (junto a Comisiones) y solo con el modo encendido', () => {
  const t = boot();
  t.run(`LV.adm = true; DF.state.cfg = { mode: 'free' };`);
  const a = t.run(`V.admin()`);
  assert.ok(/grid-cols-6/.test(a) && /Comisiones/.test(a) && />Destacados</.test(a) && /BODY/.test(a));
  const b = t.run(`AT = 'feat'; V.admin()`);
  assert.ok(/data-df="refresh"/.test(b) && !/BODY/.test(b));
  assert.ok(!/Destacados/.test(t.run(`DF.state.cfg = { mode: 'off' }; AT = 'open'; V.admin()`)));
});
