/* ============================================================
   Ledger — landing page
   Live figures from the API, the hero art with its live glass card,
   the screens carousel and the metro map.
   ============================================================ */

const LINE_COLORS = {
  Food: '#e2231a',
  Transport: '#1d5fbf',
  Shopping: '#d9488f',
  Bills: '#e8731c',
  Entertainment: '#7b3fa0',
  Health: '#2e9b4a',
  Education: '#b0177f',
  Other: '#8a8d87',
};

const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const int = new Intl.NumberFormat('en-IN');
const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lineColor = (cat) => LINE_COLORS[cat] || LINE_COLORS.Other;
const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

// ---------- Live figures ----------
// Real numbers only: if the API is unreachable the strip stays hidden
async function loadLive() {
  try {
    const [summary, cats] = await Promise.all([getJSON('/api/stats/summary'), getJSON('/api/stats/by-category')]);
    $('lMonth').textContent = inr0.format(Math.round(summary.thisMonth));
    $('lCount').textContent = int.format(summary.count);
    $('lTop').innerHTML = cats.length
      ? `<span class="bullet" style="--c:${lineColor(cats[0].category)}"></span>${escapeHtml(cats[0].category)}`
      : '—';
    $('live').hidden = false;
    $('liveNote').hidden = false;
    return { summary, cats };
  } catch {
    return null;
  }
}

async function loadPipeline() {
  try {
    const pipeline = await getJSON('/api/stats/pipeline');
    $('pipeCode').innerHTML = highlightJson(JSON.stringify(pipeline, null, 2));
    $('pipeNote').textContent = 'live, as the app runs it';
  } catch {
    /* keep the static example */
  }
}

function highlightJson(json) {
  return escapeHtml(json)
    .replace(/&quot;(\$\w+)&quot;:/g, '<span class="k">&quot;$1&quot;</span>:')
    .replace(/: &quot;([^&]*)&quot;/g, ': <span class="s">&quot;$1&quot;</span>');
}

// ---------- Reveal on scroll ----------
function bindReveal() {
  const els = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    },
    { threshold: 0.18 }
  );
  els.forEach((el) => io.observe(el));
}

// ---------- Screens (tabs flip the device in 3D) ----------
const SHOTS = {
  overview: 'The Overview screen: a yellow station board with the total, category lines, a daily spending chart and recent entries',
  transactions: 'The Transactions screen: every entry grouped by day with day totals, a search box and a sort menu',
  analytics: 'The Analytics screen: spending by month, by weekday, a category totals table and the live aggregation pipeline',
};

function bindScreens() {
  const tabs = [...document.querySelectorAll('[data-shot]')];
  const frame = $('deviceFrame');
  const img = $('shotImg');
  let busy = false;

  async function show(tab) {
    if (busy || tab.getAttribute('aria-selected') === 'true') return;
    busy = true;
    tabs.forEach((t) => t.setAttribute('aria-selected', t === tab));
    const key = tab.dataset.shot;
    const swap = async () => {
      img.src = `shots/${key}.webp`;
      img.alt = SHOTS[key];
      await img.decode().catch(() => {});
    };
    if (reduceMotion) {
      await swap();
    } else {
      const base = getComputedStyle(frame).transform;
      const rest = base === 'none' ? '' : base;
      await frame.animate([{ transform: rest || 'none' }, { transform: `${rest} rotateY(-80deg)` }], {
        duration: 240,
        easing: 'cubic-bezier(0.55, 0, 1, 0.45)',
      }).finished;
      await swap();
      await frame.animate([{ transform: `${rest} rotateY(70deg)` }, { transform: rest || 'none' }], {
        duration: 620,
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
      }).finished;
    }
    busy = false;
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => show(tab));
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.focus();
      show(next);
    });
  });
  // Warm the cache so the first flip doesn't wait on the network
  addEventListener('load', () => ['transactions', 'analytics'].forEach((k) => (new Image().src = `shots/${k}.webp`)));
}

// ---------- Metro map ----------
// The same line hues as the app, lifted so they glow on the night panel
const NEON = {
  Food: '#ff4d45',
  Transport: '#4d80ff',
  Shopping: '#f06cb8',
  Bills: '#ff9a3c',
  Entertainment: '#a35cff',
  Health: '#4ee06d',
  Education: '#d63fe2',
  Other: '#b4b4b4',
};

// A polyline with its corners eased into curves of radius r
function roundedPath(pts, r) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let k = 1; k < pts.length - 1; k++) {
    const [px, py] = pts[k - 1];
    const [x, y] = pts[k];
    const [nx, ny] = pts[k + 1];
    const l1 = Math.hypot(x - px, y - py);
    const l2 = Math.hypot(nx - x, ny - y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = x + ((px - x) / l1) * rr;
    const ay = y + ((py - y) / l1) * rr;
    const bx = x + ((nx - x) / l2) * rr;
    const by = y + ((ny - y) / l2) * rr;
    d += ` L${ax.toFixed(1)} ${ay.toFixed(1)} Q${x} ${y} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d} L${lx} ${ly}`;
}

// All lines leave one interchange (your total) and fan out, one per category
function drawMap(cats) {
  const el = $('metroMap');
  const byCat = new Map(cats.map((c) => [c.category, c]));
  const order = [...cats.map((c) => c.category), ...Object.keys(LINE_COLORS).filter((c) => !byCat.has(c))];
  const compact = el.clientWidth < 560;
  el.dataset.compact = compact;

  const W = 900;
  const H = 650;
  const hub = { x: 30, y: 222, w: 98, h: 230 };
  const ys = (i) => 252 + i * 24.5;
  const ye = (i) => 52 + i * 80;
  const bend = compact ? 250 : 350;
  const stopX = compact ? 480 : 690;
  const nameSize = compact ? 32 : 21;
  const shareSize = compact ? 30 : 20;
  const neon = (cat) => NEON[cat] || NEON.Other;

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Metro map of spending categories">
    <defs>
      <filter id="neonGlow" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="wide"/>
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="tight"/>
        <feMerge><feMergeNode in="wide"/><feMergeNode in="tight"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="hubShadow" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
        <feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#ffffff" flood-opacity="0.14"/>
      </filter>
    </defs>`;

  let tracks = '';
  let stops = '';
  let labels = '';
  order.forEach((cat, i) => {
    const dy = ye(i) - ys(i);
    const color = neon(cat);
    const c = byCat.get(cat);
    const share = c ? `${c.percent.toFixed(0)}%` : '0%';
    const pts = Math.abs(dy) < 1
      ? [[hub.x + hub.w, ys(i)], [stopX - 12, ye(i)]]
      : [[hub.x + hub.w, ys(i)], [bend, ys(i)], [bend + Math.abs(dy) * 0.8, ye(i)], [stopX - 12, ye(i)]];
    const d = roundedPath(pts, 16);
    tracks += `<path class="track" style="--i:${i}" stroke="${color}" d="${d}"/>`;
    tracks += `<path class="core" style="--i:${i}" d="${d}"/>`;
    stops += `<circle class="stop" style="--i:${i}" cx="${stopX}" cy="${ye(i)}" r="12" fill="#16181d" stroke="${color}" stroke-width="4.5"/>`;
    labels += `<g class="stop" style="--i:${i}">
      <text class="name" x="${stopX + 27}" y="${ye(i) + nameSize * 0.36}" style="font-size:${nameSize}px">${cat}</text>
      <text class="share" x="${W - 4}" y="${ye(i) + shareSize * 0.36}" text-anchor="end" fill="${color}" style="font-size:${shareSize}px">${share}</text>
    </g>`;
  });

  s += `<g filter="url(#neonGlow)">${tracks}${stops}</g>`;
  s += `<rect x="${hub.x}" y="${hub.y}" width="${hub.w}" height="${hub.h}" rx="9" fill="#060606" stroke="rgba(255,255,255,0.22)" stroke-width="1.2" filter="url(#hubShadow)"/>`;
  s += `<text class="hub-label" x="${hub.x + hub.w / 2}" y="${hub.y + hub.h / 2 + 16}" text-anchor="middle" filter="url(#neonGlow)" style="font-size:46px">₹</text>`;
  s += labels;
  s += '</svg>';
  el.innerHTML = s;
  el.querySelectorAll('.track, .core').forEach((p) => {
    const len = Math.ceil(p.getTotalLength());
    p.style.strokeDasharray = len;
    p.style.setProperty('--len', len);
  });
  if (!cats.length) $('mapMeta').textContent = 'Shares appear once the server is running';
}

// ---------- Hero art ----------
// The art turns a few degrees toward the pointer, like the app's station board
function bindHeroTilt() {
  const art = $('heroArt');
  if (reduceMotion || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const hero = art.closest('.hero');
  hero.addEventListener('pointermove', (e) => {
    const r = art.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
    art.classList.add('tilting');
    art.style.setProperty('--rx', `${(-y * 4).toFixed(2)}deg`);
    art.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`);
  });
  hero.addEventListener('pointerleave', () => {
    art.classList.remove('tilting');
    art.style.setProperty('--rx', '0deg');
    art.style.setProperty('--ry', '0deg');
  });
}

// This month's real total on the glass card, shrunk only if a large figure would overflow it
function setHeroFigure(amount) {
  const el = $('heroFigure');
  el.textContent = inr0.format(Math.round(amount));
  el.style.fontSize = '';
  const box = el.parentElement;
  const room = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) * 2;
  if (el.scrollWidth > room) el.style.fontSize = `${(5.6 * (room / el.scrollWidth) * 0.98).toFixed(2)}cqw`;
}

// ---------- Boot ----------
bindReveal();
bindScreens();
loadPipeline();
const live = loadLive();
live.then((data) => {
  const cats = data ? data.cats : [];
  drawMap(cats);
  let compact = $('metroMap').dataset.compact;
  new ResizeObserver(() => {
    const next = String($('metroMap').clientWidth < 560);
    if (next !== compact) {
      compact = next;
      drawMap(cats);
    }
  }).observe($('metroMap'));
});
bindHeroTilt();
live.then((data) => data && setHeroFigure(data.summary.thisMonth));
