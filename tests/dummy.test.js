/* U2U · prueba minima: confirma que el runner de tests corre */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('el runner de pruebas funciona', () => {
  assert.strictEqual(1 + 1, 2);
});

test('Node es 18 o mayor', () => {
  assert.ok(parseInt(process.versions.node.split('.')[0], 10) >= 18);
});

test('package.json define test y check como se espera', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.strictEqual(pkg.scripts.test, 'node --test');
  assert.strictEqual(pkg.scripts.check, 'node scripts/check-all.js');
});
