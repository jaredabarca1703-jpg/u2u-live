# U2U 8.4.0 — reportes, administrador y reseñas reales

## Qué cambió (resumen)
1. **Reportar publicación**: el botón ya no muestra solo un aviso. Abre un formulario con motivo (obscena, estafa, falsa, otro) y detalle opcional (obligatorio en "otro"), y lo envía al servidor. Un usuario no puede reportar dos veces la misma publicación (lo impone el servidor, incluso si el reporte se descarta o el servidor se reinicia). Tampoco se puede reportar la propia.
2. **Rol admin solo en el servidor**: la cuenta admin sale de las variables `ADMIN_USER` y `ADMIN_PASS`. No están en el código ni en el HTML. La cuenta vive solo en memoria (no se escribe en `users.json`), usa el mismo login con scrypt y límite de intentos, y nadie puede registrar ese usuario. Cada acción admin se revalida en el servidor.
3. **Panel de moderación** (Mi cuenta → "Panel de moderación", solo si entras con la cuenta admin): lista de reportes en vivo, ver la publicación, **eliminarla** (desaparece al instante para todos y se cancelan sus pedidos pendientes), **descartar** el reporte y **bloquear al usuario** (no puede iniciar sesión, se cierran sus conexiones, sus publicaciones se eliminan). Pestañas: Pendientes / Resueltos / Bloqueados (con "Desbloquear").
4. **Reseñas reales**: solo el comprador, solo cuando la entrega ya se confirmó con el PIN, una por pedido. Se guardan en el servidor; el perfil del vendedor muestra el promedio y las reseñas reales. Se quitaron las reseñas y promedios de ejemplo.

## Archivos
| Archivo | Cambio |
|---|---|
| `community.js` | **Nuevo**: reportes, acciones admin y reseñas |
| `store.js` | **Nuevo**: guardado atómico en `reports.json` y `reviews.json` |
| `server.js` | Carga de `.env`, integración del módulo, bloqueo en `join`, eliminación en vivo, `reviewed` en pedidos |
| `auth.js` | Cuenta admin por entorno, bloqueo de cuentas (`blocked`), login 403 para bloqueados |
| `public/app.js` | Formulario de reporte, panel admin, reseñas reales, manejo de eventos nuevos |
| `public/index.html` | Solo sube la versión de caché (`?v=8.4.0`) |
| `.env.example`, `.gitignore`, `package.json` | Plantilla de variables, `.env` ignorado, versión 8.4.0 |

Sin dependencias nuevas. Los datos nuevos se guardan en la misma carpeta de las cuentas (`DATA_DIR`, por defecto `data/`).

## Configurar las variables

**Variables**
- `ADMIN_USER`: usuario del administrador (3 a 20 caracteres: letras, números, `_` y `.`).
- `ADMIN_PASS`: contraseña del administrador (mínimo 10 caracteres). Usa una larga y única.
- `DATA_DIR` (opcional pero recomendada en Render): carpeta del disco persistente.

Si falta alguna o no cumple las reglas, el servidor arranca igual pero **sin admin**, y lo dice en el log (`[auth] Admin desactivado: ...`).

**En Render**
1. Entra a tu servicio web en render.com → pestaña **Environment**.
2. **Add Environment Variable**: crea `ADMIN_USER` y `ADMIN_PASS` con tus valores. Marca la contraseña como secreta si Render te lo ofrece.
3. Para que cuentas, bloqueos, reportes y reseñas no se borren al reiniciar: pestaña **Disks** → **Add Disk** (ruta, por ejemplo, `/var/data`) y añade `DATA_DIR` con esa misma ruta. (Los discos persistentes requieren un plan de pago de Render.)
4. **Save Changes**: Render vuelve a desplegar solo. En el log debe aparecer `[auth] Admin habilitado para el usuario "..."`.
5. Para cambiar la contraseña admin: edita `ADMIN_PASS` y guarda. La sesión anterior del admin deja de valer.

**En tu computadora**
1. En la carpeta del proyecto, copia `.env.example` y renombra la copia a `.env`.
2. Abre `.env` y escribe tus valores después de `ADMIN_USER=` y `ADMIN_PASS=`. Sin comillas ni espacios.
3. Inicia con `npm start`. Verás `Admin habilitado` en la consola.
4. `.env` está en `.gitignore`: no se sube a git. No lo compartas ni lo pegues en chats. Si defines la variable directamente en tu sistema, esa tiene prioridad sobre `.env`.

## Cómo usar el panel
Inicia sesión con `ADMIN_USER` y `ADMIN_PASS` en la misma pantalla de login → **Mi cuenta** → **Panel de moderación**. La cuenta admin solo modera: no puede publicar, comprar ni reportar.

## Limitaciones y decisiones a conocer
- **Persistencia**: cuentas, bloqueos, reportes y reseñas se guardan en archivos. En Render sin disco persistente se pierden al redesplegar (igual que las cuentas en 8.3.0).
- **Publicaciones y pedidos siguen en memoria** (como antes). Por eso solo se puede calificar un pedido mientras el servidor lo conserve; las reseñas ya guardadas no se pierden.
- **Publicaciones eliminadas**: el servidor recuerda sus ids y rechaza que el dueño las vuelva a subir (la app del dueño las borra de su copia local al reconectar).
- **Reportes por publicación sin existir**: si la publicación ya no está en línea (reinicio), el reporte se conserva y el admin puede marcarla como eliminada para que no reaparezca.
- **Si ya existe** una cuenta registrada con el mismo usuario que `ADMIN_USER`, el admin no se habilita (se avisa en el log): elige otro usuario.
- El login del admin comparte el límite de 5 intentos fallidos: alguien podría bloquear 15 minutos el acceso del admin intentando adivinar. No obtiene acceso, solo retrasa. Elige un `ADMIN_USER` poco obvio.
- Los promedios de los vendedores de ejemplo del catálogo demo ya no se muestran (no tienen cuenta real).

## Checklist de pruebas
**Reportes**
- [ ] Con dos cuentas (A vende, B compra), B abre la publicación de A → "Reportar publicación" → elegir cada motivo y enviar → toast de confirmación.
- [ ] B vuelve a abrir la misma publicación: ya no hay botón, dice "Ya reportaste esta publicación". Recarga la página y sigue igual.
- [ ] Motivo "otro" sin detalle → pide el detalle.
- [ ] A abre su propia publicación → avisa que es suya; una publicación de ejemplo avisa que es de ejemplo.

**Admin**
- [ ] Con `ADMIN_USER`/`ADMIN_PASS` correctos entra; con contraseña mala no. Tras 5 fallos, bloqueo temporal.
- [ ] Registrar una cuenta con el usuario del admin → "ya está en uso".
- [ ] Una cuenta normal no ve "Panel de moderación" en Mi cuenta.
- [ ] Sin variables definidas, arranca y el log dice que el admin está desactivado.
- [ ] Revisar `public/` y el HTML en el navegador (ver código fuente): no aparece ninguna contraseña.

**Panel**
- [ ] El reporte de B aparece al instante en el panel del admin (con su motivo, detalle y quién reportó). Con dos reportes a la misma publicación, muestra el conteo.
- [ ] "Ver publicación" abre la publicación.
- [ ] "Descartar reporte" lo pasa a Resueltos; B sigue sin poder reportarla de nuevo.
- [ ] "Eliminar publicación": desaparece al instante en el celular de A, de B y de quien esté mirando el catálogo; si había pedido pendiente, se cancela. Al reiniciar la app de A, no reaparece.
- [ ] "Bloquear usuario": A es expulsado al instante con aviso, sus publicaciones desaparecen, al intentar iniciar sesión ve "Tu cuenta fue bloqueada...". Aparece en Bloqueados; "Desbloquear" le devuelve el acceso.
- [ ] El admin no puede bloquearse a sí mismo, publicar ni comprar.

**Reseñas**
- [ ] B compra una publicación de A (se genera PIN); mientras no se confirme, no hay botón de calificar.
- [ ] A confirma con el PIN → a B le aparece "Calificar" → 1 a 5 estrellas + comentario opcional → enviar.
- [ ] Tras enviar, el pedido muestra "Reseña enviada" y no se puede calificar otra vez (ni desde otro dispositivo).
- [ ] Perfil de A (desde la publicación o el chat): promedio y reseña de B; A recibe aviso "te calificó con N★".
- [ ] Un vendedor sin reseñas muestra "Sin reseñas todavía" (no aparecen Lucía R. ni Diego M.).
- [ ] Un pedido cancelado no se puede calificar; ni el vendedor ni un tercero pueden calificar.
- [ ] Con un segundo pedido de otro comprador, el promedio se recalcula.
