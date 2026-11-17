# U2U - Marketplace Universitario UPC 🚀

U2U es una plataforma web de compra, venta y alquiler de materiales académicos (libros, maquetas, calculadoras, etc.) diseñada exclusivamente para estudiantes de la Universidad Peruana de Ciencias Aplicadas (UPC).

## 🌟 Características Principales

* **Comunidad Cerrada:** Registro validado exclusivamente con correos institucionales `@upc.edu.pe`.
* **Entregas con código:** el intercambio se confirma con un código PIN de 6 dígitos. U2U **no retiene dinero**: el pago se hace directamente al vendedor al entregar. El PIN se guarda en claro en `orders.data.pin`.
* **Chat en Tiempo Real:** Comunicación instantánea entre compradores y vendedores integrada en la plataforma.
* **Perfiles Estudiantiles:** Reputación basada en reseñas, mostrando Sede, Carrera y Ciclo del alumno.
* **Gestión de publicaciones:** los usuarios pueden publicar y eliminar sus propias publicaciones (pausar, marcar como vendido y editar aún no están disponibles).
* **Cuenta Oficial Integrada:** Moderación, soporte y catálogo semilla gestionado por la cuenta administrativa.

## 🛠️ Stack Tecnológico

* **Frontend:** HTML5, CSS3, Vanilla JavaScript.
* **Backend:** Node.js, Express.
* **Tiempo Real:** Socket.io.
* **Base de Datos:** PostgreSQL (alojado en Neon).
* **Seguridad:** contraseñas con `crypto.scrypt`, límites de intentos por cuenta e IP y cabeceras de seguridad básicas.

## ⚙️ Instalación y Configuración Local

Requiere Node.js 22.x.

1. **Clona el repositorio e instala dependencias:**
   ```bash
   git clone https://github.com/jaredabarca1703-jpg/u2u-live.git
   cd u2u-live
   npm install
   ```
2. **Configura las variables de entorno:** copia `.env.example` a `.env` y ajusta los valores. Sin `DATABASE_URL` la app guarda los datos en archivos locales (`DATA_DIR`), sin PostgreSQL. Sin proveedor de correo (`EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `EMAIL_FROM`) los códigos de verificación solo salen por consola.
3. **Inicia el servidor:**
   ```bash
   npm start
   ```
   y abre `http://localhost:3000`.
4. **Pruebas:** `npm run check` y `npm test` (ver `README-TESTING.md`).
