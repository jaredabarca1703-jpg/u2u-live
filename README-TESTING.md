# U2U · Pruebas automáticas y scripts (GitHub Actions)

Todo se hace desde la web de GitHub y Neon. No necesitas terminal ni Node en tu computadora.

## 1. Costos
En repositorios **públicos**, las ejecuciones con runners estándar (`ubuntu-latest`) son gratis. Los «runners grandes» siempre se cobran: no los uses. Los workflows de U2U usan solo `ubuntu-latest`.

## 2. Versión de Node
Los workflows y `engines` de `package.json` usan **Node 22** (Node 20 ya no tiene soporte). Render usa la versión de `engines`. Después de desplegar, revisa en Render → Logs la línea `Using Node.js version…` y confirma que dice 22.

## 3. Archivos de este bloque (créalos en GitHub)
- `.github/workflows/test.yml` y `.github/workflows/run-script.yml`
- `scripts/check-all.js`, `tests/dummy.test.js`, `README-TESTING.md`
- `package.json` (reemplaza el existente)

**Cómo crear un archivo:** en la página del repo → botón **Add file → Create new file** → en el nombre escribe la ruta completa (por ejemplo `.github/workflows/test.yml`; al escribir `/` se crean las carpetas) → pega el contenido → **Commit changes**. Las carpetas con punto, como `.github`, fallan al arrastrarlas: créalas así.

**Ramas:** solo existen `dev` y `main`. Crea `dev` desde el desplegable de ramas (escribe `dev` → «Create branch»).

**Importante:** sube los dos workflows a **dev y a main**. GitHub solo muestra `run-script` en la pestaña Actions si el archivo existe en la rama principal (`main`). Son archivos de automatización: no cambian tu app en producción.

## 4. Cómo leer el resultado de los tests
1. Pestaña **Actions** del repo → workflow **tests** → la ejecución más reciente.
2. ✅ verde = todo pasó. ❌ rojo = algo falló.
3. Haz clic en el trabajo **test** y abre el paso rojo: la última línea te dice el archivo o prueba que falló.
4. Pasos: `npm ci` (instala), `npm run check` (revisa sintaxis de todos los .js), `npm test` (corre `tests/*.test.js`).
5. Se ejecuta solo en cada push a `dev` o `main`.

## 5. Probar `dev` sin romper producción (Opción B, elegida)
Render solo despliega `main`. **No desplegamos `dev`**: validamos con los tests automáticos y, cuando el grupo de bloques está cerrado, se une `dev` a `main`. Así no gastas horas gratuitas de un segundo servicio ni mantienes otra base. Opción A (un segundo servicio en Render con una rama de Neon clonada) queda descartada por ahora.

## 6. Secretos de GitHub (nunca los pegues en el chat)
Necesitas dos: `DATABASE_URL_DEV` (rama de pruebas) y `DATABASE_URL_PROD` (rama `production`).
1. **Neon** → tu proyecto → **Branches** → **New branch** → nombre `dev-pruebas`, padre `production`, con los datos actuales. De ahí sale la URL de pruebas.
2. En cada rama (`dev-pruebas` y `production`) pulsa **Connect** y copia la *connection string* (empieza con `postgresql://`).
3. **GitHub** → repo → **Settings → Secrets and variables → Actions → New repository secret**.
4. Nombre `DATABASE_URL_DEV`, valor = URL de `dev-pruebas` → **Add secret**.
5. Repite con `DATABASE_URL_PROD`, valor = URL de `production`.
6. GitHub oculta los secretos en los logs, pero igual los scripts solo imprimen conteos (el repo es público).

## 7. Cómo ejecutar un script con run-script.yml
Los scripts viven en `scripts/NN-nombre.js` y aceptan `--dry-run` (por defecto) y `--apply`.
1. Pestaña **Actions** → **run-script** (a la izquierda) → **Run workflow**.
2. **Use workflow from:** la rama donde está el script (`dev` normalmente).
3. **script:** el nombre sin ruta ni `.js` (ej. `09-migrar-fotos`).
4. **modo:** `dry-run` primero, siempre. Lee el resultado (solo conteos). Si es correcto, repite con `apply`.
5. **entorno:** `dev` (rama de pruebas de Neon) o `prod`. Prueba primero en `dev`.
6. Corre una a la vez (no se pisan). Máximo 15 minutos.

## 8. Rama de respaldo en Neon ANTES de `apply` en prod
1. Neon → **Branches** → selecciona **production** → **Create branch** (o «New branch» con padre `production`).
2. Nombre con fecha y bloque, por ejemplo `respaldo-2026-11-10-bloque9`.
3. En **Auto-delete** elige **Never** (si queda en «Expire» se borra sola y pierdes el respaldo).
4. Datos: estado actual (*Current data*) → **Create branch**.
5. Verifica que aparece en la lista de ramas, y recién entonces ejecuta `apply` en `prod`.
6. Para volver atrás: cada script documenta su `--rollback` o cómo restaurar desde ese respaldo.

## 9. Cliente en módulos (bloque 2) y package-lock.json
- `public/app.js` ya no existe: la lógica está en `public/js/01-…10-*.js`, scripts **clásicos** (sin `type="module"`) que `index.html` carga en orden y que comparten el ámbito global. **El orden de los números es el orden de ejecución: no lo cambies.**
- `tests/client-smoke.test.js` carga `index.html` y esos scripts en jsdom y falla si alguno lanza un error al arrancar.
- jsdom es `devDependency`. Como `package-lock.json` todavía no lo incluye, `test.yml` usa `npm ci || npm install`. En la primera ejecución verde, entra a esa ejecución en Actions → **Artifacts** → descarga `package-lock` → descomprime → en GitHub abre `package-lock.json` → lápiz → pega el contenido nuevo → Commit. Hazlo ANTES de unir dev a main.
- Render: su comando de build debe ser `npm install` (el predeterminado). Si fuera `npm ci`, fallaría hasta reemplazar el lock.
