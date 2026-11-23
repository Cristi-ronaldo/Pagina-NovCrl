/**
 * routes/middleware.js — Autenticación y rol admin.
 */
const { setSetting } = require('../db');

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión para continuar.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión como administrador.' });
  }
  if (req.session.user.rol !== 'admin') {
    return res.status(403).json({ error: 'No tienes permisos para acceder a esta sección.' });
  }
  // Heartbeat: mientras el admin usa el panel, el chat sabe que está en línea.
  setSetting('admin_last_seen', Date.now());
  next();
}

module.exports = { requireAuth, requireAdmin };
