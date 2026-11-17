/* v8.7.5+ · presencia enriquecida y sala grupal «Plaza UPC» (modo archivos, HTTP y Socket.io reales) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ENV_KEYS = ['DATABASE_URL', 'ADMIN_USER', 'ADMIN_PASS', 'EMAIL_PROVIDER', 'BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_DEV_MODE', 'EMAIL_DAILY_LIMIT', 'EMAIL_IP_PER_HOUR', 'REGISTRO_MANUAL'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const IMG = 'data:image/png;base64,iVBORw0KGgo=';
const item = (o) => ({ t: 'Calculadora Casio', ph: [IMG], mode: 'venta', price: 80, cat: 'Calculadoras', cond: 'Usado', desc: 'prueba', ...o });

function load() {
  for (const k of Object.keys(require.cache)) if (k.startsWith(ROOT) && !k.includes(path.sep + 'node_modules' + path.sep) && !k.includes(path.sep + 'tests' + path.sep)) delete require.cache[k];
  return require(path.join(ROOT, 'server.js'));
}
async function start(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u2u-pz-'));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, { DATA_DIR: dir }, env || {});
  const S = load(), A = require(path.join(ROOT, 'auth.js')), codes = [];
  A.setMailer(async (m) => { codes.push(m.code); });
  await S.boot({ listen: false });
  await new Promise((r) => S._test.server.listen(0, r));
  const base = 'http://127.0.0.1:' + S._test.server.address().port;
  const post = async (url, body, token) => { const r = await fetch(base + '/api' + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, ...(await r.json()) }; };
  const account = async (n, verify = true, extra) => {
    const r = await post('/register', { name: 'Persona ' + 'abcdefghij'[n % 10] + 'xyz'[n % 3] + n, email: 'plaza' + n + '@upc.edu.pe', password: 'Clave-segura-9', cond: 'estudiante', career: 'Ing. Civil', cycle: 5, campus: 'Villa', terms: true, visibility: { career: true, campus: true }, ...extra });
    assert.equal(r.status, 201);
    if (verify) assert.equal((await post('/verify', { code: codes[codes.length - 1] }, r.token)).verified, true);
    return { uid: r.user.uid, secret: r.user.secret, token: r.token, name: r.user.name };
  };
  return { S, base, post, account, stop: () => S._test.close() };
}
function sio(base) { // cliente Socket.io mínimo que además guarda los eventos recibidos
  return new Promise((ok, no) => {
    const ws = new WebSocket(base.replace('http', 'ws') + '/socket.io/?EIO=4&transport=websocket'), acks = new Map(), events = [];
    let n = 0;
    ws.onerror = () => no(new Error('ws'));
    ws.onmessage = (ev) => {
      const m = String(ev.data);
      if (m === '2') return ws.send('3');
      if (m[0] === '0') return ws.send('40');
      if (m.startsWith('40')) return ok({
        events, send: (name, data) => ws.send('42' + JSON.stringify([name, data])),
        emit: (name, data) => new Promise((r) => { const id = ++n; acks.set(id, r); ws.send('42' + id + JSON.stringify([name, data])); }),
        last: (name) => { const e = events.filter((x) => x[0] === name); return e.length ? e[e.length - 1][1] : undefined; },
        close: () => ws.close(),
      });
      const a = /^43(\d+)([\s\S]*)$/.exec(m);
      if (a && acks.has(+a[1])) { acks.get(+a[1])(JSON.parse(a[2])[0]); acks.delete(+a[1]); return; }
      if (m.startsWith('42') && !/^42\d/.test(m)) { try { events.push(JSON.parse(m.slice(2))); } catch (e) { /* ignorar */ } }
    };
  });
}

test('presence: lista deduplicada de conectados con productos, sin datos privados', async () => {
  const t = await start(), a = await t.account(1), b = await t.account(2);
  const pub = (await t.S._test.publish({ uid: a.uid, name: a.name, admin: false }, item({ t: 'Taladro Bosch', mode: 'ambos', rent: 10 }))).res;
  const s1 = await sio(t.base), s1b = await sio(t.base), s2 = await sio(t.base);
  s1.send('join', { uid: a.uid, secret: a.secret }); s1b.send('join', { uid: a.uid, secret: a.secret }); s2.send('join', { uid: b.uid, secret: b.secret });
  await wait(1500);
  const p = s2.last('presence');
  assert.equal(p.total, 2); assert.equal(p.users.length, 2); // a con dos pestañas cuenta una vez
  const ua = p.users.find((u) => u.uid === a.uid);
  assert.equal(ua.activeCount, 1); assert.equal(ua.sampleProducts[0].id, pub.id);
  assert.match(ua.sampleProducts[0].ph, /^\/foto\//); // URL, nunca base64 en el aviso
  assert.equal(ua.campus, 'Villa'); assert.equal(ua.cp, 2); assert.equal(ua.career, 'Ing. Civil'); assert.equal(ua.verified, true);
  assert.ok(!/@upc|email|secret|password/i.test(JSON.stringify(p)), 'el aviso no debe contener datos privados');
  // al eliminar la publicación, el aviso se actualiza
  await t.S._test.removeProduct(pub.id); await wait(1400);
  assert.equal(s2.last('presence').users.find((u) => u.uid === a.uid).activeCount, 0);
  [s1, s1b, s2].forEach((s) => s.close()); await t.stop();
});

test('lobby: enviar, adjuntar producto propio, límite de frecuencia, verificación e historial', async () => {
  const t = await start(), a = await t.account(11), b = await t.account(12), nv = await t.account(13, false);
  const mine = (await t.S._test.publish({ uid: a.uid, name: a.name, admin: false }, item({ t: 'Mi calculadora' }))).res;
  const other = (await t.S._test.publish({ uid: b.uid, name: b.name, admin: false }, item({ t: 'De otro' }))).res;
  const sa = await sio(t.base), sb = await sio(t.base), sn = await sio(t.base);
  sa.send('join', { uid: a.uid, secret: a.secret }); sb.send('join', { uid: b.uid, secret: b.secret }); sn.send('join', { uid: nv.uid, secret: nv.secret });
  await wait(300);
  assert.equal((await sn.emit('lobby:send', { text: 'hola' })).code, 'NOT_VERIFIED');
  const r1 = await sa.emit('lobby:send', { text: 'Hola a todos 👋', pid: mine.id });
  assert.equal(r1.ok, true); assert.equal(r1.msg.product.id, mine.id); assert.equal(r1.msg.product.t, 'Mi calculadora'); assert.match(r1.msg.product.ph, /^\/foto\//);
  assert.equal((await sa.emit('lobby:send', { text: 'otra vez' })).code, 'RATE_LIMIT'); // 1 mensaje cada 2 s
  await wait(2100);
  assert.match((await sa.emit('lobby:send', { text: 'x', pid: other.id })).error, /no está disponible/); // producto ajeno
  assert.ok((await sa.emit('lobby:send', { text: 'y'.repeat(241) })).error);
  assert.ok((await sa.emit('lobby:send', { text: '   ' })).error);
  await wait(50);
  assert.equal(sb.last('lobby:msg').id, r1.msg.id); // el resto lo recibe en vivo
  const h = await sb.emit('lobby:history', {});
  assert.equal(h.ok, true); assert.equal(h.list.length, 1);
  [sa, sb, sn].forEach((s) => s.close()); await t.stop();
});

test('lobby: solo un admin puede borrar mensajes', async () => {
  const t = await start({ ADMIN_USER: 'admin_test', ADMIN_PASS: 'clave-admin-123456' }), a = await t.account(21);
  const ad = await t.post('/login', { id: 'admin_test', password: 'clave-admin-123456' });
  const sa = await sio(t.base), sad = await sio(t.base);
  sa.send('join', { uid: a.uid, secret: a.secret }); sad.send('join', { uid: ad.user.uid, secret: ad.user.secret }); await wait(300);
  const r = await sa.emit('lobby:send', { text: 'mensaje a borrar' });
  assert.equal(r.ok, true);
  assert.ok((await sa.emit('lobby:delete', { id: r.msg.id })).error); // usuario normal: no
  assert.equal((await sad.emit('lobby:delete', { id: r.msg.id })).ok, true);
  await wait(50); assert.equal(sa.last('lobby:deleted').id, r.msg.id);
  assert.equal((await sa.emit('lobby:history', {})).list.length, 0);
  [sa, sad].forEach((s) => s.close()); await t.stop();
});
