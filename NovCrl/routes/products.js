/**
 * routes/products.js — Catálogo público con filtros, orden y búsqueda.
 */
const express = require('express');
const { db } = require('../db');

const router = express.Router();

function shape(p) {
  let specs = [];
  try { specs = JSON.parse(p.specs || '[]'); } catch { specs = []; }
  return { ...p, specs, activo: !!p.activo };
}

const ORDENES = {
  precio_asc: 'precio_cop ASC',
  precio_desc: 'precio_cop DESC',
  ventas: 'ventas DESC',
  rating: 'rating DESC',
  recientes: 'creado_en DESC, id DESC'
};

router.get('/', (req, res) => {
  const categoria = String(req.query.categoria || '').toLowerCase();
  const q = String(req.query.q || '').trim();
  const orden = ORDENES[String(req.query.orden || '')] ? String(req.query.orden) : 'ventas';

  const where = ['activo = 1'];
  const params = {};

  if (['moto', 'auto', 'bici', 'software'].includes(categoria)) {
    where.push('categoria = @categoria');
    params.categoria = categoria;
  }
  if (q) {
    where.push('(nombre LIKE @q OR descripcion LIKE @q)');
    params.q = `%${q}%`;
  }

  const sql = `SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY ${ORDENES[orden]}`;
  const rows = db.prepare(sql).all(params);
  res.json({ productos: rows.map(shape), total: rows.length });
});

router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identificador de producto inválido.' });
  }
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND activo = 1').get(id);
  if (!p) return res.status(404).json({ error: 'El producto no existe o ya no está disponible.' });
  res.json({ producto: shape(p) });
});

module.exports = router;
