/* U2U · capa de datos
 *  - Con DATABASE_URL (variable de entorno) usa PostgreSQL (Neon). Las tablas se crean solas al iniciar.
 *  - Sin DATABASE_URL guarda en archivos JSON en data/ (o DATA_DIR): ideal para probar en tu computadora.
 *  - El servidor trabaja con los datos en memoria y los escribe aquí en segundo plano (cola con reintentos);
 *    al iniciar los vuelve a cargar. Las consultas son siempre parametrizadas.
 *  - La cuenta admin (ADMIN_USER / ADMIN_PASS) NUNCA se guarda aquí: vive solo en memoria (ver auth.js).
 *  - v8.6.3 (bloque 3): put({sync:true}) también garantiza escritura inmediata en modo archivos, y las tablas
 *    con datos de la comunidad (products, orders, convs, reviews, reports, removed) NO admiten del():
 *    se marcan con put({deleted_at, ...}). El aviso de espacio lo da server.js (STORAGE_LIMIT_MB).
 */
const fs = require('fs');
const path = require('path');

const DB_URL = String(process.env.DATABASE_URL || '').trim();
const MODE = DB_URL ? 'pg' : 'file';
const DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

/* tabla -> columna clave, columnas indexadas (tipo, extractor), índices únicos y normales */
const T = {
  users: { kt: 'text', cols: { username_lc: ['text', (d) => d.username.toLowerCase()], email: ['text', (d) => d.email] }, uniq: [['username_lc'], ['email']] },
  sessions: { kt: 'text', cols: { uid: ['text', (d) => d.uid], exp: ['bigint', (d) => d.exp] }, idx: ['uid'] },
  products: { kt: 'bigint', cols: { owner_uid: ['text', (d) => d.ownerUid], ts: ['bigint', (d) => d.ts] }, idx: ['owner_uid'] },
  orders: { kt: 'text', cols: { buyer_id: ['text', (d) => d.buyerId], owner_id: ['text', (d) => d.ownerId], status: ['text', (d) => d.status], ts: ['bigint', (d) => d.ts] }, idx: ['buyer_id', 'owner_id'] },
  reports: { kt: 'text', cols: { pid: ['bigint', (d) => d.pid], reporter_uid: ['text', (d) => d.reporterUid], ts: ['bigint', (d) => d.ts] }, uniq: [['pid', 'reporter_uid']] },
  reviews: { kt: 'text', cols: { order_id: ['text', (d) => d.orderId], seller_uid: ['text', (d) => d.sellerUid], ts: ['bigint', (d) => d.ts] }, uniq: [['order_id']], idx: ['seller_uid'] },
  removed: { kt: 'bigint', cols: { uid: ['text', (d) => d.uid || ''] } },
  convs: { kt: 'text', cols: { buyer_id: ['text', (d) => d.buyerId], pid: ['bigint', (d) => d.pid], ts: ['bigint', (d) => d.ts || 0] }, idx: ['buyer_id'] }, // chats
};
const KEY = { users: 'uid', sessions: 'h', products: 'id', orders: 'id', reports: 'id', reviews: 'id', removed: 'pid', convs: 'key' };
const NO_DEL = new Set(['products', 'orders', 'convs', 'reviews', 'reports', 'removed']); // datos de la comunidad: nunca se borran
const names = Object.keys(T);

let pool = null;
let initial = {};          // filas cargadas al iniciar: { tabla: [doc, ...] }
const mem = {};            // (modo archivo) tabla -> Map(clave -> doc)

/* ================= PostgreSQL ================= */
const TRANSIENT = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPIPE|Connection terminated|timeout|terminating connection|Client has encountered/i;
async function q(sql, params, client) {
  for (let i = 0; ; i++) {
    try { return await (client || pool).query(sql, params); }
    catch (e) {
      const transient = TRANSIENT.test(String(e.message)) || ['57P01', '57P03', '08006', '08001', '08003'].includes(e.code);
      if (client || !transient || i >= 3) throw e;
      await new Promise((r) => setTimeout(r, 700 * (i + 1))); // Neon despierta en 1-5 s tras estar inactiva
    }
  }
}
const sqlUpsert = (t) => {
  const c = Object.keys(T[t].cols);
  return 'INSERT INTO ' + t + '(k,data' + c.map((x) => ',' + x).join('') + ') VALUES($1,$2::jsonb' + c.map((_, i) => ',$' + (i + 3)).join('') + ') ON CONFLICT (k) DO UPDATE SET data=EXCLUDED.data' + c.map((x) => ',' + x + '=EXCLUDED.' + x).join('');
};
const upsertArgs = (t, doc) => [String(doc[KEY[t]]), JSON.stringify(doc), ...Object.values(T[t].cols).map(([, f]) => f(doc))];

/* cola de escritura: agrupa cambios por fila, un solo viaje y reintentos con espera creciente */
const pend = new Map(); // "tabla|clave" -> { t, k, doc | null }
let timer = null, draining = null, retry = 0;
function enqueue(t, k, doc) {
  pend.set(t + '|' + k, { t, k, doc });
  if (!timer && !draining) timer = setTimeout(drain, 120);
}
const runOne = (e, client) => (e.doc ? q(sqlUpsert(e.t), upsertArgs(e.t, e.doc), client) : q('DELETE FROM ' + e.t + ' WHERE k=$1', [String(e.k)], client));
async function drain() {
  timer = null;
  if (draining || !pend.size) return;
  const batch = [...pend.entries()];
  batch.forEach(([k]) => pend.delete(k));
  draining = (async () => {
    let c;
    try {
      c = await pool.connect();
      await c.query('BEGIN');
      for (const [, e] of batch) await runOne(e, c);
      await c.query('COMMIT');
      retry = 0;
    } catch (err) {
      try { if (c) await c.query('ROLLBACK'); } catch (_) {}
      if (/^2[23]/.test(String(err.code))) { // datos inválidos o duplicados: se aíslan para no bloquear el resto
        for (const [, e] of batch) { try { await runOne(e); } catch (x) { console.error('[db] se omitió un registro de ' + e.t + ': ' + x.message); } }
      } else {
        for (const [k, e] of batch) if (!pend.has(k)) pend.set(k, e); // reintento (no pisa cambios más nuevos)
        retry++;
        console.error('[db] no se pudo guardar, reintento ' + retry + ': ' + err.message);
        timer = setTimeout(drain, Math.min(30000, 1000 * 2 ** retry));
      }
    } finally { if (c) c.release(); }
  })();
  await draining;
  draining = null;
  if (pend.size && !timer) timer = setTimeout(drain, 120);
}
async function flush(ms = 6000) {
  const t0 = Date.now();
  clearTimeout(timer); timer = null;
  while ((pend.size || draining) && Date.now() - t0 < ms) {
    if (draining) await draining; else await drain();
  }
  if (MODE === 'file') fileFlush();
  else if (pool) { try { await Promise.race([pool.end(), new Promise((r) => setTimeout(r, 1500))]); } catch (_) {} }
}

/* ================= Archivos JSON (sin DATABASE_URL) ================= */
const dirty = new Set();
let ftimer = null;
const fileOf = (t) => path.join(DIR, 'u2u-' + t + '.json');
function fileFlush() {
  clearTimeout(ftimer); ftimer = null;
  for (const t of [...dirty]) {
    try {
      fs.mkdirSync(DIR, { recursive: true });
      const tmp = fileOf(t) + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ version: 1, rows: [...mem[t].values()] }));
      fs.renameSync(tmp, fileOf(t)); // escritura atómica
      dirty.delete(t);
    } catch (e) { console.error('[db] no se pudo guardar ' + t + ':', e.message); }
  }
}
const fileMark = (t) => { dirty.add(t); if (!ftimer) ftimer = setTimeout(fileFlush, 300); };
const readJson = (file) => {
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (!j || typeof j !== 'object') throw new Error('formato'); return j; }
  catch (e) {
    if (e.code !== 'ENOENT') { try { fs.renameSync(file, file + '.corrupt-' + Date.now()); } catch (_) {} console.warn('[db] ' + path.basename(file) + ' ilegible: respaldado, se inicia vacío'); }
    return null;
  }
};
/* Lee los archivos (formato nuevo y el anterior: users.json, reports.json, reviews.json) -> { tabla: [doc] } */
function readFiles() {
  const out = {};
  names.forEach((t) => { out[t] = []; });
  const have = {};
  names.forEach((t) => { const j = readJson(fileOf(t)); if (j && Array.isArray(j.rows)) { out[t] = j.rows; have[t] = true; } });
  const old = (f) => readJson(path.join(DIR, f));
  const u = !have.users && old('users.json');
  if (u && Array.isArray(u.users)) {
    u.users.forEach((x) => { const { sessions, ...r } = x; out.users.push(r); (sessions || []).forEach((s) => out.sessions.push({ h: s.h, uid: x.uid, exp: s.exp })); });
  }
  const r = !have.reports && !have.removed && old('reports.json');
  if (r) { out.reports = Array.isArray(r.reports) ? r.reports : []; out.removed = (Array.isArray(r.removed) ? r.removed : []).map((x) => ({ pid: x.id, uid: x.uid || '' })); }
  const v = !have.reviews && old('reviews.json');
  if (v && Array.isArray(v.reviews)) out.reviews = v.reviews;
  return out;
}

/* ================= API pública ================= */
async function init() {
  if (MODE === 'pg') {
    const { Pool } = require('pg');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(DB_URL) || /sslmode=disable/.test(DB_URL);
    pool = new Pool({ connectionString: DB_URL, max: 4, idleTimeoutMillis: 30000, connectionTimeoutMillis: 20000, ssl: local ? false : { rejectUnauthorized: true } });
    pool.on('error', (e) => console.error('[db] conexión inactiva cerrada (se reabre sola):', e.message));
    await q('SELECT 1');
    for (const t of names) {
      const s = T[t], cols = Object.entries(s.cols);
      await q('CREATE TABLE IF NOT EXISTS ' + t + ' (k ' + s.kt + ' PRIMARY KEY, data jsonb NOT NULL' + cols.map(([n, [ty]]) => ', ' + n + ' ' + ty).join('') + ')');
      for (const [i, u] of (s.uniq || []).entries()) await q('CREATE UNIQUE INDEX IF NOT EXISTS ' + t + '_u' + i + ' ON ' + t + '(' + u.join(',') + ')');
      for (const c of s.idx || []) await q('CREATE INDEX IF NOT EXISTS ' + t + '_' + c + ' ON ' + t + '(' + c + ')');
    }
    await q('DELETE FROM sessions WHERE exp < $1', [Date.now()]); // sesiones vencidas
    for (const t of names) initial[t] = (await q('SELECT data FROM ' + t)).rows.map((r) => r.data);
    console.log('[db] PostgreSQL conectado · ' + initial.users.length + ' cuentas, ' + initial.products.length + ' publicaciones, ' + initial.orders.length + ' pedidos');
    usage().then((u) => u && console.log('[db] espacio usado: ' + u.mb + ' MB (plan gratis de Neon: 512 MB) · fotos: ' + u.photosMb + ' MB')).catch(() => {});
  } else {
    initial = readFiles();
    names.forEach((t) => { mem[t] = new Map(initial[t].map((d) => [String(d[KEY[t]]), d])); });
    const now = Date.now();
    for (const [h, s] of mem.sessions) if (s.exp < now) mem.sessions.delete(h);
    initial.sessions = [...mem.sessions.values()];
    names.forEach((t) => dirty.add(t)); // primera vez: deja los archivos en el formato nuevo
    fileFlush();
    console.log('[db] modo ARCHIVOS JSON en ' + DIR + ' (sin DATABASE_URL) · ' + initial.users.length + ' cuentas, ' + initial.products.length + ' publicaciones, ' + initial.orders.length + ' pedidos');
  }
}
async function usage() {
  if (MODE !== 'pg') return null;
  const [a, b] = await Promise.all([q('SELECT pg_database_size(current_database()) AS n'), q('SELECT COALESCE(sum(pg_column_size(data)),0) AS n FROM products')]);
  const mb = (x) => Math.round(Number(x) / 1048576 * 10) / 10;
  return { mb: mb(a.rows[0].n), photosMb: mb(b.rows[0].n) };
}

function table(t) {
  const key = KEY[t];
  return {
    /* guarda o actualiza un registro; { sync: true } espera a que quede escrito (o lanza el error) */
    async put(doc, opt) {
      const k = String(doc[key]);
      if (MODE === 'file') {
        mem[t].set(k, doc);
        if (opt && opt.sync) { dirty.add(t); fileFlush(); if (dirty.has(t)) throw new Error('no se pudo escribir ' + t); return; } // sync = ya está en disco
        fileMark(t);
        return;
      }
      if (opt && opt.sync) { pend.delete(t + '|' + k); await q(sqlUpsert(t), upsertArgs(t, doc)); return; }
      enqueue(t, k, doc);
    },
    del(k) {
      if (NO_DEL.has(t)) { console.error('[db] borrado bloqueado en ' + t + ': usa put({deleted_at, ...}). No se borró nada.'); return; }
      k = String(k);
      if (MODE === 'file') { mem[t].delete(k); fileMark(t); return; }
      enqueue(t, k, null);
    },
  };
}
const api = { mode: MODE, init, flush, usage, readFiles, rows: (t) => (initial[t] || []).slice() };
names.forEach((t) => { api[t] = table(t); });
api.sessions.delByUid = (uid) => {
  if (MODE === 'file') { for (const [h, s] of mem.sessions) if (s.uid === uid) mem.sessions.delete(h); fileMark('sessions'); return; }
  for (const [k, e] of pend) if (e.t === 'sessions' && e.doc && e.doc.uid === uid) pend.delete(k);
  q('DELETE FROM sessions WHERE uid=$1', [uid]).catch((e) => console.error('[db] sesiones:', e.message));
};
/* usado por migrate.js: sube filas (idempotente) */
api.importRows = async (t, rows) => { for (const d of rows) await q(sqlUpsert(t), upsertArgs(t, d)); return rows.length; };

module.exports = api;
