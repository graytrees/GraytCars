// Fuel economy over time: one line, the 12-month average as a dashed reference,
// tap or hover any point for the details.
import { prefs, econ, econUnit, esc } from './ui.js';
import { parseDay, niceDate, km, money } from './calc.js';

export function drawEconomy(el, series, avg) {
  if (series.length < 2) { el.innerHTML = `<p class="muted" style="padding:8px 4px">The chart appears after a couple of full-tank fill-ups.</p>`; return; }
  const W = Math.max(280, el.clientWidth || 600), H = 220, P = { l: 40, r: 12, t: 14, b: 26 };
  const val = x => prefs.unit === 'kml' ? 100 / x.l100 : x.l100;
  const xs = series.map(s => parseDay(s.date).getTime()), ys = series.map(val);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.12 || 1; y0 = Math.floor(y0 - pad); y1 = Math.ceil(y1 + pad);
  const X = t => P.l + (t - x0) / (x1 - x0 || 1) * (W - P.l - P.r);
  const Y = v => P.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - P.t - P.b);
  const step = Math.max(1, Math.ceil((y1 - y0) / 4));
  const ticks = []; for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) ticks.push(v);
  const years = []; for (let y = new Date(x0).getFullYear() + 1; y <= new Date(x1).getFullYear(); y++) years.push(y);
  const pts = series.map((s, i) => [X(xs[i]), Y(ys[i])]);
  const avgV = avg == null ? null : prefs.unit === 'kml' ? 100 / avg : avg;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Fuel economy for each fill-up, ${esc(econUnit())}">
    <g class="grid">${ticks.map(v => `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}</g>
    <g class="axis">${ticks.map(v => `<text x="${P.l - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
      ${years.map(y => { const x = X(new Date(y, 0, 1).getTime()); return `<line x1="${x}" x2="${x}" y1="${H - P.b}" y2="${H - P.b + 5}" stroke="var(--line)"/><text x="${x}" y="${H - 6}" text-anchor="middle">${y}</text>`; }).join('')}</g>
    ${avgV != null ? `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(avgV)}" y2="${Y(avgV)}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 5"/>
      <text x="${W - P.r}" y="${Y(avgV) - 6}" text-anchor="end" fill="var(--muted)" style="font:600 13px var(--head)">12-month avg ${econ(avg)}</text>` : ''}
    <polyline fill="none" stroke="var(--chart)" stroke-width="2" stroke-linejoin="round" points="${pts.map(p => p.join(',')).join(' ')}"/>
    ${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--chart)" stroke="var(--panel)" stroke-width="2"/>`).join('')}
    <line class="cross" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" stroke="var(--muted)" stroke-width="1" visibility="hidden"/>
    <circle class="hot" r="7" fill="var(--chart)" stroke="var(--panel)" stroke-width="2" visibility="hidden"/>
    <rect x="${P.l}" y="0" width="${W - P.l - P.r}" height="${H}" fill="transparent" class="hit"/>
  </svg><div class="tip" hidden></div>`;
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), cross = el.querySelector('.cross'), hot = el.querySelector('.hot');
  const show = e => {
    const r = svg.getBoundingClientRect(); const mx = (e.clientX - r.left) * W / r.width;
    let i = 0, d = Infinity; pts.forEach((p, j) => { const dd = Math.abs(p[0] - mx); if (dd < d) { d = dd; i = j; } });
    const s = series[i], [px, py] = pts[i];
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
    hot.setAttribute('cx', px); hot.setAttribute('cy', py); hot.setAttribute('visibility', 'visible');
    tip.hidden = false; tip.style.left = (px * r.width / W) + 'px'; tip.style.top = (py * r.height / H) + 'px';
    tip.innerHTML = `<b>${econ(s.l100)} ${econUnit()}</b><br>${niceDate(s.date)} · ${km(s.dist)} km${s.ppl ? ' · ' + money(s.ppl) + '/L' : ''}`;
  };
  const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); hot.setAttribute('visibility', 'hidden'); };
  const hit = el.querySelector('.hit');
  hit.addEventListener('pointermove', show); hit.addEventListener('pointerdown', show); hit.addEventListener('pointerleave', hide);
}
