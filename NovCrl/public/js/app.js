/* ==========================================================================
   app.js — Núcleo de NovaVolt: utilidades, sesión, auth, settings y chat.
   Expone window.NV para el resto de módulos.
   ========================================================================== */
(function () {
  'use strict';

  const NV = (window.NV = window.NV || {});
  NV.state = { user: null, settings: null, chatOpen: false, chatLoaded: false, adminOnline: false };

  /* ------------------------------- Utilidades ------------------------------ */
  NV.escape = function (str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  };

  NV.money = function (n) {
    const v = Number(n) || 0;
    return '$' + v.toLocaleString('es-CO', { maximumFractionDigits: 0 });
  };

  NV.api = async function (url, options = {}) {
    const opts = {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options
    };
    if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
    let res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      throw { error: 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.' };
    }
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      throw data && data.error
        ? data
        : { error: 'Ocurrió un error inesperado. Intenta de nuevo en unos segundos.' };
    }
    return data;
  };

  NV.toast = function (mensaje, tipo = 'ok', titulo) {
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo === 'error' ? 'error' : tipo === 'info' ? 'info' : '');
    el.innerHTML = `<strong>${NV.escape(titulo || (tipo === 'error' ? 'Revisa esto' : 'Listo'))}</strong>${NV.escape(mensaje)}`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 280);
    }, 5200);
  };

  NV.setFieldError = function (input, errorEl, mensaje) {
    if (input) input.classList.toggle('invalid', !!mensaje);
    if (errorEl) {
      errorEl.textContent = mensaje || '';
      errorEl.classList.toggle('show', !!mensaje);
    }
  };

  NV.clearErrors = function (form) {
    form.querySelectorAll('.field-error').forEach((e) => { e.textContent = ''; e.classList.remove('show'); });
    form.querySelectorAll('input').forEach((i) => i.classList.remove('invalid'));
    const box = form.querySelector('.form-error');
    if (box) { box.textContent = ''; box.classList.remove('show'); }
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

  /* --------------------------------- Modales -------------------------------- */
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
    const focusable = m.querySelector('input, button');
    if (focusable) setTimeout(() => focusable.focus(), 80);
  }
  function closeModal(m) {
    if (!m) return;
    m.classList.remove('open');
    if (!document.querySelector('.modal.open')) document.body.style.overflow = '';
  }
  NV.openModal = openModal;
  NV.closeModal = closeModal;

  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-close-modal]') || e.target.classList.contains('modal')) {
      closeModal(e.target.closest('.modal'));
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.open').forEach(closeModal);
      if (NV.state.chatOpen) toggleChat(false);
    }
  });

  /* ---------------------------------- Auth ---------------------------------- */
  function updateAuthUI() {
    const u = NV.state.user;
    const btnLogin = document.getElementById('btnLogin');
    const navUser = document.getElementById('navUser');
    if (!btnLogin || !navUser) return;
    if (u) {
      btnLogin.hidden = true;
      navUser.hidden = false;
      const av = document.getElementById('btnUserMenu');
      av.textContent = (u.nombre || 'NV').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
      document.getElementById('userMenuHead').textContent = `${u.nombre} · ${u.email}`;
      document.getElementById('linkAdmin').hidden = u.rol !== 'admin';
      renderOrders();
    } else {
      btnLogin.hidden = false;
      navUser.hidden = true;
      const box = document.getElementById('misCompras');
      if (box) box.innerHTML = '';
    }
    if (NV.state.chatOpen) renderChatGate();
  }

  NV.refreshUser = async function () {
    try {
      const data = await NV.api('/api/auth/me');
      NV.state.user = data.user;
    } catch {
      NV.state.user = null;
    }
    updateAuthUI();
    return NV.state.user;
  };

  function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('tabLogin').classList.toggle('active', isLogin);
    document.getElementById('tabRegister').classList.toggle('active', !isLogin);
    document.getElementById('tabLogin').setAttribute('aria-selected', String(isLogin));
    document.getElementById('tabRegister').setAttribute('aria-selected', String(!isLogin));
    document.getElementById('loginForm').classList.toggle('active', isLogin);
    document.getElementById('registerForm').classList.toggle('active', !isLogin);
  }

  /* ------------------------ Medidor de contraseña --------------------------- */
  const RULES = {
    length: (v) => v.length >= 8,
    lower: (v) => /[a-z]/.test(v),
    upper: (v) => /[A-Z]/.test(v),
    number: (v) => /[0-9]/.test(v),
    symbol: (v) => /[^A-Za-z0-9]/.test(v)
  };

  function evaluarPassword(valor) {
    const cumplidas = Object.keys(RULES).filter((k) => RULES[k](valor));
    const score = cumplidas.length;
    let nivel = 'weak';
    if (valor.length >= 8 && score >= 5) nivel = 'strong';
    else if (valor.length >= 8 && score >= 3) nivel = 'medium';
    return { score, nivel, cumplidas };
  }

  function pintarMedidor(valor) {
    const { score, nivel, cumplidas } = evaluarPassword(valor);
    const bars = [1, 2, 3].map((n) => document.getElementById('pwBar' + n));
    bars.forEach((b) => { b.className = 'pw-bar'; });
    const activas = nivel === 'weak' ? (valor ? 1 : 0) : nivel === 'medium' ? 2 : 3;
    for (let i = 0; i < activas; i++) bars[i].classList.add('on-' + nivel);

    const label = document.getElementById('pwLabel');
    label.className = 'pw-label ' + nivel;
    label.textContent = !valor ? 'Escribe una contraseña'
      : nivel === 'weak' ? 'Débil — no cumple el mínimo'
      : nivel === 'medium' ? 'Media — puedes continuar'
      : 'Fuerte — excelente contraseña';

    document.querySelectorAll('#pwRules li').forEach((li) => {
      li.classList.toggle('ok', cumplidas.includes(li.dataset.rule));
    });

    const btn = document.getElementById('btnSubmitRegister');
    if (btn) btn.disabled = nivel === 'weak';
    return { score, nivel };
  }

  /* --------------------------------- Eventos -------------------------------- */
  function bindAuth() {
    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) {
      btnLogin.addEventListener('click', () => { switchAuthTab('login'); openModal('authModal'); });
    }
    document.getElementById('tabLogin').addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('tabRegister').addEventListener('click', () => switchAuthTab('register'));
    document.getElementById('goRegister').addEventListener('click', (e) => { e.preventDefault(); switchAuthTab('register'); });

    const regPass = document.getElementById('regPassword');
    regPass.addEventListener('input', () => {
      pintarMedidor(regPass.value);
      NV.setFieldError(regPass, document.getElementById('regPasswordError'), '');
    });

    /* Login */
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      NV.clearErrors(form);
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      let valido = true;
      if (!email) { NV.setFieldError(document.getElementById('loginEmail'), document.getElementById('loginEmailError'), 'Ingresa tu correo electrónico.'); valido = false; }
      else if (!EMAIL_RE.test(email)) { NV.setFieldError(document.getElementById('loginEmail'), document.getElementById('loginEmailError'), 'El formato del correo no es válido.'); valido = false; }
      if (!password) { NV.setFieldError(document.getElementById('loginPassword'), document.getElementById('loginPasswordError'), 'Ingresa tu contraseña.'); valido = false; }
      if (!valido) return;

      const btn = document.getElementById('btnSubmitLogin');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Entrando…';
      try {
        const data = await NV.api('/api/auth/login', { method: 'POST', body: { email, password } });
        NV.state.user = data.user;
        closeModal(document.getElementById('authModal'));
        updateAuthUI();
        NV.toast(`Bienvenido de nuevo, ${data.user.nombre}.`, 'ok', 'Sesión iniciada');
        form.reset();
        if (NV.state.chatOpen) loadChat();
      } catch (err) {
        const box = document.getElementById('loginError');
        box.textContent = err.error || 'No pudimos iniciar sesión.';
        box.classList.add('show');
        if (err.campo) {
          const map = { email: ['loginEmail', 'loginEmailError'], password: ['loginPassword', 'loginPasswordError'] };
          const pair = map[err.campo];
          if (pair) NV.setFieldError(document.getElementById(pair[0]), document.getElementById(pair[1]), err.error);
        }
      } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar';
      }
    });

    /* Registro */
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      NV.clearErrors(form);
      const nombre = document.getElementById('regNombre').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const confirm = document.getElementById('regConfirm').value;
      const { nivel } = evaluarPassword(password);
      let valido = true;

      if (!nombre) { NV.setFieldError(document.getElementById('regNombre'), document.getElementById('regNombreError'), 'El nombre no puede estar vacío.'); valido = false; }
      if (!email) { NV.setFieldError(document.getElementById('regEmail'), document.getElementById('regEmailError'), 'El correo electrónico es obligatorio.'); valido = false; }
      else if (!EMAIL_RE.test(email)) { NV.setFieldError(document.getElementById('regEmail'), document.getElementById('regEmailError'), 'Ingresa un correo válido, por ejemplo nombre@dominio.com.'); valido = false; }
      if (nivel === 'weak') {
        NV.setFieldError(document.getElementById('regPassword'), document.getElementById('regPasswordError'),
          'La contraseña es débil. Usa al menos 8 caracteres con mayúscula, minúscula y número.');
        valido = false;
      }
      if (password !== confirm) { NV.setFieldError(document.getElementById('regConfirm'), document.getElementById('regConfirmError'), 'Las contraseñas no coinciden.'); valido = false; }
      if (!valido) return;

      const btn = document.getElementById('btnSubmitRegister');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Creando cuenta…';
      try {
        const data = await NV.api('/api/auth/register', { method: 'POST', body: { nombre, email, password } });
        NV.state.user = data.user;
        closeModal(document.getElementById('authModal'));
        updateAuthUI();
        NV.toast(`Tu cuenta fue creada, ${data.user.nombre}. Ya puedes comprar y chatear con soporte.`, 'ok', '¡Bienvenido a NovaVolt!');
        form.reset();
        pintarMedidor('');
        if (NV.state.chatOpen) loadChat();
      } catch (err) {
        const box = document.getElementById('registerError');
        box.textContent = err.error || 'No pudimos crear tu cuenta.';
        box.classList.add('show');
        if (err.campo) {
          const map = {
            nombre: ['regNombre', 'regNombreError'],
            email: ['regEmail', 'regEmailError'],
            password: ['regPassword', 'regPasswordError']
          };
          const pair = map[err.campo];
          if (pair) NV.setFieldError(document.getElementById(pair[0]), document.getElementById(pair[1]), err.error);
        }
      } finally {
        btn.disabled = evaluarPassword(document.getElementById('regPassword').value).nivel === 'weak';
        btn.textContent = 'Crear mi cuenta';
      }
    });

    /* Menú de usuario */
    const btnMenu = document.getElementById('btnUserMenu');
    const menu = document.getElementById('userMenu');
    btnMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle('open');
      btnMenu.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', () => menu.classList.remove('open'));

    document.getElementById('btnLogout').addEventListener('click', async () => {
      try { await NV.api('/api/auth/logout', { method: 'POST' }); } catch { /* sesión local igual se limpia */ }
      NV.state.user = null;
      NV.state.chatLoaded = false;
      updateAuthUI();
      menu.classList.remove('open');
      NV.toast('Cerraste sesión correctamente.', 'info', 'Hasta pronto');
      renderChatGate();
    });

    document.getElementById('linkMisCompras').addEventListener('click', (e) => {
      e.preventDefault();
      menu.classList.remove('open');
      renderOrders(true);
      document.getElementById('misCompras').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* -------------------------------- Compras -------------------------------- */
  async function renderOrders(scroll) {
    const box = document.getElementById('misCompras');
    if (!box) return;
    if (!NV.state.user) { box.innerHTML = ''; return; }
    box.innerHTML = '<p style="color:var(--texto-muted);font-size:.9rem">Cargando tus compras…</p>';
    try {
      const { ordenes } = await NV.api('/api/orders/mine');
      if (!ordenes.length) {
        box.innerHTML = `<div class="orders-panel"><h3>Mis compras</h3><p style="margin:0;color:var(--texto-muted);font-size:.88rem">Todavía no has registrado compras. Cuando lo hagas, aparecerán aquí con su total y fecha.</p></div>`;
        return;
      }
      box.innerHTML = `
        <div class="orders-panel">
          <h3>Mis compras <span class="orders-count">${ordenes.length}</span></h3>
          <div class="orders-list">
            ${ordenes.map((o) => `
              <div class="order-row">
                <img src="${NV.escape(o.imagen_url)}" alt="" onerror="this.onerror=null;this.src='/img/fallback-${NV.escape(o.categoria)}.svg'">
                <div class="order-info">
                  <strong>${NV.escape(o.nombre)}</strong>
                  <span>${o.cantidad} × ${NV.money(o.total / o.cantidad)} · ${new Date(o.creado_en.replace(' ', 'T') + 'Z').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div class="order-total">${NV.money(o.total)}</div>
              </div>`).join('')}
          </div>
        </div>`;
      if (scroll) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      box.innerHTML = `<div class="orders-panel"><p style="margin:0;color:var(--texto-muted)">${NV.escape(err.error || 'No pudimos cargar tus compras.')}</p></div>`;
    }
  }

  /* ------------------------------- Settings -------------------------------- */
  async function loadSettings() {
    try {
      const { settings } = await NV.api('/api/settings/public');
      NV.state.settings = settings;
      const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
      set('heroBadge', settings.hero_badge);
      set('heroSubtitle', settings.hero_subtitulo);
      const title = document.getElementById('heroTitle');
      if (title && settings.hero_titulo) {
        const words = settings.hero_titulo.trim().split(' ');
        const last = words.pop();
        title.innerHTML = `${NV.escape(words.join(' '))} <span class="accent">${NV.escape(last)}</span>`;
      }
      set('aboutTitle', settings.nosotros_titulo);
      set('aboutText', settings.nosotros_texto);
      set('contactWhatsapp', settings.whatsapp);
      set('contactCorreo', settings.correo);
      set('contactDireccion', settings.direccion);
      set('footerDireccion', settings.direccion);
      set('footerWhatsapp', settings.whatsapp);
      set('footerCorreo', settings.correo);
      set('envioTexto', settings.envio_texto);

      const wa = 'https://wa.me/' + String(settings.whatsapp || '').replace(/\D/g, '');
      ['cardWhatsapp', 'bannerWhatsapp'].forEach((id) => { const el = document.getElementById(id); if (el) el.href = wa; });
      const mail = document.getElementById('cardCorreo');
      if (mail) mail.href = 'mailto:' + settings.correo;
      const dir = document.getElementById('cardDireccion');
      if (dir) dir.href = 'https://maps.google.com/?q=' + encodeURIComponent(settings.direccion || '');

      if (Array.isArray(settings.franja_frases) && settings.franja_frases.length) {
        const track = document.getElementById('marqueeTrack');
        const items = settings.franja_frases.map((f) => `<span class="marquee-item">${NV.escape(f)}</span>`).join('');
        track.innerHTML = items + items;
      }
    } catch {
      /* Si falla, quedan los textos por defecto del HTML. */
    }
  }

  /* ---------------------------------- Chat --------------------------------- */
  const chatPanel = document.getElementById('chatPanel');
  const chatFab = document.getElementById('chatFab');
  const chatBody = document.getElementById('chatBody');

  function toggleChat(force) {
    const open = typeof force === 'boolean' ? force : !NV.state.chatOpen;
    NV.state.chatOpen = open;
    chatPanel.classList.toggle('open', open);
    chatFab.setAttribute('aria-expanded', String(open));
    if (open) {
      document.getElementById('chatBadge').classList.remove('show');
      if (NV.state.user) loadChat();
      else renderChatGate();
      setTimeout(() => document.getElementById('chatInput').focus(), 120);
    }
  }

  function renderChatGate() {
    if (!chatBody) return;
    if (!NV.state.user) {
      chatBody.innerHTML = `
        <div class="chat-login">
          <p style="font-size:1.6rem;margin:0 0 6px">🌸</p>
          <p><strong>Inicia sesión para chatear con soporte.</strong><br>Así guardamos tu historial y un asesor puede darte seguimiento.</p>
          <button class="btn btn--primary btn--sm" type="button" id="chatLoginBtn">Ingresar o registrarme</button>
        </div>`;
      const b = document.getElementById('chatLoginBtn');
      if (b) b.addEventListener('click', () => { switchAuthTab('login'); openModal('authModal'); });
    }
  }

  function bubble(m) {
    const esUser = !m.de_admin;
    const hora = m.creado_en ? new Date(m.creado_en.replace(' ', 'T') + 'Z').toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
    return `<div class="chat-msg ${esUser ? 'user' : 'admin'}">${NV.escape(m.contenido)}<span class="meta">${esUser ? 'Tú' : 'Soporte NovaVolt'} · ${hora}</span></div>`;
  }

  async function loadChat() {
    if (!NV.state.user) { renderChatGate(); return; }
    try {
      const data = await NV.api('/api/messages/mine');
      NV.state.adminOnline = data.admin_en_linea;
      updateChatStatus();
      if (!data.mensajes.length) {
        chatBody.innerHTML = `<div class="chat-empty">¡Hola ${NV.escape(NV.state.user.nombre.split(' ')[0])}! Cuéntanos qué necesitas: precios, envíos, garantías o financiación. Si no hay un asesor en línea, nuestro asistente te responde de inmediato.</div>`;
      } else {
        chatBody.innerHTML = data.mensajes.map(bubble).join('');
        chatBody.scrollTop = chatBody.scrollHeight;
      }
      NV.state.chatLoaded = true;
    } catch (err) {
      chatBody.innerHTML = `<div class="chat-empty">${NV.escape(err.error || 'No pudimos cargar el chat.')}</div>`;
    }
  }

  function updateChatStatus() {
    const dot = document.getElementById('chatStatusDot');
    const txt = document.getElementById('chatStatusText');
    if (!dot || !txt) return;
    const on = NV.state.adminOnline;
    dot.classList.toggle('off', !on);
    txt.textContent = on ? 'Asesor en línea' : 'Asistente virtual · un asesor te seguirá';
  }

  async function enviarMensaje(texto) {
    const input = document.getElementById('chatInput');
    const btn = document.getElementById('chatSend');
    const contenido = (texto ?? input.value).trim();
    if (!contenido) return;
    if (!NV.state.user) { renderChatGate(); return; }
    input.value = '';
    btn.disabled = true;
    const temp = document.createElement('div');
    temp.className = 'chat-msg user';
    temp.textContent = contenido;
    chatBody.appendChild(temp);
    chatBody.scrollTop = chatBody.scrollHeight;

    try {
      const data = await NV.api('/api/messages', { method: 'POST', body: { contenido } });
      temp.innerHTML = `${NV.escape(contenido)}<span class="meta">Tú · ahora</span>`;
      if (data.bot) {
        const b = document.createElement('div');
        b.className = 'chat-msg admin';
        b.innerHTML = `${NV.escape(data.bot.contenido)}<span class="meta">Asistente NovaVolt · ahora</span>`;
        chatBody.appendChild(b);
      }
      NV.state.adminOnline = data.admin_en_linea;
      updateChatStatus();
      chatBody.scrollTop = chatBody.scrollHeight;
    } catch (err) {
      temp.remove();
      NV.toast(err.error || 'No pudimos enviar tu mensaje.', 'error');
      input.value = contenido;
    } finally {
      btn.disabled = false;
      input.focus();
    }
  }

  function bindChat() {
    chatFab.addEventListener('click', () => toggleChat());
    document.getElementById('chatClose').addEventListener('click', () => toggleChat(false));
    document.getElementById('chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      enviarMensaje();
    });

    // Polling del historial mientras el chat está abierto
    setInterval(async () => {
      if (!NV.state.chatOpen || !NV.state.user) return;
      try {
        const data = await NV.api('/api/messages/mine');
        NV.state.adminOnline = data.admin_en_linea;
        updateChatStatus();
        const actual = chatBody.querySelectorAll('.chat-msg').length;
        if (data.mensajes.length > actual) {
          chatBody.innerHTML = data.mensajes.map(bubble).join('');
          chatBody.scrollTop = chatBody.scrollHeight;
        }
      } catch { /* silencio: no interrumpir al usuario */ }
    }, 5000);

    // Estado y no leídos aun con el chat cerrado
    setInterval(async () => {
      if (!NV.state.user) return;
      try {
        const s = await NV.api('/api/messages/status');
        NV.state.adminOnline = s.admin_en_linea;
        updateChatStatus();
        if (!NV.state.chatOpen && s.no_leidos > 0) {
          const badge = document.getElementById('chatBadge');
          badge.textContent = s.no_leidos;
          badge.classList.add('show');
        }
      } catch { /* silencio */ }
    }, 15000);
  }

  /* -------------------------------- Navegación ------------------------------ */
  function bindNav() {
    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('mainNav');
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('mobile-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('mobile-open')));

    const header = document.getElementById('siteHeader');
    window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 12), { passive: true });

    document.querySelectorAll('[data-footer-cat]').forEach((a) => {
      a.addEventListener('click', () => {
        const cat = a.dataset.footerCat;
        const btn = document.querySelector(`.cat-card[data-cat="${cat}"]`);
        if (btn) setTimeout(() => btn.click(), 120);
      });
    });

    document.getElementById('year').textContent = new Date().getFullYear();
  }

  /* --------------------------------- Init ---------------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    bindNav();
    bindAuth();
    bindChat();
    loadSettings();
    await NV.refreshUser();
    renderChatGate();
  });
})();
