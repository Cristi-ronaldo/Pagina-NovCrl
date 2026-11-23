/* ==========================================================================
   snippets.js — Ejemplos de código reales con resaltado y copiado.
   ========================================================================== */
(function () {
  'use strict';
  const NV = window.NV;

  const SNIPPETS = [
    {
      id: 'landing',
      icon: '🌐',
      titulo: 'Landing de conversión',
      descripcion: 'Hero con propuesta de valor, botón de WhatsApp y prueba social. HTML semántico, accesible y sin dependencias.',
      chips: ['HTML5', 'Accesible', 'Sin frameworks'],
      lang: 'html',
      code: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NovaVolt — Muévete en silencio</title>
</head>
<body>
  <header class="hero">
    <p class="badge">Movilidad eléctrica en Bogotá</p>
    <h1>Tu próxima ruta empieza hoy</h1>
    <p class="lead">
      Scooters, bicis y autos eléctricos con garantía real
      y soporte en Colombia.
    </p>

    <a class="btn" href="https://wa.me/573103832322"
       target="_blank" rel="noopener">
      Hablar con un asesor
    </a>

    <ul class="trust" aria-label="Beneficios">
      <li>Envío gratis en Bogotá</li>
      <li>Garantía de 12 meses</li>
      <li>Financiación disponible</li>
    </ul>
  </header>
</body>
</html>`
    },
    {
      id: 'api',
      icon: '🔌',
      titulo: 'API REST con validación',
      descripcion: 'Endpoint Express que valida datos, evita correos duplicados y responde siempre con JSON claro. Sin errores 500 silenciosos.',
      chips: ['Node.js', 'Express', 'SQLite'],
      lang: 'js',
      code: `const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('./db');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }
    if (!/^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i.test(email)) {
      return res.status(400).json({ error: 'Correo inválido.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Mínimo 8 caracteres.' });
    }

    const existe = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existe) {
      return res.status(409).json({ error: 'Ese correo ya está registrado.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const info = db.prepare(
      'INSERT INTO users (nombre, email, password_hash) VALUES (?, ?, ?)'
    ).run(nombre, email, hash);

    res.status(201).json({ ok: true, id: info.lastInsertRowid });
  } catch (err) {
    next(err); // el handler global responde JSON, nunca HTML
  }
});

module.exports = router;`
    },
    {
      id: 'backup',
      icon: '🗄️',
      titulo: 'Respaldo automático cifrado',
      descripcion: 'Script de respaldo diario con compresión, cifrado GPG y rotación de 30 días. Se programa con cron y avisa por correo.',
      chips: ['Bash', 'GPG', 'Cron'],
      lang: 'bash',
      code: `#!/usr/bin/env bash
# Respaldo diario de NovaVolt con cifrado y rotación
set -euo pipefail

DB="/var/www/novavolt/data/novavolt.db"
DESTINO="/var/backups/novavolt"
FECHA=$(date +%Y-%m-%d_%H%M)
ARCHIVO="$DESTINO/novavolt-$FECHA.tar.gz"
CLAVE="respaldo@novavolt.co"

mkdir -p "$DESTINO"

# 1. Copia consistente usando la API de SQLite
sqlite3 "$DB" ".backup '/tmp/novavolt-$FECHA.db'"

# 2. Comprime y cifra con GPG (clave pública del equipo)
tar -czf - -C /tmp "novavolt-$FECHA.db" \\
  | gpg --batch --yes --encrypt --recipient "$CLAVE" \\
        --output "$ARCHIVO.gpg"

rm -f "/tmp/novavolt-$FECHA.db"

# 3. Rota copias de más de 30 días
find "$DESTINO" -name "novavolt-*.gpg" -mtime +30 -delete

# 4. Verifica que el archivo exista y no esté vacío
if [ -s "$ARCHIVO.gpg" ]; then
  echo "Respaldo OK: $ARCHIVO.gpg"
else
  echo "ERROR: el respaldo quedó vacío" >&2
  exit 1
fi`
    },
    {
      id: 'ui',
      icon: '🧩',
      titulo: 'Componente de notificaciones',
      descripcion: 'Sistema de toasts accesible en JavaScript puro: crea nodos, anuncia con aria-live y se autodestruye sin fugas de memoria.',
      chips: ['Vanilla JS', 'ARIA', 'UI'],
      lang: 'js',
      code: `export function crearToast(mensaje, tipo = 'ok') {
  const contenedor = document.getElementById('toasts');
  if (!contenedor) return;

  const toast = document.createElement('div');
  toast.className = 'toast toast--' + tipo;
  toast.setAttribute('role', tipo === 'error' ? 'alert' : 'status');

  const titulo = document.createElement('strong');
  titulo.textContent = tipo === 'error' ? 'Revisa esto' : 'Listo';

  const texto = document.createElement('p');
  texto.textContent = mensaje;

  toast.append(titulo, texto);
  contenedor.appendChild(toast);

  // Animación de salida y limpieza del DOM
  const cerrar = () => {
    toast.classList.add('toast--out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  const timer = setTimeout(cerrar, 5000);
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    cerrar();
  });

  return { cerrar };
}`
    }
  ];

  /* ------------------------------ Resaltado ------------------------------- */
  const PATRONES = {
    js: [
      ['com', /\/\/[^\n]*|\/\*[\s\S]*?\*\//],
      ['str', /`(?:\\[\s\S]|[^`\\])*`|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/],
      ['kw', /\b(?:const|let|var|function|return|if|else|await|async|new|throw|try|catch|finally|import|from|export|default|class|for|of|in|while|switch|case|break|true|false|null|undefined|require|module)\b/],
      ['num', /\b\d+(?:\.\d+)?\b/],
      ['fn', /\b[A-Za-z_$][\w$]*(?=\s*\()/]
    ],
    html: [
      ['com', /<!--[\s\S]*?-->/],
      ['tag', /<\/?[A-Za-z][\w-]*/],
      ['attr', /\b[A-Za-z-]+(?==)/],
      ['str', /"(?:[^"]*)"|'(?:[^']*)'/]
    ],
    bash: [
      ['com', /#[^\n]*/],
      ['str', /"(?:\\[\s\S]|[^"\\])*"|'[^']*'/],
      ['kw', /\b(?:if|then|else|fi|for|do|done|while|case|esac|function|local|export|echo|exit|set|source|find|tar|gpg|sqlite3|mkdir|rm)\b/],
      ['var', /\$\{?[A-Za-z_][\w]*\}?/],
      ['num', /\b\d+\b/]
    ]
  };

  function escapar(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  function resaltar(code, lang) {
    const patrones = PATRONES[lang] || PATRONES.js;
    const combined = new RegExp(patrones.map(([name, re]) => `(?<${name}>${re.source})`).join('|'), 'g');
    let out = '';
    let last = 0;
    let m;
    while ((m = combined.exec(code)) !== null) {
      out += escapar(code.slice(last, m.index));
      const grupo = Object.keys(m.groups).find((g) => m.groups[g] !== undefined);
      out += `<span class="tok-${grupo}">${escapar(m[0])}</span>`;
      last = m.index + m[0].length;
      if (m[0].length === 0) combined.lastIndex++;
    }
    out += escapar(code.slice(last));
    return out;
  }

  /* -------------------------------- Render -------------------------------- */
  function render() {
    const grid = document.getElementById('snippetsGrid');
    if (!grid) return;
    grid.innerHTML = SNIPPETS.map((s) => `
      <article class="snippet-card reveal" data-snippet="${s.id}">
        <div class="snippet-head">
          <span class="snippet-ico" aria-hidden="true">${s.icon}</span>
          <div>
            <h3>${NV.escape(s.titulo)}</h3>
            <p>${NV.escape(s.descripcion)}</p>
          </div>
          <button class="btn-copy" type="button" data-copy="${s.id}" aria-label="Copiar código de ${NV.escape(s.titulo)}">Copiar</button>
        </div>
        <pre class="snippet-code"><code>${resaltar(s.code, s.lang)}</code></pre>
        <div class="snippet-foot">${s.chips.map((c) => `<span class="chip">${NV.escape(c)}</span>`).join('')}</div>
      </article>`).join('');

    grid.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-copy]');
      if (!btn) return;
      const s = SNIPPETS.find((x) => x.id === btn.dataset.copy);
      if (!s) return;
      try {
        await navigator.clipboard.writeText(s.code);
        btn.textContent = '¡Copiado!';
        NV.toast('El código está en tu portapapeles.', 'ok', 'Copiado');
      } catch {
        const ta = document.createElement('textarea');
        ta.value = s.code;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); btn.textContent = '¡Copiado!'; NV.toast('Código copiado.', 'ok'); }
        catch { NV.toast('Tu navegador bloqueó el portapapeles. Selecciona el código manualmente.', 'error'); }
        ta.remove();
      }
      setTimeout(() => { btn.textContent = 'Copiar'; }, 2200);
    });
  }

  document.addEventListener('DOMContentLoaded', render);
})();
