ESTADO · versión 8.6.7
Terminados: [1 ✅, 2 ✅ (sin verificar jsdom en Actions), 3 ✅ (pruebas con express/socket.io reales en el entorno del asistente; falta Actions), 4 ✅ (sin verificar en navegador real), 5 ✅ (6 pruebas, HTTP y WebSocket reales; falta Actions), 6 ✅ (6 pruebas + mutaciones detectadas; 15/15 en total; falta Actions; envío a Brevo probado solo con fetch simulado), 7 ✅ (6 pruebas + 2 mutaciones detectadas; 21/21 en total; falta Actions), 8 ❌ (no empezado: faltan 8 archivos de public/js)]
En curso: ninguno
Variables de entorno nuevas: PUB_LIMIT_USER=10, STORAGE_LIMIT_MB=400 (opcionales). Bloque 6 (todas opcionales, el servidor arranca sin ellas): EMAIL_PROVIDER= (brevo), BREVO_API_KEY=, EMAIL_FROM= (ej. U2U <no-reply@dominio>), EMAIL_DEV_MODE=false, EMAIL_DAILY_LIMIT=250, REGISTRO_MANUAL=false. Fijos en código: 5 envíos/hora por correo, 200/hora por IP. El bloque 7 no añade variables.
Tablas o campos nuevos: products.data.deleted_at (moderación = marca; db.del() ya NO borra products, orders, convs, reviews, reports, removed).
  users.data (bloque 5, cuentas nuevas): cond (estudiante|egresado), career, cycle ('1'..'10'|'Egresado'), campus, terms{version:'1.0',at}, vis{career,cycle,campus} (privado por defecto), verified:false|true, verifiedAt, verify{salt,h,exp,attempts,sentAt} (solo hash del código; se borra al verificar). username de cuentas nuevas = su uid (interno, nunca se muestra; se entra con el correo). Cuentas anteriores sin "verified" = verificadas. 
  Bloque 6: tabla counters (key text PK, window text, count int) + db.counters.hit(key, window) → conteo (UPSERT atómico; en archivos u2u-counters.json). Claves: mail:e:<sha(correo)>, mail:i:<sha(ip)> (ventana = hora) y mail:day (ventana = día de Lima). users.data.pending:true (REGISTRO_MANUAL).
Endpoints y eventos nuevos (bloque 5, para el bloque 8):
  POST /api/register {name,email,password,cond,career,cycle,campus,terms:true,visibility?:{career,cycle,campus}} → 201 {ok,token,user,verify:{expiresIn:600,resendIn:60}}. Errores {ok:false,code:'INVALID',error,field} (409 si el correo existe). Formato viejo (username/cualquier correo) YA NO se acepta: el grupo [5+6+7+8] se publica junto.
  POST /api/verify {code} con sesión (Bearer) o {email,code} sin sesión → {ok,verified,user}. Errores: INVALID (formato, no gasta intento), CODE_INVALID (quedan N), CODE_EXPIRED, RATE_LIMIT (5 fallos: hay que pedir otro código).
  POST /api/resend {} con sesión o {email} → {ok,resendIn,expiresIn}; 429 RATE_LIMIT con retry (segundos) si pasaron <60 s. Con correo inexistente o ya verificado responde ok (no revela nada).
  /api/login y /api/me: user ahora trae verified y profile{cond,career,cycle,campus,vis}|null. Login por correo funciona para cuentas nuevas; sin verificar sí puede entrar.
  Bloque 6: register y resend devuelven sent:true|false (false = el proveedor falló; la cuenta existe y puede pedir otro código). Límites → 429 {code:'RATE_LIMIT',error}: «Ya se enviaron 5 códigos…», «Hay demasiadas solicitudes desde esta red…» o «Hoy se alcanzó el límite, vuelve mañana.». user trae pending. Con REGISTRO_MANUAL=true: register → 201 {pending:true} sin verify ni código; verify/resend → 403 NOT_VERIFIED.
  Bloque 6 (admin, Bearer de la cuenta oficial): GET /api/admin/pending → {pending:[{uid,name,email,cond,career,cycle,campus,createdAt}]}; POST /api/admin/approve {uid} (verifica + bienvenida); POST /api/admin/reject {uid} (borra la cuenta). Otro usuario → 403 FORBIDDEN. auth.js exporta además sweep().
  Bloque 7: user (login, register, /me, PUT /me) ahora es plano: {uid,secret,name,admin,verified,pending,email?,condition,career,cycle,campus,vis,username?}. username solo en cuentas anteriores al bloque 5 y la oficial; email nunca en la oficial. (Reemplaza a profile{...}.)
  POST /api/login {id|email,password}: por correo para todas; con usuario solo cuentas anteriores (sin campo verified) y la oficial; el resto 401 genérico.
  PUT /api/me {name?,career?,cycle?,campus?,terms?:true} → {ok,user}. Errores INVALID con field (name, career, cycle, campus). Cuentas anteriores sin perfil UPC: solo name. ciclo «Egresado» en un estudiante lo vuelve egresado. terms:true guarda la versión vigente si cambió.
  POST /api/me/password {current,password} (Bearer) → {ok,token,user}: rota secret, revoca TODAS las sesiones y entrega una nueva. 401 INVALID field current si la actual falla. La oficial: 403 (ADMIN_PASS).
  POST /api/recover {email} → siempre {ok,expiresIn,resendIn} exista o no el correo (400 INVALID solo por formato; 429 solo por límite diario/IP). POST /api/recover/reset {email,code,password} → {ok} o 400 CODE_INVALID único («Código incorrecto o vencido»). Mismos 10 min, 5 intentos y 60 s; revoca sesiones y rota secret. No inicia sesión: hay que entrar de nuevo.
  Rotar el secret desconecta los sockets de esa cuenta (auth.onSecretChange → server.js). GET /api/admin/pending y POST /api/admin/approve ya existían desde el bloque 6.
  Socket: new-product, send y order:create → {ok:false,code:'NOT_VERIFIED'} si la cuenta no está verificada (guard recalcula verified en cada evento). join sí se permite.
  auth.js exporta: isVerified(u), publicProfile(u) (uid,name,official + career/cycle/campus solo si vis), parseUpcEmail(s), setMailer(fn) (el bloque 6 conecta el proveedor; hoy el código sale en la consola con el uid, sin correo), onRegister(fn) ahora se dispara AL VERIFICAR (la bienvenida ya no sale al crear la cuenta).
Estructura del cliente (B2/B4): public/index.html carga js/01 a js/11 SIN type="module" (?v=8.6.4). El bloque 5 no tocó el frontend.
PENDIENTES (bloque de origen · qué falta):
  - (B6) Verificar en Actions tests/bloque06.test.js. Probar un envío REAL con Brevo (el remitente de EMAIL_FROM debe estar verificado en Brevo) antes de abrir el piloto.
  - (B6) Pantalla de la admin para aprobar/rechazar cuentas pendientes (hoy solo endpoints): bloque 13. Las pendientes no vencen a las 72 h.
  - (B5) Verificar en Actions que tests/bloque05.test.js pasa (usa el WebSocket global de Node 22).
  - (B5) /api/verify sin sesión permite gastar a propósito los 5 intentos de otra persona (la víctima pide código nuevo). Aceptado para el piloto (los límites del bloque 6 cubren envíos, no intentos de verify).
  - (B5) Reportes y reseñas de cuentas sin verificar NO se bloquean (community.js fuera del bloque). Decidir en el bloque 13 o 19.
  - (B8) NO EMPEZADO. Pide: public/js/01-estado.js, 03-local-publicar.js, 04-ai-upc.js, 05-socket.js, 07-pedidos.js, 08-ui-vivo.js, 09-auth.js (aquí vive el registro actual) y 10-comunidad.js. Los demás (02, 06, 11, index.html, style.css) ya los tengo. Hasta cerrar el 8 NO subir este servidor a main: el formulario viejo no puede registrar.
  - (B7) Cambiar el nombre en «Mi cuenta» no actualiza publicaciones ni chats ya creados (solo las nuevas). La visibilidad de carrera/ciclo/sede no se puede editar todavía.
  - (B7) Recuperar contraseña no verifica la cuenta ni inicia sesión; no sirve para cuentas anteriores con correo no UPC.
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
  8. (B5+B6+B7) En dev: reemplazar auth.js, server.js, db.js, .env.example y package.json (8.6.7); crear tests/bloque05.test.js, bloque06.test.js y bloque07.test.js. NO reemplazar env.js. (Si ya subiste el 5 a main y rompió el registro, restaura auth.js+server.js 8.6.4 en main.)
  9. (B3) Neon: verificar en el panel el límite real del plan (STORAGE_LIMIT_MB=400 es el tope de la app).
  10. (B6) Crear la cuenta de Brevo, verificar el remitente y poner en Render: EMAIL_PROVIDER=brevo, BREVO_API_KEY, EMAIL_FROM, EMAIL_DEV_MODE=false (sin ellas el código sale en el log de Render).
  11. (B6) Verificar que los egresados mantienen @upc.edu.pe activo; si no, plan B: REGISTRO_MANUAL=true + aprobación admin.
  12. Grupo [5+6+7+8]: NO se publica a main hasta cerrar el bloque 8 (el 7 solo no basta). Grupo [1+2+3+4]: con Actions en verde en dev, unir a main y etiquetar v8.6.4. El grupo [5+6+7+8] NO se publica hasta cerrar el bloque 8.
Decisiones del dueño:
  - Pagos presenciales entre usuarios (U2U no retiene dinero)
  - Node local = NO (todo vía GitHub Actions / admin / tests)
  - Opción dev elegida: B (no desplegar dev; validar con tests). Node: 22 (pendiente confirmar el de Render)
  - Datos de prueba: limpiar (por defecto)
  - Workflows: solo ubuntu-latest (gratis en repos públicos)
  - Cliente: scripts clásicos partidos por líneas; app.js eliminado
  - (B3) Tope 10 publicaciones activas por usuario (admin exento); tope de espacio 400 MB solo rechaza lo nuevo; nada se borra por tope global
  - (B6) REGISTRO_MANUAL: no envía código; aprobar = verificar. Las pendientes no se borran a las 72 h. El «día» del tope diario es hora de Lima.
  - (B5, supuestos a confirmar) Carreras: las 7 de los filtros actuales + «Otra». Visibilidad de carrera/ciclo/sede: privada si no se envía. Códigos en consola con uid, sin correo. Cuentas nuevas sin usuario de login visible.
Archivos a adjuntar para el próximo bloque (8): ESTADO.md y los 8 archivos de public/js indicados arriba (más 02-render.js, 06-chat.js, 11-escritorio.js, index.html y style.css si ya no los tienes en esta conversación)
Próximo bloque: 8
