/**
 * routes/settings.js — Configuración pública editable desde el admin.
 */
const express = require('express');
const { getAllSettings } = require('../db');

const router = express.Router();

const PUBLICAS = [
  'hero_badge', 'hero_titulo', 'hero_subtitulo',
  'nosotros_titulo', 'nosotros_texto',
  'direccion', 'whatsapp', 'correo', 'envio_texto', 'franja_frases'
];

router.get('/public', (req, res) => {
  const all = getAllSettings();
  const out = {};
  for (const k of PUBLICAS) out[k] = all[k] ?? '';
  try { out.franja_frases = JSON.parse(out.franja_frases || '[]'); }
  catch { out.franja_frases = []; }
  res.json({ settings: out });
});

module.exports = router;
