/* U2U · registro único de números de operación de Yape (comisiones y, más adelante, destacados).
 * Un número se usa UNA sola vez en todo el sistema. Solo en memoria: se reconstruye al arrancar desde los pedidos
 * (commission.js → rebuild) y luego se SUMAN los de los destacados (featured.js → rebuild, que usa add). claim() es síncrono: no hay await entre comprobar y reservar.
 * Normalización: mayúsculas, sin espacios, de 4 a 20 caracteres alfanuméricos. Nunca se escribe en los logs.
 * Auditoría lote 1 (L1-37/38):
 *  - rebuild() acepta VARIAS listas a la vez (rebuild(comisiones, destacados)): ya no depende del orden de arranque. rebuild(lista) sigue funcionando igual.
 *  - Respaldo en la base (opcional): setStore(db.opNumbers) + claimPersist()/releasePersist(). La RAM sigue siendo la primera barrera (síncrona);
 *    la base (clave única en la tabla op_numbers) cubre dos instancias a la vez o un registro que no se reconstruyó. Mientras commission.js y
 *    featured.js sigan llamando a claim()/release(), nada cambia.
 *  - release() solo debe llamarse tras un claim() que devolvió true en ese mismo flujo (si no, liberaría el número de otra persona). */
const used = new Set();
let store = null;

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
function rebuild(...lists) { // reemplaza todo el registro por las listas dadas (números ya guardados en pedidos/destacados)
  used.clear();
  for (const list of lists) for (const op of list || []) { const n = normalize(op); if (n) used.add(n); }
  return used.size;
}

function add(list) { // suma números ya guardados SIN borrar los que hay (featured.js lo llama después de commission.js → rebuild)
  for (const op of list || []) { const n = normalize(op); if (n) used.add(n); }
  return used.size;
}

function setStore(s) { store = s || null; } // s = { claim(n, kind, ref) → Promise<boolean>, release(n) → Promise }
/* Como claim(), pero además lo registra en la base. true = es tuyo. false = formato inválido o ya usado (en RAM o en la base).
 * Si la base falla, lanza el error y deja el número libre en RAM (quien llama debe responder «inténtalo de nuevo»). */
async function claimPersist(op, kind, ref) {
  const n = normalize(op);
  if (!n || used.has(n)) return false;
  used.add(n); // reserva síncrona en RAM
  if (!store) return true;
  try { return !!(await store.claim(n, kind, ref)); } // false = la base ya lo tenía: el número queda como usado
  catch (e) { used.delete(n); throw e; }
}
async function releasePersist(op) { // solo tras un claimPersist() que devolvió true y cuya escritura posterior falló
  const n = normalize(op);
  if (!n) return false;
  const r = used.delete(n);
  if (store) { try { await store.release(n); } catch (_) {} }
  return r;
}

module.exports = { normalize, claim, release, has, rebuild, add, setStore, claimPersist, releasePersist, size: () => used.size };
