/**
 * db.js — Capa de datos de NovaVolt
 * SQLite con better-sqlite3. El archivo vive en data/novavolt.db y se
 * escribe de forma sincrónica en cada operación (persistencia real).
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'novavolt.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ------------------------------------------------------------------ */
/* Esquema                                                             */
/* ------------------------------------------------------------------ */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  rol           TEXT    NOT NULL DEFAULT 'user' CHECK (rol IN ('user','admin')),
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL,
  categoria     TEXT    NOT NULL CHECK (categoria IN ('moto','auto','bici','software')),
  precio_cop    INTEGER NOT NULL CHECK (precio_cop >= 0),
  descripcion   TEXT    NOT NULL,
  imagen_url    TEXT    NOT NULL,
  stock         INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  ventas        INTEGER NOT NULL DEFAULT 0 CHECK (ventas >= 0),
  rating        REAL    NOT NULL DEFAULT 4.5 CHECK (rating >= 0 AND rating <= 5),
  activo        INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
  specs         TEXT    NOT NULL DEFAULT '[]',
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  cantidad   INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  total      INTEGER NOT NULL CHECK (total >= 0),
  creado_en  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS messages (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL,
  contenido TEXT    NOT NULL,
  de_admin  INTEGER NOT NULL DEFAULT 0 CHECK (de_admin IN (0,1)),
  leido     INTEGER NOT NULL DEFAULT 0 CHECK (leido IN (0,1)),
  creado_en TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS settings (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_products_categoria ON products(categoria);
CREATE INDEX IF NOT EXISTS idx_products_activo    ON products(activo);
CREATE INDEX IF NOT EXISTS idx_orders_user        ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product     ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_messages_user      ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_leido     ON messages(leido);
`);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const U = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;

const SETTINGS_SEED = {
  hero_badge: 'Movilidad eléctrica y software hecho en Colombia',
  hero_titulo: 'El futuro se mueve en silencio',
  hero_subtitulo:
    'Motos, autos y bicicletas eléctricas, más software a la medida para tu negocio. Tecnología limpia, soporte cercano y financiación pensada para Colombia.',
  nosotros_titulo: 'Somos NovaVolt',
  nosotros_texto:
    'Nacimos en Bogotá con una idea sencilla: la tecnología debe hacer la vida más liviana. Diseñamos y comercializamos vehículos eléctricos de alta eficiencia y desarrollamos software que ayuda a empresas colombianas a crecer sin complicaciones. Cada producto pasa por pruebas reales en nuestras calles, y cada cliente recibe acompañamiento antes, durante y después de la compra. Somos un equipo pequeño, obsesionado con el detalle, que cree en una movilidad más limpia y en un software que se entiende sin manuales.',
  direccion: 'Calle 48C 25-05, Bogotá',
  whatsapp: '+57 310 383 2322',
  correo: 'Lozanoaguiarcristian@gmail.com',
  envio_texto: 'Envío gratis en Bogotá en compras superiores a $2.000.000 COP. Garantía de 12 meses en vehículos y 30 días de soporte en software.',
  franja_frases: JSON.stringify([
    'Muévete distinto, muévete en silencio.',
    'La energía limpia también se diseña.',
    'Tu próxima ruta empieza con una decisión.',
    'Menos ruido, más camino.',
    'Software que trabaja mientras tú descansas.',
    'Bogotá se mueve mejor cuando tú te mueves mejor.',
    'Cada kilómetro cuenta. Cada idea también.'
  ]),
  visitas: '0',
  admin_last_seen: '0'
};

const PRODUCTS = [
  /* ---------------------------- MOTOS (6) ---------------------------- */
  {
    nombre: 'NovaVolt Sakura S1', categoria: 'moto', precio_cop: 7890000,
    descripcion: 'Scooter eléctrica urbana de 3.000 W, ideal para trayectos diarios en Bogotá. Autonomía real de 85 km y carga completa en 4 horas.',
    imagen_url: U('1558981806-ec527fa84c39'), stock: 14, ventas: 128, rating: 4.8,
    specs: [['Motor','3.000 W brushless'],['Autonomía','85 km'],['Velocidad máxima','65 km/h'],['Batería','60 V / 26 Ah litio'],['Carga','4 h'],['Peso','78 kg']]
  },
  {
    nombre: 'NovaVolt Rayo X', categoria: 'moto', precio_cop: 12490000,
    descripcion: 'Moto deportiva eléctrica con aceleración inmediata, frenos ABS y tablero digital conectado. Para quienes quieren adrenalina sin gasolina.',
    imagen_url: U('1568772585407-9361f9bf3a87'), stock: 8, ventas: 74, rating: 4.7,
    specs: [['Motor','5.000 W'],['Autonomía','120 km'],['Velocidad máxima','95 km/h'],['Batería','72 V / 40 Ah'],['Frenos','Disco + ABS'],['Peso','96 kg']]
  },
  {
    nombre: 'NovaVolt Urbana Lite', categoria: 'moto', precio_cop: 5490000,
    descripcion: 'La entrada perfecta a la movilidad eléctrica. Ligera, plegable y con espacio para casco bajo el asiento. Sin pico y placa.',
    imagen_url: U('1591637333184-19aa84b3e01f'), stock: 22, ventas: 203, rating: 4.5,
    specs: [['Motor','1.500 W'],['Autonomía','60 km'],['Velocidad máxima','45 km/h'],['Batería','48 V / 20 Ah extraíble'],['Carga','5 h'],['Peso','58 kg']]
  },
  {
    nombre: 'NovaVolt Cargo E-250', categoria: 'moto', precio_cop: 15990000,
    descripcion: 'Triciclo eléctrico de carga para domicilios y microempresas. Caja de 250 kg y suspensión reforzada para pavimento irregular.',
    imagen_url: U('1609630875171-b1321377ee65'), stock: 5, ventas: 31, rating: 4.6,
    specs: [['Motor','2.500 W'],['Capacidad de carga','250 kg'],['Autonomía','90 km'],['Batería','60 V / 45 Ah'],['Frenos','Tambor reforzado'],['Peso','145 kg']]
  },
  {
    nombre: 'NovaVolt Trail 400', categoria: 'moto', precio_cop: 18990000,
    descripcion: 'Doble propósito eléctrica con llantas mixtas y 180 mm de suspensión. Diseñada para trochas suaves y caminos de tierra.',
    imagen_url: U('1558980664-10e7170b5df9'), stock: 6, ventas: 22, rating: 4.4,
    specs: [['Motor','4.000 W'],['Autonomía','110 km'],['Velocidad máxima','85 km/h'],['Suspensión','180 mm'],['Batería','72 V / 35 Ah'],['Peso','102 kg']]
  },
  {
    nombre: 'NovaVolt City Pro', categoria: 'moto', precio_cop: 9490000,
    descripcion: 'Scooter premium con arranque sin llave, GPS antirrobo y maletero de 28 litros. Pensada para el ejecutivo que evita trancones.',
    imagen_url: U('1449426468159-d96dbf08f19f'), stock: 11, ventas: 96, rating: 4.9,
    specs: [['Motor','3.500 W'],['Autonomía','100 km'],['Velocidad máxima','75 km/h'],['Batería','60 V / 32 Ah'],['Conectividad','GPS + app'],['Peso','84 kg']]
  },

  /* ---------------------------- AUTOS (6) ---------------------------- */
  {
    nombre: 'NovaVolt Aurora Compact', categoria: 'auto', precio_cop: 89900000,
    descripcion: 'Hatchback eléctrico de cinco puertas con 320 km de autonomía y carga rápida. El compañero ideal para la ciudad.',
    imagen_url: U('1560958089-b8a1929cea89'), stock: 4, ventas: 38, rating: 4.7,
    specs: [['Motor','100 kW'],['Autonomía','320 km'],['Batería','45 kWh'],['Carga rápida','30 min (10–80 %)'],['Plazas','5'],['Maletero','310 L']]
  },
  {
    nombre: 'NovaVolt Sedán Eclipse', categoria: 'auto', precio_cop: 132000000,
    descripcion: 'Sedán eléctrico de lujo silencioso, con techo panorámico, asientos ventilados y asistente de conducción nivel 2.',
    imagen_url: U('1617788138017-80ad40651399'), stock: 3, ventas: 19, rating: 4.9,
    specs: [['Motor','150 kW'],['Autonomía','480 km'],['Batería','66 kWh'],['Carga rápida','35 min (10–80 %)'],['ADAS','Nivel 2'],['Maletero','420 L']]
  },
  {
    nombre: 'NovaVolt SUV Cumbre', categoria: 'auto', precio_cop: 168000000,
    descripcion: 'SUV eléctrica de siete plazas con tracción integral y suspensión adaptativa. Para familia y carretera sin sacrificar confort.',
    imagen_url: U('1502877338535-766e1452684a'), stock: 2, ventas: 12, rating: 4.6,
    specs: [['Motor','Dual 220 kW'],['Autonomía','420 km'],['Batería','77 kWh'],['Tracción','AWD'],['Plazas','7'],['Maletero','560 L']]
  },
  {
    nombre: 'NovaVolt Van Cargo E', categoria: 'auto', precio_cop: 145000000,
    descripcion: 'Furgoneta eléctrica de reparto con 4,2 m³ de capacidad y puertas laterales corredizas. Costo por kilómetro hasta 70 % menor.',
    imagen_url: U('1593941707882-a5bba14938c7'), stock: 3, ventas: 27, rating: 4.5,
    specs: [['Motor','120 kW'],['Autonomía','280 km'],['Batería','60 kWh'],['Capacidad','4,2 m³'],['Carga útil','850 kg'],['Carga rápida','40 min']]
  },
  {
    nombre: 'NovaVolt City Mini', categoria: 'auto', precio_cop: 67900000,
    descripcion: 'El auto eléctrico más accesible del portafolio. Dos plazas, 210 km de autonomía y un radio de giro que cabe en cualquier parqueadero.',
    imagen_url: U('1552519507-da3b142c6e3d'), stock: 7, ventas: 64, rating: 4.3,
    specs: [['Motor','45 kW'],['Autonomía','210 km'],['Batería','28 kWh'],['Plazas','2'],['Carga','6 h'],['Peso','980 kg']]
  },
  {
    nombre: 'NovaVolt Pickup Volt', categoria: 'auto', precio_cop: 189000000,
    descripcion: 'Camioneta eléctrica 4x4 con capacidad de carga de 1.000 kg y toma de corriente 220 V para herramientas en campo.',
    imagen_url: U('1494976388531-d1058494cdd8'), stock: 2, ventas: 9, rating: 4.8,
    specs: [['Motor','Dual 260 kW'],['Autonomía','380 km'],['Batería','82 kWh'],['Tracción','4x4'],['Carga útil','1.000 kg'],['Toma 220 V','Sí']]
  },

  /* ---------------------------- BICIS (6) ---------------------------- */
  {
    nombre: 'NovaVolt Bici Sakura Urban', categoria: 'bici', precio_cop: 3290000,
    descripcion: 'Bicicleta eléctrica urbana de cuadro bajo, canasta frontal y luces integradas. Perfecta para ir al trabajo sin sudar.',
    imagen_url: U('1571068316344-75bc76f77890'), stock: 18, ventas: 187, rating: 4.7,
    specs: [['Motor','250 W'],['Autonomía','70 km'],['Batería','36 V / 13 Ah'],['Cuadro','Aluminio paso bajo'],['Cambios','7 velocidades'],['Peso','23 kg']]
  },
  {
    nombre: 'NovaVolt MTB Volt Trail', categoria: 'bici', precio_cop: 5890000,
    descripcion: 'Bicicleta eléctrica de montaña con motor central y suspensión de 120 mm. Sube cualquier loma sin llegar cansado.',
    imagen_url: U('1485965120184-e220f721d03e'), stock: 9, ventas: 58, rating: 4.8,
    specs: [['Motor','250 W central'],['Autonomía','90 km'],['Batería','48 V / 15 Ah'],['Suspensión','120 mm'],['Cambios','10 velocidades'],['Peso','25 kg']]
  },
  {
    nombre: 'NovaVolt Plegable Mini', categoria: 'bici', precio_cop: 2790000,
    descripcion: 'Bicicleta eléctrica plegable de 20 pulgadas que entra en el baúl del carro o en el ascensor. Ideal para combinar con TransMilenio.',
    imagen_url: U('1502744688674-c619d1586c9e'), stock: 25, ventas: 142, rating: 4.4,
    specs: [['Motor','250 W'],['Autonomía','55 km'],['Batería','36 V / 10 Ah'],['Rin','20 pulgadas'],['Plegado','30 s'],['Peso','19 kg']]
  },
  {
    nombre: 'NovaVolt Cargo Bici', categoria: 'bici', precio_cop: 7490000,
    descripcion: 'Bicicleta de carga con cajón trasero para 80 kg. La solución de reparto sostenible para cafeterías y tiendas de barrio.',
    imagen_url: U('1532298229144-0ec0c57515c7'), stock: 7, ventas: 41, rating: 4.6,
    specs: [['Motor','350 W'],['Autonomía','80 km'],['Capacidad','80 kg'],['Batería','48 V / 17 Ah'],['Cajón','120 L'],['Peso','34 kg']]
  },
  {
    nombre: 'NovaVolt Road Aero', categoria: 'bici', precio_cop: 8990000,
    descripcion: 'Bicicleta eléctrica de ruta con cuadro de carbono, motor de 350 W y 11 velocidades. Para entrenar largo sin límites.',
    imagen_url: U('1511994298241-608e28f14fde'), stock: 4, ventas: 17, rating: 4.9,
    specs: [['Motor','350 W'],['Autonomía','110 km'],['Batería','48 V / 14 Ah'],['Cuadro','Carbono'],['Cambios','11 velocidades'],['Peso','14 kg']]
  },
  {
    nombre: 'NovaVolt Bici Niño Volt', categoria: 'bici', precio_cop: 1990000,
    descripcion: 'Bicicleta eléctrica infantil con velocidad limitada a 20 km/h y control parental desde el celular. Diversión segura.',
    imagen_url: U('1541625602330-2277a4c46182'), stock: 16, ventas: 89, rating: 4.5,
    specs: [['Motor','180 W'],['Autonomía','35 km'],['Batería','24 V / 8 Ah'],['Rin','20 pulgadas'],['Límite','20 km/h'],['Peso','15 kg']]
  },

  /* -------------------------- SOFTWARE (6) --------------------------- */
  {
    nombre: 'NovaVolt Landing Express', categoria: 'software', precio_cop: 1490000,
    descripcion: 'Landing page profesional de carga rápida, formulario conectado a WhatsApp y panel para editar textos sin tocar código.',
    imagen_url: U('1461749280684-dccba630e2f6'), stock: 999, ventas: 156, rating: 4.8,
    specs: [['Entrega','5 días hábiles'],['Incluye','Diseño + desarrollo'],['Tecnología','HTML, CSS, JS'],['Hosting','1 año incluido'],['Soporte','30 días'],['SEO','Básico']]
  },
  {
    nombre: 'NovaVolt API REST Pro', categoria: 'software', precio_cop: 2890000,
    descripcion: 'API REST documentada con autenticación JWT, roles, paginación y pruebas automatizadas. Lista para integrarse con tu app.',
    imagen_url: U('1555066931-4365d14bab8c'), stock: 999, ventas: 98, rating: 4.7,
    specs: [['Entrega','10 días hábiles'],['Stack','Node.js + Express'],['Base de datos','PostgreSQL / SQLite'],['Auth','JWT + roles'],['Docs','OpenAPI 3'],['Pruebas','Jest']]
  },
  {
    nombre: 'NovaVolt Respaldo Automático', categoria: 'software', precio_cop: 990000,
    descripcion: 'Script de respaldo programado con cifrado, rotación de copias y alertas por correo. Tu información dormirá tranquila.',
    imagen_url: U('1498050108023-c5249f4df085'), stock: 999, ventas: 211, rating: 4.6,
    specs: [['Entrega','3 días hábiles'],['Sistema','Linux / Windows'],['Cifrado','AES-256'],['Rotación','7 / 30 / 365 días'],['Alertas','SMTP'],['Instalación','Incluida']]
  },
  {
    nombre: 'NovaVolt UI Kit Volt', categoria: 'software', precio_cop: 1790000,
    descripcion: 'Sistema de componentes accesibles en HTML, CSS y JavaScript puro: botones, modales, tablas y formularios listos para producción.',
    imagen_url: U('1517180102446-f3ece451e9d8'), stock: 999, ventas: 134, rating: 4.9,
    specs: [['Entrega','Inmediata'],['Componentes','28'],['Accesibilidad','WCAG AA'],['Tecnología','Vanilla JS'],['Temas','Claro / oscuro'],['Licencia','Uso comercial']]
  },
  {
    nombre: 'NovaVolt Panel Admin', categoria: 'software', precio_cop: 3490000,
    descripcion: 'Panel administrativo completo con CRUD, gráficas, gestión de usuarios y registro de actividad. Personalízalo en días, no meses.',
    imagen_url: U('1551288049-bebda4e38f71'), stock: 999, ventas: 67, rating: 4.8,
    specs: [['Entrega','12 días hábiles'],['Módulos','6'],['Gráficas','Canvas nativo'],['Roles','Admin / editor'],['Exportación','CSV'],['Soporte','60 días']]
  },
  {
    nombre: 'NovaVolt Automatiza Py', categoria: 'software', precio_cop: 1290000,
    descripcion: 'Automatización de tareas repetitivas en Python: reportes, correos, scraping ético y limpieza de datos. Recupera tus horas.',
    imagen_url: U('1516321318423-f06f85e504b3'), stock: 999, ventas: 178, rating: 4.5,
    specs: [['Entrega','7 días hábiles'],['Lenguaje','Python 3.11'],['Tareas','Hasta 5 flujos'],['Reportes','Excel / PDF'],['Programación','Cron / Task Scheduler'],['Soporte','30 días']]
  }
];

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */
function seed() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count > 0) return { seeded: false };

  const insertProduct = db.prepare(`
    INSERT INTO products (nombre, categoria, precio_cop, descripcion, imagen_url, stock, ventas, rating, activo, specs)
    VALUES (@nombre, @categoria, @precio_cop, @descripcion, @imagen_url, @stock, @ventas, @rating, 1, @specs)
  `);
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (clave, valor) VALUES (?, ?)');

  const tx = db.transaction(() => {
    for (const p of PRODUCTS) {
      insertProduct.run({ ...p, specs: JSON.stringify(p.specs) });
    }
    for (const [clave, valor] of Object.entries(SETTINGS_SEED)) {
      insertSetting.run(clave, valor);
    }
    const adminEmail = 'admin@novavolt.co';
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
    if (!exists) {
      const hash = bcrypt.hashSync('Admin123*', 12);
      db.prepare('INSERT INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)')
        .run('Cristian Lozano', adminEmail, hash, 'admin');
    }
    // Usuario demo opcional para probar el chat y el historial
    const demoEmail = 'demo@novavolt.co';
    if (!db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail)) {
      db.prepare('INSERT INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)')
        .run('Laura Demo', demoEmail, bcrypt.hashSync('Demo1234*', 12), 'user');
    }
  });
  tx();
  return { seeded: true, productos: PRODUCTS.length };
}

seed();

/* ------------------------------------------------------------------ */
/* Settings helpers                                                    */
/* ------------------------------------------------------------------ */
function getSetting(clave, fallback = '') {
  const row = db.prepare('SELECT valor FROM settings WHERE clave = ?').get(clave);
  return row ? row.valor : fallback;
}
function setSetting(clave, valor) {
  db.prepare(`INSERT INTO settings (clave, valor) VALUES (?, ?)
              ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`).run(clave, String(valor));
}
function getAllSettings() {
  const out = {};
  for (const row of db.prepare('SELECT clave, valor FROM settings').all()) out[row.clave] = row.valor;
  return out;
}

module.exports = { db, DB_PATH, getSetting, setSetting, getAllSettings, seed };
