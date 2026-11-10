ESTADO · versión 8.6.5
Terminados: [1 ✅, 2 ✅ (sin verificar jsdom en Actions), 3 ✅ (pruebas con express/socket.io reales en el entorno del asistente; falta Actions), 4 ✅ (sin verificar en navegador real), 5 ✅ (6 pruebas aprobadas con HTTP y WebSocket reales; falta Actions)]
En curso: ninguno
Variables de entorno nuevas: PUB_LIMIT_USER=10, STORAGE_LIMIT_MB=400 (opcionales). El bloque 5 no añade variables.
Tablas o campos nuevos: products.data.deleted_at (moderación = marca; db.del() ya NO borra products, orders, convs, reviews, reports, removed).
  users.data (bloque 5, cuentas nuevas): cond (estudiante|egresado), career, cycle ('1'..'10'|'Egresado'), campus, terms{version:'1.0',at}, vis{career,cycle,campus} (privado por defecto), verified:false|true, verifiedAt, verify{salt,h,exp,attempts,sentAt} (solo hash del código; se borra al verificar). username de cuentas nuevas = su uid (interno, nunca se muestra; se entra con el correo). Cuentas anteriores sin "verified" = verificadas. db.js sin cambios.
Endpoints y eventos nuevos (bloque 5, para el bloque 8):
  POST /api/register {name,email,password,cond,career,cycle,campus,terms:true,visibility?:{career,cycle,campus}} → 201 {ok,token,user,verify:{expiresIn:600,resendIn:60}}. Errores {ok:false,code:'INVALID',error,field} (409 si el correo existe). Formato viejo (username/cualquier correo) YA NO se acepta: el grupo [5+6+7+8] se publica junto.
  POST /api/verify {code} con sesión (Bearer) o {email,code} sin sesión → {ok,verified,user}. Errores: INVALID (formato, no gasta intento), CODE_INVALID (quedan N), CODE_EXPIRED, RATE_LIMIT (5 fallos: hay que pedir otro código).
  POST /api/resend {} con sesión o {email} → {ok,resendIn,expiresIn}; 429 RATE_LIMIT con retry (segundos) si pasaron <60 s. Con correo inexistente o ya verificado responde ok (no revela nada).
  /api/login y /api/me: user ahora trae verified y profile{cond,career,cycle,campus,vis}|null. Login por correo funciona para cuentas nuevas; sin verificar sí puede entrar.
  Socket: new-product, send y order:create → {ok:false,code:'NOT_VERIFIED'} si la cuenta no está verificada (guard recalcula verified en cada evento). join sí se permite.
  auth.js exporta: isVerified(u), publicProfile(u) (uid,name,official + career/cycle/campus solo si vis), parseUpcEmail(s), setMailer(fn) (el bloque 6 conecta el proveedor; hoy el código sale en la consola con el uid, sin correo), onRegister(fn) ahora se dispara AL VERIFICAR (la bienvenida ya no sale al crear la cuenta).
Estructura del cliente (B2/B4): public/index.html carga js/01 a js/11 SIN type="module" (?v=8.6.4). El bloque 5 no tocó el frontend.
PENDIENTES (bloque de origen · qué falta):
  - (B6) Todo el bloque 6: envío real por Brevo, tabla counters y límites (5/h correo, 200/h IP, EMAIL_DAILY_LIMIT=250), REGISTRO_MANUAL con aprobación admin, borrado a las 72 h, tests/bloque06.test.js. La bienvenida tras verificar YA quedó hecha en el 5.
  - (B5) Verificar en Actions que tests/bloque05.test.js pasa (usa el WebSocket global de Node 22).
  - (B5) /api/verify sin sesión permite gastar a propósito los 5 intentos de otra persona (la víctima pide código nuevo). Aceptado para el piloto; el bloque 6 añade límites por correo.
  - (B5) Reportes y reseñas de cuentas sin verificar NO se bloquean (community.js fuera del bloque). Decidir en el bloque 13 o 19.
  - (B5) Cuentas nuevas aún no tienen pantalla de registro/verificación: es del bloque 8; hasta entonces NO subir este servidor a main.
  - (B2) Verificar tests/client-smoke.test.js en Actions; reemplazar package-lock.json por el artefacto de Actions (README-TESTING §9).
  - (B3) El secret de Socket.io sigue sirviendo tras cerrar sesión (fijo por usuario). Corregir en el bloque 7.
  - (B3) Mensajes por conversación sin tope: convs.data crece y history manda todo. Lo resuelve el bloque 23.
  - (B3) Eliminar publicación conserva la fila (y sus fotos). Soft-delete definitivo en el bloque 17.
  - (B3) STORAGE_FULL solo frena publicaciones nuevas (no registros, pedidos, chats ni reportes).
  - (B3) El cliente muestra PUB_LIMIT y STORAGE_FULL como «Se publicó solo en tu dispositivo: …»; pantalla propia en los bloques 11/18.
  - (B4) Probar en iPhone real (girar, safe-area) y en laptop (rueda y arrastre en filas, publicar con mouse).
Acciones manuales pendientes (dueño):
  1. (B1) Render → Logs: confirmar «Using Node.js version…» (engines = 22.x) y avisarme.
  2. (B1) Crear rama dev en GitHub; subir workflows y archivos a dev (workflows también a main).
  3. (B1) Neon: rama dev-pruebas (padre production).
  4. (B1) GitHub: secretos DATABASE_URL_DEV y DATABASE_URL_PROD (README-TESTING §6).
  5. (B1) Confirmar que push a dev dispara «tests» y que «run-script» aparece en Actions.
  6. (B2) En dev: crear public/js/*.js, reemplazar public/index.html, package.json, test.yml, run-script.yml, README-TESTING.md; BORRAR public/app.js. Render → Build Command = «npm install» (hasta reemplazar el lock).
  7. (B3+B4) En dev: reemplazar server.js, db.js, community.js, .env.example, public/index.html, public/style.css, public/js/02-render.js y 06-chat.js; crear tests/bloque03.test.js y public/js/11-escritorio.js.
  8. (B5) En dev: reemplazar auth.js, server.js y package.json (8.6.5); crear tests/bloque05.test.js. NO reemplazar env.js ni db.js.
  9. (B3) Neon: verificar en el panel el límite real del plan (STORAGE_LIMIT_MB=400 es el tope de la app).
  10. (B6) Crear la cuenta de Brevo y poner BREVO_API_KEY en Render (antes de probar el envío real).
  11. (B6) Verificar que los egresados mantienen @upc.edu.pe activo; si no, plan B: REGISTRO_MANUAL=true + aprobación admin.
  12. Grupo [1+2+3+4]: con Actions en verde en dev, unir a main y etiquetar v8.6.4. El grupo [5+6+7+8] NO se publica hasta cerrar el bloque 8.
Decisiones del dueño:
  - Pagos presenciales entre usuarios (U2U no retiene dinero)
  - Node local = NO (todo vía GitHub Actions / admin / tests)
  - Opción dev elegida: B (no desplegar dev; validar con tests). Node: 22 (pendiente confirmar el de Render)
  - Datos de prueba: limpiar (por defecto)
  - Workflows: solo ubuntu-latest (gratis en repos públicos)
  - Cliente: scripts clásicos partidos por líneas; app.js eliminado
  - (B3) Tope 10 publicaciones activas por usuario (admin exento); tope de espacio 400 MB solo rechaza lo nuevo; nada se borra por tope global
  - (B5, supuestos a confirmar) Carreras: las 7 de los filtros actuales + «Otra». Visibilidad de carrera/ciclo/sede: privada si no se envía. Códigos en consola con uid, sin correo. Cuentas nuevas sin usuario de login visible.
Archivos a adjuntar para el próximo bloque: auth.js, server.js, db.js, .env.example, package.json (8.6.5), ESTADO.md
Próximo bloque: 6
