# 🌸 NovCrl · Movilidad eléctrica y software

Sitio web full-stack de **NovCrl**, una empresa colombiana ficticia que vende **motos, autos y bicicletas eléctricas** y ofrece **software a la medida**. Es un proyecto educativo y de portafolio con catálogo, cuentas de usuario, pedidos, chat de soporte y panel de administración.

**Stack:** Node.js · Express · SQLite (`better-sqlite3`) · sesiones con cookie `httpOnly` · bcrypt · HTML5, CSS3 y JavaScript vanilla (sin frameworks).

> ⚠️ **Empresa ficticia.** NovCrl es una empresa **inventada** con fines educativos y de portafolio. Su nombre, logotipo, productos, precios, historia, cifras y textos son ficticios. **Cualquier parecido con empresas, marcas, personas o hechos reales es mera coincidencia.** El sitio no vende nada ni procesa pagos. Más detalles en el [aviso legal](#️-aviso-legal).

<!--
Capturas: cuando tengas el sitio corriendo, toma capturas y guárdalas en una carpeta `screenshots/`.
Luego descomenta este bloque y ajusta los nombres de archivo:

## 📸 Capturas

| Inicio (escritorio) | Inicio (móvil) |
| --- | --- |
| ![Inicio en escritorio](screenshots/home-desktop.png) | ![Inicio en móvil](screenshots/home-mobile.png) |

| Panel de administración | Chat de soporte |
| --- | --- |
| ![Panel de administración](screenshots/admin.png) | ![Chat de soporte](screenshots/chat.png) |
-->

---

## 📑 Contenido

1. [Características](#-características)
2. [Inicio rápido](#-inicio-rápido)
3. [Cuentas de demostración](#-cuentas-de-demostración)
4. [Estructura del proyecto](#-estructura-del-proyecto)
5. [Base de datos](#-base-de-datos)
6. [API](#-api)
7. [Pruebas](#-pruebas)
8. [Respaldo de la base de datos](#-respaldo-de-la-base-de-datos)
9. [Seguridad](#-seguridad)
10. [Aviso legal](#️-aviso-legal)
11. [Créditos, autor y licencia](#-créditos-autor-y-licencia)

---

## ✨ Características

- **Catálogo de 24 productos** (6 por categoría: moto, auto, bici y software) con filtros por categoría, orden por precio, ventas o calificación, búsqueda en vivo, indicador de stock y modal de detalle con ficha técnica y botón de WhatsApp.
- **Cuentas de usuario:** registro e inicio de sesión con validación en servidor, medidor visual de fortaleza de contraseña y sesión persistente.
- **Pedidos:** compra con control de stock dentro de una transacción e historial de "mis compras".
- **Chat de soporte:** widget flotante con historial guardado. Si no hay un administrador en línea, responde un bot con respuestas predefinidas (precios, envíos, garantía, financiación, horarios).
- **Panel de administración** (`/admin`): métricas (usuarios, productos, pedidos, ingresos, visitas, mensajes sin leer), top de ventas, CRUD de productos, gestión de usuarios y roles, bandeja de chat, pedidos y edición de los textos y datos de contacto del sitio.
- **Sección de software:** fragmentos de código de ejemplo con resaltado de sintaxis propio y botón para copiar.
- **Diseño responsive** (360 / 768 / 1440 px) con tema de flores de cerezo: paleta sakura, ciruela, crema y verde, tipografías Poppins e Inter, lluvia de pétalos en canvas (30 fps), *scroll reveal*, parallax y contadores. Respeta `prefers-reduced-motion`.

---

## 🚀 Inicio rápido

**Requisitos:** Node.js 18 o superior y npm. No necesita base de datos externa: SQLite se crea sola en `data/novcrl.db`.

```bash
# 1. Clonar el repositorio
git clone https://github.com/Cristi-ronaldo/novcrl.git
cd novcrl

# 2. Instalar dependencias
npm install

# 3. (Recomendado) crear el archivo de entorno
cp .env.example .env
#    Edita .env y define tu propio SESSION_SECRET

# 4. Iniciar el servidor
npm start
```

Abre **http://localhost:3000**. En el primer arranque se crea la base de datos y se cargan los 24 productos, la configuración del sitio y las dos cuentas de demostración.

### Scripts

| Comando | Descripción |
| --- | --- |
| `npm start` | Inicia el servidor en `http://localhost:3000`. |
| `npm run dev` | Igual que `start`, pero recarga al editar archivos (`--watch`). |
| `npm run seed` | Carga los datos iniciales **solo si la tabla de productos está vacía**. No reinicia una base existente. |

> Para empezar de cero, detén el servidor, borra los archivos `data/novcrl.db*` y vuelve a ejecutar `npm start`.

### Variables de entorno

| Variable | Por defecto | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP. |
| `NODE_ENV` | `development` | En `production` las cookies se marcan como `secure`. |
| `SESSION_SECRET` | valor de desarrollo | Secreto para firmar la sesión. **Cámbialo siempre fuera de tu equipo.** |
| `DB_PATH` | `data/novcrl.db` | Ruta alternativa del archivo SQLite (opcional). |

Para generar un secreto seguro:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 🔑 Cuentas de demostración

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@novcrl.example` | `Admin123*` |
| Cliente | `demo@novcrl.example` | `Demo1234*` |

El panel está en **http://localhost:3000/admin**. Un visitante sin sesión recibe `401` en la API de administración y un usuario sin rol de administrador recibe `403`.

> Estas credenciales son **solo para desarrollo local**. No las uses en un sitio publicado.

---

## 📁 Estructura del proyecto

```text
novcrl/
├── server.js              # App Express, sesión, estáticos, rutas y manejo de errores JSON
├── db.js                  # Conexión SQLite, creación de tablas y datos iniciales
├── schema.sql             # Esquema SQL documentado (referencia)
├── package.json
├── .env.example           # Variables de entorno de ejemplo
├── LICENSE
├── routes/
│   ├── middleware.js      # requireAuth / requireAdmin y señal de "admin en línea"
│   ├── auth.js            # Registro, login, logout y sesión actual
│   ├── products.js        # Catálogo público: filtros, orden, búsqueda y detalle
│   ├── orders.js          # Pedidos y "mis compras"
│   ├── messages.js        # Chat de soporte y bot de respuestas
│   ├── settings.js        # Configuración pública del sitio
│   └── admin.js           # CRUD de productos, usuarios, pedidos, mensajes, ajustes y métricas
├── views/
│   ├── index.html         # Sitio público
│   └── admin.html         # Panel de administración
├── public/
│   ├── css/               # styles.css (sitio) y admin.css (panel)
│   ├── js/                # app.js, catalog.js, snippets.js, animations.js, admin.js
│   ├── img/               # Logo, favicon e imágenes de respaldo por categoría (SVG)
│   └── uploads/           # Carpeta reservada para subidas (aún sin uso)
└── tests/
    └── e2e.sh             # Pruebas de integración con curl
```

La carpeta `data/` se crea automáticamente al iniciar y no se versiona.

---

## 🗄️ Base de datos

SQLite con `journal_mode = WAL` y `foreign_keys = ON`. Las tablas se crean en `db.js` y están documentadas en `schema.sql`.

| Tabla | Contenido | Detalles |
| --- | --- | --- |
| `users` | Usuarios | `email` único (sin distinguir mayúsculas), contraseña con hash bcrypt (coste 12), `rol` = `user` o `admin` |
| `products` | Catálogo | `categoria` = `moto`, `auto`, `bici` o `software`; `precio_cop`, `specs` (JSON), `stock`, `ventas`, `rating` (0–5), `activo` |
| `orders` | Pedidos | Relaciona usuario y producto; `cantidad` de 1 a 10 y `total` calculado en servidor |
| `messages` | Chat | Mensajes por usuario; `de_admin` indica si responde el administrador o el bot; `leido` |
| `settings` | Ajustes | Pares clave/valor editables desde el panel (textos, contacto, visitas) |

Hay índices en `products(categoria)`, `products(activo)`, `orders(user_id)`, `orders(product_id)`, `messages(user_id)` y `messages(leido)`.

---

## 🔌 API

Todas las respuestas son JSON. Los errores devuelven `{ "error": "mensaje en español" }` con el código HTTP correspondiente.

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Estado del servicio |
| POST | `/api/auth/register` | Crear cuenta |
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET | `/api/auth/me` | Usuario de la sesión actual |
| GET | `/api/products` | Catálogo (`?categoria=&q=&orden=`) |
| GET | `/api/products/:id` | Detalle de un producto |
| GET | `/api/settings/public` | Textos y datos de contacto públicos |
| POST | `/api/orders` | Registrar un pedido (requiere sesión) |
| GET | `/api/orders/mine` | Mis compras |
| GET | `/api/messages/mine` | Historial del chat |
| GET | `/api/messages/status` | Si hay un administrador en línea y mensajes sin leer |
| POST | `/api/messages` | Enviar mensaje (responde el bot si no hay administrador) |
| GET | `/api/admin/stats` | Métricas del panel |
| GET · POST · PUT · PATCH · DELETE | `/api/admin/products…` | CRUD de productos |
| GET | `/api/admin/users` | Listado de usuarios |
| PATCH | `/api/admin/users/:id/rol` | Cambiar rol |
| GET · POST | `/api/admin/messages/…` | Hilos y respuestas del chat |
| GET · PUT | `/api/admin/settings` | Configuración editable |
| GET | `/api/admin/orders` | Pedidos recientes |

---

## 🧪 Pruebas

`tests/e2e.sh` ejecuta 38 pruebas de integración con `curl` sobre la API real: registro (contraseña débil, correo inválido, duplicado), sesión, catálogo, pedidos, chat, administración y permisos.

```bash
# con el servidor corriendo en el puerto 3000
bash tests/e2e.sh
```

> Las pruebas **crean datos reales** (usuarios y un producto de prueba) en la base de datos. Ejecútalas sobre una base desechable y bórrala después (ver "Inicio rápido").

---

## 💾 Respaldo de la base de datos

La base vive en `data/novcrl.db` (más los archivos `-wal` y `-shm` del modo WAL).

**Copia en caliente con SQLite (recomendada):**

```bash
sqlite3 data/novcrl.db ".backup 'respaldo-novcrl.db'"
```

**Copia de archivos (con el servidor detenido):**

```bash
cp data/novcrl.db data/novcrl.db-wal data/novcrl.db-shm respaldos/ 2>/dev/null
```

**Restaurar:** detén el servidor, reemplaza `data/novcrl.db` por el respaldo y ejecuta `npm start`.

---

## 🔒 Seguridad

**Ya implementado**

- Contraseñas con bcrypt (coste 12) y reglas mínimas: 8 a 72 caracteres, con al menos una letra y un número.
- Cookie de sesión `httpOnly` y `sameSite=lax`; `secure` cuando `NODE_ENV=production`.
- Consultas SQL parametrizadas.
- Rutas `/api/admin/*` protegidas por rol en el servidor.
- Escape de HTML en el frontend para los datos que escriben los usuarios (chat, nombres, etc.).
- Errores internos registrados en el servidor; el cliente solo recibe un mensaje genérico.

### 🚧 Antes de publicar en producción

Este proyecto está pensado para aprender y demostrar. Para desplegarlo de verdad, falta:

- [ ] **Credenciales sembradas:** las cuentas de demostración están escritas en `db.js`. Cámbialas o léelas desde variables de entorno.
- [ ] **`SESSION_SECRET` obligatorio:** hoy existe un valor de respaldo en el código. En producción conviene que el servidor se niegue a iniciar si no está definido.
- [ ] **Almacén de sesiones persistente:** se usa el `MemoryStore` por defecto, que pierde las sesiones al reiniciar y no es apto para producción.
- [ ] **Límite de intentos** en `/api/auth/login` y `/api/auth/register` (por ejemplo, con `express-rate-limit`).
- [ ] **Cabeceras de seguridad** (por ejemplo, con `helmet`) y una política CSP.
- [ ] **Protección CSRF** con token, además de `sameSite=lax`.
- [ ] **Cambios de rol en sesiones activas:** el rol se guarda en la sesión al iniciar, así que un administrador degradado conserva el acceso hasta que su sesión expire. Conviene leer el rol desde la base de datos en cada petición.
- [ ] **HTTPS** y revisión de los datos de contacto antes de un despliegue real.

---

## ⚖️ Aviso legal

**NovCrl es una empresa ficticia.** Este proyecto se creó únicamente con fines educativos y de portafolio.

- El **nombre "NovCrl"**, el logotipo, los nombres de los productos, los precios, las cifras, la historia de la empresa y los textos publicitarios son inventados.
- La **dirección** y el **número de teléfono** que aparecen en el sitio son ficticios. El **correo de contacto** (`Lozanocristianaguiar@gmail.com`) es el del autor del proyecto.
- **Cualquier similitud con empresas, marcas, productos, personas o hechos reales es mera coincidencia.** No existe ninguna relación ni afiliación con fabricantes o marcas reales de vehículos o de software.
- El sitio **no vende productos ni procesa pagos**. Los pedidos solo se guardan en la base de datos local como demostración.
- Las fotografías pertenecen a sus autores en [Unsplash](https://unsplash.com) y se usan únicamente con fines ilustrativos.

---

## 🖼️ Créditos, autor y licencia

**Imágenes:** las fotografías de producto provienen de [Unsplash](https://unsplash.com) y se cargan por URL directa. Si una imagen no carga, se usa un SVG de respaldo en `public/img/`. El logotipo y el favicon son SVG originales.

**Autor:** Cristian Lozano · GitHub: [@Cristi-ronaldo](https://github.com/Cristi-ronaldo) · Correo: [Lozanocristianaguiar@gmail.com](mailto:Lozanocristianaguiar@gmail.com)

**Licencia:** [MIT](LICENSE).
