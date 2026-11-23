/**
 * routes/admin.js — Panel de administración (solo rol admin).
 * CRUD de productos, usuarios y roles, mensajes, settings y métricas.
 */
const express = require('express');
const { db, getAllSettings, setSetting, getSetting } = require('../db');
const { requireAdmin } = require('./middleware');

const router = express.Router();
router.use(requireAdmin);

const CATEGORIAS = ['moto', 'auto', 'bici', 'software'];
const SETTINGS_EDITABLES = [
  'hero_badge', 'hero_titulo', 'hero_subtitulo',
  'nosotros_titulo', 'nosotros_texto',
  'direccion', 'whatsapp', 'correo', 'envio_texto', 'franja_frases'
];

/* ------------------------------- Heartbeat ------------------------------- */
router.post('/heartbeat', (req, res) => {
  res.json({ ok: true, en_linea: true });
});

/* ------------------------------- Métricas -------------------------------- */
router.get('/stats', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const totalProducts = db.prepare('SELECT COUNT(*) AS n FROM products WHERE activo = 1').get().n;
  const totalOrders = db.prepare('SELECT COUNT(*) AS n FROM orders').get().n;
  const ingresos = db.prepare('SELECT COALESCE(SUM(total),0) AS n FROM orders').get().n;
  const noLeidos = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE de_admin = 0 AND leido = 0').get().n;
  const visitas = parseInt(getSetting('visitas', '0'), 10) || 0;

  const topProductos = db.prepare(`
    SELECT id, nombre, categoria, ventas, precio_cop, imagen_url
    FROM products ORDER BY ventas DESC LIMIT 5
  `).all();

  const porCategoria = db.prepare(`
    SELECT categoria, COUNT(*) AS productos, COALESCE(SUM(ventas),0) AS ventas
    FROM products GROUP BY categoria
  `).all();

  const ultimasOrdenes = db.prepare(`
    SELECT o.id, o.cantidad, o.total, o.creado_en, p.nombre AS producto, u.nombre AS usuario
    FROM orders o JOIN products p ON p.id = o.product_id JOIN users u ON u.id = o.user_id
    ORDER BY o.id DESC LIMIT 8
  `).all();

  res.json({
    metricas: { totalUsers, totalProducts, totalOrders, ingresos, noLeidos, visitas },
    topProductos, porCategoria, ultimasOrdenes
  });
});

/* ------------------------------- Productos ------------------------------- */
router.get('/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  res.json({
    productos: rows.map((p) => {
      let specs = [];
      try { specs = JSON.parse(p.specs || '[]'); } catch { specs = []; }
      return { ...p, specs, activo: !!p.activo };
    })
  });
});

function validarProducto(body, esNuevo) {
  const out = {};
  const nombre = String(body?.nombre ?? '').trim();
  const categoria = String(body?.categoria ?? '').trim().toLowerCase();
  const descripcion = String(body?.descripcion ?? '').trim();
  const imagen_url = String(body?.imagen_url ?? '').trim();
  const precio_cop = parseInt(body?.precio_cop, 10);
  const stock = parseInt(body?.stock, 10);
  const rating = parseFloat(body?.rating);
  const activo = body?.activo === undefined ? 1 : (body.activo ? 1 : 0);

  if (!nombre) return { error: 'El nombre del producto es obligatorio.', campo: 'nombre' };
  if (nombre.length > 120) return { error: 'El nombre no puede superar 120 caracteres.', campo: 'nombre' };
  if (!CATEGORIAS.includes(categoria)) return { error: 'Selecciona una categoría válida.', campo: 'categoria' };
  if (!descripcion) return { error: 'La descripción es obligatoria.', campo: 'descripcion' };
  if (!Number.isInteger(precio_cop) || precio_cop < 0) return { error: 'El precio debe ser un número entero en COP mayor o igual a 0.', campo: 'precio_cop' };
  if (!Number.isInteger(stock) || stock < 0) return { error: 'El stock debe ser un entero mayor o igual a 0.', campo: 'stock' };
  if (Number.isNaN(rating) || rating < 0 || rating > 5) return { error: 'El rating debe estar entre 0 y 5.', campo: 'rating' };

  let specs = body?.specs ?? [];
  if (typeof specs === 'string') {
    try { specs = JSON.parse(specs); } catch { return { error: 'La ficha técnica debe ser un JSON válido.', campo: 'specs' }; }
  }
  if (!Array.isArray(specs)) return { error: 'La ficha técnica debe ser una lista de pares.', campo: 'specs' };
  const specsNorm = specs
    .map((s) => Array.isArray(s) ? [String(s[0] ?? '').trim(), String(s[1] ?? '').trim()] : null)
    .filter((s) => s && s[0] && s[1])
    .slice(0, 20);

  Object.assign(out, {
    nombre, categoria, descripcion,
    imagen_url: imagen_url || `/img/fallback-${categoria}.svg`,
    precio_cop, stock, rating: Math.round(rating * 10) / 10, activo,
    specs: JSON.stringify(specsNorm)
  });
  return { data: out };
}

router.post('/products', (req, res) => {
  const v = validarProducto(req.body, true);
  if (v.error) return res.status(400).json({ error: v.error, campo: v.campo });
  const d = v.data;
  const info = db.prepare(`
    INSERT INTO products (nombre, categoria, precio_cop, descripcion, imagen_url, stock, ventas, rating, activo, specs)
    VALUES (@nombre, @categoria, @precio_cop, @descripcion, @imagen_url, @stock, 0, @rating, @activo, @specs)
  `).run(d);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, mensaje: 'Producto creado correctamente.' });
});

router.put('/products/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existe = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!existe) return res.status(404).json({ error: 'Producto no encontrado.' });

  const v = validarProducto(req.body, false);
  if (v.error) return res.status(400).json({ error: v.error, campo: v.campo });
  const d = v.data;
  db.prepare(`
    UPDATE products SET nombre=@nombre, categoria=@categoria, precio_cop=@precio_cop,
      descripcion=@descripcion, imagen_url=@imagen_url, stock=@stock, rating=@rating,
      activo=@activo, specs=@specs WHERE id=@id
  `).run({ ...d, id });
  res.json({ ok: true, mensaje: 'Producto actualizado correctamente.' });
});

router.patch('/products/:id/toggle', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const p = db.prepare('SELECT id, activo FROM products WHERE id = ?').get(id);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado.' });
  db.prepare('UPDATE products SET activo = ? WHERE id = ?').run(p.activo ? 0 : 1, id);
  res.json({ ok: true, activo: !p.activo, mensaje: p.activo ? 'Producto desactivado.' : 'Producto activado.' });
});

router.delete('/products/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const p = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado.' });
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ ok: true, mensaje: 'Producto eliminado definitivamente.' });
});

/* -------------------------------- Usuarios ------------------------------- */
router.get('/users', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.nombre, u.email, u.rol, u.creado_en,
           (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS ordenes,
           (SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.user_id = u.id) AS gastado
    FROM users u ORDER BY u.id ASC
  `).all();
  res.json({ usuarios: rows });
});

router.patch('/users/:id/rol', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const rol = String(req.body?.rol ?? '');
  if (!['user', 'admin'].includes(rol)) return res.status(400).json({ error: 'Rol inválido.' });
  if (id === req.session.user.id) return res.status(400).json({ error: 'No puedes cambiar tu propio rol.' });

  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });

  if (u.rol === 'admin' && rol === 'user') {
    const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE rol = 'admin'").get().n;
    if (admins <= 1) return res.status(400).json({ error: 'Debe existir al menos un administrador en el sistema.' });
  }

  db.prepare('UPDATE users SET rol = ? WHERE id = ?').run(rol, id);
  res.json({ ok: true, mensaje: `Rol actualizado a ${rol === 'admin' ? 'administrador' : 'usuario'}.` });
});

/* -------------------------------- Mensajes ------------------------------- */
router.get('/messages/threads', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id AS user_id, u.nombre, u.email,
           COUNT(m.id) AS total,
           SUM(CASE WHEN m.de_admin = 0 AND m.leido = 0 THEN 1 ELSE 0 END) AS no_leidos,
           MAX(m.id) AS ultimo_id
    FROM users u JOIN messages m ON m.user_id = u.id
    GROUP BY u.id ORDER BY ultimo_id DESC
  `).all();
  for (const r of rows) {
    const last = db.prepare('SELECT contenido, de_admin, creado_en FROM messages WHERE id = ?').get(r.ultimo_id);
    r.ultimo_mensaje = last?.contenido || '';
    r.ultimo_de_admin = last?.de_admin ?? 0;
    r.ultimo_creado = last?.creado_en || '';
  }
  res.json({ conversaciones: rows });
});

router.get('/messages/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const u = db.prepare('SELECT id, nombre, email FROM users WHERE id = ?').get(userId);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const mensajes = db.prepare('SELECT id, contenido, de_admin, leido, creado_en FROM messages WHERE user_id = ? ORDER BY id ASC').all(userId);
  db.prepare('UPDATE messages SET leido = 1 WHERE user_id = ? AND de_admin = 0').run(userId);
  res.json({ usuario: u, mensajes });
});

router.post('/messages/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const contenido = String(req.body?.contenido ?? '').trim();
  if (!contenido) return res.status(400).json({ error: 'Escribe una respuesta antes de enviarla.' });
  if (contenido.length > 1000) return res.status(400).json({ error: 'La respuesta no puede superar 1.000 caracteres.' });
  const u = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const info = db.prepare('INSERT INTO messages (user_id, contenido, de_admin, leido) VALUES (?, ?, 1, 0)')
    .run(userId, contenido);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, mensaje: 'Respuesta enviada.' });
});

/* ------------------------------- Settings -------------------------------- */
router.get('/settings', (req, res) => {
  const all = getAllSettings();
  const out = {};
  for (const k of SETTINGS_EDITABLES) out[k] = all[k] ?? '';
  try { out.franja_frases = JSON.parse(out.franja_frases || '[]'); } catch { out.franja_frases = []; }
  res.json({ settings: out });
});

router.put('/settings', (req, res) => {
  const body = req.body || {};
  for (const k of SETTINGS_EDITABLES) {
    if (body[k] === undefined) continue;
    if (k === 'franja_frases') {
      if (!Array.isArray(body[k]) || body[k].length < 6) {
        return res.status(400).json({ error: 'La franja debe tener al menos 6 frases.', campo: 'franja_frases' });
      }
      const frases = body[k].map((f) => String(f).trim()).filter(Boolean);
      if (frases.length < 6) return res.status(400).json({ error: 'La franja debe tener al menos 6 frases con texto.', campo: 'franja_frases' });
      setSetting(k, JSON.stringify(frases.slice(0, 12)));
    } else {
      const val = String(body[k]).trim();
      if (!val) return res.status(400).json({ error: `El campo ${k} no puede quedar vacío.`, campo: k });
      if (val.length > 4000) return res.status(400).json({ error: `El campo ${k} es demasiado largo.`, campo: k });
      setSetting(k, val);
    }
  }
  res.json({ ok: true, mensaje: 'Configuración guardada correctamente.' });
});

/* --------------------------------- Pedidos ------------------------------- */
router.get('/orders', (req, res) => {
  const rows = db.prepare(`
    SELECT o.id, o.cantidad, o.total, o.creado_en,
           p.nombre AS producto, u.nombre AS usuario, u.email
    FROM orders o JOIN products p ON p.id = o.product_id JOIN users u ON u.id = o.user_id
    ORDER BY o.id DESC LIMIT 100
  `).all();
  res.json({ ordenes: rows });
});

module.exports = router;
