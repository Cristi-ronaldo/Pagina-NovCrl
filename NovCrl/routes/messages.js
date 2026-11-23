/**
 * routes/messages.js — Chat de soporte del usuario + bot cuando no hay admin.
 */
const express = require('express');
const { db, getSetting } = require('../db');
const { requireAuth } = require('./middleware');

const router = express.Router();

const VENTANA_ADMIN_MS = 30 * 1000;

function adminEnLinea() {
  const last = parseInt(getSetting('admin_last_seen', '0'), 10) || 0;
  return Date.now() - last < VENTANA_ADMIN_MS;
}

function respuestaBot(texto) {
  const t = texto.toLowerCase();
  if (/(hola|buenas|buenos días|buenas tardes|buenas noches|hey)/.test(t)) {
    return '¡Hola! Soy el asistente virtual de NovaVolt. Puedo ayudarte con precios, envíos, garantías y financiación. Un asesor humano continuará la conversación muy pronto.';
  }
  if (/(precio|costo|cuánto|cuanto|vale|valor)/.test(t)) {
    return 'Todos los precios están en pesos colombianos (COP) y los ves en cada tarjeta del catálogo. Si quieres, dime qué producto te interesa y un asesor te comparte la cotización formal con IVA incluido.';
  }
  if (/(envío|envio|domicilio|entrega|llega)/.test(t)) {
    return 'Hacemos entregas en Bogotá en 24 a 72 horas hábiles. Envío gratis en compras superiores a $2.000.000 COP. A otras ciudades coordinamos transportadora asegurada. Un asesor confirmará tu dirección exacta.';
  }
  if (/(garantía|garantia|falla|reparación|reparacion)/.test(t)) {
    return 'Los vehículos tienen 12 meses de garantía en batería y motor, y el software incluye 30 días de soporte. Si tu producto presenta una falla, escríbenos y agendamos revisión técnica sin costo.';
  }
  if (/(financiación|financiacion|crédito|credito|cuotas|pago)/.test(t)) {
    return 'Trabajamos con financiación en cuotas y pago contra entrega en Bogotá. Para vehículos podemos simular tu crédito con cuota inicial desde el 20 %. Un asesor te pedirá unos datos básicos para la simulación.';
  }
  if (/(dirección|direccion|dónde|donde|ubicación|ubicacion|sede)/.test(t)) {
    return `Nuestra sede está en ${getSetting('direccion', 'Calle 48C 25-05, Bogotá')}. Atendemos de lunes a sábado de 8:00 a 18:00. También puedes escribirnos al WhatsApp ${getSetting('whatsapp', '+57 310 383 2322')}.`;
  }
  if (/(horario|hora|abierto|atienden)/.test(t)) {
    return 'Atendemos de lunes a sábado de 8:00 a 18:00 (hora Colombia). Fuera de ese horario, déjanos tu mensaje y un asesor te responde al inicio de la jornada.';
  }
  if (/(gracias|perfecto|listo|ok)/.test(t)) {
    return '¡Con gusto! Quedo atento. Un asesor de NovaVolt revisará esta conversación y te dará seguimiento personalizado.';
  }
  return 'Gracias por escribir a NovaVolt. Registré tu mensaje y un asesor humano continuará la conversación lo antes posible. Mientras tanto, puedo ayudarte con precios, envíos, garantías, financiación o nuestra dirección.';
}

/* --------------------------- Historial del usuario ------------------------ */
router.get('/mine', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, contenido, de_admin, leido, creado_en
    FROM messages WHERE user_id = ? ORDER BY id ASC
  `).all(req.session.user.id);
  // El usuario leyó las respuestas del soporte
  db.prepare('UPDATE messages SET leido = 1 WHERE user_id = ? AND de_admin = 1').run(req.session.user.id);
  res.json({ mensajes: rows, admin_en_linea: adminEnLinea() });
});

router.get('/status', requireAuth, (req, res) => {
  const noLeidos = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND de_admin = 1 AND leido = 0')
    .get(req.session.user.id).n;
  res.json({ admin_en_linea: adminEnLinea(), no_leidos: noLeidos });
});

/* -------------------------------- Enviar --------------------------------- */
router.post('/', requireAuth, (req, res, next) => {
  try {
    const contenido = String(req.body?.contenido ?? '').trim();
    if (!contenido) return res.status(400).json({ error: 'Escribe un mensaje antes de enviarlo.' });
    if (contenido.length > 1000) return res.status(400).json({ error: 'El mensaje no puede superar 1.000 caracteres.' });

    const userId = req.session.user.id;
    const info = db.prepare('INSERT INTO messages (user_id, contenido, de_admin, leido) VALUES (?, ?, 0, 0)')
      .run(userId, contenido);

    const enLinea = adminEnLinea();
    let bot = null;
    if (!enLinea) {
      const texto = respuestaBot(contenido);
      const b = db.prepare('INSERT INTO messages (user_id, contenido, de_admin, leido) VALUES (?, ?, 1, 0)')
        .run(userId, texto);
      bot = { id: b.lastInsertRowid, contenido: texto, de_admin: 1, creado_en: new Date().toISOString() };
    }

    res.status(201).json({
      ok: true,
      mensaje: { id: info.lastInsertRowid, contenido, de_admin: 0 },
      bot,
      admin_en_linea: enLinea
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
