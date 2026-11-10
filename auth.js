/* U2U · cuentas de usuario (sin dependencias nuevas)
 * - Registro con correo UPC (@upc.edu.pe exacto) + código de 6 dígitos (v8.6.5, bloque 5). Login con usuario o correo + contraseña.
 * - Contraseña: crypto.scrypt con sal aleatoria. Nunca se guarda ni se registra en texto plano.
 * - Código de verificación: crypto.randomInt, se guarda SOLO su hash (con sal); vence a los 10 min, máx. 5 intentos
 *   (users.data.verify), reenvío cada 60 s. Sin verificar: no publica, reserva ni chatea (lo exige server.js con NOT_VERIFIED).
 *   Sin proveedor de correo, el código sale en la consola del servidor (el envío real es del bloque 6: setMailer).
 * - Sesión: token aleatorio de 256 bits; en el servidor solo se guarda su SHA-256 (30 días).
 * - Límite de intentos: por IP y por cuenta (bloqueo temporal).
 * - Cuentas, bloqueos y sesiones se guardan con db.js: PostgreSQL (DATABASE_URL) o archivos JSON.
 *   La cuenta admin (ADMIN_USER / ADMIN_PASS) vive solo en memoria y no se guarda en la base.
 */
const crypto = require('crypto');
const express = require('express');
const store = require('./db');

const SESSION_MS = 30 * 864e5, MAX_SESSIONS = 5;
const SCRYPT = { N: 16384, r: 8, p: 1 }, KEYLEN = 64;
const LOGIN_FAILS = 5, LOGIN_WINDOW = 15 * 60e3;   // 5 fallos por cuenta -> bloqueo de 15 min
const IP_MAX = 100, REG_MAX = 10;                  // por IP (holgado: varias personas comparten el WiFi del campus)
const WEAK = new Set(['12345678', '123456789', '1234567890', 'password', 'contraseña', 'qwertyui', '11111111', '00000000', 'abcd1234', 'u2u12345']);

/* Registro UPC (bloque 5) */
const UPC_DOMAIN = 'upc.edu.pe', TERMS_VERSION = '1.0';
const CODE_MS = 10 * 60e3, CODE_MAX_FAILS = 5, RESEND_MS = 60e3;
const CAMPUSES = ['Monterrico', 'San Isidro', 'Villa', 'San Miguel'];
const REG_CAREERS = ['Ing. Civil', 'Arquitectura', 'Sistemas', 'Negocios', 'Comunicaciones', 'Diseño de Moda', 'Salud', 'Otra'];
const CYCLES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const byName = new Map(), byEmail = new Map(), byUid = new Map(), bySess = new Map();

/* ---------- almacenamiento (db.js: PostgreSQL o archivos JSON) ---------- */
function index(u) {
  byName.set(u.username.toLowerCase(), u); byEmail.set(u.email, u); byUid.set(u.uid, u);
  (u.sessions || []).forEach((s) => bySess.set(s.h, u));
}
const userRow = (u) => { const { sessions, ...r } = u; return r; }; // la cuenta admin nunca se guarda
function load() {
  const by = new Map();
  store.rows('sessions').forEach((s) => { if (!by.has(s.uid)) by.set(s.uid, []); by.get(s.uid).push({ h: s.h, exp: s.exp }); });
  store.rows('users').forEach((r) => index({ ...r, sessions: by.get(r.uid) || [] }));
}
// Cuentas anteriores al bloque 5 no tienen el campo "verified": cuentan como verificadas. La admin también.
const isVerified = (u) => !!u && (u.admin === true || u.verified !== false);

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
// neu = true: formato nuevo {ok:false, code:'RATE_LIMIT', ...}; sin neu se mantiene el formato antiguo (login)
const tooMany = (res, b, neu) => res.status(429).json({ ...(neu ? { ok: false, code: 'RATE_LIMIT' } : {}), error: 'Demasiados intentos. Intenta de nuevo en ' + mins(b) + ' min.', retry: Math.ceil((b.reset - Date.now()) / 1000) });
const bad = (res, status, code, error, field) => res.status(status).json({ ok: false, code, error, field });

/* ---------- sesiones ---------- */
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
async function issue(u) { // la sesión queda guardada (sobrevive a reinicios); la del admin solo vive en memoria
  const token = crypto.randomBytes(32).toString('hex'), now = Date.now();
  const drop = (s) => { bySess.delete(s.h); if (!u.admin) store.sessions.del(s.h); };
  (u.sessions || []).filter((s) => s.exp <= now).forEach(drop);
  u.sessions = (u.sessions || []).filter((s) => s.exp > now);
  const s = { h: sha(token), exp: now + SESSION_MS };
  u.sessions.push(s);
  while (u.sessions.length > MAX_SESSIONS) drop(u.sessions.shift());
  bySess.set(s.h, u);
  if (!u.admin) await store.sessions.put({ h: s.h, uid: u.uid, exp: s.exp }, { sync: true });
  return token;
}
// Datos de la propia cuenta (nunca incluye el correo). admin: solo informativo; el servidor lo vuelve a comprobar en cada acción.
const pub = (u) => ({
  uid: u.uid, secret: u.secret, name: u.name, username: u.username, admin: !!u.admin, verified: isVerified(u),
  profile: u.cond ? { cond: u.cond, career: u.career, cycle: u.cycle, campus: u.campus, vis: u.vis || {} } : null,
});
// Lo que ven los demás: nombre, insignia y, solo si la persona lo permitió, carrera, ciclo y sede. Nunca correo ni usuario de login.
function publicProfile(u) {
  if (!u) return null;
  const p = { uid: u.uid, name: u.name, official: !!u.admin }, vis = u.vis || {};
  if (vis.career && u.career) p.career = u.career;
  if (vis.cycle && u.cycle) p.cycle = u.cycle;
  if (vis.campus && u.campus) p.campus = u.campus;
  return p;
}
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
const USER_RE = /^[a-z0-9_.]{3,20}$/i;
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
const ip = (req) => req.ip || (req.socket && req.socket.remoteAddress) || 'x';
/* Correo UPC: minúsculas, sin espacios, un solo @ y dominio EXACTO upc.edu.pe (no acepta subdominios ni sufijos).
   Sin "+" ni caracteres raros en la parte local: un buzón = una cuenta. Devuelve el correo normalizado o null. */
function parseUpcEmail(raw) {
  const s = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!s || s.length > 254 || /\s/.test(s)) return null;
  const parts = s.split('@');
  if (parts.length !== 2) return null;
  const local = parts[0], domain = parts[1];
  if (domain !== UPC_DOMAIN || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(local) || local.includes('..')) return null;
  return s;
}

/* ---------- código de verificación ---------- */
const codeHash = (salt, code) => sha(salt + ':' + code);
function newVerify(now) { // devuelve el código (solo para enviarlo) y el registro que se guarda (solo el hash)
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0'), salt = crypto.randomBytes(8).toString('hex');
  return { code, v: { salt, h: codeHash(salt, code), exp: now + CODE_MS, attempts: 0, sentAt: now } };
}
// Envío: el bloque 6 conecta el proveedor real con setMailer(fn). Por defecto: consola (sin correo, sin secretos).
let mailer = async (m) => { console.log('[auth] (modo consola) código de verificación de la cuenta ' + m.uid + ': ' + m.code + ' · vence en 10 min'); };
const sendCode = (u, code) => mailer({ to: u.email, name: u.name, uid: u.uid, code });
const saveUser = (u) => store.users.put(userRow(u), { sync: true });
// Cuenta a la que se refiere la petición: la de la sesión (Bearer) o, si no hay sesión, la del correo enviado
function whoFor(req, email) {
  const s = fromReq(req);
  if (s) return s.u;
  const e = parseUpcEmail(email);
  return e ? byEmail.get(e) || null : null;
}

/* ---------- cuenta de administrador (SOLO por variables de entorno) ----------
 * ADMIN_USER y ADMIN_PASS se leen únicamente del entorno del servidor: nunca están en el código ni en el HTML.
 * La cuenta vive solo en memoria (no se escribe en users.json) y pasa por el mismo login con scrypt y límite de intentos.
 * El rol se asigna aquí, en el servidor; el cliente no puede pedirlo ni declararlo.
 */
let OFFICIAL = null; // { uid, name } de la cuenta oficial (la misma cuenta admin)
let onReg = null;    // aviso de cuenta verificada (bienvenida)
const nrm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function setupAdmin() {
  const user = String(process.env.ADMIN_USER || '').trim(), pass = String(process.env.ADMIN_PASS || '');
  if (!user && !pass) return console.log('[auth] Admin desactivado: define ADMIN_USER y ADMIN_PASS para habilitarlo.');
  if (!USER_RE.test(user)) return console.error('[auth] Admin desactivado: ADMIN_USER debe tener 3 a 20 caracteres (letras, números, _ y .).');
  if (pass.length < 10 || pass.length > 128) return console.error('[auth] Admin desactivado: ADMIN_PASS debe tener entre 10 y 128 caracteres.');
  if (byName.has(user.toLowerCase())) return console.error('[auth] Admin desactivado: ya existe una cuenta registrada con el usuario "' + user + '". Elige otro ADMIN_USER.');
  // nombre PÚBLICO (OFFICIAL_NAME). El usuario de login nunca se muestra a otros usuarios
  let name = clean(process.env.OFFICIAL_NAME || '', 24);
  if (name.length < 2) name = 'U2U Oficial';
  OFFICIAL = { uid: 'u_admin', name };
  const salt = crypto.randomBytes(16), k = crypto.scryptSync(pass, salt, KEYLEN, SCRYPT);
  index({
    // uid FIJO (no depende de ADMIN_USER, ADMIN_PASS ni de reinicios): los productos oficiales siguen siendo suyos siempre
    uid: 'u_admin', secret: crypto.createHmac('sha256', pass).update('u2u-admin-secret-v1').digest('hex').slice(0, 48),
    username: user, email: 'admin@u2u.invalid', name, admin: true, verified: true, createdAt: Date.now(), sessions: [],
    hash: ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), k.toString('base64')].join('$'),
  });
  console.log('[auth] Cuenta oficial habilitada · nombre público: "' + name + '"');
}

function mount(app) {
  load();
  setupAdmin();
  const api = express.Router();
  api.use(express.json({ limit: '8kb' }));
  api.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  /* Registro: crea la cuenta SIN verificar y envía el código. Entrega sesión para poder pedir otro código, pero
     sin verificar no puede publicar, reservar ni chatear. Todo se valida aquí, nunca en el cliente. */
  api.post('/register', async (req, res) => {
    try {
      const ipb = bucket('ip:' + ip(req), LOGIN_WINDOW);
      if (++ipb.n > IP_MAX) return tooMany(res, ipb, true);
      const rb = bucket('reg:' + ip(req), 3600e3); // cuentas creadas por hora desde esta IP
      if (rb.n >= REG_MAX) return tooMany(res, rb, true);
      const d = req.body || {}, vi = d.visibility && typeof d.visibility === 'object' ? d.visibility : {};
      const name = clean(d.name, 24), email = parseUpcEmail(d.email), pw = String(d.password || '');
      const cond = String(d.cond || '').toLowerCase(), career = String(d.career || ''), campus = String(d.campus || '');
      const cycle = String(d.cycle == null ? '' : d.cycle).trim().replace(/^egresado$/i, 'Egresado');
      if (name.length < 2) return bad(res, 400, 'INVALID', 'Escribe tu nombre (mínimo 2 letras).', 'name');
      if (!email) return bad(res, 400, 'INVALID', 'Usa tu correo UPC (usuario@upc.edu.pe).', 'email');
      if (pw.length < 8 || pw.length > 128) return bad(res, 400, 'INVALID', 'La contraseña debe tener entre 8 y 128 caracteres.', 'password');
      if (WEAK.has(pw.toLowerCase()) || pw.toLowerCase() === email || pw.toLowerCase() === email.split('@')[0]) return bad(res, 400, 'INVALID', 'Esa contraseña es muy fácil de adivinar. Elige otra.', 'password');
      if (!['estudiante', 'egresado'].includes(cond)) return bad(res, 400, 'INVALID', 'Indica si eres estudiante o egresado.', 'cond');
      if (!REG_CAREERS.includes(career)) return bad(res, 400, 'INVALID', 'Elige tu carrera (o «Otra»).', 'career');
      if (cond === 'egresado' ? cycle !== 'Egresado' : !CYCLES.includes(cycle)) return bad(res, 400, 'INVALID', cond === 'egresado' ? 'Los egresados usan el ciclo «Egresado».' : 'Elige tu ciclo (1 a 10).', 'cycle');
      if (!CAMPUSES.includes(campus)) return bad(res, 400, 'INVALID', 'Elige tu sede.', 'campus');
      if (d.terms !== true) return bad(res, 400, 'INVALID', 'Debes aceptar los términos para registrarte.', 'terms');
      if (OFFICIAL && (nrm(name).includes(nrm(OFFICIAL.name)) || /u2u(oficial|admin)|oficialu2u|administrador/.test(nrm(name)))) return bad(res, 400, 'INVALID', 'Ese nombre está reservado para la cuenta oficial.', 'name');
      if (byEmail.has(email)) return bad(res, 409, 'INVALID', 'Ese correo ya está registrado. Si no lo verificaste, pide un código nuevo.', 'email');

      const hash = await hashPw(pw);
      if (byEmail.has(email)) return bad(res, 409, 'INVALID', 'Ese correo ya está registrado.', 'email'); // carrera
      const now = Date.now(), uid = 'u_' + crypto.randomBytes(6).toString('hex'), nv = newVerify(now);
      const u = {
        uid, secret: crypto.randomBytes(24).toString('hex'),
        username: uid, // interno: se entra con el correo; nunca se muestra
        email, name, hash, createdAt: now, sessions: [],
        cond, career, cycle, campus,
        terms: { version: TERMS_VERSION, at: now },
        vis: { career: vi.career === true, cycle: vi.cycle === true, campus: vi.campus === true }, // privado por defecto
        verified: false, verify: nv.v,
      };
      try { await saveUser(u); } // guardada antes de responder
      catch (e) { if (e.code === '23505') return bad(res, 409, 'INVALID', 'Ese correo ya está registrado.', 'email'); throw e; }
      index(u); rb.n++;
      const token = await issue(u);
      try { await sendCode(u, nv.code); } catch (e) { console.error('[auth] no se pudo enviar el código:', e.message); } // la cuenta existe: puede pedir otro con /resend
      res.status(201).json({ ok: true, token, user: pub(u), verify: { expiresIn: CODE_MS / 1000, resendIn: RESEND_MS / 1000 } });
    } catch (e) { console.error('[auth] register', e.message); res.status(500).json({ ok: false, error: 'Error del servidor. Intenta de nuevo.' }); }
  });

  /* Verificar: {code} con sesión, o {email, code} sin sesión. 5 códigos mal bloquean ese código (hay que pedir otro). */
  api.post('/verify', async (req, res) => {
    try {
      const b = bucket('vf:' + ip(req), LOGIN_WINDOW);
      if (++b.n > 60) return tooMany(res, b, true);
      const d = req.body || {}, code = String(d.code == null ? '' : d.code).replace(/\s/g, '');
      if (!/^\d{6}$/.test(code)) return bad(res, 400, 'INVALID', 'El código tiene 6 dígitos.', 'code'); // no gasta intentos
      const u = whoFor(req, d.email);
      if (!u) return bad(res, 400, 'CODE_INVALID', 'Código incorrecto.', 'code');
      if (isVerified(u)) return res.json({ ok: true, verified: true, user: pub(u) }); // idempotente
      // desde aquí y hasta el primer await todo es síncrono: dos peticiones a la vez no pueden gastar ni validar de más
      const v = u.verify, now = Date.now();
      if (!v) return bad(res, 400, 'CODE_EXPIRED', 'Tu código venció. Pide uno nuevo.', 'code');
      if (v.attempts >= CODE_MAX_FAILS) return bad(res, 429, 'RATE_LIMIT', 'Demasiados intentos fallidos. Pide un código nuevo.', 'code');
      if (v.exp <= now) return bad(res, 400, 'CODE_EXPIRED', 'Tu código venció. Pide uno nuevo.', 'code');
      const want = Buffer.from(v.h), got = Buffer.from(codeHash(v.salt, code));
      if (!(want.length === got.length && crypto.timingSafeEqual(want, got))) {
        v.attempts++;
        await saveUser(u); // los intentos sobreviven a un reinicio (users.data.verify)
        return v.attempts >= CODE_MAX_FAILS
          ? bad(res, 429, 'RATE_LIMIT', 'Demasiados intentos fallidos. Pide un código nuevo.', 'code')
          : bad(res, 400, 'CODE_INVALID', 'Código incorrecto. Te quedan ' + (CODE_MAX_FAILS - v.attempts) + ' intentos.', 'code');
      }
      u.verified = true; u.verifiedAt = now; delete u.verify;
      try { await saveUser(u); }
      catch (e) { u.verified = false; delete u.verifiedAt; u.verify = v; throw e; } // no quedó guardado: sigue sin verificar
      if (onReg) { try { onReg(u); } catch (e) { console.error('[auth] bienvenida:', e.message); } } // bienvenida solo tras verificar
      res.json({ ok: true, verified: true, user: pub(u) });
    } catch (e) { console.error('[auth] verify', e.message); res.status(500).json({ ok: false, error: 'Error del servidor. Intenta de nuevo.' }); }
  });

  /* Reenviar: código nuevo (invalida el anterior y reinicia los intentos), como mucho uno cada 60 s */
  api.post('/resend', async (req, res) => {
    try {
      const b = bucket('rs:' + ip(req), LOGIN_WINDOW);
      if (++b.n > 60) return tooMany(res, b, true);
      const u = whoFor(req, (req.body || {}).email);
      if (!u || isVerified(u)) return res.json({ ok: true, resendIn: RESEND_MS / 1000 }); // no revela si el correo existe
      const now = Date.now(), old = u.verify;
      if (old && now - old.sentAt < RESEND_MS) {
        const wait = Math.ceil((RESEND_MS - (now - old.sentAt)) / 1000);
        return res.status(429).json({ ok: false, code: 'RATE_LIMIT', error: 'Espera ' + wait + ' s para pedir otro código.', retry: wait });
      }
      const nv = newVerify(now);
      u.verify = nv.v; // síncrono: una segunda petición idéntica ya encuentra sentAt = ahora
      try { await saveUser(u); } catch (e) { u.verify = old; throw e; }
      try { await sendCode(u, nv.code); } catch (e) { console.error('[auth] no se pudo enviar el código:', e.message); }
      res.json({ ok: true, resendIn: RESEND_MS / 1000, expiresIn: CODE_MS / 1000 });
    } catch (e) { console.error('[auth] resend', e.message); res.status(500).json({ ok: false, error: 'Error del servidor. Intenta de nuevo.' }); }
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
      res.json({ token: await issue(u), user: pub(u) });
    } catch (e) { console.error('[auth] login', e.message); res.status(500).json({ error: 'Error del servidor. Intenta de nuevo.' }); }
  });

  api.get('/me', (req, res) => {
    const b = bucket('me:' + ip(req), 60e3);
    if (++b.n > 120) return tooMany(res, b);
    const s = fromReq(req);
    if (!s) return res.status(401).json({ error: 'Sesión no válida' });
    if (s.s.exp - Date.now() < SESSION_MS - 864e5) { s.s.exp = Date.now() + SESSION_MS; if (!s.u.admin) store.sessions.put({ h: s.s.h, uid: s.u.uid, exp: s.s.exp }); } // sesión deslizante
    res.json({ user: pub(s.u) });
  });

  api.post('/logout', (req, res) => {
    const s = fromReq(req);
    if (s) { s.u.sessions = s.u.sessions.filter((x) => x.h !== s.h); bySess.delete(s.h); if (!s.u.admin) store.sessions.del(s.h); }
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
  store.users.put(userRow(u));
  if (flag) store.sessions.delByUid(u.uid);
  return u;
}
const listBlocked = () => [...byUid.values()].filter((u) => u.blocked && !u.admin).map((u) => ({ uid: u.uid, name: u.name, username: u.username, blockedAt: u.blockedAt || 0 }));

module.exports = {
  mount, accountFor, check, getByUid, setBlocked, listBlocked, flush: () => store.flush(), official: () => OFFICIAL,
  onRegister: (fn) => { onReg = fn; },          // se llama al VERIFICAR la cuenta (no al crearla)
  isVerified, publicProfile, parseUpcEmail,
  setMailer: (fn) => { if (typeof fn === 'function') mailer = fn; }, // bloque 6: proveedor real de correo
};
