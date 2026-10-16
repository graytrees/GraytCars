// Small shared UI pieces: icons, car art, odometer drums, shift-light bars, sheets, toasts.
import { km } from './calc.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ico = (n, cls = '') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

/* ---------- per-device preferences ---------- */
const PKEY = 'gc-prefs';
export const prefs = (() => { try { return { fs: 1.08, theme: 'auto', unit: 'l100', ...JSON.parse(localStorage.getItem(PKEY) || '{}') }; } catch (e) { return { fs: 1.08, theme: 'auto', unit: 'l100' }; } })();
export function setPref(k, v) { prefs[k] = v; try { localStorage.setItem(PKEY, JSON.stringify(prefs)); } catch (e) {} applyPrefs(); }
export function applyPrefs() {
  document.documentElement.style.setProperty('--fs', prefs.fs);
  if (prefs.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', prefs.theme);
}
/** fuel economy in the chosen unit */
export const econ = v => v == null ? '–' : prefs.unit === 'kml' ? (100 / v).toFixed(1) : v.toFixed(1);
export const econUnit = () => prefs.unit === 'kml' ? 'km/L' : 'L/100km';

/* ---------- car art: their photo, or a generic outline until one is added ---------- */
const SHAPES = {
  coupe: `<svg viewBox="0 0 240 90" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M8 66v-8c0-6 4-9 12-11l34-7 30-16c6-3 12-4 19-4h38c9 0 16 3 22 9l15 13 28 5c12 2 18 6 20 13l2 6v6h-14"/><path d="M48 66h96M194 66h-6"/><path d="M60 40h118l-22-17c-4-3-8-4-14-4h-37c-6 0-11 1-16 4z"/><circle cx="38" cy="66" r="15"/><circle cx="168" cy="66" r="15"/><circle cx="38" cy="66" r="6"/><circle cx="168" cy="66" r="6"/></svg>`,
  suv: `<svg viewBox="0 0 240 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M8 76V54c0-5 3-8 9-9l26-4 24-24c3-3 7-5 12-5h104c6 0 10 3 12 8l12 30 14 3c6 1 9 5 9 10v13h-16"/><path d="M58 76h106M200 76h-4"/><path d="M50 42h160l-10-24c-1-3-4-4-7-4H80c-4 0-7 1-9 4z"/><path d="M128 14v28"/><circle cx="40" cy="76" r="16"/><circle cx="182" cy="76" r="16"/><circle cx="40" cy="76" r="6"/><circle cx="182" cy="76" r="6"/></svg>`,
};
export const shapeOf = car => car.shape || (/everest|ranger|territory|escape|explorer|bronco|suv|4wd|ute|wagon/i.test(car.name + ' ' + (car.model || '')) ? 'suv' : 'coupe');
export const carArt = car => car.photo ? `<img src="${car.photo}" alt="">` : `<div class="shape">${SHAPES[shapeOf(car)]}</div>`;
export const carThumb = car => car.photo ? `<img src="${car.photo}" alt="">` : SHAPES[shapeOf(car)];
export const carStyle = car => `--car:${car.colour || '#1C5BC4'}`;

/* ---------- odometer drums ---------- */
export function drums(odo) {
  const s = String(Math.round(odo || 0)).padStart(6, '0');
  const lead = s.length - String(Math.round(odo || 0)).length;
  return `<span class="drums" aria-label="${km(odo)} kilometres">${[...s].map((d, i) => `<b class="${i < lead ? 'lead' : ''}" aria-hidden="true">${d}</b>`).join('')}</span>`;
}

/* ---------- progress bar: green → yellow → red as it nears due ---------- */
export function lights(st) {
  if (!st || st.level === 'none') return '';
  if (st.level === 'unknown') return `<span class="meter unknown" aria-hidden="true"></span>`;
  const p = Math.max(2, Math.min(100, Math.round(st.frac * 100)));
  return `<span class="meter ${st.frac >= 1 ? 'over' : ''}" style="--p:${p}%" aria-hidden="true"><i></i></span>`;
}
export const LEVEL_WORD = { red: 'Due now', amber: 'Coming due', green: 'All good', unknown: 'Not recorded', none: 'No reminder' };

/* icons in the style of dashboard warning lights */
export function itemIcon(it) {
  const n = (it.name || '').toLowerCase();
  const rules = [
    [/basic|monthly/, 'basics'], [/pressure/, 'tpms'], [/rotat/, 'rotate'], [/align/, 'align'],
    [/catch ?can|separator/, 'catchcan'], [/water|pre-?filter|fuel filter|drain/, 'water'],
    [/wiper/, 'wiper'], [/brake/, 'brake'], [/coolant|radiator/, 'coolant'], [/light|globe|bulb/, 'lights'],
    [/belt/, 'belt'], [/spark|plug/, 'plug'], [/battery/, 'battery'], [/filter|pollen/, 'filter'],
    [/oil/, 'drop'], [/tyre|tire|wheel/, 'tyre'], [/service/, 'wrench'],
  ];
  for (const [re, ic] of rules) if (re.test(n)) return ic;
  return it.kind === 'check' ? 'gauge' : 'wrench';
}
/** rego in a number-plate style */
export const plate = txt => txt ? `<span class="plate">${esc(txt)}</span>` : '';

/* ---------- sheets (work with the phone's back button) ---------- */
let open = [], skipPop = 0;
window.addEventListener('popstate', () => { if (skipPop) { skipPop--; return; } const s = open.pop(); if (s) s.remove(true); });
export function sheet(html, { full = false, cls = '', style = '', label = '' } = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="sheet ${full ? 'full' : ''} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label)}" style="${style}">${html}</div>`;
  document.getElementById('layer').appendChild(scrim);
  document.body.style.overflow = 'hidden';
  const el = scrim.firstElementChild;
  const entry = {
    el,
    remove(fromPop) {
      scrim.remove(); if (!document.querySelector('.scrim')) document.body.style.overflow = '';
      entry.onclose?.();
      if (!fromPop) { const i = open.indexOf(entry); if (i >= 0) { open.splice(i, 1); skipPop++; history.back(); } }
    },
    close() { entry.remove(false); },
    set(html2) { el.innerHTML = html2; el.scrollTop = 0; },
  };
  scrim.addEventListener('click', e => { if (e.target === scrim) entry.close(); });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') entry.close(); });
  history.pushState({ sheet: open.length + 1 }, '');
  open.push(entry);
  return entry;
}
export const closeAll = () => { while (open.length) open[open.length - 1].close(); };

export function toast(msg, ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* ---------- photos: resize on the phone, pick the paint colour ---------- */
function loadImg(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file); const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; }); }
export async function carPhoto(file) {
  const img = await loadImg(file);
  let max = 1280, q = 0.8, url;
  do {
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    url = c.toDataURL('image/jpeg', q); max -= 200; q -= 0.05;
  } while (url.length > 600000 && max > 500);
  return { url, colour: paintColour(img) };
}
/** The car's paint colour: the most common strong colour in the middle of the photo. Null for white/silver/black cars. */
export function paintColour(img) {
  const c = document.createElement('canvas'); c.width = 60; c.height = 40;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, 60, 40);
  const px = g.getImageData(6, 6, 48, 30).data;
  const bins = Array.from({ length: 24 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i < px.length; i += 4) {
    const [r, gg, b] = [px[i], px[i + 1], px[i + 2]];
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 510, d = (mx - mn) / 255;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (sat < 0.35 || l < 0.12 || l > 0.85) continue;
    let h = mx === r ? ((gg - b) / (mx - mn)) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4;
    h = (h * 60 + 360) % 360;
    const bin = bins[Math.floor(h / 15)], w = sat * sat;
    bin.w += w; bin.r += r * w; bin.g += gg * w; bin.b += b * w;
  }
  // look at each hue with its neighbours (reds sit either side of 0°)
  let best = null;
  for (let i = 0; i < 24; i++) {
    const g3 = [bins[(i + 23) % 24], bins[i], bins[(i + 1) % 24]].reduce((a, b) => ({ w: a.w + b.w, r: a.r + b.r, g: a.g + b.g, b: a.b + b.b }), { w: 0, r: 0, g: 0, b: 0 });
    if (!best || g3.w > best.w) best = g3;
  }
  if (best.w < 15) return null;
  return darkenForText(best.r / best.w, best.g / best.w, best.b / best.w);
}
/** Keep the colour dark enough for white writing on it */
export function darkenForText(r, g, b) {
  const lum = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  for (let k = 1; k > 0.2; k -= 0.04) {
    const R = r * k, G = g * k, B = b * k;
    const L = 0.2126 * lum(R) + 0.7152 * lum(G) + 0.0722 * lum(B);
    if (1.05 / (L + 0.05) >= 4.5) return '#' + [R, G, B].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }
  return '#333333';
}
export const SWATCHES = [['Race Red', '#C8102E'], ['Ford blue', '#1C5BC4'], ['Deep navy', '#1B2F55'], ['Graphite', '#3F4752'], ['Copper orange', '#D4561A'], ['Bronze', '#7A4E22'], ['Forest', '#2F5D3A'], ['Purple', '#5B3A86']];
