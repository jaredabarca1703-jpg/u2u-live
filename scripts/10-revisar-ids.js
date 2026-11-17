/* Revisa ids de publicaciones "del futuro" (envenenados: id > ahora + 24 h). SOLO INFORMA: nunca borra ni modifica nada.
 * Uso (workflow run-script): node scripts/10-revisar-ids.js --dry-run | --apply   (--apply tampoco escribe: es igual que --dry-run)
 * Imprime únicamente conteos e ids (nunca títulos, fotos ni datos de personas). */
const db = require('../db');

(async () => {
  const apply = process.argv.includes('--apply');
  await db.init();
  const limit = Date.now() + 864e5;
  const rows = db.rows('products');
  const bad = rows.filter((p) => !Number.isSafeInteger(p.id) || p.id > limit);
  const active = bad.filter((p) => !p.deleted_at).length;
  console.log('[10-revisar-ids] modo: ' + (apply ? 'apply (no escribe nada)' : 'dry-run') + ' · modo de datos: ' + db.mode);
  console.log('[10-revisar-ids] publicaciones totales: ' + rows.length + ' · con id sospechoso: ' + bad.length + ' (activas: ' + active + ', eliminadas: ' + (bad.length - active) + ')');
  if (bad.length) {
    console.log('[10-revisar-ids] ids sospechosos: ' + bad.map((p) => String(p.id)).join(', '));
    console.log('[10-revisar-ids] Acción: con el servidor ya corregido (v8.7.5) ninguno de estos ids puede volver a crearse ni bloquea los ids nuevos. Revísalos a mano en la base; este script no borra nada.');
  } else console.log('[10-revisar-ids] OK: no hay ids sospechosos.');
  await db.flush();
  process.exit(0);
})().catch((e) => { console.error('[10-revisar-ids] error:', e.message); process.exit(1); });
