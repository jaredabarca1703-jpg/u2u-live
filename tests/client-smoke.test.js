/* U2U · prueba de arranque del cliente (jsdom, sin puppeteer).
 * Carga index.html y los scripts public/js/*.js EN EL ORDEN en que los pide el HTML, como scripts clásicos
 * que comparten el mismo ámbito global (igual que en el navegador), y comprueba que arrancan sin errores. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const PUB = fs.existsSync(path.join(ROOT, 'public', 'index.html')) ? path.join(ROOT, 'public') : ROOT;
const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');

// scripts locales, en el orden del HTML (se ignoran CDN y /socket.io)
const local = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)]
  .map((m) => m[1].split('?')[0])
  .filter((s) => !/^(https?:)?\/\//.test(s) && !s.startsWith('/'));

test('index.html carga los módulos js/ en orden y existen', () => {
  assert.ok(local.length >= 2, 'se esperaban varios scripts locales');
  assert.ok(local.every((s) => /^js\/\d\d-[\w-]+\.js$/.test(s)), 'scripts fuera de js/NN-nombre.js: ' + local.join(', '));
  assert.deepStrictEqual(local, [...local].sort());
  local.forEach((s) => assert.ok(fs.existsSync(path.join(PUB, s)), 'falta ' + s));
});

test('cada módulo es un script clásico válido (sin import/export)', () => {
  for (const s of local) {
    const code = fs.readFileSync(path.join(PUB, s), 'utf8');
    assert.doesNotThrow(() => new vm.Script(code, { filename: s }), s);
  }
});

test('el cliente arranca en jsdom sin errores y deja LV y la pantalla de login', (t) => {
  const page = html.replace(/<script[\s\S]*?<\/script>/g, ''); // sin CDN: nada de red
  const dom = new JSDOM(page, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.lucide = { createIcons() {} }; // lo que define el <script> en línea de index.html
  const ctx = dom.getInternalVMContext();
  const run = (code, name) => new vm.Script(code, { filename: name }).runInContext(ctx);

  for (const s of local) assert.doesNotThrow(() => run(fs.readFileSync(path.join(PUB, s), 'utf8'), s), s);

  assert.strictEqual(run('typeof LV', 'probe'), 'object');   // LV es const global: no cuelga de window, se lee en el ámbito global
  assert.strictEqual(typeof w.nav, 'function');              // funciones globales que usan los onclick en línea
  assert.strictEqual(typeof w.openP, 'function');
  assert.ok(w.document.querySelector('#v').innerHTML.length > 100, 'la pantalla inicial no se pintó');
});
