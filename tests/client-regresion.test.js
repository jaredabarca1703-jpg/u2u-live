/* v8.7.5 · regresión del cliente (jsdom): esc con comilla simple y fd con la fecha local de Lima */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public');
const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const local = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1].split('?')[0]).filter((s) => !/^(https?:)?\/\//.test(s) && !s.startsWith('/'));

function boot(t) {
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ''), { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  dom.window.lucide = { createIcons() {} };
  const ctx = dom.getInternalVMContext(), run = (code, name) => new vm.Script(code, { filename: name || 'probe' }).runInContext(ctx);
  for (const s of local) run(fs.readFileSync(path.join(PUB, s), 'utf8'), s);
  return run;
}

test('esc escapa también la comilla simple', (t) => {
  const run = boot(t);
  assert.strictEqual(run(`esc("it's <b>\\"x\\"</b> & co")`), 'it&#39;s &lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; co');
});

test('fd usa la fecha LOCAL: a las 21:00 en Lima sigue siendo «hoy» (con UTC daba mañana)', (t) => {
  const prevTZ = process.env.TZ; process.env.TZ = 'America/Lima';
  t.after(() => { if (prevTZ === undefined) delete process.env.TZ; else process.env.TZ = prevTZ; });
  const run = boot(t);
  run(`globalThis.__RD = Date; Date = class extends __RD { constructor(...a) { a.length ? super(...a) : super(Date.UTC(2026, 10, 16, 2, 0, 0)); } }`); // 15-nov-2026 21:00 en Lima = 16-nov 02:00 UTC
  assert.strictEqual(run('fd(0)'), '2026-11-15');
  assert.strictEqual(run('fd(1)'), '2026-11-16');
  assert.strictEqual(run('fd(3)'), '2026-11-18');
});

test('profile() no revienta sin sesión (uname() vacío)', (t) => {
  const run = boot(t);
  assert.doesNotThrow(() => run('V.profile()'));
});
