/* Carga variables de entorno desde .env (solo en tu computadora). En Render se definen en el panel (Environment).
 * Lo que ya venga definido en el entorno tiene prioridad sobre el .env. El archivo .env está en .gitignore.
 * Sin dependencias nuevas.
 * Auditoría lote 1: (L1-34) se avisa —solo con el NOMBRE de la variable— cuando un valor sin comillas contiene « #» (los comentarios al final de línea no se admiten).
 * (El BOM de UTF-8 al inicio del archivo ya se toleraba: \s lo absorbe. No hace falta tratarlo.)
 * (L1-33) validate(): resumen de la configuración efectiva (sin secretos) y avisos de valores inválidos o peligrosos en producción. */
const suspicious = [];
try {
  const f = require('path').join(__dirname, '.env');
  if (require('fs').existsSync(f)) {
    require('fs').readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);
      if (!m || l.trim().startsWith('#')) return;
      let v = m[2];
      if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
      else if (/\s#/.test(v)) suspicious.push(m[1]);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    });
  }
} catch (e) { console.warn('[env] no se pudo leer .env:', e.message); }
if (suspicious.length) console.warn('[env] OJO: ' + suspicious.join(', ') + ' contiene « #». Los comentarios al final de línea NO se admiten: si no es parte del valor, bórralo o pon el comentario en su propia línea.');

/* Revisa la configuración. Devuelve { warnings, summary }. Solo lanza error con STRICT_ENV=true (y hay avisos).
 * Nunca imprime valores secretos: solo si están definidos. opt.quiet = no imprime (pruebas). */
function validate(opt) {
  opt = opt || {};
  const env = process.env, warnings = [];
  const isProd = env.NODE_ENV === 'production' || !!env.RENDER;
  const has = (k) => String(env[k] == null ? '' : env[k]).trim() !== '';
  const posInt = (k) => { const n = parseInt(env[k], 10); return Number.isFinite(n) && n > 0; };
  for (const k of ['PUB_LIMIT_USER', 'STORAGE_LIMIT_MB', 'ORDER_TTL_HOURS', 'EMAIL_DAILY_LIMIT', 'EMAIL_IP_PER_HOUR', 'FEATURE_DAYS', 'MAX_FEATURED', 'MSG_DAILY_LIMIT', 'MSG_CONV_LIMIT', 'CONV_NEW_DAILY_LIMIT']) {
    if (has(k) && !posInt(k)) warnings.push(k + ' no es un entero positivo: se usará el valor por defecto');
  }
  for (const k of ['RATE_API_PER_MIN', 'RATE_FOTO_PER_MIN', 'PG_QUERY_TIMEOUT_MS']) {
    if (has(k) && !(Number.isFinite(parseInt(env[k], 10)) && parseInt(env[k], 10) >= 0)) warnings.push(k + ' no es un número válido: se usará el valor por defecto');
  }
  if (has('COMMISSION_RATE')) { const r = Number(env.COMMISSION_RATE); if (!(r > 0 && r < 1)) warnings.push('COMMISSION_RATE debe estar entre 0 y 1 (0.03 = 3 %)'); }
  if (has('FEATURE_PRICE') && !(Number(env.FEATURE_PRICE) > 0)) warnings.push('FEATURE_PRICE no es válido: se usará el valor por defecto');
  const oneOf = (k, list) => { if (has(k) && !list.includes(String(env[k]).trim().toLowerCase())) warnings.push(k + '="' + env[k] + '" no es válido (usa: ' + list.join(' | ') + ')'); };
  oneOf('COMMISSION_MODE', ['off', 'shadow', 'active']);
  oneOf('COMMISSION_BLOCK_SCOPE', ['all', 'new']);
  oneOf('FEATURE_MODE', ['off', 'free', 'paid']);
  oneOf('EMAIL_PROVIDER', ['brevo']);
  if (env.RENDER && env.NODE_ENV !== 'production') warnings.push('NODE_ENV no es "production" en Render: Express puede mostrar detalles de errores. Defínelo en Environment.');
  if (!has('ADMIN_USER') || !has('ADMIN_PASS')) warnings.push('Sin ADMIN_USER/ADMIN_PASS: no habrá cuenta oficial ni panel de moderación.');
  else if (String(env.ADMIN_PASS).length < 10) warnings.push('ADMIN_PASS tiene menos de 10 caracteres.');
  const mailOk = has('EMAIL_PROVIDER') && has('BREVO_API_KEY') && has('EMAIL_FROM') && String(env.EMAIL_DEV_MODE).toLowerCase() !== 'true';
  if (isProd && !mailOk && String(env.REGISTRO_MANUAL).toLowerCase() !== 'true') {
    warnings.push('Correo no configurado (o EMAIL_DEV_MODE=true) en producción: los códigos de verificación y recuperación SALDRÁN EN EL LOG del servidor.');
  }
  const yn = (k) => (has(k) ? 'sí' : 'no');
  const summary = '[config] ' + (has('DATABASE_URL') ? 'base=PostgreSQL' : 'base=archivos') + ' · producción=' + (isProd ? 'sí' : 'no')
    + ' · comisión=' + (env.COMMISSION_MODE || 'off') + ' · destacados=' + (env.FEATURE_MODE || 'off')
    + ' · secretos definidos: ADMIN_PASS=' + yn('ADMIN_PASS') + ' DATABASE_URL=' + yn('DATABASE_URL') + ' BREVO_API_KEY=' + yn('BREVO_API_KEY') + ' YAPE_NUMBER=' + yn('YAPE_NUMBER');
  if (!opt.quiet) { console.log(summary); warnings.forEach((w) => console.warn('[config] AVISO: ' + w)); }
  if (warnings.length && String(env.STRICT_ENV).toLowerCase() === 'true') throw new Error('Configuración con avisos (STRICT_ENV=true): ' + warnings.join(' | '));
  return { warnings, summary };
}
module.exports = { validate };
