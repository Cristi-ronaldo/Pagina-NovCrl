-- NovaVolt — Esquema de base de datos SQLite
-- Motor: SQLite 3 (archivo data/novavolt.db)
-- Integridad referencial activada con PRAGMA foreign_keys = ON;

PRAGMA foreign_keys = ON;

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
  specs         TEXT    NOT NULL DEFAULT '[]',   -- ficha técnica en JSON
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
