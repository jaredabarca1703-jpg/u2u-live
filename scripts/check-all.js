/* U2U · revisa la sintaxis de todos los .js del repo con `node --check`.
 * Uso: npm run check   (sale con codigo 1 si algun archivo falla) */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'data']);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (e.isFile() && e.name.endsWith('.js')) out.push(path.join(dir, e.name));
  }
  return out;
}

const files = walk(ROOT, []).sort();
const bad = [];
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) bad.push(path.relative(ROOT, f));
}
console.log('[check] ' + files.length + ' archivos .js revisados, ' + bad.length + ' con error');
if (bad.length) { bad.forEach((f) => console.error('[check] con error: ' + f)); process.exit(1); }
