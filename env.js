/* Carga variables de entorno desde .env (solo en tu computadora). En Render se definen en el panel (Environment).
 * Lo que ya venga definido en el entorno tiene prioridad sobre el .env. El archivo .env está en .gitignore.
 * Sin dependencias nuevas. */
try {
  const f = require('path').join(__dirname, '.env');
  if (require('fs').existsSync(f)) {
    require('fs').readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);
      if (!m || l.trim().startsWith('#')) return;
      let v = m[2];
      if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    });
  }
} catch (e) { console.warn('[env] no se pudo leer .env:', e.message); }
