/* ==========================================================================
   catalog.js — Catálogo: filtros, orden, búsqueda en vivo, modal y compra.
   ========================================================================== */
(function () {
  'use strict';
  const NV = window.NV;
  const state = { productos: [], categoria: '', q: '', orden: 'ventas', cargando: false };

  const CAT_LABEL = { moto: 'Moto eléctrica', auto: 'Auto eléctrico', bici: 'Bici eléctrica', software: 'Software' };
  const CAT_ICON = { moto: '🏍️', auto: '🚗', bici: '🚲', software: '💻' };

  const grid = document.getElementById('productGrid');
  const resultCount = document.getElementById('resultCount');

  function normalizar(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function estrellas(rating) {
    const full = Math.round(Number(rating) || 0);
    return '★'.repeat(Math.max(0, Math.min(5, full))) + '☆'.repeat(Math.max(0, 5 - full));
  }

  function stockBadge(p) {
    if (p.stock <= 0) return '<span class="product-stock out">Agotado</span>';
    if (p.stock <= 5) return `<span class="product-stock low">Últimas ${p.stock}</span>`;
    return `<span class="product-stock">Disponible</span>`;
  }

  function card(p) {
    const agotado = p.stock <= 0;
    return `
      <article class="product-card" data-id="${p.id}">
        <div class="product-media">
          <img src="${NV.escape(p.imagen_url)}" alt="${NV.escape(p.nombre)}" loading="lazy" width="900" height="675"
               onerror="this.onerror=null;this.src='/img/fallback-${NV.escape(p.categoria)}.svg'">
          <span class="product-tag">${CAT_LABEL[p.categoria] || p.categoria}</span>
          ${stockBadge(p)}
        </div>
        <div class="product-body">
          <h3>${NV.escape(p.nombre)}</h3>
          <p class="product-desc">${NV.escape(p.descripcion)}</p>
          <div class="product-meta">
            <span class="stars" title="Calificación ${Number(p.rating).toFixed(1)} de 5">
              <span class="star-row" aria-hidden="true">${estrellas(p.rating)}</span> ${Number(p.rating).toFixed(1)}
            </span>
            <span>${p.ventas} vendidos</span>
          </div>
          <div class="product-price">${NV.money(p.precio_cop)} <small>COP · IVA incluido</small></div>
          <div class="product-actions">
            <button class="btn btn--primary btn--sm" type="button" data-buy="${p.id}" ${agotado ? 'disabled' : ''}>
              ${agotado ? 'Agotado' : 'Comprar'}
            </button>
            <button class="btn btn--ghost btn--sm btn-detail" type="button" data-detail="${p.id}" aria-label="Ver detalle de ${NV.escape(p.nombre)}">＋</button>
          </div>
        </div>
      </article>`;
  }

  function aplicar() {
    let lista = state.productos.slice();
    if (state.categoria) lista = lista.filter((p) => p.categoria === state.categoria);
    if (state.q) {
      const q = normalizar(state.q);
      lista = lista.filter((p) => normalizar(p.nombre).includes(q) || normalizar(p.descripcion).includes(q));
    }
    switch (state.orden) {
      case 'precio_asc': lista.sort((a, b) => a.precio_cop - b.precio_cop); break;
      case 'precio_desc': lista.sort((a, b) => b.precio_cop - a.precio_cop); break;
      case 'rating': lista.sort((a, b) => b.rating - a.rating); break;
      case 'recientes': lista.sort((a, b) => b.id - a.id); break;
      default: lista.sort((a, b) => b.ventas - a.ventas);
    }

    if (!lista.length) {
      grid.innerHTML = `<div class="empty-state"><div class="big" aria-hidden="true">🌸</div>
        <h3>No encontramos productos con esos filtros</h3>
        <p>Prueba con otra palabra o cambia de categoría. También puedes escribirnos por WhatsApp y te ayudamos a elegir.</p></div>`;
    } else {
      grid.innerHTML = lista.map(card).join('');
    }
    resultCount.textContent = `${lista.length} producto${lista.length === 1 ? '' : 's'} encontrado${lista.length === 1 ? '' : 's'}`;
  }

  function actualizarContadores() {
    const c = { '': state.productos.length, moto: 0, auto: 0, bici: 0, software: 0 };
    state.productos.forEach((p) => { c[p.categoria] = (c[p.categoria] || 0) + 1; });
    const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n; };
    set('countAll', c['']);
    set('countMoto', c.moto);
    set('countAuto', c.auto);
    set('countBici', c.bici);
    set('countSoftware', c.software);
  }

  async function cargar() {
    if (state.cargando) return;
    state.cargando = true;
    grid.innerHTML = '<div class="empty-state"><div class="big" aria-hidden="true">⚡</div><p>Cargando catálogo…</p></div>';
    try {
      const data = await NV.api('/api/products');
      state.productos = data.productos;
      actualizarContadores();
      aplicar();
    } catch (err) {
      grid.innerHTML = `<div class="empty-state"><div class="big">⚠️</div><h3>No pudimos cargar el catálogo</h3><p>${NV.escape(err.error || 'Revisa tu conexión e intenta de nuevo.')}</p><button class="btn btn--primary btn--sm" type="button" id="retryCatalog">Reintentar</button></div>`;
      const r = document.getElementById('retryCatalog');
      if (r) r.addEventListener('click', () => { state.cargando = false; cargar(); });
    } finally {
      state.cargando = false;
    }
  }

  /* --------------------------------- Compra -------------------------------- */
  async function comprar(id, boton) {
    if (!NV.state.user) {
      NV.toast('Inicia sesión o crea una cuenta para registrar tu compra.', 'info', 'Necesitas una cuenta');
      NV.openModal('authModal');
      return;
    }
    const p = state.productos.find((x) => x.id === id);
    if (!p) return;
    const original = boton ? boton.innerHTML : '';
    if (boton) { boton.disabled = true; boton.innerHTML = '<span class="spinner"></span>'; }
    try {
      const data = await NV.api('/api/orders', { method: 'POST', body: { product_id: id, cantidad: 1 } });
      NV.toast(data.mensaje, 'ok', 'Compra registrada');
      p.ventas += 1;
      p.stock = Math.max(0, p.stock - 1);
      aplicar();
      NV.refreshUser();
      const modal = document.getElementById('productModal');
      if (modal.classList.contains('open')) cerrarDetalle();
    } catch (err) {
      NV.toast(err.error || 'No pudimos registrar tu compra.', 'error');
      if (boton) { boton.disabled = false; boton.innerHTML = original; }
    }
  }

  /* ------------------------------- Detalle --------------------------------- */
  function abrirDetalle(id) {
    const p = state.productos.find((x) => x.id === id);
    if (!p) return;
    const wa = 'https://wa.me/' + String((NV.state.settings && NV.state.settings.whatsapp) || '+57 310 383 2322').replace(/\D/g, '');
    const textoWa = encodeURIComponent(`Hola NovaVolt, me interesa el producto "${p.nombre}" (${NV.money(p.precio_cop)} COP). ¿Me pueden dar más información?`);
    const specs = (p.specs || []).map(([k, v]) => `<tr><td>${NV.escape(k)}</td><td>${NV.escape(v)}</td></tr>`).join('');
    document.getElementById('productModalBody').innerHTML = `
      <div class="product-modal-grid">
        <div class="product-modal-media">
          <img src="${NV.escape(p.imagen_url)}" alt="${NV.escape(p.nombre)}" width="900" height="900"
               onerror="this.onerror=null;this.src='/img/fallback-${NV.escape(p.categoria)}.svg'">
        </div>
        <div class="product-modal-info">
          <span class="eyebrow" style="margin-bottom:8px">${CAT_ICON[p.categoria] || ''} ${CAT_LABEL[p.categoria] || p.categoria}</span>
          <h2 id="pmTitle">${NV.escape(p.nombre)}</h2>
          <div class="product-meta" style="margin-bottom:4px">
            <span class="stars"><span class="star-row" aria-hidden="true">${estrellas(p.rating)}</span> ${Number(p.rating).toFixed(1)} / 5</span>
            <span>${p.ventas} vendidos · ${p.stock > 0 ? p.stock + ' en stock' : 'agotado'}</span>
          </div>
          <div class="pm-price">${NV.money(p.precio_cop)} <small>COP · IVA incluido</small></div>
          <p style="color:var(--texto-muted);font-size:.92rem">${NV.escape(p.descripcion)}</p>
          ${specs ? `<h3 style="font-size:.95rem;margin:16px 0 4px">Ficha técnica</h3><table class="spec-table"><tbody>${specs}</tbody></table>` : ''}
          <div class="pm-actions">
            <button class="btn btn--primary" type="button" data-buy="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>${p.stock <= 0 ? 'Agotado' : 'Comprar ahora'}</button>
            <a class="btn btn--verde" href="${wa}?text=${textoWa}" target="_blank" rel="noopener">Consultar por WhatsApp</a>
          </div>
          <p class="pm-note">🚚 ${NV.escape((NV.state.settings && NV.state.settings.envio_texto) || 'Envío gratis en Bogotá en compras superiores a $2.000.000 COP.')}</p>
          <p class="attribution">Imagen: <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a> · Foto de uso libre con atribución.</p>
        </div>
      </div>`;
    NV.openModal('productModal');
  }

  function cerrarDetalle() {
    NV.closeModal(document.getElementById('productModal'));
  }

  /* -------------------------------- Eventos -------------------------------- */
  function bind() {
    document.getElementById('catStrip').addEventListener('click', (e) => {
      const btn = e.target.closest('.cat-card');
      if (!btn) return;
      document.querySelectorAll('.cat-card').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      state.categoria = btn.dataset.cat || '';
      aplicar();
    });

    let timer;
    document.getElementById('searchInput').addEventListener('input', (e) => {
      clearTimeout(timer);
      const val = e.target.value;
      timer = setTimeout(() => { state.q = val.trim(); aplicar(); }, 220);
    });

    document.getElementById('sortSelect').addEventListener('change', (e) => {
      state.orden = e.target.value;
      aplicar();
    });

    grid.addEventListener('click', (e) => {
      const buy = e.target.closest('[data-buy]');
      if (buy) { comprar(parseInt(buy.dataset.buy, 10), buy); return; }
      const detail = e.target.closest('[data-detail]');
      if (detail) abrirDetalle(parseInt(detail.dataset.detail, 10));
    });

    document.getElementById('productModalBody').addEventListener('click', (e) => {
      const buy = e.target.closest('[data-buy]');
      if (buy) comprar(parseInt(buy.dataset.buy, 10), buy);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    cargar();
  });
})();
