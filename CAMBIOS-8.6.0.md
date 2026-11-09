# U2U 8.6.0 — cuenta oficial (administrador + vendedor)

## Qué cambió
1. **Una sola cuenta oficial**, definida por `ADMIN_USER` y `ADMIN_PASS`. Nueva variable `OFFICIAL_NAME` (nombre público, por defecto "U2U Oficial"). El usuario de login **nunca** se muestra a otros: solo el nombre público. Nadie puede registrarse con ese usuario ni con nombres parecidos a "U2U Oficial".
2. **Puede**: moderar (panel), **publicar**, recibir pedidos, confirmar entregas con PIN y chatear. **No puede**: comprarse a sí misma (ni comprar/alquilar a otros), reportar, ni calificarse. Los demás usuarios **sí** pueden calificarla. Todo se valida en el servidor.
3. **uid fijo** (`u_admin`, no depende de ADMIN_USER, ADMIN_PASS ni de reinicios): sus productos siguen siendo suyos siempre. La cuenta sigue **sin guardarse como usuario** en la base (ni sus sesiones).
4. **Chats** migrados a PostgreSQL (tabla `convs`, se crea sola). Reportes, reseñas y publicaciones eliminadas ya estaban migrados en 8.5.0.
5. **seed.json** (24 productos con ids 1–24, fotos de `public/img/`): el catálogo de ejemplo y los vendedores ficticios salieron de `app.js`. Al iniciar, el servidor crea **solo los que faltan** a nombre de la cuenta oficial: no duplica en cada reinicio y **no recrea los que elimines** desde el panel.
6. **Cero reseñas de prueba**: la cuenta oficial empieza con 0 calificaciones (todas son reales, solo tras una entrega confirmada con PIN).
7. **Insignia "Oficial ✓"** en tarjetas, detalle y perfil del vendedor (la decide el servidor; nadie puede falsificarla). Filtro **Todos / Oficiales ✓ / Comunidad** en el catálogo. Los productos de otros usuarios se suman y se conservan; el tope de 50 publicaciones cuenta solo las de la comunidad (las oficiales no se descartan).
8. **Bienvenida**: al registrarse, la cuenta oficial le escribe un chat con un consejo para su primera publicación (con aviso de mensaje nuevo). Botón **"Chatear con U2U Oficial"** en inicio y perfil.
9. Panel admin: nueva pestaña **Oficiales** para eliminar productos oficiales, y botón de eliminar en el detalle de cualquier publicación.

## Cómo elegir ADMIN_USER y ADMIN_PASS
- **ADMIN_USER**: algo que nadie adivine y que no sea tu nombre ni tu correo. No uses `admin`, `administrador`, `u2u` ni `root`. Acepta 3–20 letras, números, `_` y `.`. Ejemplo de estilo: `mesa_k7x_41`.
- **ADMIN_PASS**: mínimo 10 caracteres (el servidor lo exige); mejor una frase larga de 4–5 palabras al azar (25+ caracteres), por ejemplo `cafe-lluvia-torre-azul-nube`. Que no la uses en ningún otro sitio. Guárdala en un gestor de contraseñas (Bitwarden es gratis) o en papel; nunca en el chat, en el repositorio ni en capturas.
- Tras 5 intentos fallidos la cuenta se bloquea 15 minutos. Cambiar ADMIN_USER o ADMIN_PASS más adelante es seguro: tus productos no se pierden.

## Dónde configurarlas
**Render**: tu servicio → **Environment** → **Add Environment Variable** (una por cada una) → `ADMIN_USER`, `ADMIN_PASS`, `OFFICIAL_NAME` (ej. `U2U Oficial`) y `DATABASE_URL` (ya la tienes) → **Save Changes**. Render redespliega. En el log debes ver: `[auth] Cuenta oficial habilitada` y `[seed] catálogo oficial: 24 creados`.
**Tu computadora**: copia `.env.example` como `.env`, rellena `ADMIN_USER=`, `ADMIN_PASS=`, `OFFICIAL_NAME=` y `DATABASE_URL=` (sin comillas ni espacios), luego `npm install` y `npm start`. El `.env` está en `.gitignore`: no se sube.

## Cosas que debes saber
- **Eliminar un producto oficial es definitivo**: el seed no lo recrea. Para cambiar precio o descripción de uno, elimínalo y publica uno nuevo, o añade uno nuevo a seed.json con un id libre (25 en adelante) y reinicia.
- La bienvenida solo se envía a cuentas **nuevas** (las que ya existían no la reciben, pero pueden usar el botón de chat).
- Sin servidor (abriendo el HTML suelto) ya no hay catálogo: ahora viene del servidor.
- Sin ADMIN_USER/ADMIN_PASS no hay cuenta oficial ni seed (el log lo avisa).
- La cuenta oficial no compra ni alquila a otros usuarios (interpretación conservadora; es una línea en server.js si quieres permitirlo).
- Los chats guardan los últimos 200 mensajes de cada conversación y hasta 500 conversaciones.

## Checklist
**Laptop**
- [ ] Entrar con tu cuenta oficial: tu nombre es "U2U Oficial" y ves el panel con la pestaña Oficiales.
- [ ] Registrar otra cuenta: aparece 1 mensaje nuevo de U2U Oficial con el consejo.
- [ ] Con esa cuenta, comprar un producto oficial; en el pedido ver el PIN; con la oficial, confirmar con el PIN.
- [ ] Calificar a la oficial (solo después de la entrega).
- [ ] Eliminar un producto oficial desde el panel, reiniciar: no vuelve; el resto no se duplica (24 → 23).
- [ ] Ver código fuente y respuestas de red: no aparece tu usuario de login.
**iPhone y Android**
- [ ] Filtro Oficiales / Comunidad y la insignia se ven bien (sin cortarse).
- [ ] Botón "Chatear con U2U Oficial" abre el chat y el teclado no hace zoom.
- [ ] Publicar un producto como usuario: sale sin insignia y se conserva tras redesplegar en Render.
