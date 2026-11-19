/* U2U · importación única: sube a PostgreSQL (Neon) lo que ya tengas en archivos JSON (data/ o DATA_DIR).
 * (No migra el esquema: las tablas e índices los crea/actualiza db.js al iniciar el servidor.)
 * Uso:  npm run migrate                  (necesita DATABASE_URL en tu .env o en el entorno)
 *       npm run migrate -- --dry-run     (simulacro: cuenta lo que haría, no escribe nada)
 *       npm run migrate -- --overwrite   (ATENCIÓN: pisa filas que ya existan en la base con lo que haya en los archivos)
 * Por defecto SOLO AGREGA lo que falta: repetirlo es seguro y no revierte cuentas, pedidos ni mensajes más nuevos que ya estén en la base.
 * Una fila con error se omite (se avisa) y el resto continúa. No borra tus archivos. */
require('./env');
if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL. Cópiala de Neon en tu archivo .env y vuelve a ejecutar.'); process.exit(1); }
const args = process.argv.slice(2);
const overwrite = args.includes('--overwrite'), dry = args.includes('--dry-run');
const db = require('./db');
const host = (() => { try { return new URL(process.env.DATABASE_URL).host; } catch (_) { return '(no se pudo leer el host)'; } })();
(async () => {
  console.log('Destino: ' + host + ' · modo: ' + (dry ? 'SIMULACRO (no escribe nada)' : overwrite ? 'SOBRESCRIBIR (--overwrite)' : 'solo agregar lo que falta (no pisa nada)'));
  const rows = db.readFiles();              // lee los JSON (formato nuevo y el anterior)
  await db.init();                          // conecta y crea las tablas
  let errors = 0;
  for (const t of ['users', 'sessions', 'products', 'orders', 'reports', 'reviews', 'removed', 'convs', 'messages', 'featured']) {
    const r = rows[t].length ? await db.importRows(t, rows[t], { overwrite, dryRun: dry }) : { total: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };
    errors += r.errors;
    console.log('  ' + t.padEnd(9) + r.total + ' en archivos · ' + (dry ? 'se agregarían ' : 'agregados ') + r.inserted + ' · ' + (overwrite ? (dry ? 'se pisarían ' : 'pisados ') + r.updated : 'ya existían (intactos) ' + r.skipped) + (r.errors ? ' · CON ERROR ' + r.errors : ''));
  }
  console.log(errors ? 'Terminó con ' + errors + ' fila(s) omitida(s): revisa los avisos de arriba.' : dry ? 'Simulacro terminado: no se escribió nada.' : 'Listo. Ya puedes iniciar el servidor: npm start');
  await db.flush();
  process.exit(errors ? 1 : 0);
})().catch((e) => { console.error('Error de migración:', e.message); process.exit(1); });
