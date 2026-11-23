/* ==========================================================================
   animations.js — Pétalos de cerezo, reveal, parallax y contadores.
   Respeta prefers-reduced-motion y pausa cuando la pestaña no está visible.
   ========================================================================== */
(function () {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------- Lluvia de pétalos ---------------------------- */
  function iniciarPetalos() {
    if (reduceMotion) return;
    const canvas = document.getElementById('petals');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, dpr = 1;
    const PETALOS = [];
    const CANTIDAD = window.innerWidth < 700 ? 24 : 42;
    const COLORES = ['#F7A8C4', '#FBD3E1', '#E97BA6', '#F9C6D8'];

    function medir() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function crear(p, arriba) {
      p.x = Math.random() * W;
      p.y = arriba ? -30 - Math.random() * 80 : Math.random() * H;
      p.size = 5 + Math.random() * 9;
      p.speed = 0.35 + Math.random() * 0.85;
      p.sway = 0.5 + Math.random() * 1.4;
      p.fase = Math.random() * Math.PI * 2;
      p.rot = Math.random() * Math.PI * 2;
      p.vr = (Math.random() - 0.5) * 0.02;
      p.color = COLORES[Math.floor(Math.random() * COLORES.length)];
      p.alpha = 0.35 + Math.random() * 0.45;
      return p;
    }

    medir();
    for (let i = 0; i < CANTIDAD; i++) PETALOS.push(crear({}, false));

    let ultimo = 0;
    const INTERVALO = 1000 / 30; // 30 fps objetivo
    let activo = true;

    function dibujar(ts) {
      if (!activo) return;
      requestAnimationFrame(dibujar);
      if (ts - ultimo < INTERVALO) return;
      const dt = Math.min((ts - ultimo) / 16.67, 3);
      ultimo = ts;

      ctx.clearRect(0, 0, W, H);
      for (const p of PETALOS) {
        p.y += p.speed * dt;
        p.fase += 0.012 * dt;
        p.x += Math.sin(p.fase) * p.sway * 0.5 * dt;
        p.rot += p.vr * dt;

        if (p.y > H + 30) crear(p, true);
        if (p.x < -40) p.x = W + 20;
        if (p.x > W + 40) p.x = -20;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        // Pétalo: dos curvas simétricas
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.bezierCurveTo(p.size * 0.9, -p.size * 0.5, p.size * 0.7, p.size * 0.6, 0, p.size);
        ctx.bezierCurveTo(-p.size * 0.7, p.size * 0.6, -p.size * 0.9, -p.size * 0.5, 0, -p.size);
        ctx.fill();
        ctx.restore();
      }
    }
    requestAnimationFrame(dibujar);

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(medir, 180);
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { activo = false; }
      else if (!activo) { activo = true; ultimo = 0; requestAnimationFrame(dibujar); }
    });
  }

  /* ----------------------------- Reveal scroll ---------------------------- */
  function iniciarReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach((el) => el.classList.add('visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach((el) => io.observe(el));
  }

  /* ------------------------------- Parallax ------------------------------- */
  function iniciarParallax() {
    if (reduceMotion) return;
    const art = document.getElementById('heroArt');
    if (!art) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 900 && window.innerWidth > 900) {
          art.style.transform = `translateY(${y * 0.07}px)`;
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* ------------------------------- Contadores ----------------------------- */
  function animarContador(el) {
    const objetivo = parseInt(el.dataset.count, 10) || 0;
    const sufijo = el.dataset.suffix || '';
    if (reduceMotion) { el.textContent = objetivo.toLocaleString('es-CO') + sufijo; return; }
    const duracion = 1400;
    const inicio = performance.now();
    function paso(now) {
      const t = Math.min((now - inicio) / duracion, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const valor = Math.round(objetivo * eased);
      el.innerHTML = valor.toLocaleString('es-CO') + (sufijo ? `<span class="suffix">${sufijo}</span>` : '');
      if (t < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }

  function iniciarContadores() {
    const nums = document.querySelectorAll('[data-count]');
    if (!('IntersectionObserver' in window)) { nums.forEach(animarContador); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animarContador(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    nums.forEach((el) => io.observe(el));
  }

  document.addEventListener('DOMContentLoaded', () => {
    iniciarPetalos();
    iniciarReveal();
    iniciarParallax();
    iniciarContadores();
  });
})();
