/* U2U · migración única: sube a PostgreSQL (Neon) lo que ya tengas en archivos JSON (data/ o DATA_DIR).
 * Uso:  npm run migrate        (necesita DATABASE_URL en tu .env o en el entorno)
 * Es seguro repetirlo: no duplica nada (actualiza por clave). No borra tus archivos. */
require('./env');
if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL. Cópiala de Neon en tu archivo .env y vuelve a ejecutar.'); process.exit(1); }
const db = require('./db');
(async () => {
  const rows = db.readFiles();              // lee los JSON (formato nuevo y el anterior)
  await db.init();                          // conecta y crea las tablas
  for (const t of ['users', 'sessions', 'products', 'orders', 'reports', 'reviews', 'removed', 'convs', 'messages']) {
    const n = rows[t].length ? await db.importRows(t, rows[t]) : 0;
    console.log('  ' + t.padEnd(9) + n + ' registros');
  }
  console.log('Listo. Ya puedes iniciar el servidor: npm start');
  await db.flush();
  process.exit(0);
})().catch((e) => { console.error('Error de migración:', e.message); process.exit(1); });
