/**
 * routes/auth.js — Registro, login, logout y sesión actual.
 * Todas las respuestas de error usan { error: "mensaje en español" }.
 */
const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../db');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

function publicUser(u) {
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, creado_en: u.creado_en };
}

/** Fuerza de contraseña en servidor: mínimo 8, letras y números. */
function validarPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (password.length > 72) return 'La contraseña no puede superar 72 caracteres.';
  if (!/[a-zA-Z]/.test(password)) return 'La contraseña debe incluir al menos una letra.';
  if (!/[0-9]/.test(password)) return 'La contraseña debe incluir al menos un número.';
  return null;
}

/* ------------------------------- Registro -------------------------------- */
router.post('/register', async (req, res, next) => {
  try {
    const nombre = String(req.body?.nombre ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    if (!nombre) return res.status(400).json({ error: 'El nombre no puede estar vacío.', campo: 'nombre' });
    if (nombre.length > 80) return res.status(400).json({ error: 'El nombre no puede superar 80 caracteres.', campo: 'nombre' });
    if (!email) return res.status(400).json({ error: 'El correo electrónico es obligatorio.', campo: 'email' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Ingresa un correo electrónico válido (ejemplo@dominio.com).', campo: 'email' });
    if (email.length > 120) return res.status(400).json({ error: 'El correo es demasiado largo.', campo: 'email' });

    const errPass = validarPassword(password);
    if (errPass) return res.status(400).json({ error: errPass, campo: 'password' });

    const existe = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existe) {
      return res.status(409).json({ error: 'Ya existe una cuenta registrada con este correo.', campo: 'email' });
    }

    const hash = await bcrypt.hash(password, 12);
    let info;
    try {
      info = db.prepare('INSERT INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)')
        .run(nombre, email, hash, 'user');
    } catch (e) {
      if (String(e.code).includes('SQLITE_CONSTRAINT')) {
        return res.status(409).json({ error: 'Ya existe una cuenta registrada con este correo.', campo: 'email' });
      }
      throw e;
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    req.session.user = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
    res.status(201).json({ ok: true, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- Login --------------------------------- */
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Ingresa un correo electrónico válido.', campo: 'email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Ingresa tu contraseña.', campo: 'password' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.', campo: 'password' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.', campo: 'password' });
    }

    req.session.user = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
    res.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- Logout --------------------------------- */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('novavolt.sid');
    res.json({ ok: true });
  });
});

/* ------------------------------ Sesión actual ---------------------------- */
router.get('/me', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  if (!user) {
    req.session.destroy(() => {});
    return res.json({ user: null });
  }
  res.json({ user: publicUser(user) });
});

module.exports = router;
