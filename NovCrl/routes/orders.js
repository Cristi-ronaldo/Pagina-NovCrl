/**
 * routes/orders.js — Registro de compras, control de stock y ventas.
 */
const express = require('express');
const { db } = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión para realizar una compra.' });
  }
  next();
}

router.post('/', requireAuth, (req, res, next) => {
  try {
    const productId = parseInt(req.body?.product_id, 10);
    const cantidad = parseInt(req.body?.cantidad ?? 1, 10);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Producto inválido.' });
    }
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 10) {
      return res.status(400).json({ error: 'La cantidad debe estar entre 1 y 10 unidades.' });
    }

    const result = db.transaction(() => {
      const p = db.prepare('SELECT * FROM products WHERE id = ? AND activo = 1').get(productId);
      if (!p) {
        const e = new Error('El producto no existe o ya no está disponible.');
        e.status = 404;
        throw e;
      }
      if (p.stock < cantidad) {
        const e = new Error(`Stock insuficiente: solo quedan ${p.stock} unidades.`);
        e.status = 409;
        throw e;
      }
      const total = p.precio_cop * cantidad;
      db.prepare('UPDATE products SET stock = stock - ?, ventas = ventas + ? WHERE id = ?')
        .run(cantidad, cantidad, productId);
      const info = db.prepare('INSERT INTO orders (user_id, product_id, cantidad, total) VALUES (?, ?, ?, ?)')
        .run(req.session.user.id, productId, cantidad, total);
      return { orderId: info.lastInsertRowid, total, producto: p };
    })();

    res.status(201).json({
      ok: true,
      mensaje: `Compra registrada: ${result.producto.nombre}. Un asesor te contactará para coordinar el pago y la entrega.`,
      orden: {
        id: result.orderId,
        producto_id: productId,
        nombre: result.producto.nombre,
        cantidad,
        total: result.total
      }
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.get('/mine', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT o.id, o.cantidad, o.total, o.creado_en,
           p.nombre, p.categoria, p.imagen_url
    FROM orders o
    JOIN products p ON p.id = o.product_id
    WHERE o.user_id = ?
    ORDER BY o.id DESC
  `).all(req.session.user.id);
  res.json({ ordenes: rows });
});

module.exports = router;
