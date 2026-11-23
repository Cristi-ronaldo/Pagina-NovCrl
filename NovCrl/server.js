/**
 * server.js — NovaVolt
 * Node.js + Express + SQLite + sesiones con cookie httpOnly.
 */
require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const { db, getSetting, setSetting } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.set('trust proxy', 1);

/* ------------------------------ Middlewares ------------------------------ */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: 'novavolt.sid',
    secret: process.env.SESSION_SECRET || 'novavolt-dev-secret-cambiar-en-produccion',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

// Contador de visitas: una por sesión, solo en la página pública
app.use((req, res, next) => {
  if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html')) {
    if (!req.session.visitada) {
      req.session.visitada = true;
      const actual = parseInt(getSetting('visitas', '0'), 10) || 0;
      setSetting('visitas', actual + 1);
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '7d' : 0 }));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

/* -------------------------------- Rutas ---------------------------------- */
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin.html')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, servicio: 'NovaVolt', hora: new Date().toISOString() });
});

/* --------------------------- Manejo de errores ---------------------------- */
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// Errores de JSON malformado y errores no controlados → siempre JSON en español
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es un JSON válido.' });
  }
  console.error('[NovaVolt] Error no controlado:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Ocurrió un error inesperado. Intenta de nuevo en unos segundos.' });
});

app.listen(PORT, () => {
  console.log(`NovaVolt escuchando en http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
});

module.exports = app;
