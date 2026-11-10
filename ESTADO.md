ESTADO · versión 8.6.2
Terminados: [1 ✅, 2 ✅ (sin verificar jsdom en Actions)]
En curso: ninguno
Variables de entorno nuevas: ninguna (secretos de GitHub: DATABASE_URL_DEV, DATABASE_URL_PROD)
Tablas o campos nuevos: ninguno
Endpoints y eventos nuevos: ninguno
Estructura del cliente (B2): public/index.html carga, en este orden y SIN type="module", public/js/ 01-estado, 02-render (nav, tarjeta, objeto V de pantallas), 03-local-publicar, 04-ai-upc, 05-socket (LV, identidad, liveStart), 06-chat, 07-pedidos (+bandeja, indicadores), 08-ui-vivo (filtros, catálogo en vivo, confirmación, reseñas UI, banner de red), 09-auth, 10-comunidad (reportes, reseñas, panel admin, cuenta oficial, bootInit()). public/app.js se elimina. Todas las funciones siguen globales (los onclick en línea dependen de ello). LV, S, V, etc. son const/let globales: se leen sin «window.».
PENDIENTES (bloque de origen · qué falta):
  - (B2) Verificar que tests/client-smoke.test.js pasa en Actions (jsdom no se pudo instalar aquí).
  - (B2) Reemplazar package-lock.json por el artefacto «package-lock» de Actions (README-TESTING §9).
Acciones manuales pendientes (dueño):
  1. (B1) Render → Logs: confirmar «Using Node.js version…» (engines = 22.x) y avisarme.
  2. (B1) Crear rama dev en GitHub; subir workflows y archivos a dev (workflows también a main).
  3. (B1) Neon: rama dev-pruebas (padre production).
  4. (B1) GitHub: secretos DATABASE_URL_DEV y DATABASE_URL_PROD (README-TESTING §6).
  5. (B1) Confirmar que push a dev dispara «tests» y que «run-script» aparece en Actions.
  6. (B2) En dev: crear public/js/*.js, reemplazar public/index.html, package.json, test.yml, run-script.yml, README-TESTING.md; BORRAR public/app.js.
  7. (B2) Probar dev en local no es posible: validar con Actions y, tras cerrar el grupo [1+2], unir a main y revisar la app en Render (checklist del bloque 2).
  8. (B2) Render → Settings → Build Command = «npm install» (hasta reemplazar el lock).
Decisiones del dueño:
  - Pagos presenciales entre usuarios (U2U no retiene dinero)
  - Node local = NO (todo vía GitHub Actions / admin / tests)
  - Opción dev elegida: B (no desplegar dev; validar con tests). Node: 22 (pendiente confirmar el de Render)
  - Datos de prueba: limpiar (por defecto)
  - Workflows: solo ubuntu-latest (gratis en repos públicos)
  - Cliente: scripts clásicos partidos por líneas, sin cambios funcionales; app.js eliminado
Archivos a adjuntar para el próximo bloque: los que liste el bloque 3 + package.json (8.6.2) + ESTADO.md (nota: el cliente ahora está en public/js/*.js, ya no en app.js)
Próximo bloque: 3
Grupo [1+2] cerrado al verificar Actions: unir dev→main y etiquetar v8.6.2.
