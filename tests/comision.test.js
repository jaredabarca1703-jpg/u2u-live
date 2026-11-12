/* Parte A · comisión del 3 %: lógica de commission.js sin Express ni base de datos (pedidos en memoria). */
const test = require('node:test');
const assert = require('node:assert');
const opn = require('../opnumbers');
const create = require('../commission');

function setup(env) {
  opn.rebuild([]);
  const orders = new Map(), products = new Map(), sent = [];
  const fees = create({
    orders, products, env: Object.assign({ COMMISSION_MODE: 'active' }, env),
    saveOrder: async () => true, pushOrder() {}, setStatus: async (p, s) => { p.status = s; return true; },
    emitTo: (uid, ev, payload) => sent.push([uid, ev, payload]),
  });
  let n = 0;
  const order = (seller, baseSoles) => { // pedido pendiente: total = precio + S/ 10 de «protección»; la comisión solo mira el precio
    const id = 'U2U-00000' + (++n);
    products.set(n, { id: n, status: 'reserved' });
    const o = { id, pid: n, t: 'Cámara', mode: 'compra', total: baseSoles + 10, del: 'meet', baseCents: Math.round(baseSoles * 100), status: 'pending', buyerId: 'b1', ownerId: seller, ownerName: 'Vendedor', pin: '123456', fails: 0, lockedUntil: 0, ts: Date.now() };
    orders.set(id, o); return o;
  };
  return { fees, orders, products, sent, order };
}
const ADMIN = { uid: 'u_admin', admin: true };

test('el 3 % redondea al céntimo y no cuenta la protección: S/ 33.33 → 100; S/ 1.00 → 3; S/ 200 → 600', async () => {
  const { fees, order } = setup();
  assert.strictEqual(fees.feeCents(3333, 0.03), 100);
  assert.strictEqual(fees.feeCents(100, 0.03), 3);
  const o = order('s1', 200);
  const r = await fees.confirmDelivery(o.id, 's1', '123456');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(o.commission.amount, 600); // 3 % de S/ 200, no de S/ 210
  assert.strictEqual(o.commission.status, 'pending_commission');
});

test('código incorrecto no crea comisión; confirmar dos veces no la duplica; quien no es el vendedor no confirma', async () => {
  const { fees, orders, order } = setup();
  const o = order('s1', 100);
  const bad = await fees.confirmDelivery(o.id, 's1', '000000');
  assert.strictEqual(bad.code, 'CODE_INVALID'); assert.strictEqual(o.commission, undefined);
  assert.strictEqual((await fees.confirmDelivery(o.id, 'otro', '123456')).code, 'NOT_FOUND');
  const [a, b] = await Promise.all([fees.confirmDelivery(o.id, 's1', '123456'), fees.confirmDelivery(o.id, 's1', '123456')]); // doble clic
  assert.ok(a.ok && b.ok);
  assert.strictEqual((await fees.confirmDelivery(o.id, 's1', '123456')).already, true);
  assert.strictEqual([...orders.values()].filter((x) => x.commission).length, 1);
});

test('un número de operación repetido se rechaza; un no admin no aprueba; el admin sí', async () => {
  const { fees, order } = setup();
  const a = order('s1', 100), b = order('s2', 100);
  await fees.confirmDelivery(a.id, 's1', '123456'); await fees.confirmDelivery(b.id, 's2', '123456');
  const r1 = await fees.reportYape('s1', a.id, { operationNumber: 'ab 1234', senderName: 'Juan Pérez' });
  assert.strictEqual(r1.status, 200);
  const r2 = await fees.reportYape('s2', b.id, { operationNumber: 'AB1234', senderName: 'Ana' });
  assert.strictEqual(r2.status, 400); assert.match(r2.body.error, /ya fue usado/);
  assert.strictEqual((await fees.adminAct('approve', { uid: 's1' }, a.id)).status, 403);
  assert.strictEqual((await fees.adminAct('approve', ADMIN, a.id)).body.status, 'completed');
});

test('active: el vendedor queda sin escribir hasta que el admin aprueba (salvo a la cuenta oficial); shadow y off no restringen', async () => {
  const { fees, order, sent } = setup();
  const o = order('s1', 100);
  await fees.confirmDelivery(o.id, 's1', '123456');
  assert.strictEqual(fees.canMessage('s1'), false);
  assert.strictEqual(fees.restrict('s1', { action: 'message', toOfficial: false, chatExists: true }).code, 'FEE_DUE');
  assert.strictEqual(fees.restrict('s1', { action: 'message', toOfficial: true }), null);
  assert.strictEqual(fees.due('s1'), 3 * 100); // S/ 100 → 300 céntimos
  assert.ok(sent.some((e) => e[1] === 'commission' && e[0] === 's1'));
  await fees.reportYape('s1', o.id, { operationNumber: 'XY9876', senderName: 'Juan' });
  assert.strictEqual(fees.canMessage('s1'), false); // reportada no basta: falta la aprobación
  await fees.adminAct('approve', ADMIN, o.id);
  assert.strictEqual(fees.canMessage('s1'), true);
  for (const mode of ['shadow', 'off']) {
    const t = setup({ COMMISSION_MODE: mode }), p = t.order('s1', 100);
    await t.fees.confirmDelivery(p.id, 's1', '123456');
    assert.strictEqual(t.fees.canMessage('s1'), true); assert.strictEqual(t.fees.restrict('s1', { action: 'message' }), null);
    assert.strictEqual(mode === 'shadow' ? p.commission.status : p.commission, mode === 'shadow' ? 'shadow' : undefined);
  }
});

test('scope=new: responde en chats abiertos pero no abre chats nuevos, ni publica ni reserva; rechazar devuelve el motivo; los números rechazados siguen bloqueados', async () => {
  const { fees, order } = setup({ COMMISSION_BLOCK_SCOPE: 'new' });
  const o = order('s1', 50);
  await fees.confirmDelivery(o.id, 's1', '123456');
  assert.strictEqual(fees.restrict('s1', { action: 'message', chatExists: true }), null);
  assert.strictEqual(fees.restrict('s1', { action: 'message', chatExists: false }).code, 'FEE_DUE');
  assert.strictEqual(fees.restrict('s1', { action: 'publish' }).code, 'FEE_DUE');
  assert.strictEqual(fees.restrict('s1', { action: 'order' }).code, 'FEE_DUE');
  await fees.reportYape('s1', o.id, { operationNumber: 'ZZ1111', senderName: 'Juan' });
  await fees.adminAct('reject', ADMIN, o.id, { reason: 'No llegó el pago' });
  assert.strictEqual(o.commission.status, 'rejected'); assert.strictEqual(o.commission.rejectReason, 'No llegó el pago');
  const again = await fees.reportYape('s1', o.id, { operationNumber: 'zz1111', senderName: 'Juan' });
  assert.match(again.body.error, /ya fue usado/);
});
