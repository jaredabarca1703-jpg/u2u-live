# U2U 8.5.0 — datos permanentes con PostgreSQL (Neon)

## Qué cambió
1. **Base de datos**: librería `pg` (gratuita). Con la variable `DATABASE_URL` la app usa PostgreSQL; crea sus 7 tablas sola al iniciar. Todas las consultas son parametrizadas.
2. **Cuentas y sesiones** (usuarios, contraseñas scrypt, bloqueos, sesiones): se guardan en la base. Tras reiniciar el servidor nadie vuelve a iniciar sesión; el token sigue guardado en el dispositivo.
3. **Publicaciones y pedidos** se guardan en la base (también estado reservado/vendido, intentos fallidos de PIN y bloqueo de 5 min). La lógica del PIN, los bloqueos y el cálculo de montos en el servidor no se tocaron. Reportes, reseñas y publicaciones eliminadas por moderación también quedan guardados.
4. **Fotos**: la app las reduce a máx. 1024 px (lado mayor) y JPEG, bajando la calidad hasta que cada una pese ≤ 150 KB.
5. **Admin**: sigue saliendo de `ADMIN_USER` y `ADMIN_PASS`. Vive solo en memoria: no se guarda en la base ni sus sesiones.
6. **Sin `DATABASE_URL`** usa archivos JSON en `data/` (también lee los de la versión anterior: users.json, reports.json, reviews.json).
7. `npm run migrate` sube a Neon lo que ya tengas en archivos (se puede repetir sin duplicar).

## Archivos
Nuevos: `db.js`, `env.js`, `migrate.js`. Modificados: `server.js`, `auth.js`, `community.js`, `public/app.js`, `public/index.html` (?v=8.5.0), `package.json`, `package-lock.json`, `.env.example`. **Borra `store.js`** de tu repo (ya no se usa).

## Cómo copiar DATABASE_URL de Neon
1. Entra a console.neon.tech y abre tu proyecto.
2. En el panel principal pulsa **Connect**.
3. Elige tu rama (main), base de datos y rol. **Desactiva "Connection pooling"** (conexión directa; la app solo usa 4 conexiones).
4. Copia la cadena que empieza con `postgresql://`. Incluye usuario, contraseña y `?sslmode=require`. Es una clave secreta.

## Dónde pegarla
**Render**: tu servicio → **Environment** → **Add Environment Variable** → Key `DATABASE_URL`, Value = la cadena (sin comillas) → **Save Changes**. Render redespliega. En el log debe aparecer `[db] PostgreSQL conectado`. Deja también `ADMIN_USER` y `ADMIN_PASS`. Ya no necesitas `DATA_DIR` ni disco de pago.
**Tu computadora**: copia `.env.example` como `.env`; después de `DATABASE_URL=` pega la cadena (sin comillas ni espacios). `npm install` y `npm start`. El `.env` está en `.gitignore`: no se sube. Si lo dejas vacío usa archivos JSON.
Si alguna vez se filtra la cadena: en Neon, **Roles** → restablecer la contraseña del rol y actualiza Render y `.env`.
Para pasar tus datos de archivos a Neon (una vez): con `DATABASE_URL` en `.env`, ejecuta `npm run migrate`.

## Espacio de fotos (plan gratis de Neon: 0,5 GB según su información; confírmalo en su página de precios)
- Una foto de celular de 12 MP pesa ~3 MB. Medido con una imagen de prueba muy detallada: a 1024 px queda entre 132 y 236 KB según calidad; la app baja la calidad hasta ≤ 150 KB. Fotos reales suelen quedar en 60–150 KB.
- Una publicación (hasta 3 fotos) pesa ≤ ~450 KB. Con el límite actual de **50 publicaciones activas** (`MAX_PRODUCTS`) las fotos ocupan **≤ ~22 MB**: sobra espacio.
- Los pedidos ya no copian la foto (un pedido ocupa ~0,5 KB; antes ~93 KB).
- La app avisa en el log al iniciar cuánto espacio usa y, cada 6 h, si pasa de 400 MB.

## Limitaciones
- **Los chats siguen en memoria** (se pierden al reiniciar). No estaba en la lista.
- Los datos se escriben en segundo plano (cola con reintentos): si la base se cae unos minutos no se pierde nada mientras el servidor siga vivo. Si el servidor también se reinicia en ese lapso, lo pendiente se pierde. Registrar cuenta y crear sesión esperan a quedar guardados antes de responder.
- El PIN de un pedido pendiente se guarda tal cual en la base (el comprador debe poder volver a verlo).
- Neon gratis suspende el cómputo tras ~5 min sin uso: la primera consulta puede tardar 1–5 s (la app reintenta sola). Render gratis también se duerme.
- Si la base no responde al iniciar, el servidor no arranca (Render lo reintenta).

## Checklist
**Laptop**
- [ ] Sin `DATABASE_URL`: arranca en modo archivos (log "modo ARCHIVOS JSON"). Con ella: "PostgreSQL conectado" y las tablas aparecen en Neon (Tables).
- [ ] Registrar 2 cuentas, publicar con foto, comprar (PIN), reiniciar con Ctrl+C y `npm start`: todo sigue y la sesión no se cierra.
- [ ] Confirmar el pedido con PIN erróneo 2 veces, reiniciar, y comprobar que quedan 2 intentos.
- [ ] La cuenta admin no aparece en la tabla `users` de Neon.
- [ ] Ver código fuente de la página: no hay contraseñas ni URLs de base de datos.
**iPhone y Android**
- [ ] Subir una foto de la cámara: se publica rápido y se ve nítida.
- [ ] Iniciar sesión, cerrar el navegador por completo, reabrir: entra directo.
- [ ] Redesplegar en Render y reabrir la app: cuentas, publicaciones y pedidos siguen.
- [ ] Pedido pendiente: el comprador ve su PIN; el vendedor, no.
