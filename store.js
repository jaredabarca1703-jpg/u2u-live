/* U2U · almacenamiento mínimo en archivos JSON (misma carpeta DATA_DIR que las cuentas)
 * Escritura atómica (archivo temporal + rename). Si un archivo está dañado se respalda y se arranca vacío.
 * OJO (Render): sin disco persistente estos archivos se borran al redesplegar.
 */
const fs = require('fs');
const path = require('path');

const DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

function open(name, empty) {
  const file = path.join(DIR, name);
  let data = empty;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || typeof data !== 'object') throw new Error('formato');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      try { fs.renameSync(file, path.join(DIR, name + '.corrupt-' + Date.now())); } catch (_) {}
      console.warn('[store] ' + name + ' ilegible: respaldado, se inicia vacío');
    }
    data = empty;
  }
  let timer = null;
  const flush = () => {
    clearTimeout(timer);
    try {
      fs.mkdirSync(DIR, { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data));
      fs.renameSync(tmp, file);
    } catch (e) { console.error('[store] no se pudo guardar ' + name + ':', e.message); }
  };
  const save = () => { clearTimeout(timer); timer = setTimeout(flush, 300); };
  return { data, save, flush };
}

module.exports = { open };
