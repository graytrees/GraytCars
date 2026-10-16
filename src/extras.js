// Trips, mods, tyres, workshops and "Book it".
import { state, save, saveMeta, remove, newId } from './store.js';
import { live, carOdo, km, niceDate, ymd, addMonths, status, dotDate } from './calc.js';
import { $, $$, esc, ico, sheet, toast, carThumb, carStyle, plate } from './ui.js';
import { TRIP_TYPES, TRIP_LISTS, MOD_CATS, MOD_HINTS } from './catalogue.js';
import { calendarLink } from './calendar-link.js';
import { tripCalendarName } from './config.js';

const cars = () => live(state.cars).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const carOf = id => state.cars.find(c => c.id === id);
const numVal = v => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : null; };
const head = (title, small, car) => `<div class="band ${car ? car.cluster || '' : 'plain'}" ${car ? '' : ''}>${car ? `<div class="ph">${carThumb(car)}</div>` : ''}
  <div class="who"><small>${esc(small)}${car ? plate(car.plate) : ''}</small><strong>${esc(title)}</strong></div><button class="iconbtn x" data-close aria-label="Close">${ico('x')}</button></div>`;
const field = (label, inner, hint = '') => `<label class="field"><span>${label}</span>${inner}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;

/* =============== WORKSHOPS =============== */
export const workshops = () => state.meta.workshops?.list || [];
export function workshopFor(where) {
  const w = (where || '').toLowerCase(); if (!w) return null;
  return workshops().find(x => w.includes(x.name.toLowerCase()) || (x.aka || []).some(a => w.includes(a)) || x.name.toLowerCase().includes(w));
}
export const telHref = p => 'tel:' + String(p || '').replace(/[^0-9+]/g, '');
export const mapHref = w => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${w.name} ${w.address || ''}`);
export const contactBtns = w => w ? `<span class="contact">${w.phone ? `<a class="chipbtn" href="${telHref(w.phone)}">${ico('phone')} Call</a>` : ''}${w.address && !/^online/i.test(w.address) ? `<a class="chipbtn" href="${mapHref(w)}" target="_blank" rel="noopener">${ico('pin')} Directions</a>` : ''}</span>` : '';

export function workshopSheet(id = null) {
  const list = workshops();
  const W = id ? { ...list.find(x => x.id === id) } : { id: newId('w'), name: '', phone: '', address: '', notes: '' };
  const s = sheet(`${head(id ? W.name : 'New workshop', 'Workshop')}
    <div class="form">
      ${field('Name', `<input id="name" value="${esc(W.name)}" placeholder="e.g. Brendale Automotive">`)}
      ${field('Phone', `<input id="phone" inputmode="tel" value="${esc(W.phone)}">`)}
      ${field('Address', `<input id="address" value="${esc(W.address)}">`)}
      ${field('Notes', `<textarea id="notes" rows="2" placeholder="What you use them for, who to ask for">${esc(W.notes)}</textarea>`)}
      ${id ? contactBtns(W) : ''}
    </div>
    <div class="foot">${id ? `<button class="btn danger" data-del style="flex:0 0 auto" aria-label="Delete">${ico('trash')}</button>` : ''}<button class="btn" data-save>${ico('check')} Save</button></div>`, { label: 'Workshop' });
  s.el.onclick = async e => {
    if (e.target.closest('[data-close]')) return s.close();
    if (e.target.closest('[data-del]')) { await saveMeta('workshops', { list: list.filter(x => x.id !== id) }); toast('Workshop removed'); return s.close(); }
    if (!e.target.closest('[data-save]')) return;
    const g = k => $('#' + k, s.el).value.trim();
    Object.assign(W, { name: g('name'), phone: g('phone'), address: g('address'), notes: g('notes') });
    if (!W.name) return toast('Give it a name');
    await saveMeta('workshops', { list: id ? list.map(x => x.id === id ? W : x) : [...list, W] });
    toast('Saved'); s.close();
  };
}

/* =============== BOOK IT =============== */
export function bookSheet(itemId) {
  const it = state.items.find(i => i.id === itemId), car = carOf(it.carId), st = status(it);
  const lastWhere = live(state.logs).filter(l => l.items?.includes(it.id) && l.where).sort((a, b) => b.date.localeCompare(a.date))[0]?.where;
  const suggested = workshopFor(lastWhere);
  const title = `Book ${car.name}: ${it.name}`;
  const due = st.dueDate || addMonths(ymd(), 0);
  const details = `${it.name} for the ${car.name} (${car.plate || ''}). ${st.text}. Odometer ${km(carOdo(car.id).odo)} km.`;
  const text = `${title} – ${st.text}`;
  const ws = workshops();
  const s = sheet(`${head(it.name, 'Book it', car)}
    <div class="form">
      <p style="margin:0">${esc(st.text)}</p>
      <div class="field"><span>Ring the workshop</span><div class="rows panel" style="margin:0">${ws.map(w => `<div class="row"><span class="grow"><span class="t">${esc(w.name)}${w === suggested ? ' <span class="flag ok">Used last time</span>' : ''}</span><span class="s">${esc(w.phone || '')}${w.notes ? ' · ' + esc(w.notes) : ''}</span></span>${w.phone ? `<a class="chipbtn" href="${telHref(w.phone)}">${ico('phone')} Call</a>` : ''}</div>`).join('') || '<p class="muted">Add workshops in Settings.</p>'}</div></div>
      <div class="field"><span>Remind me</span>
        <a class="btn ghost" href="${calendarLink({ title, start: due < ymd() ? ymd() : due, details })}" target="_blank" rel="noopener">${ico('cal')} Add to ${esc(tripCalendarName)}</a>
        <button class="btn ghost" data-share>${ico('list')} Send to TickTick</button>
        <span class="hint">“Send to TickTick” opens your phone's share menu – pick TickTick and it becomes a task.</span></div>
    </div>`, { style: carStyle(car), label: 'Book it' });
  s.el.onclick = async e => {
    if (e.target.closest('[data-close]')) return s.close();
    if (e.target.closest('[data-share]')) {
      try { if (navigator.share) await navigator.share({ title, text }); else { await navigator.clipboard.writeText(text); toast('Copied – paste it into TickTick'); } }
      catch (err) { if (err.name !== 'AbortError') { try { await navigator.clipboard.writeText(text); toast('Copied – paste it into TickTick'); } catch (e2) { toast(text, 6000); } } }
    }
  };
}

/* =============== TRIPS =============== */
export function tripSheet(id = null, preset = {}) {
  const T = id ? JSON.parse(JSON.stringify(state.trips.find(t => t.id === id))) : { id: newId('t'), carId: cars().find(c => c.cluster === 'offroad')?.id || cars()[0]?.id, name: '', type: 'beach', start: ymd(), end: ymd(), pre: {}, post: {}, notes: '', ...preset };
  const s = sheet('', { full: true, label: 'Trip' });
  const form = () => {
    const car = carOf(T.carId), L = TRIP_LISTS[T.type] || TRIP_LISTS.road, started = T.start <= ymd();
    s.el.style.cssText = carStyle(car);
    const tickList = (key, items) => `<div class="ticks">${items.map(x => `<button class="tick" data-tick="${key}|${esc(x)}" aria-pressed="${!!T[key][x]}"><span class="box">${T[key][x] ? ico('check') : ''}</span><span>${esc(x)}</span></button>`).join('')}</div>`;
    const preDone = L.pre.filter(x => T.pre[x]).length;
    s.set(`${head(T.name || 'New trip', `Trip · ${TRIP_TYPES[T.type]}`, car)}
    <div class="form">
      ${field('Where to?', `<input id="name" value="${esc(T.name)}" placeholder="e.g. Rainbow Beach camping">`)}
      <div class="field"><span>Car</span><span class="seg" style="align-self:flex-start">${cars().map(c => `<button class="plain" data-car="${c.id}" aria-pressed="${c.id === T.carId}">${esc(c.name)}</button>`).join('')}</span></div>
      <div class="field"><span>Type</span><span class="seg" style="align-self:flex-start;flex-wrap:wrap">${Object.entries(TRIP_TYPES).map(([k, l]) => `<button class="plain" data-type="${k}" aria-pressed="${k === T.type}">${l}</button>`).join('')}</span>
        <span class="hint">Fill-ups during the trip are tagged automatically${T.type === 'road' ? '' : ' and kept out of your normal average'}.</span></div>
      <div class="pair">${field('From', `<input type="date" id="start" value="${T.start}">`)}${field('To', `<input type="date" id="end" value="${T.end || T.start}">`)}</div>
      <div class="field"><span>Before you go · ${preDone}/${L.pre.length}</span>${tickList('pre', L.pre)}</div>
      ${L.post.length ? `<div class="field"><span>When you're back${started ? '' : ' (after the trip)'}</span>${tickList('post', L.post)}</div>` : ''}
      ${field('Notes', `<textarea id="notes" rows="2" placeholder="Tyre pressures used, what to fix, what to pack next time">${esc(T.notes)}</textarea>`)}
      <a class="btn ghost" href="${calendarLink({ title: T.name || 'Trip', start: T.start, end: T.end, details: `${TRIP_TYPES[T.type]} trip in the ${car?.name || ''}` })}" target="_blank" rel="noopener">${ico('cal')} Add to ${esc(tripCalendarName)}</a>
    </div>
    <div class="foot">${id ? `<button class="btn danger" data-del style="flex:0 0 auto" aria-label="Delete">${ico('trash')}</button>` : ''}<button class="btn paint" data-save>${ico('check')} Save trip</button></div>`);
  };
  const read = () => { const g = k => $('#' + k, s.el); T.name = g('name').value.trim(); T.start = g('start').value || ymd(); T.end = g('end').value || T.start; if (T.end < T.start) T.end = T.start; T.notes = g('notes').value.trim(); };
  s.el.onclick = async e => {
    if (e.target.closest('[data-close]')) return s.close();
    const c = e.target.closest('[data-car]'); if (c) { read(); T.carId = c.dataset.car; return form(); }
    const ty = e.target.closest('[data-type]'); if (ty) { read(); T.type = ty.dataset.type; return form(); }
    const tk = e.target.closest('[data-tick]'); if (tk) { read(); const [k, x] = tk.dataset.tick.split('|'); T[k][x] = !T[k][x]; if (id) save('trips', { id: T.id, [k]: T[k] }); return form(); }
    if (e.target.closest('[data-del]')) { await remove('trips', T.id); toast('Trip removed'); return s.close(); }
    if (!e.target.closest('[data-save]')) return;
    read(); if (!T.name) return toast('Give the trip a name');
    const { revisions, ...rec } = T; await save('trips', rec); toast('Trip saved'); s.close();
  };
  form();
}

/* =============== MODS =============== */
export function modSheet(carId, id = null, preset = {}) {
  const car = carOf(carId);
  const M = id ? { ...state.mods.find(m => m.id === id) } : { id: newId('m'), carId, name: '', category: 'Exterior', brand: '', date: '', odo: '', installer: '', notes: '', removed: false, ...preset };
  const s = sheet('', { full: true, style: carStyle(car), label: 'Mod' });
  const form = () => s.set(`${head(M.name || 'New mod', 'Build sheet', car)}
    <div class="form">
      ${field('What is it?', `<input id="name" value="${esc(M.name)}" placeholder="e.g. Snorkel">`)}
      <div class="field"><span>Category</span><div class="sugg">${MOD_CATS.map(c => `<button data-cat="${esc(c)}" style="${c === M.category ? 'box-shadow:inset 0 0 0 2px var(--car);' : ''}">${esc(c)}</button>`).join('')}</div></div>
      ${field('Brand / part', `<input id="brand" value="${esc(M.brand)}" placeholder="e.g. Safari Armax">`)}
      <div class="pair">${field('Fitted', `<input type="date" id="date" value="${esc(M.date)}">`)}${field('Odometer', `<input id="odo" inputmode="numeric" value="${esc(M.odo ?? '')}">`)}</div>
      ${field('Fitted by', `<input id="installer" value="${esc(M.installer)}" placeholder="Me, or the shop">`)}
      ${field('Notes', `<textarea id="notes" rows="3" placeholder="Specs, warranty, settings, receipts">${esc(M.notes)}</textarea>`)}
      <label class="toggle"><span><b>Removed</b><br><span class="muted" style="font-size:.88em">Keeps it in the history</span></span><input type="checkbox" id="removed" ${M.removed ? 'checked' : ''}></label>
    </div>
    <div class="foot">${id ? `<button class="btn danger" data-del style="flex:0 0 auto" aria-label="Delete">${ico('trash')}</button>` : ''}<button class="btn paint" data-save>${ico('check')} Save</button></div>`);
  const read = () => { const g = k => $('#' + k, s.el); Object.assign(M, { name: g('name').value.trim(), brand: g('brand').value.trim(), date: g('date').value, odo: numVal(g('odo').value), installer: g('installer').value.trim(), notes: g('notes').value.trim(), removed: g('removed').checked }); };
  s.el.onclick = async e => {
    if (e.target.closest('[data-close]')) return s.close();
    const c = e.target.closest('[data-cat]'); if (c) { read(); M.category = c.dataset.cat; return form(); }
    if (e.target.closest('[data-del]')) { await remove('mods', M.id); toast('Mod removed'); return s.close(); }
    if (!e.target.closest('[data-save]')) return;
    read(); if (!M.name) return toast('Name the mod');
    const { revisions, ...rec } = M; await save('mods', rec); toast('Saved'); s.close();
  };
  form();
}
export const modHints = carId => (MOD_HINTS[carId] || []).filter(h => !live(state.mods).some(m => m.carId === carId && m.name.toLowerCase() === h.name.toLowerCase()));

/* =============== TYRES =============== */
export function tyreSheet(carId, id = null) {
  const car = carOf(carId);
  const T = id ? JSON.parse(JSON.stringify(state.tyres.find(t => t.id === id))) : { id: newId('y'), carId, brand: '', model: '', size: '', position: 'all', dot: '', fittedDate: ymd(), fittedOdo: carOdo(carId).odo || '', newTread: '', readings: [], notes: '' };
  const s = sheet('', { full: true, style: carStyle(car), label: 'Tyres' });
  const form = () => s.set(`${head(T.brand ? `${T.brand} ${T.model}` : 'New tyres', 'Tyres', car)}
    <div class="form">
      <div class="pair">${field('Brand', `<input id="brand" value="${esc(T.brand)}" placeholder="e.g. Yokohama">`)}${field('Model', `<input id="model" value="${esc(T.model)}" placeholder="e.g. Geolandar A/T G015">`)}</div>
      <div class="pair">${field('Size', `<input id="size" value="${esc(T.size)}" placeholder="e.g. 275/65R18">`)}${field('Which', `<select id="position">${[['all', 'All four'], ['front', 'Front pair'], ['rear', 'Rear pair']].map(([v, l]) => `<option value="${v}" ${T.position === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
      ${field('DOT date code', `<input id="dot" inputmode="numeric" maxlength="4" value="${esc(T.dot)}" placeholder="e.g. 2423">`, 'The last 4 digits on the sidewall: week then year (2423 = week 24 of 2023). Used for the age warning.')}
      <div class="pair">${field('Fitted', `<input type="date" id="fittedDate" value="${esc(T.fittedDate)}">`)}${field('Odometer', `<input id="fittedOdo" inputmode="numeric" value="${esc(T.fittedOdo ?? '')}">`)}</div>
      ${field('Tread when new (mm)', `<input id="newTread" inputmode="decimal" value="${esc(T.newTread ?? '')}" placeholder="e.g. 12">`, 'From the tyre shop or the maker’s spec. Optional.')}
      <div class="field"><span>Tread readings</span>
        ${(T.readings || []).length ? `<div class="rows panel" style="margin:0">${T.readings.map((r, i) => `<div class="row"><span class="grow"><span class="t">${r.mm} mm</span><span class="s">${niceDate(r.date)} · ${km(r.odo)} km</span></span><button class="iconbtn" data-delread="${i}" aria-label="Remove">${ico('trash')}</button></div>`).join('')}</div>` : ''}
        <div class="pair"><input id="readMm" inputmode="decimal" placeholder="mm (lowest tyre)"><button class="btn ghost small" data-addread>${ico('plus')} Add reading</button></div></div>
      ${field('Notes', `<textarea id="notes" rows="2" placeholder="Pressures you run, where bought, warranty">${esc(T.notes)}</textarea>`)}
      ${id && !T.removedDate ? `<button class="btn ghost" data-retire>Replaced – these tyres are off the car</button>` : ''}
    </div>
    <div class="foot">${id ? `<button class="btn danger" data-del style="flex:0 0 auto" aria-label="Delete">${ico('trash')}</button>` : ''}<button class="btn paint" data-save>${ico('check')} Save</button></div>`);
  const read = () => { const g = k => $('#' + k, s.el); Object.assign(T, { brand: g('brand').value.trim(), model: g('model').value.trim(), size: g('size').value.trim(), position: g('position').value, dot: g('dot').value.trim(), fittedDate: g('fittedDate').value, fittedOdo: numVal(g('fittedOdo').value), newTread: numVal(g('newTread').value), notes: g('notes').value.trim() }); };
  s.el.onclick = async e => {
    if (e.target.closest('[data-close]')) return s.close();
    if (e.target.closest('[data-addread]')) { read(); const mm = numVal($('#readMm', s.el).value); if (!mm) return toast('Enter the tread depth in mm'); T.readings = [...(T.readings || []), { date: ymd(), odo: carOdo(carId).odo, mm }]; return form(); }
    const dr = e.target.closest('[data-delread]'); if (dr) { read(); T.readings.splice(+dr.dataset.delread, 1); return form(); }
    if (e.target.closest('[data-retire]')) { read(); T.removedDate = ymd(); T.removedOdo = carOdo(carId).odo; }
    else if (e.target.closest('[data-del]')) { await remove('tyres', T.id); toast('Removed'); return s.close(); }
    else if (!e.target.closest('[data-save]')) return;
    else read();
    if (T.dot && !dotDate(T.dot)) return toast('DOT code should be 4 digits, like 2423');
    const { revisions, ...rec } = T; await save('tyres', rec); toast(T.removedDate ? 'Marked as replaced' : 'Saved'); s.close();
  };
  form();
}
