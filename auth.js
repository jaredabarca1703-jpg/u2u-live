/* U2U · cuentas de usuario (sin dependencias nuevas)
 * - Registro / login con usuario o correo + contraseña.
 * - Contraseña: crypto.scrypt con sal aleatoria. Nunca se guarda ni se registra en texto plano.
 * - Sesión: token aleatorio de 256 bits; en el servidor solo se guarda su SHA-256 (30 días).
 * - Límite de intentos: por IP y por cuenta (bloqueo temporal).
 * - Cuentas en data/users.json (carpeta ignorada por git; configurable con DATA_DIR).
 *   OJO: en Render el disco es efímero, el archivo se borra al redesplegar.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DIR, 'users.json');
const SESSION_MS = 30 * 864e5, MAX_SESSIONS = 5;
const SCRYPT = { N: 16384, r: 8, p: 1 }, KEYLEN = 64;
const LOGIN_FAILS = 5, LOGIN_WINDOW = 15 * 60e3;   // 5 fallos por cuenta -> bloqueo de 15 min
const IP_MAX = 100, REG_MAX = 10;                  // por IP (holgado: varias personas comparten el WiFi del campus)
const WEAK = new Set(['12345678', '123456789', '1234567890', 'password', 'contraseña', 'qwertyui', '11111111', '00000000', 'abcd1234', 'u2u12345']);

let db = { version: 1, users: [] };
const byName = new Map(), byEmail = new Map(), byUid = new Map(), bySess = new Map();

/* ---------- almacenamiento en archivo ---------- */
function index(u) {
  byName.set(u.username.toLowerCase(), u); byEmail.set(u.email, u); byUid.set(u.uid, u);
  (u.sessions || []).forEach((s) => bySess.set(s.h, u));
}
function load() {
  fs.mkdirSync(DIR, { recursive: true });
  try {
    db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!db || !Array.isArray(db.users)) throw new Error('formato');
  } catch (e) {
    if (e.code !== 'ENOENT') { // archivo dañado: se respalda (no se pierde) y se arranca vacío
      try { fs.renameSync(FILE, path.join(DIR, 'users.corrupt-' + Date.now() + '.json')); } catch (_) {}
      console.warn('[auth] users.json ilegible: respaldado, se inicia sin cuentas');
    }
    db = { version: 1, users: [] };
  }
  db.users.forEach(index);
}
let timer = null;
function flush() {
  clearTimeout(timer);
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE); // escritura atómica: nunca queda a medias
  } catch (e) { console.error('[auth] no se pudo guardar users.json:', e.message); }
}
const saveSoon = () => { clearTimeout(timer); timer = setTimeout(flush, 300); };

/* ---------- contraseñas ---------- */
const scrypt = (pw, salt, len, o) => new Promise((ok, no) => crypto.scrypt(pw, salt, len, o, (e, k) => (e ? no(e) : ok(k))));
async function hashPw(pw) {
  const salt = crypto.randomBytes(16), k = await scrypt(pw, salt, KEYLEN, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), k.toString('base64')].join('$');
}
async function checkPw(pw, stored) {
  const [a, N, r, p, s, h] = String(stored).split('$');
  if (a !== 'scrypt' || !h) return false;
  const want = Buffer.from(h, 'base64');
  const got = await scrypt(pw, Buffer.from(s, 'base64'), want.length, { N: +N, r: +r, p: +p });
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
let dummy = null; // para que "usuario inexistente" tarde lo mismo que "contraseña mala"
const dummyHash = () => dummy || (dummy = hashPw(crypto.randomBytes(8).toString('hex')));

/* ---------- límite de intentos ---------- */
const hits = new Map();
function bucket(key, ms) {
  const now = Date.now();
  let b = hits.get(key);
  if (!b || b.reset <= now) {
    if (hits.size > 20000) hits.delete(hits.keys().next().value);
    b = { n: 0, reset: now + ms }; hits.set(key, b);
  }
  return b;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of hits) if (b.reset <= now) hits.delete(k); }, 10 * 60e3).unref();
const mins = (b) => Math.max(1, Math.ceil((b.reset - Date.now()) / 60e3));
const tooMany = (res, b) => res.status(429).json({ error: 'Demasiados intentos. Intenta de nuevo en ' + mins(b) + ' min.', retry: Math.ceil((b.reset - Date.now()) / 1000) });

/* ---------- sesiones ---------- */
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function issue(u) {
  const token = crypto.randomBytes(32).toString('hex'), now = Date.now();
  u.sessions = (u.sessions || []).filter((s) => s.exp > now);
  u.sessions.push({ h: sha(token), exp: now + SESSION_MS });
  while (u.sessions.length > MAX_SESSIONS) bySess.delete(u.sessions.shift().h);
  bySess.set(u.sessions[u.sessions.length - 1].h, u);
  saveSoon();
  return token;
}
const pub = (u) => ({ uid: u.uid, secret: u.secret, name: u.name, username: u.username, admin: !!u.admin }); // admin: solo informativo para la interfaz; el servidor lo vuelve a comprobar en cada acción
function fromReq(req) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const h = sha(m[1]), u = bySess.get(h), now = Date.now();
  const s = u && (u.sessions || []).find((x) => x.h === h);
  if (!s || s.exp <= now) { bySess.delete(h); return null; }
  if (u.blocked) return null; // cuenta bloqueada: la sesión ya no sirve
  return { u, s, h };
}

/* ---------- validación ---------- */
const USER_RE = /^[a-z0-9_.]{3,20}$/i, EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
const ip = (req) => req.ip || (req.socket && req.socket.remoteAddress) || 'x';

/* ---------- cuenta de administrador (SOLO por variables de entorno) ----------
 * ADMIN_USER y ADMIN_PASS se leen únicamente del entorno del servidor: nunca están en el código ni en el HTML.
 * La cuenta vive solo en memoria (no se escribe en users.json) y pasa por el mismo login con scrypt y límite de intentos.
 * El rol se asigna aquí, en el servidor; el cliente no puede pedirlo ni declararlo.
 */
function setupAdmin() {
  const user = String(process.env.ADMIN_USER || '').trim(), pass = String(process.env.ADMIN_PASS || '');
  if (!user && !pass) return console.log('[auth] Admin desactivado: define ADMIN_USER y ADMIN_PASS para habilitarlo.');
  if (!USER_RE.test(user)) return console.error('[auth] Admin desactivado: ADMIN_USER debe tener 3 a 20 caracteres (letras, números, _ y .).');
  if (pass.length < 10 || pass.length > 128) return console.error('[auth] Admin desactivado: ADMIN_PASS debe tener entre 10 y 128 caracteres.');
  if (byName.has(user.toLowerCase())) return console.error('[auth] Admin desactivado: ya existe una cuenta registrada con el usuario "' + user + '". Elige otro ADMIN_USER.');
  const salt = crypto.randomBytes(16), k = crypto.scryptSync(pass, salt, KEYLEN, SCRYPT);
  index({
    uid: 'u_admin', secret: crypto.createHmac('sha256', pass).update('u2u-admin-secret-v1').digest('hex').slice(0, 48),
    username: user, email: 'admin@u2u.invalid', name: 'Administrador', admin: true, createdAt: Date.now(), sessions: [],
    hash: ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), k.toString('base64')].join('$'),
  });
  console.log('[auth] Admin habilitado para el usuario "' + user + '".');
}

function mount(app) {
  load();
  setupAdmin();
  const api = express.Router();
  api.use(express.json({ limit: '8kb' }));
  api.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  api.post('/register', async (req, res) => {
    try {
      const ipb = bucket('ip:' + ip(req), LOGIN_WINDOW);
      if (++ipb.n > IP_MAX) return tooMany(res, ipb);
      const rb = bucket('reg:' + ip(req), 3600e3); // cuentas creadas por hora desde esta IP
      if (rb.n >= REG_MAX) return tooMany(res, rb);
      const d = req.body || {};
      const name = clean(d.name, 24), username = clean(d.username, 20), email = clean(d.email, 254).toLowerCase(), pw = String(d.password || '');
      if (name.length < 2) return res.status(400).json({ error: 'Escribe tu nombre (mínimo 2 letras).', field: 'name' });
      if (!USER_RE.test(username)) return res.status(400).json({ error: 'Usuario: 3 a 20 caracteres (letras, números, _ y .).', field: 'username' });
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Escribe un correo válido.', field: 'email' });
      if (pw.length < 8 || pw.length > 128) return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 128 caracteres.', field: 'password' });
      if (WEAK.has(pw.toLowerCase()) || pw.toLowerCase() === username.toLowerCase() || pw.toLowerCase() === email) return res.status(400).json({ error: 'Esa contraseña es muy fácil de adivinar. Elige otra.', field: 'password' });
      if (byName.has(username.toLowerCase())) return res.status(409).json({ error: 'Ese usuario ya está en uso.', field: 'username' });
      if (byEmail.has(email)) return res.status(409).json({ error: 'Ese correo ya está registrado.', field: 'email' });

      const hash = await hashPw(pw);
      if (byName.has(username.toLowerCase()) || byEmail.has(email)) return res.status(409).json({ error: 'Ese usuario o correo ya está en uso.' }); // carrera
      const u = {
        uid: 'u_' + crypto.randomBytes(6).toString('hex'), secret: crypto.randomBytes(24).toString('hex'),
        username, email, name, hash, createdAt: Date.now(), sessions: [],
      };
      db.users.push(u); index(u); rb.n++;
      const token = issue(u);
      saveSoon();
      res.status(201).json({ token, user: pub(u) });
    } catch (e) { console.error('[auth] register', e.message); res.status(500).json({ error: 'Error del servidor. Intenta de nuevo.' }); }
  });

  api.post('/login', async (req, res) => {
    try {
      const ipb = bucket('ip:' + ip(req), LOGIN_WINDOW);
      if (++ipb.n > IP_MAX) return tooMany(res, ipb);
      const d = req.body || {};
      const id = clean(d.id, 254).toLowerCase(), pw = String(d.password || '').slice(0, 128);
      if (!id || !pw) return res.status(400).json({ error: 'Completa usuario o correo y contraseña.' });
      const acc = bucket('acc:' + id, LOGIN_WINDOW);
      if (acc.n >= LOGIN_FAILS) return tooMany(res, acc); // cuenta bloqueada: ni siquiera se calcula el hash

      const u = id.includes('@') ? byEmail.get(id) : byName.get(id);
      const ok = await checkPw(pw, u ? u.hash : await dummyHash());
      if (!u || !ok) {
        if (++acc.n >= LOGIN_FAILS) { acc.reset = Date.now() + LOGIN_WINDOW; return tooMany(res, acc); }
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' }); // mismo mensaje exista o no el usuario
      }
      hits.delete('acc:' + id);
      if (u.blocked) return res.status(403).json({ error: 'Tu cuenta fue bloqueada por incumplir las normas de la comunidad.', blocked: true });
      res.json({ token: issue(u), user: pub(u) });
    } catch (e) { console.error('[auth] login', e.message); res.status(500).json({ error: 'Error del servidor. Intenta de nuevo.' }); }
  });

  api.get('/me', (req, res) => {
    const b = bucket('me:' + ip(req), 60e3);
    if (++b.n > 120) return tooMany(res, b);
    const s = fromReq(req);
    if (!s) return res.status(401).json({ error: 'Sesión no válida' });
    if (s.s.exp - Date.now() < SESSION_MS - 864e5) { s.s.exp = Date.now() + SESSION_MS; saveSoon(); } // sesión deslizante
    res.json({ user: pub(s.u) });
  });

  api.post('/logout', (req, res) => {
    const s = fromReq(req);
    if (s) { s.u.sessions = s.u.sessions.filter((x) => x.h !== s.h); bySess.delete(s.h); saveSoon(); }
    res.json({ ok: true });
  });

  api.use((_req, res) => res.status(404).json({ error: 'No encontrado' }));
  api.use((err, _req, res, _next) => res.status(400).json({ error: 'Solicitud no válida' }));
  app.use('/api', api);
}

/* Socket.io: solo entran cuentas registradas, con su uid + secreto emitidos por el servidor */
function check(uid, secret) {
  const u = byUid.get(String(uid || ''));
  if (!u) return null;
  const a = Buffer.from(String(secret || '')), b = Buffer.from(u.secret);
  if (!(a.length === b.length && crypto.timingSafeEqual(a, b))) return null;
  return { u, blocked: !!u.blocked };
}
function accountFor(uid, secret) { const c = check(uid, secret); return c && !c.blocked ? c.u : null; }

/* ---------- moderación: bloqueo de cuentas (se guarda en users.json) ---------- */
const getByUid = (uid) => byUid.get(String(uid || '')) || null;
function setBlocked(uid, flag) {
  const u = getByUid(uid);
  if (!u || u.admin) return null; // la cuenta admin no se puede bloquear
  if (flag) {
    u.blocked = true; u.blockedAt = Date.now();
    (u.sessions || []).forEach((s) => bySess.delete(s.h)); // se revocan todas sus sesiones
    u.sessions = [];
  } else { delete u.blocked; delete u.blockedAt; }
  saveSoon();
  return u;
}
const listBlocked = () => db.users.filter((u) => u.blocked).map((u) => ({ uid: u.uid, name: u.name, username: u.username, blockedAt: u.blockedAt || 0 }));

module.exports = { mount, accountFor, check, getByUid, setBlocked, listBlocked, flush };
