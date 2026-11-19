/* U2U · servidor de tiempo real (Express + Socket.io)
 * - Sirve la app desde /public
 * - Cuentas con usuario/correo + contraseña (auth.js, crypto.scrypt) y sesión por token.
 *   El servidor emite a cada cuenta su identidad (uid público + secreto privado) y solo
 *   deja entrar al chat en vivo a cuentas registradas: nadie puede suplantar a otro.
 * - Cualquier usuario puede publicar, comprar, alquilar y chatear.
 * - Cuenta OFICIAL = la cuenta admin (ADMIN_USER/ADMIN_PASS) con nombre público OFFICIAL_NAME: vende el catálogo
 *   inicial (seed.json), recibe pedidos, confirma entregas con PIN, chatea y modera. No compra, no reporta, no se califica.
 * - Publicaciones: se guardan, se reenvían en vivo a todos y se entregan a quien entre después.
 * - Chat PRIVADO por producto: solo lo ven el interesado y el dueño de ese producto.
 * - Pedidos con CÓDIGO DE ENTREGA (estilo PedidosYa): al comprar se genera un PIN de 6 dígitos
 *   que solo ve el comprador. El dueño lo ingresa al entregar el producto y recién ahí se
 *   confirma la transacción.
 * - Cuentas, sesiones, publicaciones, pedidos, reportes y reseñas se guardan en PostgreSQL (DATABASE_URL) o,
 *   sin esa variable, en archivos JSON (db.js). Los chats también.
 * - v8.6.3 (bloque 3, protección de datos): NADA se borra por tope global (publicaciones, pedidos, chats ni mensajes).
 *   Tope por usuario (PUB_LIMIT_USER) y tope de espacio (STORAGE_LIMIT_MB) solo RECHAZAN lo nuevo.
 *   Las escrituras críticas (publicar, pedidos, reservas, bloqueos, reseñas) esperan a quedar guardadas antes de confirmar.
 *   Cada evento de Socket.io vuelve a comprobar cuenta, bloqueo y rol en el servidor (guard).
 * - v8.6.5 (bloque 5): cuentas nuevas con correo UPC sin verificar NO publican, reservan ni chatean (code NOT_VERIFIED);
 *   la bienvenida de la cuenta oficial se envía al VERIFICAR (auth.js llama a sendWelcome), no al crear la cuenta.
 * - v8.7.0 (parche de prioridad alta): (1) el catálogo ya NO manda las fotos en base64 por Socket.io: cada foto se sirve por
 *   GET /foto/:pid/:n con caché del navegador y el catálogo solo lleva esa URL; (2) los pedidos pendientes vencen a las
 *   ORDER_TTL_HOURS (48 h por defecto) y liberan la reserva; (3) cada mensaje del chat es una fila de la tabla messages y solo se
 *   entrega y confirma cuando quedó guardado (las conversaciones antiguas se migran solas al iniciar).
 * - v8.7.3 (parte C): destacar publicaciones (featured.js, FEATURE_MODE=off|free|paid, nace apagado): las vigentes salen primero en el catálogo
 *   y llevan featured:true; al venderse, pausarse o eliminarse una publicación se cancelan sus solicitudes (setStatus y removeProduct).
 * - v8.6.7 (bloque 7): al cambiar o recuperar la contraseña se rota el secret y se desconectan los sockets de esa cuenta;
 *   el nombre editado en «Mi cuenta» se usa en las publicaciones nuevas.
 * - Auditoría lote 1 (solo correcciones, mismo comportamiento en lo demás): sala 'members' (los avisos globales ya no llegan a sockets sin sesión);
 *   tope diario de mensajes, de chats nuevos y por conversación (MSG_DAILY_LIMIT, CONV_NEW_DAILY_LIMIT, MSG_CONV_LIMIT) y chats nuevos
 *   rechazados con el almacenamiento lleno; límite de join y de eventos por socket; cierre ordenado (SIGTERM) y salida tras uncaughtException;
 *   /ready; 404 de /api y manejador final de errores; HSTS, límite HTTP por IP, caché de estáticos con ?v=; reconciliación de reservas al arrancar;
 *   la semilla no recrea lo eliminado por su dueño; la eliminación de una publicación se reintenta si falla el guardado; texto limpio con una sola función.
 *   IMPORTANTE: todo el estado vive en memoria al arrancar → funciona con UNA sola instancia (no escalar a 2 en Render).
 */
require('./env'); // variables de entorno: .env en tu PC, panel Environment en Render (ver env.js)

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const db = require('./db');
const accounts = require('./auth');

const app = express();
app.set('trust proxy', 1); // Render va detrás de un proxy: así req.ip es la IP real (límite de intentos)
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6 }); // 1 MB por mensaje (fotos incluidas)

/* ---------- Ajustes por variable de entorno (si falta o es inválida, el servidor arranca igual con el valor por defecto) ---------- */
const envInt = (name, def) => { const n = parseInt(process.env[name], 10); return Number.isFinite(n) && n > 0 ? n : def; };
const envInt0 = (name, def) => { const n = parseInt(process.env[name], 10); return Number.isFinite(n) && n >= 0 ? n : def; }; // admite 0 (= desactivado)
const pubLimit = () => envInt('PUB_LIMIT_USER', 10);
const storageLimit = () => envInt('STORAGE_LIMIT_MB', 400);
const orderTtlMs = () => envInt('ORDER_TTL_HOURS', 48) * 3600e3; // vigencia de un pedido pendiente (libera la reserva al vencer)
const msgDailyLimit = () => envInt('MSG_DAILY_LIMIT', 500);          // mensajes por usuario y día (hora de Lima); la cuenta oficial no tiene tope
const msgConvLimit = () => envInt('MSG_CONV_LIMIT', 2000);           // mensajes por conversación
const convNewDailyLimit = () => envInt('CONV_NEW_DAILY_LIMIT', 30);  // conversaciones nuevas por usuario y día

/* ---------- Constantes de negocio y de protección (antes eran números sueltos) ---------- */
const DELIVERY_FEE = 15, MAX_RENTAL_DAYS = 60, MAX_RENTAL_AHEAD_DAYS = 90, PRESENCE_MAX = 100;
const JOIN_PER_MIN = 30;                       // un usuario real no entra más de unas pocas veces por minuto
const FLOOD_MAX = 150, FLOOD_WINDOW_MS = 10e3; // más eventos que esto en 10 s desde un mismo socket: se desconecta
const limaDay = (ms) => new Date(ms - 5 * 3600e3).toISOString().slice(0, 10); // día en Lima (UTC-5, sin horario de verano)
let shuttingDown = false;                       // true desde SIGTERM/SIGINT: no se aceptan eventos nuevos
const sec = { denied: 0, joinThrottled: 0, floods: 0, httpLimited: 0 }; // contadores de seguridad (se resumen en el log cada 10 min; sin datos personales)

server.keepAliveTimeout = 65e3; server.headersTimeout = 66e3; // mayores que el tiempo de inactividad del proxy de Render: evita 502 esporádicos

// Límite de peticiones por IP (ventana fija, solo en memoria). max=0 lo desactiva.
function makeLimiter(max, windowMs) {
  const hits = new Map(); let sweptAt = Date.now();
  return (req) => {
    if (!max) return true;
    const now = Date.now();
    if (now - sweptAt > windowMs || hits.size > 50000) { for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); if (hits.size > 50000) hits.clear(); sweptAt = now; }
    let h = hits.get(req.ip);
    if (!h || h.reset <= now) { h = { n: 0, reset: now + windowMs }; hits.set(req.ip, h); }
    return ++h.n <= max;
  };
}
const apiLimit = makeLimiter(envInt0('RATE_API_PER_MIN', 900), 60e3);   // generoso: el WiFi del campus comparte IP
const fotoLimit = makeLimiter(envInt0('RATE_FOTO_PER_MIN', 3000), 60e3);
const CSP_REPORT = "default-src 'self'; img-src 'self' data: https://*.tile.openstreetmap.org; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

app.disable('x-powered-by');
app.use((req, res, next) => { // cabeceras de seguridad básicas (la CSP real queda pendiente hasta alojar Tailwind, Lucide y Leaflet en el propio servidor; con CSP_REPORT_ONLY=true solo avisa en la consola del navegador)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000'); // req.secure sale de «trust proxy» (Render termina el HTTPS)
  if (process.env.CSP_REPORT_ONLY === 'true') res.setHeader('Content-Security-Policy-Report-Only', CSP_REPORT);
  next();
});
if (process.env.LOG_IP_DEBUG === 'true') { // diagnóstico opcional: ¿req.ip es la IP real del usuario o la del proxy? (se imprime UNA vez)
  let once = false;
  app.use((req, _res, next) => { if (!once) { once = true; console.log('[http] req.ip=' + req.ip + ' · x-forwarded-for=' + (req.headers['x-forwarded-for'] || '(ninguno)')); } next(); });
}
app.use('/api', (req, res, next) => {
  if (apiLimit(req)) return next();
  sec.httpLimited++; res.set('Retry-After', '60');
  res.status(429).json({ ok: false, code: 'RATE_LIMIT', error: 'Demasiadas solicitudes desde esta red. Espera un minuto.', retry: 60 });
});
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => { const v = res.req && res.req.query && res.req.query.v; if (v) res.setHeader('Cache-Control', 'public, max-age=86400'); }, // los scripts y estilos con ?v=versión se guardan 1 día; index.html siempre se revalida
}));
app.get('/health', (_req, res) => (shuttingDown ? res.status(503).send('shutting down') : res.send('ok'))); // liveness (no toca la base: la mantendría despierta)
app.get('/ready', (_req, res) => { // estado de la cola de escritura: 503 si se está cerrando o si lleva varios reintentos fallidos seguidos
  const st = db.status(), ok = !shuttingDown && st.retry < 5;
  res.status(ok ? 200 : 503).json({ ok, mode: st.mode, pending: st.pending, retry: st.retry, shuttingDown });
});
// Foto de una publicación: se descarga solo cuando la pantalla la necesita y el navegador la guarda (ids nunca se reutilizan: caché larga + ETag)
app.get('/foto/:pid/:n', (req, res) => {
  if (!fotoLimit(req)) { sec.httpLimited++; return res.status(429).end(); }
  const p = products.get(parseInt(req.params.pid, 10)), n = parseInt(req.params.n, 10);
  const f = p && Number.isInteger(n) && n >= 0 ? p.ph[n] : null;
  const m = isData(f) ? DATA_IMG.exec(f) : null;
  if (!m) return res.status(404).end();
  const etag = 'W/"' + p.id + '-' + n + '-' + f.length + '"';
  res.set({ ETag: etag, 'Cache-Control': 'public, max-age=604800, immutable', 'X-Content-Type-Options': 'nosniff' });
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.type(m[1]).send(Buffer.from(m[2], 'base64'));
});

const MAX_PHOTOS = 3, MAX_PHOTO = 250000, MAX_TOTAL = 620000; // fotos (caracteres base64): el cliente las reduce a 1024 px y ≤150 KB c/u
const MAX_PIN_FAILS = 5, LOCK_MS = 5 * 60 * 1000;             // 5 intentos y bloqueo de 5 minutos
const CATS = ['Cámaras', 'Laptops', 'Calculadoras', 'Herramientas', 'Libros', 'Audio', 'Ropa'];
const MODES = ['venta', 'alquiler', 'ambos'];
const CONDS = ['Nuevo', 'Semi nuevo', 'Usado'];
const CAREERS = ['Ing. Civil', 'Arquitectura', 'Sistemas', 'Negocios', 'Comunicaciones', 'Diseño de Moda', 'Salud'];
const ACTIVE = new Set(['available', 'paused', 'reserved']); // cuentan para PUB_LIMIT_USER (vendidas y eliminadas no)

const convs = new Map();    // "pid|buyerId" -> { key, pid, buyerId, buyerName, msgs: [] }
const products = new Map(); // id -> publicación (catálogo compartido)
const owners = new Map();   // pid -> uid del dueño
const orders = new Map();   // id -> pedido
const quotas = new Map();   // uid -> contadores de límites (sobreviven a re-join y a varios sockets del mismo usuario)
let lastId = Date.now();
const HISTORY_N = 50;
const LOBBY_MAX = 50, LOBBY_MSGS = [], lobbyLast = new Map(); // sala grupal: mensajes recientes y último envío por usuario
const sentCids = new Set(); // cid de mensajes ya recibidos (conv|uid|cid): un reintento con el mismo cid no duplica el mensaje
const deletedIds = new Set(); // ids de publicaciones eliminadas (moderación o dueño): no se pueden volver a publicar
/* ---------- Comisión por venta (parte A, commission.js): COMMISSION_MODE=off|shadow|active, nace apagada ---------- */
const fees = require('./commission')({
  orders, products, setStatus, saveOrder, pushOrder, maxPinFails: MAX_PIN_FAILS, lockMs: LOCK_MS,
  emitTo: (uid, ev, payload) => io.to('u:' + uid).emit(ev, payload),
  isVerified: (u) => accounts.isVerified(u),
  isOfficial: (uid) => !!OFFICIAL && uid === OFFICIAL.uid,
  env: process.env,
});
/* ---------- Destacados (parte C, featured.js): FEATURE_MODE=off|free|paid, nace apagado ---------- */
const featured = require('./featured')({
  products, saveProduct, saveFeatured,
  emitTo: (uid, ev, payload) => io.to('u:' + uid).emit(ev, payload),
  broadcast: (ev, payload) => io.to('members').emit(ev, payload), // solo sockets con sesión (sala members)
  isVerified: (u) => accounts.isVerified(u),
  env: process.env,
});
let OFFICIAL = null;       // cuenta oficial (la admin): { uid, name } o null; se define en boot()

/* ---------- Fotos fuera del catálogo (v8.7.0) ---------- */
const DATA_IMG = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const isData = (f) => typeof f === 'string' && f.startsWith('data:');
// Lo que viaja por Socket.io: las fotos en base64 se reemplazan por su URL (/foto/:pid/:n); las claves internas (cam, dron...) quedan igual
// perfil público del dueño (carrera/ciclo/sede solo si aceptó mostrarlos) y su verificación; nunca el correo
const ownerProfile = (uid) => { const acc = uid && accounts.getByUid(uid); return acc ? { ...accounts.publicProfile(acc), verified: accounts.isVerified(acc) } : null; };
const pubProduct = (p) => ({ ...p, ownerProfile: ownerProfile(p.ownerUid), ph: (p.ph || []).map((f, i) => (isData(f) ? '/foto/' + p.id + '/' + i : f)), ...(featured.isFeatured(p) ? { featured: true } : {}) });
// Conversaciones y mensajes (v8.7.0): la fila de la conversación NO lleva los mensajes; cada mensaje es una fila de messages
const convRow = (c) => { const { msgs, ...r } = c; return r; };
const newMsgId = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');

const ownerOf = (pid) => owners.get(pid);
const ownerOfConv = (c) => (c.pid === 0 ? OFFICIAL && OFFICIAL.uid : ownerOf(c.pid)); // pid 0 = chat directo con la cuenta oficial
// Presencia: usuarios con al menos un socket activo (deduplicados por uid, sin bloqueados). Solo datos públicos: carrera, ciclo y sede únicamente si la persona aceptó mostrarlos; nunca correo ni secretos.
const SEDES_IDX = ['Monterrico', 'San Isidro', 'Villa', 'San Miguel'];
const photoUrl = (p) => { const f = (p.ph || [])[0]; return isData(f) ? '/foto/' + p.id + '/0' : (f || ''); }; // = pubProduct(p).ph[0] sin copiar el producto entero
const presence = () => {
  const byOwner = new Map();
  for (const p of products.values()) if (p.status === 'available') { if (!byOwner.has(p.ownerUid)) byOwner.set(p.ownerUid, []); byOwner.get(p.ownerUid).push(p); }
  const seen = new Set(), users = []; let total = 0;
  for (const k of io.sockets.adapter.rooms.keys()) {
    if (!k.startsWith('u:')) continue;
    const uid = k.slice(2); if (seen.has(uid)) continue; seen.add(uid);
    const acc = accounts.getByUid(uid); if (!acc || acc.blocked) continue;
    total++; // el total cuenta a todos; la lista se corta en PRESENCE_MAX (tope de tamaño del aviso)
    if (users.length >= PRESENCE_MAX) continue;
    const pp = accounts.publicProfile(acc), mine = byOwner.get(uid) || [];
    users.push({
      uid, name: pp.name, career: pp.career || '', cycle: pp.cycle || '', campus: pp.campus || '', cp: SEDES_IDX.indexOf(pp.campus),
      verified: accounts.isVerified(acc), official: !!acc.admin, activeCount: mine.length,
      sampleProducts: mine.slice(0, 3).map((p) => ({ id: p.id, t: p.t, mode: p.mode, price: p.price, rent: p.rent, ph: photoUrl(p), e: p.e || '📦' })),
    });
  }
  return { total, users };
};
let presTimer = null; // se avisa como máximo cada 1 s (evita una ráfaga de eventos por cada conexión)
const pushPresence = () => { if (presTimer) return; presTimer = setTimeout(() => { presTimer = null; io.to('members').emit('presence', presence()); }, 1000); if (presTimer.unref) presTimer.unref(); };
const num = (v, max) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
/* Limpieza de texto único para publicaciones, chat privado y Plaza: NFC, sin caracteres de control (nl:true conserva los saltos de línea), sin <> (angle:false los conserva)
   y sin invisibles ni marcas de dirección que sirven para suplantar (U+200B, U+2060, U+FEFF, U+00AD, U+202A-202E, U+2066-2069). U+200D se conserva: une los emojis compuestos. */
const INVISIBLES = /[\u00ad\u200b\u2060\ufeff\u202a-\u202e\u2066-\u2069]/g;
function cleanText(v, n, o) {
  o = o || {};
  let t = String(v == null ? '' : v).normalize('NFC').replace(o.nl ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, '');
  if (o.angle !== false) t = t.replace(/[<>]/g, '');
  return t.replace(INVISIBLES, '').trim().slice(0, n);
}
/* el contenido real de una foto debe ser del tipo que declara su data URL (primeros bytes). IMG_CHECK=off lo desactiva. */
function imgSigOk(f) {
  if (String(process.env.IMG_CHECK || '').toLowerCase() === 'off') return true;
  const m = /^data:image\/(jpeg|png|webp);base64,/.exec(f); if (!m) return false;
  const b = Buffer.from(f.slice(m[0].length, m[0].length + 24), 'base64');
  if (m[1] === 'jpeg') return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (m[1] === 'png') return b.length >= 8 && b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
  return b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP';
}
const fail = (code, error) => ({ ok: false, code, error });
const notVerified = () => fail('NOT_VERIFIED', 'Verifica tu correo UPC para publicar, reservar o chatear.');
function quotaOf(uid) {
  let q = quotas.get(uid);
  if (!q) {
    if (quotas.size > 5000) quotas.delete(quotas.keys().next().value); // sale el más antiguo, no todos (así nadie recupera cupos de golpe)
    q = { hits: [], pubs: [], ords: [] }; quotas.set(uid, q);
  }
  return q;
}

/* ---------- Validación por evento: cuenta, bloqueo y rol salen SIEMPRE del servidor ---------- */
function guard(socket) {
  if (shuttingDown) return { err: fail('SHUTTING_DOWN', 'El servidor se está reiniciando. Inténtalo de nuevo en unos segundos.') };
  const me = socket.data;
  if (!me || !me.uid) return { err: { ok: false, code: 'FORBIDDEN', error: 'Primero entra con tu nombre' } };
  const acc = accounts.getByUid(me.uid);
  if (!acc) return { err: fail('ACCOUNT_DELETED', 'Tu cuenta ya no existe') };
  if (acc.blocked) { socket.emit('blocked'); socket.disconnect(true); return { err: fail('USER_BLOCKED', 'Tu cuenta fue bloqueada') }; }
  me.admin = acc.admin === true; // el rol no se arrastra: se recalcula de la cuenta en cada evento
  me.name = acc.name; // nombre actual de la cuenta (puede cambiar en «Mi cuenta»)
  me.verified = accounts.isVerified(acc); // idem: cuentas nuevas sin verificar no publican, reservan ni chatean
  return { me, acc };
}

/* ---------- Espacio en la base de datos (STORAGE_LIMIT_MB) ---------- */
const storage = { mb: null, at: 0, busy: false, warnAt: 0 };
async function refreshStorage(force) {
  if (storage.busy || (!force && Date.now() - storage.at < 15000)) return;
  storage.busy = true;
  try {
    const u = await db.usage(); // null sin PostgreSQL (modo archivos): no hay medición y no se rechaza nada
    if (u) {
      storage.mb = u.mb;
      const lim = storageLimit();
      if (u.mb >= lim) console.warn('[db] ALMACENAMIENTO LLENO: ' + u.mb + ' MB de ' + lim + ' MB. Se rechazan publicaciones nuevas (STORAGE_FULL). No se borra nada.');
      else if (u.mb >= lim * 0.9) console.warn('[db] ATENCIÓN: ' + u.mb + ' MB de ' + lim + ' MB. Cerca del tope de publicaciones nuevas.');
    }
    storage.at = Date.now();
  } catch (e) { console.error('[db] no se pudo medir el espacio:', e.message); }
  finally { storage.busy = false; }
}
const storageFull = () => storage.mb !== null && storage.mb >= storageLimit();

/* ---------- Publicaciones ---------- */
function cleanProduct(d, me) {
  d = d || {};
  const clean = (v, n, nl) => cleanText(v, n, { nl }); // sin controles ni <>, en NFC y sin invisibles (la descripción conserva los saltos de línea)
  const t = clean(d.t, 60);
  if (t.length < 3) return { error: 'Título muy corto' };
  const mode = MODES.includes(d.mode) ? d.mode : 'venta';
  const price = num(d.price, 1e6), rent = num(d.rent, 1e5), dep = num(d.dep, 1e6);
  if (mode !== 'alquiler' && !price) return { error: 'Falta el precio de venta' };
  if (mode !== 'venta' && !rent) return { error: 'Falta el precio de alquiler' };
  const ph = Array.isArray(d.ph) ? d.ph.slice(0, MAX_PHOTOS) : [];
  if (!ph.length) return { error: 'Falta al menos una foto' };
  let total = 0;
  for (const f of ph) {
    // imágenes en base64 (o, solo para admin, claves internas de la app): nunca URLs externas
    const okKey = !!(me && me.admin === true) && typeof f === 'string' && /^[a-z0-9]{2,12}$/.test(f); // las claves internas (catálogo oficial) solo las puede usar un admin
    const okImg = typeof f === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f) && f.length <= MAX_PHOTO && imgSigOk(f);
    if (!okKey && !okImg) return { error: 'Foto no válida o muy pesada' };
    total += f.length;
  }
  if (total > MAX_TOTAL) return { error: 'Las fotos pesan demasiado' };

  let id = parseInt(d.id, 10);
  if (!Number.isSafeInteger(id) || id <= 1000 || id > Date.now() + 864e5) id = 0; // ids del futuro (envenenados) se descartan: el servidor asigna otro
  const cond = d.cond === 'Como nuevo' ? 'Semi nuevo' : d.cond; // compatibilidad con publicaciones antiguas
  const car = [...new Set(Array.isArray(d.car) ? d.car : [])].filter((c) => CAREERS.includes(c)).slice(0, CAREERS.length);
  return {
    p: {
      id, t, ph, mode, price, rent, dep, car,
      cat: CATS.includes(d.cat) ? d.cat : 'Herramientas',
      cond: CONDS.includes(cond) ? cond : 'Usado',
      cp: Math.min(3, Math.max(0, parseInt(d.cp, 10) || 0)),
      desc: clean(d.desc, 500, true) || 'Sin descripción',
      status: 'available', // available | reserved | sold
      ownerUid: me.uid, ownerName: me.name, ts: Date.now(),
      official: me.admin === true, // la insignia "Oficial ✓" la decide el servidor, nunca el cliente
    },
  };
}

const activeCount = (uid) => { let n = 0; for (const p of products.values()) if (p.ownerUid === uid && ACTIVE.has(p.status)) n++; return n; };

/* Publicar: validación + topes + guardado. La comprobación y el registro en memoria son síncronos (sin await entre medio);
   la respuesta de éxito solo sale cuando la publicación ya quedó guardada. Devuelve { res: ack, p?: publicación nueva }. */
async function publish(me, d) {
  if (me.verified === false) return { res: notVerified() };
  const fd = fees.restrict(me.uid, { action: 'publish' }); // comisión pendiente + COMMISSION_BLOCK_SCOPE=new
  if (fd) return { res: fd };
  const r = cleanProduct(d, me);
  if (r.error) return { res: { ok: false, error: r.error } };
  const p = r.p;
  if (p.id && community.isRemoved(p.id)) return { res: { ok: false, error: 'Esta publicación fue eliminada por moderación', removed: true } };
  if (p.id && deletedIds.has(p.id)) return { res: { ok: false, error: 'Esta publicación fue eliminada', removed: true } }; // el cliente la quita de su copia local
  if (p.id) {
    const ow = owners.get(p.id);
    if (ow && ow !== me.uid) return { res: { ok: false, error: 'Publicación duplicada' } }; // nadie puede apropiarse de un id
    if (products.has(p.id)) return { res: { ok: true, id: p.id }, dup: true };               // reenvío idempotente
  }
  if (me.admin !== true && activeCount(me.uid) >= pubLimit()) {
    return { res: fail('PUB_LIMIT', 'Llegaste al límite de ' + pubLimit() + ' publicaciones activas. Cuando vendas o elimines alguna podrás publicar otra.') };
  }
  if (storageFull()) {
    if (Date.now() - storage.warnAt > 60000) { storage.warnAt = Date.now(); console.warn('[server] publicación rechazada (STORAGE_FULL): ' + storage.mb + ' MB de ' + storageLimit() + ' MB'); }
    return { res: fail('STORAGE_FULL', 'U2U llegó a su límite de espacio y por ahora no acepta publicaciones nuevas. Inténtalo más tarde.') };
  }
  if (!p.id) { do { lastId = Math.max(Date.now(), lastId + 1); } while (products.has(lastId) || owners.has(lastId)); p.id = lastId; }
  owners.set(p.id, me.uid);
  products.set(p.id, p);
  try { await db.products.put(p, { sync: true }); }
  catch (e) {
    products.delete(p.id); owners.delete(p.id);
    console.error('[server] no se pudo guardar la publicación:', e.message);
    return { res: { ok: false, error: 'No se pudo guardar tu publicación. Inténtalo de nuevo.' } };
  }
  refreshStorage(); // medición actualizada (máx. cada 15 s) para el próximo tope
  pushPresence(); // cambia la vitrina de «conectados»
  return { res: { ok: true, id: p.id }, p };
}

// Cambia el estado, avisa a todos y espera a que quede guardado. Resuelve true/false (nunca lanza).
function setStatus(p, status) {
  if (p.status === status) return Promise.resolve(true);
  p.status = status;
  if (status === 'sold' || status === 'paused') featured.onGone(p.id, status); // vendida o pausada: se cancelan sus solicitudes de destacar (y p.featuredUntil queda en 0 antes de guardar)
  io.to('members').emit('product-status', { id: p.id, status }); // todos los conectados con sesión ven el cambio al instante
  pushPresence();
  return db.products.put(p, { sync: true }).then(() => true, (e) => { console.error('[server] no se pudo guardar el estado de una publicación:', e.message); return false; });
}

// Guardado para destacados (parte C): esperan a quedar escritos y resuelven true/false (nunca lanzan)
function saveProduct(p) {
  return db.products.put(p, { sync: true }).then(() => true, (e) => { console.error('[server] no se pudo guardar una publicación:', e.message); return false; });
}
function saveFeatured(r) {
  return db.featured.put(r, { sync: true }).then(() => true, (e) => { console.error('[destacados] no se pudo guardar una solicitud:', e.message); return false; });
}

/* ---------- Pedidos con código de entrega ---------- */
function newPin() {
  const used = new Set([...orders.values()].filter((o) => o.status === 'pending').map((o) => o.pin));
  let pin;
  do { pin = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); } while (used.has(pin));
  return pin;
}
function newOrderId() {
  let id;
  do { id = 'U2U-' + String(crypto.randomInt(0, 1000000)).padStart(6, '0'); } while (orders.has(id));
  return id;
}
// El PIN solo lo ve el comprador y mientras el pedido está pendiente. Nunca llega al dueño.
function view(o, uid) {
  const v = { ...o };
  delete v.pin; delete v.fails; delete v.lockedUntil; delete v.commission; // la comisión no viaja dentro del pedido (ni opNumber ni titular)
  if (uid === o.buyerId && o.status === 'pending') v.pin = o.pin;
  v.locked = !!(o.lockedUntil && o.lockedUntil > Date.now());
  v.reviewed = community.reviewed(o.id); // ya tiene reseña (una por pedido)
  if (isData(v.ph)) v.ph = '/foto/' + o.pid + '/0'; // la foto del pedido viaja como URL, no como base64
  if (o.status === 'pending') v.expiresAt = deadline(o); // cuándo vence si nadie lo atiende
  return v;
}
// la foto del pedido es copia de la de la publicación: no se duplica en la base (se vuelve a enlazar al cargar)
// con sync=true espera a que quede guardado y resuelve true/false (nunca lanza)
function saveOrder(o, sync) {
  const row = /^data:/.test(o.ph) ? { ...o, ph: '' } : o;
  if (!sync) { db.orders.put(row); return Promise.resolve(true); }
  return db.orders.put(row, { sync: true }).then(() => true, (e) => { console.error('[server] no se pudo guardar un pedido:', e.message); return false; });
}
function pushOrder(o, saved) {
  if (!saved) saveOrder(o); // todo cambio de un pedido pasa por aquí: queda guardado (cola). Con saved=true ya se guardó con sync
  io.to('u:' + o.buyerId).emit('order', view(o, o.buyerId));
  io.to('u:' + o.ownerId).emit('order', view(o, o.ownerId));
}

/* ---------- Moderación: eliminar publicaciones y cancelar pedidos pendientes ---------- */
// Resuelve cuando todos los cambios quedaron guardados
function cancelPending(match, by) { // by: quién cancela (por defecto 'admin'); removeProduct pasa el uid del dueño cuando él mismo elimina
  const jobs = [];
  for (const o of orders.values()) {
    if (o.status !== 'pending' || !match(o)) continue;
    o.status = 'cancelled'; o.doneAt = Date.now(); o.cancelledBy = by || 'admin';
    const p = products.get(o.pid);
    if (p && o.mode === 'compra' && p.status === 'reserved') jobs.push(setStatus(p, 'available'));
    jobs.push(saveOrder(o, true).then((ok) => { pushOrder(o, true); return ok; }));
  }
  return Promise.all(jobs);
}
// Eliminación por moderación: sale del catálogo pero la fila NO se borra de la base (se marca con deleted_at)
async function removeProduct(pid, opt) {
  await cancelPending((o) => o.pid === pid, (opt && opt.by) || 'admin');
  const p = products.get(pid);
  if (!p) return false;
  products.delete(pid); deletedIds.add(pid);
  const gone = featured.onGone(pid, 'deleted'); // cancela sus solicitudes de destacar (si había dinero de por medio: refundDue)
  io.to('members').emit('product-removed', { id: pid, mod: !!(opt && opt.mod) }); // desaparece al instante para todos los conectados; mod = la quitó un moderador
  pushPresence();
  const row = { ...p, deleted_at: Date.now() };
  try { await db.products.put(row, { sync: true }); }
  catch (e) {
    console.error('[server] no se pudo guardar la eliminación de una publicación (se reintenta en segundo plano):', e.message);
    db.products.put(row); // la cola de db.js reintenta: si no, tras un reinicio la publicación reaparecería
  }
  await gone;
  return true;
}
// Vencimiento de pedidos pendientes: ORDER_TTL_HOURS desde que se crearon (los alquileres, desde el día de inicio si es posterior)
function deadline(o) {
  const ttl = orderTtlMs(), f = o.mode === 'alquiler' ? Date.parse(o.from) : NaN;
  return Math.max(o.ts + ttl, Number.isFinite(f) ? f + ttl : 0);
}
let expiring = false;
// Cancela los pedidos pendientes vencidos y libera la reserva. Resuelve cuando todo quedó guardado. `now` solo lo usan las pruebas.
async function expireOrders(now) {
  now = now || Date.now();
  if (expiring) return [];
  expiring = true;
  try {
    const jobs = [];
    for (const o of orders.values()) {
      if (o.status !== 'pending' || now < deadline(o)) continue;
      o.status = 'cancelled'; o.doneAt = now; o.cancelledBy = 'timeout';
      const p = products.get(o.pid);
      if (p && o.mode === 'compra' && p.status === 'reserved') jobs.push(setStatus(p, 'available'));
      jobs.push(saveOrder(o, true).then((ok) => { pushOrder(o, true); return ok; }));
    }
    if (jobs.length) console.log('[pedidos] ' + jobs.length + ' cambio(s) por vencimiento (' + (orderTtlMs() / 3600e3) + ' h)');
    return await Promise.all(jobs);
  } catch (e) { console.error('[pedidos] error al vencer pedidos:', e.message); return []; }
  finally { expiring = false; }
}
let community; // se crea en boot(), cuando la base de datos ya cargó

io.on('connection', (socket) => {
  socket.data = {};
  // ningún handler (síncrono o async) puede tumbar el proceso: el error se registra y, si hay ack, se responde
  const _on = socket.on.bind(socket);
  const oops = (ev, args) => (e) => { console.error('[socket] ' + ev + ':', (e && e.stack) || e); const ack = args[args.length - 1]; if (typeof ack === 'function') ack({ ok: false, error: 'Error del servidor. Inténtalo de nuevo.' }); };
  socket.on = (ev, fn) => _on(ev, (...a) => { try { const r = fn(...a); if (r && typeof r.catch === 'function') r.catch(oops(ev, a)); } catch (e) { oops(ev, a)(e); } });
  let evN = 0, evAt = Date.now(); // control de inundación por socket: demasiados eventos en poco tiempo = se corta la conexión (sirve también para sockets sin sesión)
  socket.use((_packet, next) => {
    const t = Date.now();
    if (t - evAt > FLOOD_WINDOW_MS) { evAt = t; evN = 0; }
    if (++evN > FLOOD_MAX) { sec.floods++; socket.disconnect(true); return; }
    next();
  });
  community.attach(socket); // reportes, panel admin y reseñas
  pushPresence(); // avisa a todos que alguien abrió el enlace

  /* Entrada: la identidad (uid + secreto) la emitió el servidor al registrarse o iniciar sesión. */
  socket.on('join', (d) => {
    if (shuttingDown) return; // el servidor se está cerrando: el cliente se reconecta al nuevo
    d = d || {};
    const uid = String(d.uid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
    const secret = String(d.secret || '').slice(0, 64);
    const chk = accounts.check(uid, secret); // solo cuentas registradas, con el secreto que emitió el servidor
    if (!chk) { sec.denied++; return socket.emit('denied'); }
    if (chk.blocked) return socket.emit('blocked'); // cuenta bloqueada por moderación
    const acc = chk.u;
    const name = acc.name; // el nombre sale de la cuenta, no del cliente

    // los contadores de límites son del USUARIO (no del socket): volver a entrar no los reinicia
    const qu = quotaOf(uid), nowJ = Date.now();
    qu.joins = (qu.joins || []).filter((t) => nowJ - t < 60000);
    if (qu.joins.length >= JOIN_PER_MIN) { sec.joinThrottled++; return; } // exceso de entradas por minuto (cada join reenvía chats, pedidos y catálogo): se ignora en silencio, sin 'denied' para no cerrar la sesión
    qu.joins.push(nowJ);

    if (socket.data.uid) socket.leave('u:' + socket.data.uid);
    socket.data = Object.assign(qu, { uid, name, admin: acc.admin === true }); // admin sale de la cuenta (servidor), nunca del cliente
    socket.leave('admin');
    socket.join('members'); // sala de sockets con sesión: los avisos globales (presencia, Plaza, publicaciones) solo van aquí
    socket.join('u:' + uid);
    if (socket.data.admin) socket.join('admin');
    socket.emit('official', OFFICIAL); // nombre público de la cuenta oficial (nunca su usuario de login)

    // Todo lo privado: solo MIS conversaciones y MIS pedidos (como comprador o como dueño)
    socket.emit('history', [...convs.values()].filter((c) => c.buyerId === uid || ownerOfConv(c) === uid).map((c) => ({ ...c, msgs: c.msgs.slice(-HISTORY_N), more: c.msgs.length > HISTORY_N }))); // solo los últimos 50 por conversación; el resto, bajo demanda
    socket.emit('orders', [...orders.values()].filter((o) => o.buyerId === uid || o.ownerId === uid).map((o) => view(o, uid)));
    if (fees.mode() === 'active') socket.emit('commission', fees.snapshot(uid)); // estado de mi comisión (parte B lo muestra)
    community.onJoin(socket); // publicaciones eliminadas, mis reportes, promedios y (si es admin) el panel
    socket.emit('products', featured.order([...products.values()]).map(pubProduct)); // catálogo compartido (público): destacadas vigentes primero; las fotos van como URL
    pushPresence();
  });

  // mensajes anteriores de MIS conversaciones, de a 50: history:more {key, before:ts}
  socket.on('history:more', (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket); if (g.err) return reply(g.err);
    d = d || {}; const c = convs.get(String(d.key || '')), before = Number(d.before) || Infinity;
    if (!c || !(c.buyerId === g.me.uid || ownerOfConv(c) === g.me.uid)) return reply({ error: 'Conversación no encontrada' });
    const older = c.msgs.filter((m) => m.ts < before);
    reply({ ok: true, key: c.key, msgs: older.slice(-HISTORY_N), more: older.length > HISTORY_N });
  });

  /* Sala grupal «Plaza UPC»: historial circular en memoria (50 mensajes) */
  socket.on('lobby:history', (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket); if (g.err) return reply(g.err);
    reply({ ok: true, list: LOBBY_MSGS });
  });
  socket.on('lobby:send', (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket); if (g.err) return reply(g.err);
    const me = g.me, acc = accounts.getByUid(me.uid);
    if (me.verified === false) return reply({ ok: false, code: 'NOT_VERIFIED', error: 'Verifica tu correo UPC para participar en el chat en vivo' });
    const fd = fees.restrict(me.uid, { action: 'message', toOfficial: false, chatExists: false }); // comisión pendiente: sin sala grupal
    if (fd) return reply({ ok: false, code: 'FEE_DUE', error: fd.error });
    d = d || {};
    const text = cleanText(d.text, 241);
    if (!text || text.length > 240) return reply({ ok: false, error: text ? 'Máximo 240 caracteres' : 'Escribe un mensaje' });
    const now = Date.now();
    if (now - (lobbyLast.get(me.uid) || 0) < 2000) return reply({ ok: false, code: 'RATE_LIMIT', error: 'Espera un par de segundos entre mensajes' });
    let product = null;
    if (d.pid) {
      const p = products.get(parseInt(d.pid, 10));
      if (!p || p.ownerUid !== me.uid || p.status !== 'available') return reply({ ok: false, error: 'Esa publicación no está disponible para promocionar' });
      const v = pubProduct(p); product = { id: p.id, t: p.t, mode: p.mode, price: p.price, rent: p.rent, ph: v.ph[0] || '', e: p.e || '📦' };
    }
    lobbyLast.set(me.uid, now); if (lobbyLast.size > 5000) lobbyLast.delete(lobbyLast.keys().next().value);
    const pp = accounts.publicProfile(acc);
    const msg = { id: newMsgId(), uid: me.uid, name: pp.name, career: pp.career || '', campus: pp.campus || '', official: !!acc.admin, text, product, ts: now };
    LOBBY_MSGS.push(msg); while (LOBBY_MSGS.length > LOBBY_MAX) LOBBY_MSGS.shift();
    io.to('members').emit('lobby:msg', msg);
    reply({ ok: true, msg });
  });
  socket.on('lobby:delete', (d, ack) => { // solo moderación
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket); if (g.err) return reply(g.err);
    if (g.me.admin !== true) return reply({ ok: false, error: 'No tienes permiso para esto' });
    const i = LOBBY_MSGS.findIndex((m) => m.id === String((d || {}).id));
    if (i < 0) return reply({ ok: false, error: 'Mensaje no encontrado' });
    LOBBY_MSGS.splice(i, 1); io.to('members').emit('lobby:deleted', { id: String(d.id) });
    reply({ ok: true });
  });

  /* Nueva publicación -> se guarda (y solo entonces se confirma) y se reenvía a todos los demás conectados */
  socket.on('new-product', async (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket);
    if (g.err) return reply(g.err);
    const me = g.me;

    const now = Date.now();
    me.pubs = (me.pubs || []).filter((t) => now - t < 60000);
    if (me.pubs.length >= 5) return reply({ ok: false, error: 'Demasiadas publicaciones seguidas, espera un minuto' });
    me.pubs.push(now);

    const r = await publish(me, d);
    if (!r.p) { const i = me.pubs.lastIndexOf(now); if (i >= 0) me.pubs.splice(i, 1); } // rechazada o repetida: no gasta cupo por minuto
    if (r.p) socket.to('members').emit('new-product', pubProduct(r.p)); // a todos los demás conectados con sesión (fotos como URL)
    reply(r.res);
  });

  /* Eliminar publicación propia: solo el dueño (o un admin) */
  socket.on('product:delete', async (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket);
    if (g.err) return reply(g.err);
    const pid = parseInt((d || {}).id, 10);
    const p = products.get(pid);
    if (!p) return reply({ error: 'Publicación no encontrada' });
    if (p.ownerUid !== g.me.uid && !g.me.admin) return reply({ error: 'Solo puedes eliminar tus propias publicaciones' });
    await removeProduct(pid, { by: p.ownerUid === g.me.uid ? g.me.uid : 'admin' }); // los pedidos pendientes quedan cancelados por el dueño (o por el admin si eliminó otra persona)
    reply({ ok: true });
  });

  /* Chat privado: solo entre el interesado y el dueño del producto */
  socket.on('send', async (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket);
    if (g.err) return reply(g.err);
    const me = g.me;
    if (me.verified === false) return reply(notVerified());
    d = d || {};

    const text = cleanText(d.text, 500, { nl: true, angle: false }); // conserva saltos de línea y < >; quita controles e invisibles
    if (!text) return reply({ error: 'Mensaje vacío' });

    const now = Date.now();
    me.hits = (me.hits || []).filter((t) => now - t < 10000);
    if (me.hits.length >= 15) return reply({ error: 'Vas muy rápido, espera un momento' });
    me.hits.push(now);

    const pid = parseInt(d.pid, 10) || 0; // pid 0 = chat directo con la cuenta oficial (bienvenida y ayuda)
    const owner = pid === 0 ? OFFICIAL && OFFICIAL.uid : ownerOf(pid);
    if (!owner) return reply({ error: pid === 0 ? 'La cuenta oficial no está disponible ahora' : 'Esta publicación ya no está disponible' });
    if (pid && community.isRemoved(pid)) return reply({ error: 'Esta publicación fue eliminada' });

    let buyerId, from;
    if (owner === me.uid) {
      buyerId = String(d.buyerId || '');
      if (!convs.has(pid + '|' + buyerId)) return reply({ error: 'Conversación no encontrada' });
      from = 'seller';
    } else {
      buyerId = me.uid;
      from = 'buyer';
    }
    const key = pid + '|' + buyerId;
    const fd = fees.restrict(me.uid, { action: 'message', toOfficial: !!OFFICIAL && owner === OFFICIAL.uid, chatExists: convs.has(key) }); // comisión pendiente: bloqueo según COMMISSION_BLOCK_SCOPE (a la cuenta oficial siempre puede)
    if (fd) return reply(fd);

    // v8.7.0: el mensaje es una fila de la tabla messages y solo se entrega cuando YA quedó guardado.
    // Si la conversación es nueva, primero se guarda su fila (sin mensajes). Si algo falla no se entrega nada y el cliente puede reintentar.
    const cid = String(d.cid || '').replace(/[^\w-]/g, '').slice(0, 24), ckey = key + '|' + me.uid + '|' + cid;
    if (cid && sentCids.has(ckey)) return reply({ ok: true, dup: true }); // reintento del mismo envío: ya está guardado
    if (!me.admin) { // topes por usuario y día (hora de Lima), por conversación y con el almacenamiento lleno: la cuenta oficial no tiene tope
      const day = limaDay(Date.now());
      if (me.msgDay !== day) { me.msgDay = day; me.msgN = 0; me.convN = 0; }
      if ((me.msgN || 0) >= msgDailyLimit()) return reply({ ok: false, code: 'MSG_LIMIT', error: 'Llegaste al límite de mensajes de hoy. Vuelve mañana.' });
      const c0 = convs.get(key);
      if (c0 && c0.msgs.length >= msgConvLimit()) return reply({ ok: false, code: 'CONV_FULL', error: 'Esta conversación llegó a su límite de mensajes.' });
      if (!c0 && pid !== 0) {
        if ((me.convN || 0) >= convNewDailyLimit()) return reply({ ok: false, code: 'CONV_LIMIT', error: 'Hoy ya abriste muchos chats nuevos. Inténtalo mañana.' });
        if (storageFull()) return reply(fail('STORAGE_FULL', 'U2U llegó a su límite de espacio y por ahora no abre chats nuevos. Inténtalo más tarde.'));
      }
    }
    if (cid) { sentCids.add(ckey); if (sentCids.size > 5000) sentCids.delete(sentCids.values().next().value); }
    const msg = { id: newMsgId(), uid: me.uid, from, name: me.name, text, ts: Date.now() };
    const fresh = convs.has(key) ? null : { key, pid, buyerId, buyerName: me.name, msgs: [], ts: msg.ts };
    try {
      if (fresh) await db.convs.put(convRow(fresh), { sync: true });
      await db.messages.put({ ...msg, key }, { sync: true });
    } catch (e) {
      console.error('[server] no se pudo guardar un mensaje:', e.message);
      if (cid) sentCids.delete(ckey); // no se guardó: el reintento debe poder entrar
      return reply({ ok: false, error: 'No se pudo enviar el mensaje. Inténtalo de nuevo.' });
    }
    let c = convs.get(key);
    if (!c) { c = fresh || { key, pid, buyerId, buyerName: me.name, msgs: [], ts: msg.ts }; convs.set(key, c); } // las conversaciones nunca se descartan por tope
    if (from === 'buyer') c.buyerName = me.name;
    c.msgs.push(msg); // los mensajes tampoco se descartan por tope
    if (c.msgs.length > 1 && c.msgs[c.msgs.length - 2].ts > msg.ts) c.msgs.sort((a, b) => a.ts - b.ts); // dos envíos casi a la vez: orden por hora
    if (!me.admin) { me.msgN = (me.msgN || 0) + 1; if (fresh && pid !== 0) me.convN = (me.convN || 0) + 1; }
    c.ts = msg.ts; db.convs.put(convRow(c)); // solo actualiza hora y nombre de la conversación (cola); los mensajes ya están guardados

    io.to('u:' + buyerId).to('u:' + owner).emit('msg', {
      conv: { key, pid, buyerId, buyerName: c.buyerName },
      msg,
    });
    reply({ ok: true });
  });

  /* Crear pedido: se reserva el producto y se genera el código de entrega (solo para el comprador).
     La reserva se decide en la parte síncrona; solo se confirma cuando pedido y reserva quedaron guardados. */
  socket.on('order:create', async (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket);
    if (g.err) return reply(g.err);
    const me = g.me;
    d = d || {};

    if (me.verified === false) return reply(notVerified());
    if (me.admin) return reply({ error: 'La cuenta oficial vende y modera: no compra ni alquila' });
    const fd = fees.restrict(me.uid, { action: 'order' }); // comisión pendiente + COMMISSION_BLOCK_SCOPE=new
    if (fd) return reply(fd);
    const now = Date.now();
    me.ords = (me.ords || []).filter((t) => now - t < 60000);
    if (me.ords.length >= 5) return reply({ error: 'Demasiados pedidos seguidos, espera un minuto' });

    const pid = parseInt(d.pid, 10);
    const p = products.get(pid);
    const ownerId = ownerOf(pid);
    if (!p || !ownerId) return reply({ error: deletedIds.has(pid) ? 'Esta publicación ya no está disponible' : 'Producto de ejemplo: compra publicaciones de otros estudiantes' });
    if (ownerId === me.uid) return reply({ error: 'No puedes comprar tu propia publicación' });
    if (p.status === 'sold') return reply({ error: 'Este producto ya fue vendido' });
    if (p.status === 'paused') return reply({ error: 'Esta publicación está pausada' });

    const mode = d.mode === 'alquiler' ? 'alquiler' : 'compra';
    if (mode === 'compra' && p.mode === 'alquiler') return reply({ error: 'Este producto solo se alquila' });
    if (mode === 'alquiler' && p.mode === 'venta') return reply({ error: 'Este producto solo se vende' });
    if (mode === 'compra' && p.status === 'reserved') return reply({ error: 'Otro estudiante ya inició la compra de este producto' });
    if (mode === 'alquiler' && p.status === 'reserved') return reply({ error: 'Este producto está reservado' });

    const dup = [...orders.values()].find((o) => o.pid === pid && o.buyerId === me.uid && o.mode === mode && o.status === 'pending');
    if (dup) return reply({ error: 'Ya tienes un pedido pendiente por este producto' });

    // El monto lo calcula el servidor (no se confía en el cliente)
    const del = d.del === 'home' ? 'home' : 'meet';
    let days = 1, from = '', to = '', base = p.price;
    if (mode === 'alquiler') { // fechas validadas ANTES de calcular el monto (día de hoy en Lima, UTC-5)
      const ISO = /^\d{4}-\d{2}-\d{2}$/, real = (x) => ISO.test(x) && !isNaN(Date.parse(x)) && new Date(Date.parse(x)).toISOString().slice(0, 10) === x; // descarta 2026-02-30
      const f = String(d.from || ''), t = String(d.to || '');
      if (!real(f) || !real(t)) return reply({ error: 'Elige fechas válidas' });
      if (f < limaDay(now) || t < f || f > limaDay(now + MAX_RENTAL_AHEAD_DAYS * 864e5)) return reply({ error: 'Las fechas no son válidas' });
      const cnt = Math.round((Date.parse(t) - Date.parse(f)) / 864e5) + 1;
      if (cnt > MAX_RENTAL_DAYS) return reply({ error: 'El alquiler máximo es de ' + MAX_RENTAL_DAYS + ' días' });
      const clash = [...orders.values()].some((o) => o.pid === pid && o.mode === 'alquiler' && o.status === 'pending' && o.from <= t && o.to >= f);
      if (clash) return reply({ error: 'Esas fechas ya están reservadas' });
      days = cnt; from = f; to = t;
      base = p.rent * days;
    }
    const total = base + (del === 'home' ? DELIVERY_FEE : 0);

    const o = {
      id: newOrderId(), pid, t: p.t, ph: p.ph[0] || '', mode, total, days, del, from, to,
      cp: Math.min(3, Math.max(0, parseInt(d.cp, 10) || 0)),
      baseCents: Math.round(base * 100), // precio del producto (sin protección ni delivery): base de la comisión
      status: 'pending', buyerId: me.uid, buyerName: me.name, ownerId, ownerName: p.ownerName,
      ts: now, doneAt: 0, pin: newPin(), fails: 0, lockedUntil: 0,
    };
    orders.set(o.id, o); // sin await entre las comprobaciones y este registro: nadie más puede reservar lo mismo
    me.ords.push(now);
    const reserve = mode === 'compra';

    const saved = await Promise.all([saveOrder(o, true), reserve ? setStatus(p, 'reserved') : true]);
    if (!saved.every(Boolean)) { // no quedó guardado: se deshace y NO se confirma
      orders.delete(o.id);
      o.status = 'cancelled'; o.doneAt = Date.now(); o.cancelledBy = 'system'; saveOrder(o); // si llegó a escribirse, queda cancelado
      if (reserve) await setStatus(p, 'available');
      return reply({ ok: false, error: 'No se pudo guardar tu pedido. Inténtalo de nuevo.' });
    }
    pushOrder(o, true);
    reply({ ok: true, order: view(o, me.uid) });
  });

  /* Confirmar entrega: SOLO el dueño, ingresando el código que le muestra el comprador.
     La lógica vive en commission.js (confirmDelivery: la misma para este evento y para POST /api/orders/:id/confirm);
     con COMMISSION_MODE=shadow|active además crea la comisión del pedido en la misma operación. */
  socket.on('order:confirm', async (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket);
    if (g.err) return reply(g.err);
    d = d || {};
    const r = await fees.confirmDelivery(String(d.id || ''), g.me.uid, d.pin);
    if (!r.ok) return reply({ ok: false, code: r.code, error: r.error });
    reply({ ok: true, ...(r.commission ? { commission: r.commission } : {}) });
  });

  /* Cancelar un pedido pendiente (comprador o dueño): libera la reserva */
  socket.on('order:cancel', async (d, ack) => {
    const reply = (o) => typeof ack === 'function' && ack(o);
    const g = guard(socket);
    if (g.err) return reply(g.err);
    const me = g.me;
    const o = orders.get(String((d || {}).id || ''));
    if (!o || (o.buyerId !== me.uid && o.ownerId !== me.uid)) return reply({ error: 'Pedido no encontrado' });
    if (o.status !== 'pending') return reply({ error: 'Este pedido ya no está pendiente' });
    o.status = 'cancelled'; o.doneAt = Date.now(); o.cancelledBy = me.uid;
    const p = products.get(o.pid);
    const free = !!(p && o.mode === 'compra' && p.status === 'reserved'); // misma guarda que cancelPending y expireOrders
    const saved = await Promise.all([saveOrder(o, true), free ? setStatus(p, 'available') : true]);
    if (!saved.every(Boolean)) {
      o.status = 'pending'; o.doneAt = 0; delete o.cancelledBy; saveOrder(o);
      if (free) await setStatus(p, 'reserved');
      return reply({ ok: false, error: 'No se pudo guardar la cancelación. Inténtalo de nuevo.' });
    }
    pushOrder(o, true);
    reply({ ok: true });
  });

  socket.on('leave', () => {
    if (socket.data.uid) socket.leave('u:' + socket.data.uid);
    socket.leave('admin'); socket.leave('members');
    socket.data = {};
    pushPresence();
  });

  socket.on('disconnect', () => pushPresence());
});

/* ---------- Cuenta oficial: catálogo inicial (seed.json) y bienvenida ---------- */
function seedCatalog() {
  if (!OFFICIAL) return console.log('[seed] sin cuenta admin (ADMIN_USER/ADMIN_PASS): no se crea el catálogo oficial');
  let list;
  try { list = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8')); } catch (e) { return console.error('[seed] no se pudo leer seed.json:', e.message); }
  const me = { uid: OFFICIAL.uid, name: OFFICIAL.name, admin: true };
  let made = 0, had = 0, gone = 0;
  list.forEach((d, i) => {
    const id = parseInt(d.id, 10);
    if (!(id > 0 && id <= 1000)) return console.error('[seed] id inválido: ' + d.id);
    if (community.isRemoved(id) || deletedIds.has(id)) { gone++; return; } // lo eliminaste (panel o su dueño): no se vuelve a crear
    if (products.has(id)) { had++; return; }          // ya existe: no se duplica
    const r = cleanProduct(d, me);
    if (r.error) return console.error('[seed] producto ' + id + ' omitido: ' + r.error);
    const p = r.p; p.id = id; p.ts = Date.now() + i; p.official = true;
    products.set(id, p); owners.set(id, OFFICIAL.uid); db.products.put(p); made++;
  });
  console.log('[seed] catálogo oficial: ' + made + ' creados · ' + had + ' ya existían · ' + gone + ' eliminados desde el panel (no se recrean)');
}
// Al VERIFICAR su correo (auth.js → onRegister), la cuenta oficial le escribe un mensaje de bienvenida (chat directo, pid 0)
function sendWelcome(u) {
  if (!OFFICIAL || u.admin) return;
  const key = '0|' + u.uid;
  if (convs.has(key)) return;
  const first = String(u.name).split(' ')[0].slice(0, 16);
  const text = '¡Hola ' + first + '! 👋 Soy ' + OFFICIAL.name + '. Bienvenido a U2U. Tip para tu primera publicación: toca + Publicar, sube fotos nítidas con buena luz (hasta 3), pon un título claro con marca y modelo y un precio justo. Entrega siempre en un punto seguro del campus. Si tienes dudas, escríbeme por aquí.';
  const msg = { id: newMsgId(), uid: OFFICIAL.uid, from: 'seller', name: OFFICIAL.name, text, ts: Date.now() };
  const c = { key, pid: 0, buyerId: u.uid, buyerName: u.name, msgs: [msg], ts: msg.ts, welcome: true };
  convs.set(key, c);
  db.convs.put(convRow(c));
  db.messages.put({ ...msg, key }); // misma cola que la conversación: se guardan juntas
}

/* Chats: conversaciones (tabla convs) + mensajes (tabla messages). Las conversaciones anteriores a v8.7.0 traían sus mensajes dentro de la
   fila: se copian a messages en UNA transacción y SOLO después se reescribe la fila sin ellos (si algo falla, no se pierde nada y el
   arranque se detiene para reintentar). Repetirlo es seguro: lo que ya está en messages no se vuelve a copiar. */
async function loadChats() {
  const byKey = new Map();
  for (const m of db.rows('messages')) { if (!byKey.has(m.key)) byKey.set(m.key, new Map()); byKey.get(m.key).set(m.id, m); }
  const moveRows = [], baseRows = [];
  const list = db.rows('convs').sort((a, b) => (a.ts || 0) - (b.ts || 0));
  for (const r of list) {
    const legacy = Array.isArray(r.msgs) ? r.msgs : [];
    if (!byKey.has(r.key)) byKey.set(r.key, new Map());
    const have = byKey.get(r.key);
    for (const m of legacy) {
      if (!m || !m.id || have.has(m.id)) continue;
      const row = { ...m, key: r.key };
      have.set(m.id, row); moveRows.push(row);
    }
    if (Array.isArray(r.msgs)) baseRows.push(convRow(r));
  }
  if (moveRows.length) await db.messages.putMany(moveRows);   // 1º los mensajes quedan guardados...
  if (baseRows.length) await db.convs.putMany(baseRows);      // 2º recién entonces la fila pierde su copia
  let total = 0;
  for (const r of list) {
    const msgs = [...byKey.get(r.key).values()].sort((a, b) => a.ts - b.ts).map(({ key, ...m }) => m);
    if (!msgs.length) continue; // conversación sin mensajes (el guardado se cortó a medias): no se muestra; la fila se conserva
    convs.set(r.key, { ...convRow(r), msgs }); total += msgs.length;
  }
  console.log('[chats] ' + convs.size + ' conversaciones, ' + total + ' mensajes' + (moveRows.length ? ' (' + moveRows.length + ' migrados a la tabla messages)' : ''));
}

/* Reservas huérfanas: pedido y estado del producto se guardan en dos escrituras. Si el proceso murió entre ambas, un producto podía quedar
   «reserved» sin pedido (bloqueado para siempre) o con pedido pendiente pero «available». Al arrancar se deja consistente (solo compras; los alquileres no reservan). */
function reconcileReservations() {
  const buying = new Set();
  for (const o of orders.values()) if (o.status === 'pending' && o.mode === 'compra') buying.add(o.pid);
  let freed = 0, locked = 0;
  for (const p of products.values()) if (p.status === 'reserved' && !buying.has(p.id)) { p.status = 'available'; db.products.put(p); freed++; }
  for (const pid of buying) { const p = products.get(pid); if (p && p.status === 'available') { p.status = 'reserved'; db.products.put(p); locked++; } }
  if (freed || locked) console.warn('[reservas] reconciliación al arrancar: ' + freed + ' liberada(s) sin pedido pendiente · ' + locked + ' re-reservada(s) con pedido pendiente');
}

const PORT = process.env.PORT || 3000;

/* Arranque: primero la base de datos (o los archivos), luego cuentas, comunidad y el servidor */
async function boot(opt) {
  opt = opt || {};
  require('./env').validate({ quiet: opt.listen === false }); // resumen de la configuración efectiva y avisos (con STRICT_ENV=true los avisos detienen el arranque)
  await db.init();
  const rows = db.rows('products');
  rows.forEach((p) => { if (Number.isSafeInteger(p.id) && p.id <= Date.now() + 6e5) lastId = Math.max(lastId, p.id); }); // los ids de eliminadas también cuentan; los ya del futuro (más de 10 min) se ignoran para que lastId no salte al futuro
  deletedIds.clear(); rows.filter((p) => p.deleted_at).forEach((p) => deletedIds.add(p.id));
  rows.filter((p) => !p.deleted_at).sort((a, b) => a.ts - b.ts).forEach((p) => { products.set(p.id, p); owners.set(p.id, p.ownerUid); });
  db.rows('orders').sort((a, b) => a.ts - b.ts).forEach((o) => { const p = products.get(o.pid); if (!o.ph && p && p.ph[0]) o.ph = p.ph[0]; orders.set(o.id, o); });
  reconcileReservations();           // reservas huérfanas (se corrige antes de vencer pedidos)
  require('./opnumbers').setStore(db.opNumbers); // respaldo en la base del registro de números de operación (solo se usa si commission.js/featured.js llaman a claimPersist)
  fees.describe(); fees.rebuild();   // comisiones abiertas por vendedor y números de operación usados, desde los pedidos ya cargados
  fees.mount(app, accounts);         // rutas REST de la comisión: ANTES de accounts.mount (su router responde 404 a cualquier /api/... que no conozca)
  featured.describe(); featured.rebuild(db.rows('featured')); // destacados: DESPUÉS de fees.rebuild() (suma sus números de operación al mismo registro) y con los productos ya cargados
  featured.mount(app, accounts);     // rutas REST de destacados: también ANTES de accounts.mount
  accounts.onMe((u) => ({ can_message: fees.canMessage(u.uid), commission_due: fees.due(u.uid) })); // /api/me
  accounts.mount(app); // /api/register, /api/login, /api/me, /api/logout
  app.use('/api', (_req, res) => res.status(404).json({ ok: false, code: 'NOT_FOUND', error: 'No encontrado' })); // lo que ninguna ruta de /api atendió
  app.use((err, req, res, next) => { // manejador final: nunca devuelve el stack al cliente (los errores de cuerpo mal formado conservan su 4xx)
    console.error('[http] ' + req.method + ' ' + req.path + ':', (err && err.stack) || err);
    if (res.headersSent) return next(err);
    const code = err && (err.status || err.statusCode);
    const st = code >= 400 && code < 500 ? code : 500;
    res.status(st).json({ ok: false, code: st === 500 ? 'SERVER_ERROR' : 'BAD_REQUEST', error: st === 500 ? 'Error del servidor. Inténtalo de nuevo.' : 'Solicitud no válida' });
  });
  community = require('./community')({ io, accounts, products, orders, removeProduct, cancelPending, pushOrder, guard });
  OFFICIAL = accounts.official();
  await loadChats();                   // chats guardados (y migración única de los mensajes antiguos a la tabla messages)
  if (OFFICIAL) for (const p of products.values()) if (p.ownerUid === OFFICIAL.uid) { p.official = true; p.ownerName = OFFICIAL.name; }
  seedCatalog();                       // crea solo lo que falta (sin duplicar ni recrear lo eliminado)
  accounts.onSecretChange((uid) => io.in('u:' + uid).disconnectSockets(true)); // secret rotado: fuera los sockets viejos
  expireOrders();                      // pedidos pendientes vencidos mientras el servidor estuvo apagado
  setInterval(expireOrders, 5 * 60e3).unref(); // y cada 5 minutos
  accounts.onRegister(sendWelcome);    // bienvenida automática a cada cuenta al verificar su correo
  await refreshStorage(true);          // mide el espacio al arrancar y cada 10 min (solo con PostgreSQL)
  setInterval(() => { if (db.status().lastWriteAt > storage.at) refreshStorage(true); }, 10 * 60e3).unref(); // solo si hubo escrituras desde la última medición: sin tráfico, Neon puede dormir
  setInterval(() => { // resumen de eventos de seguridad (sin datos personales)
    const items = Object.entries(sec).filter(([, v]) => v);
    if (items.length) console.warn('[seguridad] últimos 10 min: ' + items.map(([k, v]) => k + '=' + v).join(' · '));
    for (const k of Object.keys(sec)) sec[k] = 0;
  }, 10 * 60e3).unref();
  if (opt.listen !== false) {
    server.listen(PORT, () => console.log('U2U en vivo escuchando en el puerto ' + PORT));
    db.releaseInitial(['messages', 'convs']); // ya están en memoria (loadChats): no se guardan dos veces
  }
}

/* Cierre ordenado: deja de aceptar eventos, desconecta a los clientes, guarda lo pendiente y sale. Una segunda señal sale de inmediato. */
async function shutdown(code, why) {
  if (shuttingDown) { console.warn('[proc] segunda señal: salida inmediata'); return process.exit(code); }
  shuttingDown = true;
  console.log('[proc] cerrando (' + why + '): se guardan los cambios pendientes…');
  const hard = setTimeout(() => process.exit(code || 1), 10e3); if (hard.unref) hard.unref(); // si algo se cuelga, sale igual a los 10 s
  try { await io.close(); } catch (_) {} // desconecta a todos y cierra el servidor HTTP
  try { await db.flush(); } catch (e) { console.error('[proc] no se pudo vaciar la cola:', e.message); code = code || 1; }
  process.exit(code);
}

if (require.main === module) {
  ['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => shutdown(0, s))); // guarda lo pendiente al apagar
  process.on('unhandledRejection', (e) => console.error('[proc] unhandledRejection:', (e && e.stack) || e));
  process.on('uncaughtException', (e) => { console.error('[proc] uncaughtException:', (e && e.stack) || e); shutdown(1, 'uncaughtException'); }); // estado dudoso: se guarda y se sale para que Render reinicie limpio
  server.on('error', (e) => { console.error('[boot] error del servidor HTTP:', e.message); process.exit(1); }); // p. ej. puerto ocupado
  boot().catch((e) => { console.error('[boot] no se pudo iniciar:', e.message); process.exit(1); });
}

/* Para las pruebas (tests/bloque03.test.js): no las usa la app */
module.exports = {
  boot,
  _test: {
    publish, products, orders, convs, db, io, server, pubProduct, view, expireOrders, loadChats, fees, featured, removeProduct,
    presence, seedCatalog, reconcileReservations, cleanText, setOfficial: (o) => { OFFICIAL = o; },
    setStorageMb: (mb) => { storage.mb = mb; storage.at = Date.now(); },
    close: async () => { io.close(); await db.flush(); },
  },
};
