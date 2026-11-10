ESTADO · versión 8.6.8
Terminados: [1 ✅, 2 ✅ (sin verificar jsdom en Actions), 3 ✅ (falta Actions), 4 ✅ (sin verificar en navegador real), 5 ✅ (6 pruebas; falta Actions), 6 ✅ (6 pruebas; envío a Brevo probado solo con fetch simulado), 7 ✅ (6 pruebas; 21/21 en total; falta Actions), 8 ✅ (node --check + 42 pruebas con DOM y fetch simulados, 2 mutaciones detectadas; SIN probar en navegador real ni iPhone), 9 a 30 ❌]
En curso: ninguno
Variables de entorno nuevas: PUB_LIMIT_USER=10, STORAGE_LIMIT_MB=400 (opcionales). Bloque 6 (opcionales, el servidor arranca sin ellas): EMAIL_PROVIDER= (brevo), BREVO_API_KEY=, EMAIL_FROM= (ej. U2U <no-reply@dominio>), EMAIL_DEV_MODE=false, EMAIL_DAILY_LIMIT=250, REGISTRO_MANUAL=false. Fijos en código: 5 envíos/hora por correo, 200/hora por IP. Los bloques 7 y 8 no añaden variables.
Tablas o campos nuevos: products.data.deleted_at (moderación = marca; db.del() ya NO borra products, orders, convs, reviews, reports, removed).
  users.data (cuentas nuevas, B5): cond (estudiante|egresado), career, cycle ('1'..'10'|'Egresado'), campus, terms{version:'1.0',at}, vis{career,cycle,campus}, verified:false|true, verifiedAt, verify{salt,h,exp,attempts,sentAt}. username de cuentas nuevas = su uid (interno; se entra con el correo). Cuentas anteriores sin "verified" = verificadas.
  B6: tabla counters (key text PK, window text, count int) + db.counters.hit(key, window). users.data.pending:true (REGISTRO_MANUAL).
  Cliente (B8): SEL[ME].prof = {career,cycle,campus,verified} (de /api/me); SEL[i].prof de otros vendedores solo si el servidor manda ownerProfile (pendiente).
Endpoints y eventos (servidor, B5-B7; el bloque 8 ya los consume):
  POST /api/register {name,email,password,cond,career,cycle,campus,terms:true,visibility?} → 201 {ok,token,user,sent,verify:{expiresIn:600,resendIn:60}} | con REGISTRO_MANUAL {pending:true} sin verify. Errores {ok:false,code,error,field}.
  POST /api/verify {code[,email]} → {ok,verified,user}. Errores INVALID, CODE_INVALID (quedan N), CODE_EXPIRED, RATE_LIMIT (5 fallos), 403 NOT_VERIFIED si pendiente. POST /api/resend {[email]} → {ok,sent,resendIn,expiresIn}; 429 RATE_LIMIT con retry (s), límites 5/h por correo, 200/h por IP, diario «Hoy se alcanzó el límite, vuelve mañana.».
  POST /api/login {id|email,password}: por correo para todas; con usuario solo cuentas anteriores y la oficial. user plano: {uid,secret,name,admin,verified,pending,email?,condition,career,cycle,campus,vis,username?}.
  GET /api/me (renueva sesión). PUT /api/me {name?,career?,cycle?,campus?,terms?} → {ok,user}. POST /api/me/password {current,password} → {ok,token,user} (rota secret, revoca sesiones; el cliente aún NO tiene pantalla para esto).
  POST /api/recover {email} → siempre {ok,expiresIn,resendIn}. POST /api/recover/reset {email,code,password} → {ok} o 400 CODE_INVALID único; revoca sesiones, rota secret, no inicia sesión.
  Admin: GET /api/admin/pending, POST /api/admin/approve {uid}, POST /api/admin/reject {uid} (solo cuenta oficial; pantalla en el bloque 13). Socket: new-product, send y order:create → {ok:false,code:'NOT_VERIFIED'} si la cuenta no está verificada; join sí se permite.
  auth.js exporta isVerified, publicProfile (uid,name,official + career/cycle/campus solo si vis), parseUpcEmail, setMailer, onRegister (al VERIFICAR), sweep.
Estructura del cliente: public/index.html carga js/01 a js/12 SIN type="module" (?v=8.6.8). El arranque (bootInit) vive AL FINAL de 12-cuenta.js. 09-auth.js = login/sesión; 12-cuenta.js = registro en 2 pasos, código, recuperar, Mi cuenta, Términos y bloqueo de cuentas sin verificar.
PENDIENTES (bloque de origen · qué falta):
  - (B8→servidor) Mandar en new-product y products el perfil público del vendedor: ownerProfile {career,cycle,campus (solo si vis), verified}, usando auth.publicProfile + verified. El cliente ya lo lee (08-ui-vivo.js addRemote). Hasta entonces la tarjeta de OTROS vendedores dice solo «Estudiante UPC» y no muestra «Correo UPC verificado ✓» (la propia cuenta sí). Candidato: bloque 13 o un parche chico antes del piloto.
  - (B8) Probar en iPhone real y laptop: registro completo, código incorrecto, reenvío, recuperar, Mi cuenta. No hay jsdom en el entorno del asistente: ejecutar Actions (client-smoke) tras subir.
  - (B8) Cuenta sin verificar: botones publicar/reservar/chatear quedan con aria-disabled + opacidad y un aviso al tocarlos (no el atributo disabled, para poder explicar el motivo). Con REGISTRO_MANUAL el texto no dice «72 h» (esas cuentas no vencen).
  - (B8) Sin pantalla para cambiar contraseña con la actual (POST /api/me/password); solo «Recuperar contraseña» por correo. Cambiar el nombre no actualiza publicaciones/chats ya creados; la visibilidad (carrera/ciclo/sede) no se edita.
  - (B8) Términos v1.0 = borrador sin revisar por abogado; el bloque 29 los completa. 02-render.js aún tiene el checkout viejo (Protección S/ 10, Visa/Yape): bloque 16.
  - (B8) package.json: poner "version": "8.6.8" (no estaba entre los archivos de este bloque).
  - (B6) Probar un envío REAL con Brevo (remitente de EMAIL_FROM verificado) antes del piloto. Las cuentas pendientes (REGISTRO_MANUAL) no vencen a las 72 h; pantalla de aprobación: bloque 13.
  - (B5) Verificar tests/bloque05.test.js en Actions (usa el WebSocket global de Node 22). /api/verify sin sesión permite gastar a propósito los 5 intentos de otra persona (aceptado en el piloto). Reportes y reseñas de cuentas sin verificar NO se bloquean: decidir en bloque 13 o 19.
  - (B7) Recuperar contraseña no sirve para cuentas anteriores con correo no UPC ni inicia sesión.
  - (B2) Verificar client-smoke en Actions; reemplazar package-lock.json por el artefacto de Actions (README-TESTING §9).
  - (B3) El secret de Socket.io sigue sirviendo tras cerrar sesión (solo se rota al cambiar contraseña). Mensajes por conversación sin tope: bloque 23. Eliminar publicación conserva la fila: soft-delete en bloque 17. STORAGE_FULL solo frena publicaciones nuevas. El cliente muestra PUB_LIMIT/STORAGE_FULL como «Se publicó solo en tu dispositivo»: pantalla propia en bloques 11/18.
  - (B4) Probar en iPhone real (girar, safe-area) y en laptop (rueda y arrastre en filas, publicar con mouse).
Acciones manuales pendientes (dueño):
  1. (B1) Render → Logs: confirmar «Using Node.js version…» (engines = 22.x) y avisarme.
  2. (B1) Rama dev en GitHub con workflows (también en main); Neon rama dev-pruebas (padre production); secretos DATABASE_URL_DEV y DATABASE_URL_PROD (README-TESTING §6); confirmar que push a dev dispara «tests» y que «run-script» aparece.
  3. (B2) Render → Build Command = «npm install» hasta reemplazar el lock; public/app.js debe estar BORRADO.
  4. (B3+B4) En dev: server.js, db.js, community.js, .env.example, public/index.html, public/style.css, public/js/02-render.js y 06-chat.js; tests/bloque03.test.js y public/js/11-escritorio.js.
  5. (B5+B6+B7) En dev: auth.js, server.js, db.js, .env.example, package.json; tests/bloque05, 06 y 07. NO reemplazar env.js.
  6. (B8) En dev: reemplazar public/js/02-render.js, 08-ui-vivo.js, 09-auth.js, 10-comunidad.js y public/index.html; CREAR public/js/12-cuenta.js; package.json version 8.6.8.
  7. (B3) Neon: verificar el límite real del plan (STORAGE_LIMIT_MB=400 es el tope de la app).
  8. (B6) Cuenta de Brevo con remitente verificado y en Render: EMAIL_PROVIDER=brevo, BREVO_API_KEY, EMAIL_FROM, EMAIL_DEV_MODE=false (sin ellas el código sale en el log de Render).
  9. (B6) Verificar que los egresados mantienen @upc.edu.pe activo; si no, plan B: REGISTRO_MANUAL=true + aprobación admin.
  10. Grupo [1+2+3+4]: con Actions en verde, unir a main y etiquetar v8.6.4. Grupo [5+6+7+8] YA CERRADO: con Actions en verde y el checklist en dev, unir a main y etiquetar v8.6.8 (el servidor 8.6.7 rechaza el registro viejo: no subir solo una parte; para volver atrás se restaura todo el grupo desde v8.6.4).
Decisiones del dueño:
  - Pagos presenciales entre usuarios (U2U no retiene dinero)
  - Node local = NO (todo vía GitHub Actions / admin / tests)
  - Opción dev elegida: B (no desplegar dev; validar con tests). Node: 22 (pendiente confirmar el de Render)
  - Datos de prueba: limpiar (por defecto)
  - Workflows: solo ubuntu-latest (gratis en repos públicos). Cliente: scripts clásicos partidos por líneas; app.js eliminado
  - (B3) Tope 10 publicaciones activas por usuario (admin exento); tope 400 MB solo rechaza lo nuevo; nada se borra por tope global
  - (B6) REGISTRO_MANUAL: no envía código; aprobar = verificar. El «día» del tope diario es hora de Lima.
  - (B5, supuestos a confirmar) Carreras: las 7 de los filtros + «Otra». Cuentas nuevas sin usuario de login visible.
  - (B8, supuestos a confirmar) La casilla obligatoria «serán visibles» envía visibility {carrera, ciclo, sede} = true. Una cuenta sin verificar puede explorar la app (con aviso) pero no publicar, reservar ni chatear. «Verificar más tarde» existe. Ciclo «Egresado» fijo para egresados.
Archivos a adjuntar para el próximo bloque (9): ESTADO.md, server.js, db.js, .env.example y package.json (el bloque 9 crea scripts/NN-migrar-fotos.js y tests/bloque09.test.js)
Próximo bloque: 9
