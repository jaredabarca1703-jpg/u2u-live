/* U2U · registro único de números de operación de Yape (comisiones y, más adelante, destacados).
 * Un número se usa UNA sola vez en todo el sistema. Solo en memoria: se reconstruye al arrancar desde los pedidos
 * (commission.js → rebuild) y, cuando exista, desde los destacados. claim() es síncrono: no hay await entre comprobar y reservar.
 * Normalización: mayúsculas, sin espacios, de 4 a 20 caracteres alfanuméricos. Nunca se escribe en los logs. */
const used = new Set();

function normalize(op) {
  const s = String(op == null ? '' : op).toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9]{4,20}$/.test(s) ? s : null;
}
function claim(op) { // false si el formato no es válido o el número ya existe
  const n = normalize(op);
  if (!n || used.has(n)) return false;
  used.add(n);
  return true;
}
function release(op) { const n = normalize(op); return n ? used.delete(n) : false; } // solo si la escritura posterior falla
const has = (op) => { const n = normalize(op); return !!n && used.has(n); };
function rebuild(list) { // reemplaza todo el registro por la lista dada (números ya guardados en pedidos/destacados)
  used.clear();
  for (const op of list || []) { const n = normalize(op); if (n) used.add(n); }
  return used.size;
}

module.exports = { normalize, claim, release, has, rebuild, size: () => used.size };
