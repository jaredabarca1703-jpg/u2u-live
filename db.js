/* U2U · capa de datos
 *  - Con DATABASE_URL (variable de entorno) usa PostgreSQL (Neon). Las tablas se crean solas al iniciar.
 *  - Sin DATABASE_URL guarda en archivos JSON en data/ (o DATA_DIR): ideal para probar en tu computadora.
 *  - El servidor trabaja con los datos en memoria y los escribe aquí en segundo plano (cola con reintentos);
 *    al iniciar los vuelve a cargar. Las consultas son siempre parametrizadas.
 *  - La cuenta admin (ADMIN_USER / ADMIN_PASS) NUNCA se guarda aquí: vive solo en memoria (ver auth.js).
 *  - v8.6.3 (bloque 3): put({sync:true}) también garantiza escritura inmediata en modo archivos, y las tablas
 *    con datos de la comunidad (products, orders, convs, reviews, reports, removed) NO admiten del():
 *    se marcan con put({deleted_at, ...}). El aviso de espacio lo da server.js (STORAGE_LIMIT_MB).
 *  - v8.7.0: tabla messages (una fila por mensaje de chat: id, key de la conversación, uid, from, name, text, ts) y putMany(docs):
 *    guarda varias filas en UNA transacción (PostgreSQL) o con una sola escritura de archivo. messages tampoco admite del().
 *  - v8.6.6 (bloque 6): tabla counters (key text PK, win text, count int) con UPSERT atómico: counters.hit(key, window)
 *    suma 1 y devuelve el conteo de esa ventana (si la ventana cambió, reinicia en 1). Límites de correo (auth.js).
 *  - v8.7.3 (parte C): tabla featured (solicitudes para destacar una publicación: id, pid, ownerUid, amount, status, opNumber...).
 *    Tampoco admite del(): una solicitud cancelada o vencida se conserva (el dinero cobrado se concilia con ella).
 *  - Auditoría lote 1: (L1-26) sin DATABASE_URL en producción NO arranca en modo archivos salvo DATA_DIR (disco persistente) o ALLOW_FILE_DB=1;
 *    (L1-27) pool con keepAlive y query_timeout (PG_QUERY_TIMEOUT_MS, 60 s por defecto) y una conexión que falló se descarta; (L1-28) una escritura
 *    sync espera al lote en vuelo y descarta versiones pendientes más viejas (seq); (L1-29) ADD COLUMN IF NOT EXISTS por cada columna declarada;
 *    (L1-31) un fallo transitorio al aislar filas se reintenta en vez de descartarse; (L1-32) índice redundante messages(conv_key) eliminado;
 *    status() (cola de escritura), releaseInitial(), importRows con opciones (migrate.js) y opNumbers (respaldo de opnumbers.js).
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
  convs: { kt: 'text', cols: { buyer_id: ['text', (d) => d.buyerId], pid: ['bigint', (d) => d.pid], ts: ['bigint', (d) => d.ts || 0] }, idx: ['buyer_id'] }, // chats (sin los mensajes desde v8.7.0)
  messages: { kt: 'text', cols: { conv_key: ['text', (d) => d.key], ts: ['bigint', (d) => d.ts || 0] }, idx: ['conv_key,ts'] }, // una fila por mensaje; (conv_key, ts) para paginar el historial (cubre también las búsquedas solo por conv_key)
  featured: { kt: 'text', cols: { pid: ['bigint', (d) => d.pid], owner_uid: ['text', (d) => d.ownerUid], status: ['text', (d) => d.status], ts: ['bigint', (d) => d.createdAt || 0] }, idx: ['owner_uid', 'pid'] }, // destacados (parte C)
};
const KEY = { users: 'uid', sessions: 'h', products: 'id', orders: 'id', reports: 'id', reviews: 'id', removed: 'pid', convs: 'key', messages: 'id', featured: 'id' };
const NO_DEL = new Set(['products', 'orders', 'convs', 'messages', 'reviews', 'reports', 'removed', 'featured']); // datos de la comunidad: nunca se borran
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
const sqlInsert = (t) => {
  const c = Object.keys(T[t].cols);
  return 'INSERT INTO ' + t + '(k,data' + c.map((x) => ',' + x).join('') + ') VALUES($1,$2::jsonb' + c.map((_, i) => ',$' + (i + 3)).join('') + ')';
};
const sqlUpsert = (t) => {
  const c = Object.keys(T[t].cols);
  return sqlInsert(t) + ' ON CONFLICT (k) DO UPDATE SET data=EXCLUDED.data' + c.map((x) => ',' + x + '=EXCLUDED.' + x).join('');
};
const sqlInsertOnly = (t) => sqlInsert(t) + ' ON CONFLICT DO NOTHING'; // migrate.js: no pisa filas que ya existen
const upsertArgs = (t, doc) => [String(doc[KEY[t]]), JSON.stringify(doc), ...Object.values(T[t].cols).map(([, f]) => f(doc))];

/* cola de escritura: agrupa cambios por fila, un solo viaje y reintentos con espera creciente */
const pend = new Map(); // "tabla|clave" -> { t, k, doc | null }
let timer = null, draining = null, retry = 0;
let seq = 0, lastWriteAt = 0;   // seq: orden de las escrituras (cola y sync); lastWriteAt: última escritura confirmada (server.js decide si vale la pena medir el espacio)
function enqueue(t, k, doc) {
  pend.set(t + '|' + k, { t, k, doc, seq: ++seq });
  if (!timer && !draining) timer = setTimeout(drain, 120);
}
const runOne = (e, client) => (e.doc ? q(sqlUpsert(e.t), upsertArgs(e.t, e.doc), client) : q('DELETE FROM ' + e.t + ' WHERE k=$1', [String(e.k)], client));
const isDataErr = (x) => /^2[23]/.test(String(x && x.code)) || x instanceof TypeError; // datos inválidos, duplicados o fila mal formada: reintentar no sirve
async function drain() {
  timer = null;
  if (!pend.size && !draining) retry = 0; // cola vacía (p. ej. una escritura sync ya guardó la fila): no arrastrar reintentos de un fallo anterior
  if (draining || !pend.size) return;
  const batch = [...pend.entries()];
  batch.forEach(([k]) => pend.delete(k));
  draining = (async () => {
    let c, bad = false;
    try {
      c = await pool.connect();
      await c.query('BEGIN');
      for (const [, e] of batch) await runOne(e, c);
      await c.query('COMMIT');
      retry = 0; lastWriteAt = Date.now();
    } catch (err) {
      bad = true; // la conexión se descarta (release(true)): si estaba medio muerta no vuelve al pool
      try { if (c) await c.query('ROLLBACK'); } catch (_) {}
      if (isDataErr(err)) { // se aíslan las filas para no bloquear el resto
        let again = false;
        for (const [k, e] of batch) {
          try { await runOne(e); lastWriteAt = Date.now(); }
          catch (x) {
            if (isDataErr(x)) console.error('[db] se omitió un registro de ' + e.t + ': ' + x.message);
            else { if (!pend.has(k)) pend.set(k, e); again = true; console.error('[db] fallo transitorio en ' + e.t + ', se reintentará: ' + x.message); } // antes se descartaba
          }
        }
        if (again) { retry++; timer = setTimeout(drain, Math.min(30000, 1000 * 2 ** retry)); }
      } else {
        for (const [k, e] of batch) if (!pend.has(k)) pend.set(k, e); // reintento (no pisa cambios más nuevos)
        retry++;
        console.error('[db] no se pudo guardar, reintento ' + retry + ': ' + err.message);
        timer = setTimeout(drain, Math.min(30000, 1000 * 2 ** retry));
      }
    } finally { if (c) c.release(bad); }
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
const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.RENDER;
const fileModeAllowed = () => !IS_PROD || !!process.env.DATA_DIR || /^(1|true)$/i.test(String(process.env.ALLOW_FILE_DB || ''));
const envNum = (n, d) => { const v = parseInt(process.env[n], 10); return Number.isFinite(v) && v >= 0 ? v : d; };
async function init() {
  if (MODE === 'file' && !fileModeAllowed()) {
    throw new Error('Falta DATABASE_URL en producción: la app NO arranca en modo archivos (los datos se perderían en cada despliegue). Define DATABASE_URL (Neon), o DATA_DIR si usas un disco persistente, o ALLOW_FILE_DB=1 si de verdad lo quieres.');
  }
  if (MODE === 'pg') {
    const { Pool } = require('pg');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(DB_URL) || /sslmode=disable/.test(DB_URL);
    pool = new Pool({ connectionString: DB_URL, max: 4, idleTimeoutMillis: 30000, connectionTimeoutMillis: 20000, keepAlive: true, keepAliveInitialDelayMillis: 10000, query_timeout: envNum('PG_QUERY_TIMEOUT_MS', 60000) || undefined, ssl: local ? false : { rejectUnauthorized: true } }); // query_timeout es del lado del cliente (no usa parámetros de inicio: compatible con el pooler de Neon); 0 = sin límite
    pool.on('error', (e) => console.error('[db] conexión inactiva cerrada (se reabre sola):', e.message));
    await q('SELECT 1');
    for (const t of names) {
      const s = T[t], cols = Object.entries(s.cols);
      await q('CREATE TABLE IF NOT EXISTS ' + t + ' (k ' + s.kt + ' PRIMARY KEY, data jsonb NOT NULL' + cols.map(([n, [ty]]) => ', ' + n + ' ' + ty).join('') + ')');
      for (const [n, [ty]] of cols) await q('ALTER TABLE ' + t + ' ADD COLUMN IF NOT EXISTS ' + n + ' ' + ty); // si se agrega una columna a T, las tablas ya creadas la reciben (idempotente)
      for (const [i, u] of (s.uniq || []).entries()) await q('CREATE UNIQUE INDEX IF NOT EXISTS ' + t + '_u' + i + ' ON ' + t + '(' + u.join(',') + ')');
      for (const c of s.idx || []) await q('CREATE INDEX IF NOT EXISTS ' + t + '_' + c.replace(/\W+/g, '_') + ' ON ' + t + '(' + c + ')');
    }
    await q('DROP INDEX IF EXISTS messages_conv_key'); // redundante: lo cubre messages_conv_key_ts
    await q('CREATE TABLE IF NOT EXISTS counters (key text PRIMARY KEY, win text NOT NULL, count int NOT NULL)');
    await q('CREATE TABLE IF NOT EXISTS op_numbers (op text PRIMARY KEY, kind text NOT NULL, ref text NOT NULL, at bigint NOT NULL)'); // respaldo de opnumbers.js (clave única entre instancias)
    await q('DELETE FROM sessions WHERE exp < $1', [Date.now()]); // sesiones vencidas
    for (const t of names) initial[t] = (await q('SELECT data FROM ' + t)).rows.map((r) => r.data);
    console.log('[db] PostgreSQL conectado · ' + initial.users.length + ' cuentas, ' + initial.products.length + ' publicaciones, ' + initial.orders.length + ' pedidos');
    usage().then((u) => u && console.log('[db] espacio usado: ' + u.mb + ' MB (plan gratis de Neon: 512 MB) · fotos: ' + u.photosMb + ' MB')).catch(() => {});
  } else {
    initial = readFiles();
    names.forEach((t) => { mem[t] = new Map(initial[t].map((d) => [String(d[KEY[t]]), d])); });
    const cj = readJson(fileOf('counters')); // contadores (límites de correo): key -> { key, window, count }
    mem.counters = new Map(((cj && Array.isArray(cj.rows)) ? cj.rows : []).map((r) => [r.key, r]));
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
      if (opt && opt.sync) {
        const my = ++seq, pk = t + '|' + k;
        if (draining) await draining; // un lote en vuelo con una versión más vieja de esta fila no puede terminar DESPUÉS y pisarla
        const cur = pend.get(pk); if (cur && cur.seq < my) pend.delete(pk); // y una pendiente más vieja (o reencolada tras un fallo) tampoco
        await q(sqlUpsert(t), upsertArgs(t, doc)); lastWriteAt = Date.now();
        return;
      }
      enqueue(t, k, doc);
    },
    /* guarda varias filas juntas: en PostgreSQL una sola transacción (todo o nada); en archivos una sola escritura. Espera a que quede guardado. */
    async putMany(docs) {
      if (!docs || !docs.length) return;
      if (MODE === 'file') {
        docs.forEach((d) => mem[t].set(String(d[key]), d));
        dirty.add(t); fileFlush();
        if (dirty.has(t)) throw new Error('no se pudo escribir ' + t);
        return;
      }
      const my = ++seq;
      if (draining) await draining;
      docs.forEach((d) => { const pk = t + '|' + String(d[key]), cur = pend.get(pk); if (cur && cur.seq < my) pend.delete(pk); });
      const c = await pool.connect();
      let bad = false;
      try {
        await c.query('BEGIN');
        for (const d of docs) await q(sqlUpsert(t), upsertArgs(t, d), c);
        await c.query('COMMIT');
        lastWriteAt = Date.now();
      } catch (e) { bad = true; try { await c.query('ROLLBACK'); } catch (_) {} throw e; }
      finally { c.release(bad); }
    },
    del(k) {
      if (NO_DEL.has(t)) { console.error('[db] borrado bloqueado en ' + t + ': usa put({deleted_at, ...}). No se borró nada.'); return; }
      k = String(k);
      if (MODE === 'file') { mem[t].delete(k); fileMark(t); return; }
      enqueue(t, k, null);
    },
  };
}
/* estado de la cola de escritura (server.js: /ready y la medición de espacio) */
const status = () => ({ mode: MODE, pending: pend.size, draining: !!draining, retry, lastWriteAt });
/* libera las filas cargadas al iniciar de las tablas indicadas (server.js lo usa con messages y convs cuando ya las pasó a memoria): evita tenerlas dos veces */
const releaseInitial = (list) => { for (const t of list || []) delete initial[t]; };
const api = { mode: MODE, init, flush, usage, readFiles, status, releaseInitial, rows: (t) => (initial[t] || []).slice() };
names.forEach((t) => { api[t] = table(t); });
api.sessions.delByUid = (uid) => { // devuelve la promesa: quien cambia la clave espera a que el DELETE termine antes de emitir la sesión nueva
  if (MODE === 'file') { for (const [h, s] of mem.sessions) if (s.uid === uid) mem.sessions.delete(h); fileMark('sessions'); return Promise.resolve(); }
  for (const [k, e] of pend) if (e.t === 'sessions' && e.doc && e.doc.uid === uid) pend.delete(k);
  return Promise.resolve(draining).then(() => q('DELETE FROM sessions WHERE uid=$1', [uid])).then(() => { lastWriteAt = Date.now(); }).catch((e) => console.error('[db] sesiones:', e.message)); // espera el lote en vuelo: no puede revivir una sesión recién borrada
};
/* Contadores por ventana (límites de envío de correo). Una sola sentencia atómica en PostgreSQL; en archivos
   no hay concurrencia real (un proceso, sin await entre leer y escribir). Devuelve el conteo tras sumar 1. */
api.counters = {
  async hit(key, win) {
    key = String(key); win = String(win);
    if (MODE === 'file') {
      let r = mem.counters.get(key);
if (!r || r.win !== win) { r = { key, win: win, count: 0 }; mem.counters.set(key, r); }
      r.count++; fileMark('counters'); lastWriteAt = Date.now();
      return r.count;
    }
    const res = await q('INSERT INTO counters(key,win,count) VALUES($1,$2,1) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN counters.win = EXCLUDED.win THEN counters.count + 1 ELSE 1 END, win = EXCLUDED.win RETURNING count', [key, win]);
    lastWriteAt = Date.now();
    return Number(res.rows[0].count);
  },
};
/* usado por migrate.js. Sin opciones: sube todo pisando por clave (comportamiento anterior) y devuelve la cantidad.
   Con opciones { overwrite, dryRun }: overwrite:false SOLO agrega lo que falta (no pisa filas existentes); dryRun no escribe nada.
   Una fila con error se omite y se cuenta. Devuelve { total, inserted, updated, skipped, errors }. */
api.importRows = async (t, rows, opt) => {
  if (!opt) { for (const d of rows) await q(sqlUpsert(t), upsertArgs(t, d)); return rows.length; }
  const overwrite = opt.overwrite !== false, res = { total: rows.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  const have = (opt.dryRun || overwrite) ? new Set((await q('SELECT k FROM ' + t)).rows.map((r) => String(r.k))) : null;
  for (const d of rows) {
    const key = String(d && d[KEY[t]]), exists = have ? have.has(key) : false;
    if (opt.dryRun) { if (!exists) res.inserted++; else if (overwrite) res.updated++; else res.skipped++; continue; }
    try {
      if (overwrite) { await q(sqlUpsert(t), upsertArgs(t, d)); if (exists) res.updated++; else res.inserted++; }
      else { const r = await q(sqlInsertOnly(t), upsertArgs(t, d)); if (r.rowCount === 1) res.inserted++; else res.skipped++; }
    } catch (e) { res.errors++; console.error('  [' + t + '] fila omitida (' + key + '): ' + e.message); }
  }
  return res;
};
/* Respaldo en la base del registro de números de operación (opnumbers.js → setStore). claim: true = el número es nuevo. En modo archivos no hay base: siempre true. */
api.opNumbers = {
  async claim(op, kind, ref) {
    if (MODE !== 'pg') return true;
    const r = await q('INSERT INTO op_numbers(op,kind,ref,at) VALUES($1,$2,$3,$4) ON CONFLICT (op) DO NOTHING', [String(op), String(kind || ''), String(ref || ''), Date.now()]);
    lastWriteAt = Date.now();
    return r.rowCount === 1;
  },
  async release(op) { if (MODE === 'pg') await q('DELETE FROM op_numbers WHERE op=$1', [String(op)]); },
};

module.exports = api;
