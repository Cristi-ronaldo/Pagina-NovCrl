/* NovaVolt — Panel de administración */
(function () {
  'use strict';

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const money = (n) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(Number(n) || 0);

  const fecha = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const state = {
    user: null,
    products: [],
    users: [],
    threads: [],
    activeThread: null,
    poll: null,
    heartbeat: null
  };

  async function api(url, options) {
    const opts = Object.assign({ headers: {} }, options || {});
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(url, opts);
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Ocurrió un error inesperado.');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  let toastTimer = null;
  function toast(msg, tipo) {
    const el = $('#adminToast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'admin-toast show' + (tipo === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.className = 'admin-toast';
    }, 3200);
  }

  /* ---------------- Sesión / acceso ---------------- */

  function mostrarGateError(msg) {
    const el = $('#gateError');
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  async function comprobarSesion() {
    try {
      const data = await api('/api/auth/me');
      if (data.user && data.user.rol === 'admin') {
        state.user = data.user;
        abrirPanel();
      } else if (data.user) {
        mostrarGateError('Esta cuenta no tiene permisos de administrador.');
      }
    } catch (e) {
      /* sin sesión: se muestra el formulario */
    }
  }

  function abrirPanel() {
    $('#adminGate').hidden = true;
    $('#adminApp').hidden = false;
    const iniciales = (state.user.nombre || 'A')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
    $('#adminAvatar').textContent = iniciales;
    $('#adminName').textContent = state.user.nombre;

    cargarDashboard();
    cargarProductos();
    cargarUsuarios();
    cargarHilos();
    cargarOrdenes();
    cargarSettings();

    clearInterval(state.poll);
    state.poll = setInterval(() => {
      if (document.hidden) return;
      cargarHilos(true);
      if (state.activeThread) cargarConversacion(state.activeThread, true);
    }, 5000);

    clearInterval(state.heartbeat);
    const latir = () => api('/api/admin/heartbeat', { method: 'POST' }).catch(() => {});
    latir();
    state.heartbeat = setInterval(latir, 15000);
  }

  function bindGate() {
    const form = $('#gateForm');
    if (!form) return;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      mostrarGateError('');
      const email = $('#gateEmail').value.trim();
      const password = $('#gatePassword').value;
      if (!email || !password) {
        mostrarGateError('Ingresa tu correo y contraseña.');
        return;
      }
      const btn = $('#gateSubmit');
      btn.disabled = true;
      btn.textContent = 'Verificando…';
      try {
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: { email, password }
        });
        if (data.user.rol !== 'admin') {
          await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
          mostrarGateError('Esta cuenta no tiene permisos de administrador.');
          return;
        }
        state.user = data.user;
        abrirPanel();
      } catch (e) {
        mostrarGateError(e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar al panel';
      }
    });
  }

  function bindLogout() {
    const btn = $('#adminLogout');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      window.location.reload();
    });
  }

  /* ---------------- Navegación ---------------- */

  const TITULOS = {
    dashboard: ['Resumen general', 'Actividad del negocio en tiempo real'],
    productos: ['Productos', 'Crea, edita, desactiva o elimina artículos del catálogo'],
    usuarios: ['Usuarios', 'Consulta cuentas registradas y administra sus roles'],
    mensajes: ['Mensajes', 'Bandeja de soporte en vivo con tus clientes'],
    ordenes: ['Pedidos', 'Historial de compras realizadas en la tienda'],
    config: ['Configuración', 'Textos del sitio, contacto y franja de frases']
  };

  function bindNav() {
    $$('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const vista = btn.dataset.view;
        $$('.nav-item').forEach((b) => b.classList.toggle('active', b === btn));
        $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + vista));
        const t = TITULOS[vista] || ['Panel', ''];
        $('#viewTitle').textContent = t[0];
        $('#viewSubtitle').textContent = t[1];
        if (window.innerWidth <= 860) $('#adminSidebar').classList.remove('open');
        if (vista === 'dashboard') cargarDashboard();
        if (vista === 'productos') cargarProductos();
        if (vista === 'usuarios') cargarUsuarios();
        if (vista === 'mensajes') cargarHilos();
        if (vista === 'ordenes') cargarOrdenes();
        if (vista === 'config') cargarSettings();
      });
    });

    const burger = $('#adminBurger');
    if (burger) {
      burger.addEventListener('click', () => $('#adminSidebar').classList.toggle('open'));
    }
  }

  /* ---------------- Dashboard ---------------- */

  async function cargarDashboard() {
    try {
      const data = await api('/api/admin/stats');
      const s = data.metricas || {};
      $('#mUsers').textContent = s.totalUsers;
      $('#mProducts').textContent = s.totalProducts;
      $('#mOrders').textContent = s.totalOrders;
      $('#mRevenue').textContent = money(s.ingresos);
      $('#mVisits').textContent = s.visitas;
      $('#mUnread').textContent = s.noLeidos;
      actualizarBadge(s.noLeidos);

      $('#topProducts').innerHTML = (data.topProductos || [])
        .map(
          (p, i) => `
        <div class="top-product">
          <span class="tp-rank">${i + 1}</span>
          <img src="${esc(p.imagen_url)}" alt="" loading="lazy" onerror="this.src='/img/fallback-${esc(p.categoria)}.svg'">
          <div class="tp-info"><strong>${esc(p.nombre)}</strong><small>${p.ventas} ventas · ${money(p.precio_cop)}</small></div>
        </div>`
        )
        .join('') || '<p class="muted">Aún no hay ventas registradas.</p>';

      const cats = data.porCategoria || [];
      const max = Math.max(1, ...cats.map((c) => c.productos));
      $('#catBars').innerHTML = cats
        .map(
          (c) => `
        <div class="cat-bar">
          <div class="cat-bar-head"><span>${esc(c.categoria)}</span><b>${c.productos}</b></div>
          <div class="cat-bar-track"><i style="width:${Math.round((c.productos / max) * 100)}%" class="cat-${esc(c.categoria)}"></i></div>
        </div>`
        )
        .join('');

      $('#recentOrders').innerHTML =
        (data.ultimasOrdenes || [])
          .map(
            (o) => `
        <tr>
          <td>#${o.id}</td>
          <td>${esc(o.usuario)}</td>
          <td>${esc(o.producto)}</td>
          <td>${o.cantidad}</td>
          <td>${money(o.total)}</td>
          <td>${fecha(o.creado_en)}</td>
        </tr>`
          )
          .join('') ||
        '<tr><td colspan="6" class="muted">Sin pedidos todavía.</td></tr>';
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function actualizarBadge(n) {
    const b = $('#navUnread');
    if (!b) return;
    b.textContent = n;
    b.hidden = !n;
  }

  /* ---------------- Productos ---------------- */

  async function cargarProductos() {
    try {
      const data = await api('/api/admin/products');
      state.products = data.productos || [];
      $('#productsTableBody').innerHTML = state.products
        .map(
          (p) => `
        <tr class="${p.activo ? '' : 'row-off'}">
          <td><img class="tbl-thumb" src="${esc(p.imagen_url)}" alt="" loading="lazy" onerror="this.src='/img/fallback-${esc(p.categoria)}.svg'"></td>
          <td><strong>${esc(p.nombre)}</strong><small class="tbl-sub">${esc(p.descripcion).slice(0, 70)}…</small></td>
          <td><span class="pill pill-${esc(p.categoria)}">${esc(p.categoria)}</span></td>
          <td>${money(p.precio_cop)}</td>
          <td>${p.stock}</td>
          <td>${p.ventas}</td>
          <td><span class="pill ${p.activo ? 'pill-on' : 'pill-off'}">${p.activo ? 'Activo' : 'Inactivo'}</span></td>
          <td class="row-actions">
            <button class="icon-btn" data-edit="${p.id}" title="Editar">✏️</button>
            <button class="icon-btn" data-toggle="${p.id}" title="${p.activo ? 'Desactivar' : 'Activar'}">${p.activo ? '⏸️' : '▶️'}</button>
            <button class="icon-btn danger" data-delete="${p.id}" title="Eliminar">🗑️</button>
          </td>
        </tr>`
        )
        .join('') || '<tr><td colspan="8" class="muted">No hay productos.</td></tr>';
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function abrirModalProducto(p) {
    $('#productModalTitle').textContent = p ? 'Editar producto' : 'Nuevo producto';
    $('#pId').value = p ? p.id : '';
    $('#pNombre').value = p ? p.nombre : '';
    $('#pCategoria').value = p ? p.categoria : 'moto';
    $('#pPrecio').value = p ? p.precio_cop : '';
    $('#pStock').value = p ? p.stock : 10;
    $('#pRating').value = p ? p.rating : 4.5;
    $('#pImagen').value = p ? p.imagen_url : '';
    $('#pDescripcion').value = p ? p.descripcion : '';
    $('#pActivo').checked = p ? !!p.activo : true;
    $('#pSpecs').value = p && Array.isArray(p.specs)
      ? p.specs.map((s) => (Array.isArray(s) ? s[0] + ': ' + s[1] : s)).join('\n')
      : '';
    $('#productFormError').hidden = true;
    $('#productModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function cerrarModalProducto() {
    $('#productModal').classList.remove('open');
    document.body.style.overflow = '';
  }

  function bindProductos() {
    $('#btnNewProduct').addEventListener('click', () => abrirModalProducto(null));
    $('#productModal').addEventListener('click', (ev) => {
      if (ev.target.id === 'productModal' || ev.target.hasAttribute('data-close-product')) {
        cerrarModalProducto();
      }
    });

    $('#productsTableBody').addEventListener('click', async (ev) => {
      const edit = ev.target.closest('[data-edit]');
      const toggle = ev.target.closest('[data-toggle]');
      const del = ev.target.closest('[data-delete]');

      if (edit) {
        const p = state.products.find((x) => String(x.id) === edit.dataset.edit);
        if (p) abrirModalProducto(p);
        return;
      }
      if (toggle) {
        try {
          await api('/api/admin/products/' + toggle.dataset.toggle + '/toggle', { method: 'PATCH' });
          toast('Estado del producto actualizado.');
          cargarProductos();
          cargarDashboard();
        } catch (e) {
          toast(e.message, 'error');
        }
        return;
      }
      if (del) {
        const p = state.products.find((x) => String(x.id) === del.dataset.delete);
        if (!p) return;
        if (!confirm('¿Eliminar definitivamente «' + p.nombre + '»? Esta acción no se puede deshacer.')) return;
        try {
          await api('/api/admin/products/' + p.id, { method: 'DELETE' });
          toast('Producto eliminado.');
          cargarProductos();
          cargarDashboard();
        } catch (e) {
          toast(e.message, 'error');
        }
      }
    });

    $('#productForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const errEl = $('#productFormError');
      errEl.hidden = true;
      const id = $('#pId').value;
      const specs = $('#pSpecs')
        .value.split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const i = l.indexOf(':');
          return i > -1 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ''];
        });

      const body = {
        nombre: $('#pNombre').value.trim(),
        categoria: $('#pCategoria').value,
        precio_cop: Number($('#pPrecio').value),
        stock: Number($('#pStock').value),
        rating: Number($('#pRating').value),
        imagen_url: $('#pImagen').value.trim(),
        descripcion: $('#pDescripcion').value.trim(),
        specs,
        activo: $('#pActivo').checked ? 1 : 0
      };

      if (!body.nombre) {
        errEl.textContent = 'El nombre es obligatorio.';
        errEl.hidden = false;
        return;
      }
      if (!(body.precio_cop >= 0)) {
        errEl.textContent = 'El precio debe ser un número mayor o igual a cero.';
        errEl.hidden = false;
        return;
      }

      const btn = $('#btnSaveProduct');
      btn.disabled = true;
      try {
        if (id) {
          await api('/api/admin/products/' + id, { method: 'PUT', body });
          toast('Producto actualizado correctamente.');
        } else {
          await api('/api/admin/products', { method: 'POST', body });
          toast('Producto creado correctamente.');
        }
        cerrarModalProducto();
        cargarProductos();
        cargarDashboard();
      } catch (e) {
        errEl.textContent = e.message;
        errEl.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ---------------- Usuarios ---------------- */

  async function cargarUsuarios() {
    try {
      const data = await api('/api/admin/users');
      state.users = data.usuarios || [];
      $('#usersTableBody').innerHTML = state.users
        .map(
          (u) => `
        <tr>
          <td><strong>${esc(u.nombre)}</strong></td>
          <td>${esc(u.email)}</td>
          <td>${u.ordenes}</td>
          <td>${money(u.gastado)}</td>
          <td>${fecha(u.creado_en)}</td>
          <td>
            <select class="role-select" data-user="${u.id}" ${u.id === state.user.id ? 'disabled title="No puedes cambiar tu propio rol"' : ''}>
              <option value="user" ${u.rol === 'user' ? 'selected' : ''}>Usuario</option>
              <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Administrador</option>
            </select>
          </td>
        </tr>`
        )
        .join('') || '<tr><td colspan="6" class="muted">Sin usuarios.</td></tr>';
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function bindUsuarios() {
    $('#usersTableBody').addEventListener('change', async (ev) => {
      const sel = ev.target.closest('.role-select');
      if (!sel) return;
      const id = sel.dataset.user;
      const rol = sel.value;
      try {
        await api('/api/admin/users/' + id + '/rol', { method: 'PATCH', body: { rol } });
        toast('Rol actualizado.');
        cargarUsuarios();
      } catch (e) {
        toast(e.message, 'error');
        cargarUsuarios();
      }
    });
  }

  /* ---------------- Mensajes ---------------- */

  async function cargarHilos(silencioso) {
    try {
      const data = await api('/api/admin/messages/threads');
      state.threads = data.conversaciones || [];
      const total = state.threads.reduce((a, t) => a + (t.no_leidos || 0), 0);
      actualizarBadge(total);
      if (silencioso && state.activeThread) return;
      $('#threadsList').innerHTML = state.threads
        .map(
          (t) => `
        <button class="thread-item ${state.activeThread === t.user_id ? 'active' : ''}" data-thread="${t.user_id}">
          <span class="thread-avatar">${esc((t.nombre || 'U')[0].toUpperCase())}</span>
          <span class="thread-main">
            <span class="thread-top"><strong>${esc(t.nombre)}</strong>${t.no_leidos ? `<b class="thread-badge">${t.no_leidos}</b>` : ''}</span>
            <small>${esc(t.ultimo_mensaje || 'Sin mensajes').slice(0, 52)}</small>
          </span>
        </button>`
        )
        .join('') || '<p class="muted pad">Aún no hay conversaciones.</p>';
    } catch (e) {
      if (!silencioso) toast(e.message, 'error');
    }
  }

  async function cargarConversacion(userId, silencioso) {
    state.activeThread = Number(userId);
    try {
      const data = await api('/api/admin/messages/' + userId);
      const t = state.threads.find((x) => Number(x.user_id) === Number(userId));
      $('#chatUserTitle').textContent = t ? t.nombre : 'Cliente';
      $('#chatUserEmail').textContent = t ? t.email : '';
      $('#adminChatBody').innerHTML = (data.mensajes || [])
        .map(
          (m) => `
        <div class="chat-msg ${m.de_admin ? 'admin' : 'user'}">
          <div class="chat-bubble">${esc(m.contenido)}</div>
          <small>${m.de_admin ? 'Tú' : 'Cliente'} · ${fecha(m.creado_en)}</small>
        </div>`
        )
        .join('') || '<p class="muted pad">Sin mensajes en esta conversación.</p>';
      const body = $('#adminChatBody');
      body.scrollTop = body.scrollHeight;
      $('#adminReplyInput').disabled = false;
      $('#adminReplySend').disabled = false;
      if (!silencioso) {
        $$('.thread-item').forEach((b) =>
          b.classList.toggle('active', String(b.dataset.thread) === String(userId))
        );
        cargarHilos(true);
      }
    } catch (e) {
      if (!silencioso) toast(e.message, 'error');
    }
  }

  function bindMensajes() {
    $('#threadsList').addEventListener('click', (ev) => {
      const item = ev.target.closest('[data-thread]');
      if (!item) return;
      cargarConversacion(item.dataset.thread);
    });

    $('#adminReplyForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const input = $('#adminReplyInput');
      const texto = input.value.trim();
      if (!texto || !state.activeThread) return;
      const btn = $('#adminReplySend');
      btn.disabled = true;
      try {
        await api('/api/admin/messages/' + state.activeThread, {
          method: 'POST',
          body: { contenido: texto }
        });
        input.value = '';
        await cargarConversacion(state.activeThread);
        cargarHilos(true);
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ---------------- Pedidos ---------------- */

  async function cargarOrdenes() {
    try {
      const data = await api('/api/admin/orders');
      $('#ordersTableBody').innerHTML = (data.ordenes || [])
        .map(
          (o) => `
        <tr>
          <td>#${o.id}</td>
          <td><strong>${esc(o.usuario)}</strong><small class="tbl-sub">${esc(o.email)}</small></td>
          <td>${esc(o.producto)}</td>
          <td>${o.cantidad}</td>
          <td>${money(o.total)}</td>
          <td>${fecha(o.creado_en)}</td>
        </tr>`
        )
        .join('') || '<tr><td colspan="6" class="muted">Sin pedidos registrados.</td></tr>';
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  /* ---------------- Configuración ---------------- */

  async function cargarSettings() {
    try {
      const data = await api('/api/admin/settings');
      const s = data.settings || {};
      $('#sHeroBadge').value = s.hero_badge || '';
      $('#sHeroTitulo').value = s.hero_titulo || '';
      $('#sHeroSub').value = s.hero_subtitulo || '';
      $('#sNosotrosTitulo').value = s.nosotros_titulo || '';
      $('#sNosotrosTexto').value = s.nosotros_texto || '';
      $('#sDireccion').value = s.direccion || '';
      $('#sWhatsapp').value = s.whatsapp || '';
      $('#sCorreo').value = s.correo || '';
      $('#sEnvio').value = s.envio_texto || '';
      let frases = s.franja_frases;
      if (typeof frases === 'string') {
        try {
          frases = JSON.parse(frases);
        } catch (e) {
          frases = [];
        }
      }
      $('#sFrases').value = Array.isArray(frases) ? frases.join('\n') : '';
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function bindSettings() {
    $('#settingsForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const errEl = $('#settingsError');
      errEl.hidden = true;
      const frases = $('#sFrases')
        .value.split('\n')
        .map((f) => f.trim())
        .filter(Boolean);
      if (frases.length < 6) {
        errEl.textContent = 'La franja rotativa necesita al menos 6 frases (una por línea).';
        errEl.hidden = false;
        return;
      }
      const body = {
        hero_badge: $('#sHeroBadge').value.trim(),
        hero_titulo: $('#sHeroTitulo').value.trim(),
        hero_subtitulo: $('#sHeroSub').value.trim(),
        nosotros_titulo: $('#sNosotrosTitulo').value.trim(),
        nosotros_texto: $('#sNosotrosTexto').value.trim(),
        direccion: $('#sDireccion').value.trim(),
        whatsapp: $('#sWhatsapp').value.trim(),
        correo: $('#sCorreo').value.trim(),
        envio_texto: $('#sEnvio').value.trim(),
        franja_frases: frases
      };
      const btn = $('#btnSaveSettings');
      btn.disabled = true;
      btn.textContent = 'Guardando…';
      try {
        await api('/api/admin/settings', { method: 'PUT', body });
        toast('Configuración guardada. El sitio público ya refleja los cambios.');
      } catch (e) {
        errEl.textContent = e.message;
        errEl.hidden = false;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar cambios';
      }
    });
  }

  /* ---------------- Arranque ---------------- */

  document.addEventListener('DOMContentLoaded', () => {
    bindGate();
    bindLogout();
    bindNav();
    bindProductos();
    bindUsuarios();
    bindMensajes();
    bindSettings();
    comprobarSesion();
  });
})();
