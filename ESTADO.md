ESTADO · versión 8.6.4
Terminados: [1 ✅, 2 ✅ (sin verificar jsdom en Actions), 3 ✅ (sin verificar en Actions: pruebas corridas con réplicas de express/socket.io), 4 ✅ (sin verificar en navegador real)]
En curso: ninguno
Variables de entorno nuevas: PUB_LIMIT_USER=10, STORAGE_LIMIT_MB=400 (opcionales: si faltan o son inválidas se usan esos valores). Secretos de GitHub: DATABASE_URL_DEV, DATABASE_URL_PROD
Tablas o campos nuevos: products.data.deleted_at (eliminación por moderación = marca, la fila se conserva; el arranque la ignora). db.del() ya NO borra en products, orders, convs, reviews, reports, removed (lo registra en el log)
Endpoints y eventos nuevos: ninguno. Cambios: guard(socket) en cada evento (cuenta, bloqueo, rol); acks nuevos {ok:false, code, error} con PUB_LIMIT, STORAGE_FULL, FORBIDDEN, ACCOUNT_DELETED, USER_BLOCKED; contadores de límites por usuario (no se reinician al volver a entrar)
Estructura del cliente (B2/B4): public/index.html carga js/01 a js/11 SIN type="module" (?v=8.6.4). 11-escritorio.js: rueda y arrastre con mouse en filas .no-sb (solo hover:hover + pointer:fine). public/style.css: .app-frame (marco solo con mouse; táctil = pantalla completa con dvh y safe-area izq/der). R(1) ya no repite la animación ni pierde el scroll horizontal; el chat solo baja solo si ya estabas abajo o el mensaje es tuyo.
PENDIENTES (bloque de origen · qué falta):
  - (B2) Verificar que tests/client-smoke.test.js pasa en Actions (jsdom no se pudo instalar aquí).
  - (B2) Reemplazar package-lock.json por el artefacto «package-lock» de Actions (README-TESTING §9).
  - (B3) Probar en Actions tests/bloque03.test.js con express y socket.io reales.
  - (B3) REPORTE sin aplicar: el secret de Socket.io SIGUE sirviendo tras cerrar sesión (es fijo por usuario; /api/logout solo borra la sesión HTTP y los sockets abiertos siguen conectados). Corregir en el bloque 7 (rotación): rotar al cambiar contraseña y decidir si al cerrar sesión.
  - (B3) Mensajes por conversación ya sin tope: convs.data crece y el evento history manda todo al entrar. Lo resuelve el bloque 23 (7a, tabla messages).
  - (B3) Eliminar publicación (moderación) conserva la fila con deleted_at: sus fotos siguen ocupando espacio. El bloque 17 (B9) define el soft-delete definitivo.
  - (B3) STORAGE_FULL solo frena publicaciones nuevas (no registros, pedidos, chats ni reportes: auth.js estaba fuera del bloque).
  - (B3) El cliente muestra PUB_LIMIT y STORAGE_FULL como «Se publicó solo en tu dispositivo: …»; pantalla propia en los bloques 11/18.
  - (B3) Estimación (AMPLIABLE): con fotos de ~150 KB x3 (~0,45 MB por publicación) caben ~850 en 400 MB; en el peor caso (620 KB) ~600; menos lo que ocupen cuentas, pedidos y chats.
  - (B4) Probar en iPhone real (girar vertical/horizontal, safe-area) y en laptop (rueda y arrastre en filas, publicar con mouse).
Acciones manuales pendientes (dueño):
  1. (B1) Render → Logs: confirmar «Using Node.js version…» (engines = 22.x) y avisarme.
  2. (B1) Crear rama dev en GitHub; subir workflows y archivos a dev (workflows también a main).
  3. (B1) Neon: rama dev-pruebas (padre production).
  4. (B1) GitHub: secretos DATABASE_URL_DEV y DATABASE_URL_PROD (README-TESTING §6).
  5. (B1) Confirmar que push a dev dispara «tests» y que «run-script» aparece en Actions.
  6. (B2) En dev: crear public/js/*.js, reemplazar public/index.html, package.json, test.yml, run-script.yml, README-TESTING.md; BORRAR public/app.js.
  7. (B2) Render → Settings → Build Command = «npm install» (hasta reemplazar el lock).
  8. (B3+B4) En dev: reemplazar server.js, db.js, community.js, .env.example, package.json, public/index.html, public/style.css, public/js/02-render.js y 06-chat.js; crear tests/bloque03.test.js y public/js/11-escritorio.js.
  9. (B3) Neon: verificar en el panel el límite real del plan (STORAGE_LIMIT_MB=400 es el tope de la app).
  10. Grupo [1+2+3+4]: cuando Actions pase en dev, unir dev→main y etiquetar v8.6.4 (el [1+2] y el [3+4] se publican juntos si [1+2] aún no se subió).
Decisiones del dueño:
  - Pagos presenciales entre usuarios (U2U no retiene dinero)
  - Node local = NO (todo vía GitHub Actions / admin / tests)
  - Opción dev elegida: B (no desplegar dev; validar con tests). Node: 22 (pendiente confirmar el de Render)
  - Datos de prueba: limpiar (por defecto)
  - Workflows: solo ubuntu-latest (gratis en repos públicos)
  - Cliente: scripts clásicos partidos por líneas; app.js eliminado
  - (B3) Tope por usuario 10 publicaciones activas (disponible, pausada, reservada); admin exento; tope de espacio 400 MB solo rechaza lo nuevo
  - (B3) Nada se borra por tope global (publicaciones, pedidos, chats, mensajes, reportes, eliminadas por moderación)
Archivos a adjuntar para el próximo bloque: los que liste el bloque 5 + package.json (8.6.4) + ESTADO.md (el cliente está en public/js/*.js; auth.js, community.js y db.js tal como quedaron en el bloque 3)
Próximo bloque: 5
