/* ============================================================
   Ledger — Expense Tracker frontend (vanilla JS, SVG charts)
   ============================================================ */

// ---------- Lines (categories) ----------
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
const RANGE_EN = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  month: 'This month',
  year: 'This year',
  all: 'All time',
  custom: 'Selected dates',
};
const VIEW_TITLES = { overview: 'Overview', transactions: 'Transactions', analytics: 'Analytics' };
const PAGE_SIZE = 40;
const INK = '#121212';

const lineColor = (cat) => LINE_COLORS[cat] || LINE_COLORS.Other;
const bullet = (cat) => `<span class="bullet" style="--c:${lineColor(cat)}"></span>`;

// ---------- Formatting ----------
const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat('en-IN');

const money = (n) => (Math.round(n * 100) % 100 === 0 ? inr0.format(n) : inr2.format(n));
const moneyRound = (n) => inr0.format(Math.round(n));
function axisMoney(v) {
  if (v === 0) return '₹0';
  if (v >= 100000) return `₹${+(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${+(v / 1000).toFixed(1)}k`;
  return `₹${v}`;
}
const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Local calendar day as "YYYY-MM-DD"
function isoDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d, n) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
// Expense dates are stored as UTC midnight, so read them back in UTC
const fmtUTC = (iso, opts) => new Date(iso).toLocaleDateString('en-IN', { timeZone: 'UTC', ...opts });
function dayLabel(key) {
  if (key === isoDay()) return 'Today';
  if (key === isoDay(addDays(new Date(), -1))) return 'Yesterday';
  return fmtUTC(`${key}T00:00:00Z`, { day: 'numeric', month: 'short' });
}
const pluralize = (n, one, many = `${one}s`) => `${int.format(n)} ${n === 1 ? one : many}`;

// ---------- State ----------
const state = {
  view: 'overview',
  categories: Object.keys(LINE_COLORS),
  range: '30d',
  from: '',
  to: '',
  category: 'All',
  search: '',
  sort: 'date',
  order: 'desc',
  visible: PAGE_SIZE,
  expenses: [],
  editingId: null,
};
let requestId = 0;
let installPrompt = null;

const $ = (id) => document.getElementById(id);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- API ----------
async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  } catch {
    throw new Error(navigator.onLine ? 'Could not reach the server. Is it running?' : 'You are offline. Connect to save changes.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function qs(extra = {}, { dates = true, category = true, search = false } = {}) {
  const p = new URLSearchParams();
  if (dates && state.from) p.set('from', state.from);
  if (dates && state.to) p.set('to', state.to);
  if (category && state.category !== 'All') p.set('category', state.category);
  if (search && state.search) p.set('search', state.search);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ---------- Range ----------
function applyRange(range) {
  const today = new Date();
  state.range = range;
  state.to = isoDay(today);
  switch (range) {
    case '7d': state.from = isoDay(addDays(today, -6)); break;
    case '30d': state.from = isoDay(addDays(today, -29)); break;
    case '90d': state.from = isoDay(addDays(today, -89)); break;
    case 'month': state.from = isoDay(new Date(today.getFullYear(), today.getMonth(), 1)); break;
    case 'year': state.from = isoDay(new Date(today.getFullYear(), 0, 1)); break;
    default: state.from = ''; state.to = '';
  }
  syncRangeUI();
}

function syncRangeUI() {
  document.querySelectorAll('#rangeTabs button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.range === state.range));
  $('rangeSelect').value = state.range;
  $('fromDate').value = state.from;
  $('toDate').value = state.to;
  document.querySelector('.dates').classList.toggle('custom', state.range === 'custom');
}

// ---------- Routing ----------
function setView(view) {
  if (!VIEW_TITLES[view]) view = 'overview';
  state.view = view;
  $('viewTitle').textContent = VIEW_TITLES[view];
  document.title = `${VIEW_TITLES[view]} · Ledger`;
  for (const v of Object.keys(VIEW_TITLES)) $(`view-${v}`).hidden = v !== view;
  document.querySelectorAll('[data-view]').forEach((a) => {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  enterView($(`view-${view}`));
  load();
}
const viewFromHash = () => (location.hash.match(/^#\/(\w+)/) || [])[1] || 'overview';

// ---------- Loading ----------
async function load({ keepPage = false } = {}) {
  const id = ++requestId;
  const viewEl = $(`view-${state.view}`);
  viewEl.classList.add('loading');
  try {
    if (state.view === 'overview') {
      const [summary, cats, trend, expenses] = await Promise.all([
        api(`/api/stats/summary${qs()}`),
        api(`/api/stats/by-category${qs()}`),
        api(`/api/stats/trend${qs()}`),
        api(`/api/expenses${qs({ sort: 'date', order: 'desc' })}`),
      ]);
      if (id !== requestId) return;
      renderOverview(summary, cats, trend, expenses);
    } else if (state.view === 'transactions') {
      const [summary, expenses] = await Promise.all([
        api(`/api/stats/summary${qs({}, { search: true })}`),
        api(`/api/expenses${qs({ sort: state.sort, order: state.order }, { search: true })}`),
      ]);
      if (id !== requestId) return;
      state.expenses = expenses;
      if (!keepPage) state.visible = PAGE_SIZE;
      renderTransactions(summary);
    } else {
      const [cats, months, weekdays, pipeline] = await Promise.all([
        api(`/api/stats/by-category${qs()}`),
        api(`/api/stats/trend${qs({}, { dates: false })}`),
        api(`/api/stats/by-weekday${qs()}`),
        api(`/api/stats/pipeline${qs()}`),
      ]);
      if (id !== requestId) return;
      renderAnalytics(cats, months, weekdays, pipeline);
    }
  } catch (err) {
    if (id !== requestId) return;
    $('finding').textContent = err.message;
    toast(err.message, { error: true, action: 'Retry', onAction: () => load() });
  } finally {
    if (id === requestId) viewEl.classList.remove('loading');
  }
}

// ---------- Overview ----------
function renderOverview(s, cats, trend, expenses) {
  state.expenses = expenses;
  const catName = state.category === 'All' ? null : state.category;
  const rangeEn = RANGE_EN[state.range];

  // Station board
  $('boardEn').textContent = `${catName ? `Spent on ${catName}` : 'Total spent'} · ${rangeEn}`;
  rollFigure($('boardTotal'), moneyRound(s.total));

  const lastMonthName = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
  $('bMonth').textContent = moneyRound(s.thisMonth);
  $('bMonthDelta').innerHTML = monthDelta(s, lastMonthName);
  $('bCount').textContent = int.format(s.count);
  $('bAvg').textContent = s.count ? `avg ${moneyRound(s.average)}` : '—';
  $('bLargest').textContent = s.largest ? moneyRound(s.largest.amount) : '—';
  $('bLargestTitle').textContent = s.largest ? s.largest.title : 'No entries';

  // Finding: the change against last month, then the line that carries most
  $('finding').innerHTML = findingSentence(s, cats);

  renderRoute(cats);

  // Daily / monthly bars, with the biggest bucket annotated by its largest entry
  const unit = trend.unit;
  $('trendTitle').textContent = unit === 'month' ? 'Monthly spending' : 'Daily spending';
  $('trendMeta').textContent = rangeEn;
  const points = trend.points;
  let annotate = null;
  if (points.some((p) => p.total > 0)) {
    const maxI = points.reduce((best, p, i) => (p.total > points[best].total ? i : best), 0);
    const key = points[maxI].key;
    const top = expenses
      .filter((e) => e.date.slice(0, key.length) === key)
      .sort((a, b) => b.amount - a.amount)[0];
    if (top) annotate = { index: maxI, text: `${moneyRound(points[maxI].total)} · ${top.title}` };
  }
  drawBars($('trendChart'), {
    points,
    color: catName ? lineColor(catName) : INK,
    annotate,
    grow: true,
    tick: (p) => trendTick(p.key, unit),
    tip: (p) => `${trendTipLabel(p.key, unit)} · <b>${moneyRound(p.total)}</b> · ${pluralize(p.count, 'entry', 'entries')}`,
    aria: `${unit === 'month' ? 'Monthly' : 'Daily'} spending, ${rangeEn}`,
    empty: `No spending in ${rangeEn.toLowerCase()}`,
  });

  // Recent timetable
  const recent = expenses.slice(0, 5);
  $('recentBody').innerHTML = recent.length
    ? recent
        .map(
          (e) => `<tr>
        <td class="date">${dayLabel(e.date.slice(0, 10))}</td>
        <td class="entry"><span>${escapeHtml(e.title)}</span></td>
        <td><span class="line-cell">${bullet(e.category)}${e.category}</span></td>
        <td class="num">${money(e.amount)}</td>
      </tr>`
        )
        .join('')
    : `<tr class="empty-row"><td colspan="4"><strong>No entries yet</strong>Add your first expense with the button at the top right, or press N.</td></tr>`;
}

function monthDelta(s, lastMonthName) {
  if (!s.lastMonth) return `<span>no ${lastMonthName} entries</span>`;
  const pct = ((s.thisMonth - s.lastMonth) / s.lastMonth) * 100;
  if (Math.abs(pct) < 0.5) return `same as ${lastMonthName}`;
  const cls = pct > 0 ? 'neg' : 'pos';
  return `<span class="${cls}">${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(0)}%</span> vs ${lastMonthName}`;
}

function findingSentence(s, cats) {
  const parts = [];
  const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString('en-IN', { month: 'long' });
  const subject = state.category === 'All' ? 'Spending' : `${state.category} spending`;
  if (s.lastMonth > 0) {
    const pct = ((s.thisMonth - s.lastMonth) / s.lastMonth) * 100;
    if (Math.abs(pct) >= 0.5) {
      const up = pct > 0;
      parts.push(`${subject} this month is <span class="${up ? 'neg' : 'pos'}">${Math.abs(pct).toFixed(0)}% ${up ? 'above' : 'below'}</span> ${lastMonth} (${moneyRound(s.lastMonth)}).`);
    } else {
      parts.push(`${subject} this month matches ${lastMonth}.`);
    }
  }
  const total = cats.reduce((a, c) => a + c.total, 0);
  if (cats.length && state.category === 'All') {
    parts.push(`${cats[0].category} carries ${cats[0].percent.toFixed(0)}% of the ${RANGE_EN[state.range].toLowerCase()}.`);
  } else if (state.category !== 'All' && total) {
    const mine = cats.find((c) => c.category === state.category);
    parts.push(`That is ${mine ? mine.percent.toFixed(0) : 0}% of all spending in the ${RANGE_EN[state.range].toLowerCase()}.`);
  }
  return parts.join(' ') || 'No spending recorded yet.';
}

// Shrink the board figure only when a large total (₹12,34,567) would overflow the board
function fitFigure(el) {
  el.style.fontSize = '';
  if (el.scrollWidth > el.clientWidth) {
    const size = parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = `${Math.floor(size * (el.clientWidth / el.scrollWidth) * 0.98)}px`;
  }
}

// The signature: board characters flip over like a split-flap station board.
// Characters are matched from the right, so ₹9,800 → ₹10,200 flips only what changed.
function rollFigure(el, text) {
  const prev = el.dataset.text || '';
  el.dataset.text = text;
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text].map((ch) => `<span class="d" aria-hidden="true">${ch}</span>`).join('');
  fitFigure(el);
  if (prev === text || reduceMotion()) return;
  const spans = [...el.children];
  const prevChars = prev === '₹—' ? [] : [...prev];
  spans.forEach((span, i) => {
    const old = prevChars[prevChars.length - spans.length + i] ?? ' ';
    if (old !== span.textContent) flipChar(span, old, i * 45);
  });
}

function flipChar(span, oldCh, delay) {
  const newCh = span.textContent;
  const flap = (cls, ch) => {
    const f = document.createElement('span');
    f.className = `flap ${cls}`;
    f.textContent = ch;
    span.appendChild(f);
    return f;
  };
  // Old bottom half stays put until the new bottom flap lands on it
  const under = flap('flap-under', oldCh);
  const top = flap('flap-top', oldCh);
  const bottom = flap('flap-bottom', newCh);
  const p = `perspective(${Math.round(span.offsetHeight * 4)}px)`;
  top.animate(
    [
      { transform: `${p} rotateX(0deg)`, backgroundColor: '#f6c400' },
      { transform: `${p} rotateX(-90deg)`, backgroundColor: '#c29b00' },
    ],
    { duration: 160, delay, easing: 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'forwards' }
  );
  bottom.animate(
    [
      { transform: `${p} rotateX(90deg)`, backgroundColor: '#c29b00' },
      { transform: `${p} rotateX(0deg)`, backgroundColor: '#f6c400' },
    ],
    { duration: 260, delay: delay + 160, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', fill: 'backwards' }
  ).onfinish = () => [under, top, bottom].forEach((f) => f.remove());
}

// ---------- Depth (3D motion) ----------
// The board turns a few degrees toward the pointer; the coin above it shifts with parallax
function bindBoardTilt() {
  const board = document.querySelector('.board');
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  board.addEventListener('pointermove', (e) => {
    if (reduceMotion()) return;
    const r = board.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    board.classList.add('tilting');
    board.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
    board.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
    board.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
    board.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
  });
  board.addEventListener('pointerleave', () => {
    board.classList.remove('tilting');
    board.style.setProperty('--rx', '0deg');
    board.style.setProperty('--ry', '0deg');
  });
}

// Panels of a newly opened screen swing up into place, one after another
function enterView(viewEl) {
  if (reduceMotion()) return;
  [...viewEl.children].forEach((el, i) =>
    el.animate(
      [
        { opacity: 0, transform: 'perspective(1400px) translateY(24px) rotateX(9deg)', transformOrigin: '50% 0' },
        { opacity: 1, transform: 'perspective(1400px) translateY(0) rotateX(0deg)', transformOrigin: '50% 0' },
      ],
      { duration: 560, delay: i * 70, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' }
    )
  );
}

// A saved expense flips the ₹ mark and sends the board's coin up for a spin
function celebrateSave() {
  if (reduceMotion()) return;
  document.querySelector('.mark').animate(
    [{ transform: 'perspective(200px) rotateY(0deg)' }, { transform: 'perspective(200px) rotateY(360deg)' }],
    { duration: 700, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
  );
  $('boardCoin').animate(
    [
      { transform: 'translateY(0) rotateY(0deg)' },
      { transform: 'translateY(-34px) rotateY(540deg)', offset: 0.5, easing: 'ease-in' },
      { transform: 'translateY(0) rotateY(1080deg)' },
    ],
    { duration: 950, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
  );
}

function renderRoute(cats) {
  const route = $('route');
  const max = cats.length ? cats[0].total : 0;
  $('linesMeta').textContent = cats.length ? `${cats.length} of ${state.categories.length} lines` : '';
  route.classList.toggle('filtered', state.category !== 'All');
  route.innerHTML = cats.length
    ? cats
        .map((c) => {
          const w = max ? Math.max(4, (c.total / max) * 100) : 0;
          return `<li><button type="button" class="route-row ${state.category === c.category ? 'on' : ''}" data-category="${c.category}"
            style="--c:${lineColor(c.category)}; --w:${w}%" aria-pressed="${state.category === c.category}"
            aria-label="${c.category}: ${moneyRound(c.total)}, ${c.percent.toFixed(0)} percent. Filter by this line.">
            <span class="name">${c.category}<small>${pluralize(c.count, 'entry', 'entries')}</small></span>
            <span class="track"></span>
            <span class="amt">${moneyRound(c.total)}<small>${c.percent.toFixed(0)}%</small></span>
          </button></li>`;
        })
        .join('')
    : '<li class="meta">No spending in this range.</li>';
}

// ---------- Charts (SVG) ----------
function niceScale(max, ticks = 4) {
  if (max <= 0) return { step: 1, top: 4 };
  const raw = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  let top = Math.ceil(max / step) * step;
  if (top === max) top += step; // keep the tallest bar off the plot's top edge
  return { step, top };
}

function drawBars(el, cfg) {
  el._cfg = cfg;
  const { points, color, annotate } = cfg;
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (!w || !h) return;
  if (!points.length || !points.some((p) => p.total > 0)) {
    el.innerHTML = `<div class="chart-empty">${escapeHtml(cfg.empty)}</div>`;
    return;
  }
  const top = annotate ? 30 : 8;
  const bottom = 24;
  const left = 50;
  const right = 2;
  const ih = h - top - bottom;
  const iw = w - left - right;
  const max = Math.max(...points.map((p) => p.total));
  const scale = niceScale(max, h < 240 ? 3 : 4);
  const y = (v) => top + ih - (v / scale.top) * ih;
  const band = iw / points.length;
  const bw = Math.max(2, Math.min(40, band * 0.66));

  let s = `<svg class="${cfg.grow ? 'grow' : ''}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeHtml(cfg.aria)}"><g class="grid">`;
  for (let v = scale.step; v <= scale.top + 1e-6; v += scale.step) {
    s += `<line x1="${left}" x2="${w - right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`;
  }
  s += '</g>';
  for (let v = 0; v <= scale.top + 1e-6; v += scale.step) {
    s += `<text x="${left - 10}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${axisMoney(v)}</text>`;
  }
  points.forEach((p, i) => {
    if (p.total <= 0) return;
    const x = left + i * band + (band - bw) / 2;
    s += `<rect class="bar" data-i="${i}" style="animation-delay:${Math.min(i * 14, 420)}ms" x="${x.toFixed(1)}" y="${y(p.total).toFixed(1)}" width="${bw.toFixed(1)}" height="${(top + ih - y(p.total)).toFixed(1)}" fill="${color}"/>`;
  });
  s += `<line class="base" x1="${left}" x2="${w - right}" y1="${top + ih + 0.5}" y2="${top + ih + 0.5}"/>`;

  // X labels on one step, never rotated
  const maxLabels = Math.max(2, Math.floor(iw / 72));
  const every = Math.ceil(points.length / maxLabels);
  points.forEach((p, i) => {
    if (i % every) return;
    const cx = left + i * band + band / 2;
    s += `<text x="${cx.toFixed(1)}" y="${h - 5}" text-anchor="middle">${cfg.tick(p)}</text>`;
  });

  if (annotate) {
    const p = points[annotate.index];
    const cx = left + annotate.index * band + band / 2;
    const nearRight = cx > left + iw * 0.62;
    s += `<line class="leader" x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="6" y2="${(y(p.total) - 3).toFixed(1)}"/>`;
    s += `<text class="note" x="${(nearRight ? cx - 7 : cx + 7).toFixed(1)}" y="16" text-anchor="${nearRight ? 'end' : 'start'}">${escapeHtml(annotate.text)}</text>`;
  }
  s += '</svg>';
  el.innerHTML = s;
  el._geom = { left, band, n: points.length };
  cfg.grow = false; // grow once per data load; later redraws (resize) are still
}

function bindChartHover(el) {
  const tip = $('tip');
  el.addEventListener('pointermove', (e) => {
    const cfg = el._cfg;
    const g = el._geom;
    if (!cfg || !g) return;
    const rect = el.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - g.left) / g.band);
    const p = cfg.points[i];
    if (!p) return hideTip(el);
    el.classList.add('hovering');
    el.querySelectorAll('.bar').forEach((b) => b.classList.toggle('hot', +b.dataset.i === i));
    tip.innerHTML = cfg.tip(p);
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.min(window.innerWidth - tw - 8, Math.max(8, e.clientX - tw / 2))}px`;
    tip.style.top = `${rect.top + 4}px`;
  });
  el.addEventListener('pointerleave', () => hideTip(el));
}
function hideTip(el) {
  $('tip').hidden = true;
  el.classList.remove('hovering');
  el.querySelectorAll('.bar.hot').forEach((b) => b.classList.remove('hot'));
}

function trendTick(key, unit) {
  if (unit === 'month') {
    const d = new Date(`${key}-01T00:00:00Z`);
    return d.toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'short', ...(d.getUTCMonth() === 0 ? { year: '2-digit' } : {}) });
  }
  return fmtUTC(`${key}T00:00:00Z`, { day: 'numeric', month: 'short' });
}
function trendTipLabel(key, unit) {
  if (unit === 'month') return new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  return fmtUTC(`${key}T00:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' });
}

// ---------- Transactions ----------
function renderTransactions(summary) {
  const all = state.expenses;
  const rows = all.slice(0, state.visible);
  const scope = [RANGE_EN[state.range]];
  if (state.category !== 'All') scope.unshift(state.category);
  if (state.search) scope.push(`matching “${state.search}”`);
  $('finding').textContent = `${pluralize(all.length, 'entry', 'entries')}, ${moneyRound(summary.total)} in total · ${scope.join(' · ')}`;
  $('txMeta').textContent = all.length ? `Showing ${int.format(rows.length)} of ${int.format(all.length)}` : '';

  $('sortSelect').value = `${state.sort}:${state.order}`;
  document.querySelector('.tt-full').classList.toggle('grouped', state.sort === 'date');

  if (!all.length) {
    const filtered = state.search || state.category !== 'All' || state.range !== 'all';
    $('txBody').innerHTML = `<tr class="empty-row"><td colspan="5"><strong>${filtered ? 'Nothing matches' : 'No entries yet'}</strong>${
      filtered ? 'Try a wider date range, another line, or a different search.' : 'Add your first expense with the button at the top right, or press N.'
    }</td></tr>`;
    $('txMore').innerHTML = '';
    return;
  }

  let html = '';
  if (state.sort === 'date') {
    // Group by day with a day total, like a timetable split by date
    const dayTotals = new Map();
    for (const e of all) {
      const k = e.date.slice(0, 10);
      dayTotals.set(k, (dayTotals.get(k) || 0) + e.amount);
    }
    let lastKey = null;
    for (const e of rows) {
      const k = e.date.slice(0, 10);
      if (k !== lastKey) {
        html += `<tr class="day-row"><td colspan="2">${fmtUTC(e.date, { weekday: 'long', day: 'numeric', month: 'long' })}${k === isoDay() ? ' · Today' : ''}</td><td class="num">${money(dayTotals.get(k))}</td><td></td></tr>`;
        lastKey = k;
      }
      html += txRow(e);
    }
  } else {
    html = rows.map(txRow).join('');
  }
  $('txBody').innerHTML = html;

  const remaining = all.length - rows.length;
  $('txMore').innerHTML = remaining > 0
    ? `<button type="button" class="btn-ghost" data-action="more">Show ${Math.min(remaining, PAGE_SIZE)} more</button><span>${int.format(remaining)} left</span>`
    : `<span>End of list · ${pluralize(all.length, 'entry', 'entries')}</span>`;
}

function txRow(e) {
  const note = e.note ? `<span class="note">${escapeHtml(e.note)}</span>` : '';
  return `<tr data-id="${e._id}">
    <td class="date">${fmtUTC(e.date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
    <td class="entry"><span>${escapeHtml(e.title)}</span>${note}</td>
    <td class="line"><span class="line-cell">${bullet(e.category)}${e.category}</span></td>
    <td class="num">${money(e.amount)}</td>
    <td class="act"><div class="row-actions">
      <button type="button" class="icon-btn" data-action="edit" aria-label="Edit ${escapeHtml(e.title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg></button>
      <button type="button" class="icon-btn danger" data-action="delete" aria-label="Delete ${escapeHtml(e.title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
    </div></td>
  </tr>`;
}

async function deleteExpense(id, rowEl) {
  const expense = state.expenses.find((e) => e._id === id);
  if (!expense) return;
  rowEl?.classList.add('removing');
  try {
    await api(`/api/expenses/${id}`, { method: 'DELETE' });
    toast(`Deleted “${expense.title}”`, {
      action: 'Undo',
      onAction: async () => {
        const { title, amount, category, date, note } = expense;
        await api('/api/expenses', { method: 'POST', body: JSON.stringify({ title, amount, category, date: date.slice(0, 10), note }) });
        toast('Restored');
        load({ keepPage: true });
      },
    });
    load({ keepPage: true });
  } catch (err) {
    rowEl?.classList.remove('removing');
    toast(err.message, { error: true });
  }
}

// ---------- Analytics ----------
function renderAnalytics(cats, months, weekdays, pipeline) {
  const total = cats.reduce((a, c) => a + c.total, 0);
  const count = cats.reduce((a, c) => a + c.count, 0);
  const catName = state.category === 'All' ? null : state.category;

  drawBars($('monthChart'), {
    points: months.points,
    color: catName ? lineColor(catName) : INK,
    annotate: null,
    grow: true,
    tick: (p) => trendTick(p.key, months.unit),
    tip: (p) => `${trendTipLabel(p.key, months.unit)} · <b>${moneyRound(p.total)}</b> · ${pluralize(p.count, 'entry', 'entries')}`,
    aria: `Spending by ${months.unit}, all time`,
    empty: 'No spending recorded yet',
  });

  // Weekday: grey bars, the busiest day in ink (or the line's colour)
  const wMax = Math.max(...weekdays.map((d) => d.total), 0);
  const busiest = weekdays.reduce((b, d) => (d.total > b.total ? d : b), weekdays[0]);
  $('weekdayMeta').textContent = RANGE_EN[state.range];
  $('weekdayList').innerHTML = weekdays
    .map(
      (d) => `<li class="${wMax && d === busiest ? 'top' : ''}" style="--c:${catName ? lineColor(catName) : INK}">
        <span>${d.day}</span>
        <span class="bar-track"><span style="width:${wMax ? (d.total / wMax) * 100 : 0}%; background:${wMax && d === busiest ? '' : '#a5a8a1'}"></span></span>
        <span class="v">${d.total ? moneyRound(d.total) : '₹0'}</span>
      </li>`
    )
    .join('');

  // Category table: the $group output, row for row
  $('catMeta').textContent = RANGE_EN[state.range];
  $('catBody').innerHTML = cats.length
    ? cats
        .map(
          (c) => `<tr data-category="${c.category}" style="cursor:pointer">
        <td><span class="line-cell">${bullet(c.category)}${c.category}</span></td>
        <td class="num">${int.format(c.count)}</td>
        <td class="num">${moneyRound(c.average)}</td>
        <td class="num">${moneyRound(c.total)}</td>
        <td class="share"><div class="share-cell"><span class="share-bar"><span style="--c:${lineColor(c.category)}; width:${c.percent}%"></span></span><small>${c.percent.toFixed(0)}%</small></div></td>
      </tr>`
        )
        .join('') +
      `<tr class="foot"><td><strong>All lines</strong></td><td class="num">${int.format(count)}</td><td class="num">${count ? moneyRound(total / count) : '—'}</td><td class="num">${moneyRound(total)}</td><td></td></tr>`
    : `<tr class="empty-row"><td colspan="5"><strong>No spending in this range</strong>Pick a wider range above.</td></tr>`;

  $('pipelineCode').innerHTML = highlightJson(JSON.stringify(pipeline, null, 2));

  $('finding').innerHTML = busiest && busiest.total
    ? `${dayName(busiest.day)} is the costliest day of the week: ${moneyRound(busiest.total)} across ${pluralize(busiest.count, 'entry', 'entries')} in the ${RANGE_EN[state.range].toLowerCase()}.`
    : 'No spending in this range.';
}

const dayName = (short) => ({ Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' })[short];

function highlightJson(json) {
  return escapeHtml(json)
    .replace(/&quot;(\$\w+)&quot;/g, '<span class="k">&quot;$1&quot;</span>')
    .replace(/: &quot;([^&]*)&quot;/g, ': <span class="s">&quot;$1&quot;</span>');
}

// ---------- Line filter (rail) ----------
function renderLineFilter() {
  const items = ['All', ...state.categories];
  $('lineFilter').innerHTML = items
    .map((c) => {
      const color = c === 'All' ? '#f6c400' : lineColor(c);
      return `<li><button type="button" class="line-btn" data-category="${c}" aria-pressed="${state.category === c}">
        <span class="bullet" style="--c:${color}"></span>${c === 'All' ? 'All lines' : c}
      </button></li>`;
    })
    .join('');
}

function setCategory(cat) {
  state.category = state.category === cat && cat !== 'All' ? 'All' : cat;
  renderLineFilter();
  load();
}

// ---------- Drawer (add / edit) ----------
function renderLinePick() {
  $('linePick').innerHTML = state.categories
    .map(
      (c) => `<div class="line-opt">
      <input type="radio" name="line" id="line-${c}" value="${c}" />
      <label for="line-${c}">${bullet(c)}${c}</label>
    </div>`
    )
    .join('');
}

function openDrawer(expense = null, { instant = false } = {}) {
  const drawer = $('drawer');
  state.editingId = expense ? expense._id : null;
  $('drawerTitle').textContent = expense ? 'Edit expense' : 'New expense';
  $('saveBtn').textContent = expense ? 'Save changes' : 'Save expense';
  $('fAmount').value = expense ? expense.amount : '';
  $('fTitle').value = expense ? expense.title : '';
  $('fDate').value = expense ? expense.date.slice(0, 10) : isoDay();
  $('fNote').value = expense ? expense.note || '' : '';
  const line = expense ? expense.category : state.category !== 'All' ? state.category : 'Food';
  document.querySelectorAll('#linePick input').forEach((r) => (r.checked = r.value === line));
  $('formError').textContent = '';
  drawer.classList.toggle('instant', instant);
  drawer.classList.remove('closing');
  drawer.showModal();
  $('fAmount').focus();
}

function closeDrawer({ instant = false } = {}) {
  const drawer = $('drawer');
  if (!drawer.open || drawer.classList.contains('closing')) return;
  if (instant || reduceMotion()) {
    drawer.close();
    return;
  }
  drawer.classList.remove('instant');
  drawer.classList.add('closing');
  setTimeout(() => {
    drawer.close();
    drawer.classList.remove('closing');
  }, 200);
}

async function submitForm(evt) {
  evt.preventDefault();
  const checked = document.querySelector('#linePick input:checked');
  const payload = {
    amount: parseFloat($('fAmount').value),
    title: $('fTitle').value.trim(),
    category: checked ? checked.value : '',
    date: $('fDate').value,
    note: $('fNote').value.trim(),
  };
  const error =
    !(payload.amount > 0) ? 'Enter an amount above ₹0.'
    : !payload.title ? 'Say what it was for, e.g. “Groceries”.'
    : !payload.category ? 'Pick the line it belongs to.'
    : !payload.date ? 'Pick the date you spent it.'
    : '';
  if (error) {
    $('formError').textContent = error;
    return;
  }
  const btn = $('saveBtn');
  btn.disabled = true;
  try {
    if (state.editingId) {
      await api(`/api/expenses/${state.editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Expense updated');
    } else {
      await api('/api/expenses', { method: 'POST', body: JSON.stringify(payload) });
      toast(`Added ${money(payload.amount)} · ${payload.title}`);
    }
    closeDrawer();
    celebrateSave();
    load({ keepPage: true });
  } catch (err) {
    $('formError').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

// ---------- Toasts ----------
function toast(message, { error = false, action, onAction } = {}) {
  const el = document.createElement('div');
  el.className = `toast${error ? ' error' : ''}`;
  el.innerHTML = `<span>${escapeHtml(message)}</span>`;
  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 180);
  };
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action;
    btn.onclick = () => {
      dismiss();
      Promise.resolve(onAction()).catch((err) => toast(err.message, { error: true }));
    };
    el.appendChild(btn);
  }
  $('toasts').appendChild(el);
  const ms = action ? 6000 : 3000;
  timer = setTimeout(dismiss, ms);
  // Pause while hovered so an Undo is never missed
  el.addEventListener('pointerenter', () => clearTimeout(timer));
  el.addEventListener('pointerleave', () => (timer = setTimeout(dismiss, 1500)));
}

// ---------- PWA ----------
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    $('installBtn').hidden = false;
  });
  $('installBtn').addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    $('installBtn').hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    $('installBtn').hidden = true;
    toast('Ledger is installed');
  });
  const syncNet = () => {
    $('netStatus').hidden = navigator.onLine;
    if (!navigator.onLine) toast('You are offline. Showing the last saved data.');
  };
  window.addEventListener('online', () => { syncNet(); load(); });
  window.addEventListener('offline', syncNet);
  if (!navigator.onLine) syncNet();
}

// ---------- Events ----------
function bindEvents() {
  window.addEventListener('hashchange', () => setView(viewFromHash()));

  $('addBtn').addEventListener('click', () => openDrawer());
  $('tabAdd').addEventListener('click', () => openDrawer());
  $('drawerClose').addEventListener('click', () => closeDrawer());
  $('drawerCancel').addEventListener('click', () => closeDrawer());
  $('drawer').addEventListener('cancel', (e) => {
    e.preventDefault();
    closeDrawer({ instant: true }); // Esc is a keyboard action: no animation
  });
  $('drawer').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDrawer(); // click on the backdrop
  });
  $('expenseForm').addEventListener('submit', submitForm);

  $('rangeTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-range]');
    if (!b) return;
    applyRange(b.dataset.range);
    load();
  });
  $('rangeSelect').addEventListener('change', (e) => {
    applyRange(e.target.value);
    load();
  });
  const onDate = () => {
    state.from = $('fromDate').value;
    state.to = $('toDate').value;
    state.range = state.from || state.to ? 'custom' : 'all';
    syncRangeUI();
    load();
  };
  $('fromDate').addEventListener('change', onDate);
  $('toDate').addEventListener('change', onDate);

  $('lineFilter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-category]');
    if (b) setCategory(b.dataset.category);
  });
  $('route').addEventListener('click', (e) => {
    const b = e.target.closest('[data-category]');
    if (b) setCategory(b.dataset.category);
  });
  $('catBody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-category]');
    if (tr) setCategory(tr.dataset.category);
  });

  let searchTimer;
  $('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      load();
    }, 220);
  });

  $('sortSelect').addEventListener('change', (e) => {
    [state.sort, state.order] = e.target.value.split(':');
    load();
  });

  $('txBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const expense = state.expenses.find((x) => x._id === row.dataset.id);
    if (btn?.dataset.action === 'delete') return deleteExpense(row.dataset.id, row);
    if (btn?.dataset.action === 'edit' || !btn) openDrawer(expense);
  });
  $('txMore').addEventListener('click', (e) => {
    if (e.target.closest('[data-action="more"]')) {
      state.visible += PAGE_SIZE;
      renderTransactions({ total: state.expenses.reduce((a, x) => a + x.amount, 0) });
    }
  });

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (typing || $('drawer').open || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      openDrawer(null, { instant: true }); // keyboard-opened: no animation
    }
  });

  bindBoardTilt();
  new ResizeObserver(() => fitFigure($('boardTotal'))).observe($('boardTotal').parentElement);
  for (const id of ['trendChart', 'monthChart']) {
    const el = $(id);
    bindChartHover(el);
    new ResizeObserver(() => el._cfg && drawBars(el, el._cfg)).observe(el);
  }
}

// ---------- Boot ----------
async function init() {
  bindEvents();
  renderLinePick();
  try {
    state.categories = await api('/api/categories');
  } catch {
    /* fall back to the built-in list */
  }
  renderLineFilter();
  applyRange('30d');
  setupPWA();
  setView(viewFromHash());
  if (new URLSearchParams(location.search).get('add') === '1') {
    history.replaceState(null, '', location.pathname + location.hash);
    openDrawer(null, { instant: true });
  }
}

init();
