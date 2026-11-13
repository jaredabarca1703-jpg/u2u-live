/* Parte C · destacados: lógica de featured.js sin Express ni base de datos (productos y pedidos en memoria, reloj simulado). */
const test = require('node:test');
const assert = require('node:assert');
const opn = require('../opnumbers');
const createFees = require('../commission');
const createFeatured = require('../featured');

const DAY = 86400e3;
const ADMIN = { uid: 'u_admin', admin: true };
const PAID = { FEATURE_MODE: 'paid', YAPE_NUMBER: '900000000', YAPE_HOLDER: 'Test' };

function setup(env) {
  opn.rebuild([]);
  const products = new Map(), sent = [];
  let t = Date.UTC(2026, 10, 12, 12, 0, 0);
  const f = createFeatured({
    products, env: Object.assign({ FEATURE_MODE: 'free' }, env), now: () => t,
    saveProduct: async () => true, saveFeatured: async () => true,
    emitTo: (uid, ev, p) => sent.push([uid, ev, p]), broadcast: (ev, p) => sent.push(['*', ev, p]),
  });
  let n = 0;
  const product = (owner) => { const p = { id: 1000 + (++n), t: 'Cámara', ownerUid: owner, ownerName: 'Dueño', status: 'available' }; products.set(p.id, p); return p; };
  return { f, products, product, sent, t0: t, advance: (ms) => { t += ms; } };
}

test('un número de operación ya usado en una comisión se rechaza aquí, y rebuild() suma los de destacados sin borrar los de comisiones', async () => {
  const { f, product } = setup(PAID);
  const orders = new Map(), products = new Map([[1, { id: 1, status: 'reserved' }]]);
  const fees = createFees({ orders, products, env: { COMMISSION_MODE: 'active' }, saveOrder: async () => true, pushOrder() {}, setStatus: async () => true, emitTo() {}, isOfficial: () => false });
  orders.set('U2U-000001', { id: 'U2U-000001', pid: 1, t: 'Cámara', mode: 'compra', total: 110, del: 'meet', baseCents: 10000, status: 'pending', buyerId: 'b1', ownerId: 's1', ownerName: 'V', pin: '123456', fails: 0, lockedUntil: 0, ts: Date.now() });
  await fees.confirmDelivery('U2U-000001', 's1', '123456');
  assert.strictEqual((await fees.reportYape('s1', 'U2U-000001', { operationNumber: 'AB1234', senderName: 'Juan' })).status, 200);
  const p = product('s1'), req = await f.request({ uid: 's1' }, { pid: p.id });
  assert.ok(req.body.yape && req.body.featured.status === 'pending_payment'); // en paid devuelve los datos de Yape
  const r = await f.reportYape('s1', req.body.featured.id, { operationNumber: 'ab 1234', senderName: 'Juan Pérez' });
  assert.strictEqual(r.status, 400); assert.match(r.body.error, /ya fue usado/);
  f.rebuild([{ id: 'F1', pid: p.id, ownerUid: 's1', status: 'payment_reported', opNumber: 'ZZ9999', amount: 200, createdAt: 1 }]);
  assert.ok(opn.has('ZZ9999') && opn.has('AB1234'));
});

test('un no admin no aprueba; el admin sí, y la vigencia queda en ahora + 7 días', async () => {
  const { f, product, t0 } = setup();
  const p = product('s1'), id = (await f.request({ uid: 's1' }, { pid: p.id })).body.featured.id;
  assert.strictEqual((await f.approve({ uid: 's1' }, id)).status, 403);
  assert.strictEqual((await f.approve({ uid: 's2', admin: false }, id)).status, 403);
  assert.strictEqual((await f.approve(ADMIN, id)).status, 200);
  assert.strictEqual(p.featuredUntil, t0 + 7 * DAY);
});

test('no se supera MAX_FEATURED (FEATURE_FULL); renovar una ya vigente no ocupa cupo nuevo', async () => {
  const { f, product } = setup({ MAX_FEATURED: '2' });
  const a = product('s1'), b = product('s2'), c = product('s3');
  assert.strictEqual((await f.grant(ADMIN, a.id, {})).status, 200);
  assert.strictEqual((await f.grant(ADMIN, b.id, {})).status, 200);
  const id = (await f.request({ uid: 's3' }, { pid: c.id })).body.featured.id;
  const full = await f.approve(ADMIN, id);
  assert.strictEqual(full.body.code, 'FEATURE_FULL'); assert.ok(!c.featuredUntil);
  assert.strictEqual((await f.grant(ADMIN, a.id, { days: 3 })).status, 200); // renovar a (ya vigente) sí cabe
});

test('la vigencia se calcula por fecha (sin temporizadores), renovar suma días y las vigentes salen primero y estables en la hora', async () => {
  const { f, product, advance, products, t0 } = setup();
  const a = product('s1'), b = product('s2'), c = product('s3');
  await f.grant(ADMIN, a.id, {}); // vence a los 7 días
  advance(3 * DAY);
  const id = (await f.request({ uid: 's1' }, { pid: a.id })).body.featured.id; // renovación: se suma al vencimiento vigente
  await f.approve(ADMIN, id);
  assert.strictEqual(a.featuredUntil, t0 + 14 * DAY);
  await f.grant(ADMIN, c.id, {});
  const list = [...products.values()], o1 = f.order(list).map((x) => x.id);
  assert.deepStrictEqual(o1.slice(2), [b.id]); assert.deepStrictEqual(f.order(list.slice().reverse()).map((x) => x.id), o1); // vigentes primero, mismo orden en la misma hora
  advance(12 * DAY); // t0 + 15 días: a venció (por fecha); c (concedida a t0 + 3 días, 7 días) también
  assert.strictEqual(f.isFeatured(a), false); assert.strictEqual(f.countActive(), 0);
});

test('cancelar por eliminación marca refundDue solo si había dinero de por medio; vendida cancela las abiertas sin devolución', async () => {
  const { f, product, products } = setup(PAID);
  const a = product('s1'), b = product('s2');
  const ra = (await f.request({ uid: 's1' }, { pid: a.id })).body.featured.id;
  await f.reportYape('s1', ra, { operationNumber: 'PAG0001', senderName: 'Ana' });
  assert.strictEqual((await f.approve(ADMIN, ra)).status, 200); // pagó y fue aprobada
  const rb = (await f.request({ uid: 's2' }, { pid: b.id })).body.featured.id; // abierta, sin pagar
  products.delete(a.id); await f.onGone(a.id, 'deleted'); // eliminación (lo que hace removeProduct)
  b.status = 'sold'; await f.onGone(b.id, 'sold'); // vendida (lo que hace setStatus)
  const mine = (uid) => f.myFeatured(uid).body.items[0];
  assert.deepStrictEqual([mine('s1').status, mine('s1').refundDue], ['canceled', true]);
  assert.deepStrictEqual([mine('s2').status, mine('s2').refundDue, b.featuredUntil || 0], ['canceled', false, 0]);
  assert.strictEqual((await f.reportYape('s2', rb, { operationNumber: 'PAG0002', senderName: 'Beto' })).status, 409); // ya no admite pago
});
