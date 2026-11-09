# U2U 8.3.0 — cuentas

## Cambios
1. Registro e inicio de sesión con usuario o correo + contraseña (auth.js, sin dependencias nuevas).
2. Contraseñas con crypto.scrypt (sal aleatoria por usuario). Nunca se guardan ni se envían de vuelta en texto plano.
3. Sesión guardada en el celular (token de 256 bits, 30 días, solo su SHA-256 queda en el servidor). Botón Cerrar sesión con confirmación; revoca el token.
4. Cuentas en data/users.json (data/ agregado a .gitignore). Se puede cambiar la carpeta con la variable DATA_DIR.
5. Límite de intentos: 5 fallos por cuenta = bloqueo de 15 min; tope por IP; tope de registros por IP. Mensaje de error igual exista o no el usuario.
6. Socket.io solo admite cuentas registradas; el nombre del chat sale de la cuenta (no del cliente).
7. Pantallas de login y registro con el diseño actual. Si abres el HTML sin servidor, sigue el acceso demo por nombre.

## LIMITACIÓN IMPORTANTE (Render)
Render borra el disco al redesplegar o reiniciar: data/users.json se pierde y todos tendrán que volver a registrarse.
Solución provisional: Render > Disks > montar un disco persistente y definir DATA_DIR=/ruta/del/disco.
Solución definitiva: migrar las cuentas a una base de datos (auth.js concentra todo el acceso a datos).
Chats, pedidos y publicaciones siguen en memoria (como antes).
