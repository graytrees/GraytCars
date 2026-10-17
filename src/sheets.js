// The pop-up screens: fill-up, log work, an item's details, odometer, import, add a car.
// Every one shows the car's photo and paint colour across the top, so it's obvious which car you're on.
import { state, save, saveMany, remove, newId, onChange } from './store.js';
import { live, carOdo, carItems, status, itemHistory, checkReading, economy, economyAlert, fuelStats, activeTrip, km, niceDate, ymd, addMonths } from './calc.js';
import { $, $$, esc, ico, sheet, toast, carThumb, carStyle, lights, itemIcon, econ, econUnit, LEVEL_WORD, plate } from './ui.js';
import { SUGGESTIONS, FILL_TAGS, tagForTrip, TRIP_TYPES } from './catalogue.js';
import { readFiles } from './simplyauto.js';
import { detectStation } from './station.js';
import { bookSheet } from './extras.js';

const cars = () => live(state.cars).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const carOf = id => state.cars.find(c => c.id === id);
const numVal = v => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : null; };

function band(car, kind, { switchable = true, plain = false } = {}) {
  const others = cars().filter(c => c.id !== car.id);
  const other = others[0];
  return `<div class="band ${plain ? 'plain' : car.cluster || ''}">
    <div class="ph">${carThumb(car)}</div>
    <div class="who"><small>${esc(kind)}${plain ? '' : plate(car.plate)}</small><strong>${esc(car.name)}</strong></div>
    ${switchable && other ? `<button class="switch" data-switch="${other.id}" style="--other:${other.colour}" aria-label="Switch to the ${esc(other.name)}"><span class="dot"></span>${esc(other.name)}</button>` : ''}
    <button class="iconbtn x" data-close aria-label="Close">${ico('x')}</button></div>`;
}
const stations = carId => [...new Set(live(state.fills).filter(f => !carId || f.carId === carId).sort((a, b) => b.date.localeCompare(a.date)).map(f => f.station).filter(Boolean))].slice(0, 15);
const places = () => [...new Set(live(state.logs).sort((a, b) => b.date.localeCompare(a.date)).map(l => l.where).filter(Boolean))].slice(0, 15);

/** "Is this the right car?" — shows both cars big. Resolves to 'keep' | 'switch' | 'fix'. */
function rightCar(s, car, warn) {
  return new Promise(resolve => {
    const o = warn.otherCar;
    s.set(`${band(car, 'Check the car', { switchable: false })}<div class="form">
      <div class="warnbox"><h3>Is this the ${esc(car.name)}?</h3><p>${esc(warn.msg)}</p></div>
      <div class="which">
        <button data-pick="keep" style="--c:${car.colour}"><div class="ph">${carThumb(car)}</div><span>Yes, it's the ${esc(car.name)}</span></button>
        ${o ? `<button data-pick="switch" style="--c:${o.colour}"><div class="ph">${carThumb(o)}</div><span>No, it's the ${esc(o.name)}</span></button>` : ''}
      </div>
      <button class="btn ghost" data-pick="fix">${ico('edit')} Fix the reading</button></div>`);
    const prevHandler = s.el.onclick;
    s.el.onclick = e => {
      if (e.target.closest('[data-close]')) { s.el.onclick = prevHandler; return s.close(); }
      const b = e.target.closest('[data-pick]'); if (!b) return;
      s.el.onclick = prevHandler;
      resolve(b.dataset.pick);
    };
  });
}

/* =============== FILL UP =============== */
export function fillSheet(carId, existing = null) {
  let car = carOf(carId);
  const tripTag = cid => { const t = activeTrip(cid); return t ? tagForTrip(t.type) : ''; };
  const f = existing ? { tag: '', ...existing } : { carId, date: ymd(), odo: '', litres: '', full: true, missed: false, station: '', notes: '', lat: null, lng: null, tag: tripTag(carId) };
  let tagTouched = !!existing;
  const s = sheet('', { full: true, style: carStyle(car), label: 'Fill up' });
  let detectMsg = existing ? '' : 'Finding the servo…', typedStation = !!existing;
  const form = () => {
    car = carOf(f.carId);
    s.el.style.cssText = carStyle(car);
    const cur = carOdo(car.id);
    s.set(`${band(car, existing ? 'Edit fill-up' : 'Fill up', { switchable: !existing })}
    <div class="form">
      <label class="field"><span>Odometer (km)</span>
        <input class="big" id="odo" inputmode="numeric" autocomplete="off" value="${esc(f.odo)}" placeholder="${cur.odo ? km(cur.odo) : ''}">
        <span class="hint">${cur.odo ? `Last reading ${km(cur.odo)} km${cur.date ? ', ' + niceDate(cur.date) : ''}` : 'First reading for this car'}</span></label>
      <label class="field"><span>Litres</span><input class="big" id="litres" inputmode="decimal" autocomplete="off" value="${esc(f.litres)}"></label>
      <label class="field"><span>Servo</span><input id="station" list="stations" value="${esc(f.station)}" placeholder="e.g. BP Brendale"><datalist id="stations">${stations().map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        <span class="detect" id="detect">${detectMsg ? ico('pin') + ' ' + esc(detectMsg) : ''}</span></label>
      <label class="toggle"><span><b>Filled to the top</b><br><span class="muted" style="font-size:.88em">Turn off for a part fill</span></span><input type="checkbox" id="full" ${f.full ? 'checked' : ''}></label>
      <div class="field"><span>This tank was</span><span class="seg" style="align-self:flex-start;flex-wrap:wrap">${Object.entries(FILL_TAGS).map(([k, l]) => `<button class="plain" data-tag="${k}" aria-pressed="${(f.tag || '') === k}">${l}</button>`).join('')}</span>
        <span class="hint">${activeTrip(car.id) ? `On a trip: ${esc(activeTrip(car.id).name)}. ` : ''}Towing, 4WD and track tanks are kept out of your normal average.</span></div>
      <details class="extra" ${f.notes || f.missed || existing ? 'open' : ''}><summary>Date and notes</summary>
        <div class="form" style="padding:0">
          <label class="field"><span>Date</span><input type="date" id="date" value="${f.date}" max="${ymd()}"></label>
          <label class="field"><span>Notes</span><textarea id="notes" rows="2">${esc(f.notes)}</textarea></label>
          <label class="toggle"><span><b>I missed logging a fill before this one</b><br><span class="muted" style="font-size:.88em">Skips the economy figure for this fill</span></span><input type="checkbox" id="missed" ${f.missed ? 'checked' : ''}></label>
          ${f.lat != null ? `<a class="more" href="https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lng}" target="_blank" rel="noopener">${ico('pin')} Show on map</a>` : ''}
        </div></details>
      <p class="err" id="err" role="alert"></p>
    </div>
    <div class="foot">${existing ? `<button class="btn danger" data-del style="flex:0 0 auto" aria-label="Delete">${ico('trash')}</button>` : ''}<button class="btn paint" data-save>${ico('fuel')} Save fill-up</button></div>`);
    $('#station', s.el).oninput = () => { typedStation = true; };
    if (!existing) setTimeout(() => $('#odo', s.el)?.focus(), 250);
  };
  const read = () => {
    const g = id => $('#' + id, s.el);
    Object.assign(f, { odo: g('odo').value, litres: g('litres').value, full: g('full').checked,
      date: g('date').value || ymd(), station: g('station').value.trim(), notes: g('notes').value.trim(), missed: g('missed').checked });
  };
  if (!existing) {
    detectStation().then(({ pos, name }) => {
      f.lat = pos.lat; f.lng = pos.lng;
      const el = $('#detect', s.el), inp = $('#station', s.el);
      if (name && inp && !typedStation && !inp.value) { inp.value = name; f.station = name; }
      detectMsg = name ? `Found ${name}` : 'Location saved. Type the servo name.';
      if (el) el.innerHTML = ico('pin') + ' ' + esc(detectMsg);
    }).catch(() => { detectMsg = ''; const el = $('#detect', s.el); if (el) el.textContent = ''; });
  }
  s.el.onclick = async e => {
    if (e.target.closest('[data-close]')) return s.close();
    const sw = e.target.closest('[data-switch]');
    if (sw) { read(); f.carId = sw.dataset.switch; if (!tagTouched) f.tag = tripTag(f.carId); form(); return; }
    const tg = e.target.closest('[data-tag]'); if (tg) { read(); f.tag = tg.dataset.tag; tagTouched = true; form(); return; }
    if (e.target.closest('[data-del]')) { await remove('fills', existing.id); toast('Fill-up moved to the recycle bin'); return s.close(); }
    if (!e.target.closest('[data-save]')) return;
    read();
    const odo = numVal(f.odo), litres = numVal(f.litres);
    const err = m => { $('#err', s.el).textContent = m; };
    if (!odo) return err('Enter the odometer reading.');
    if (!litres) return err('Enter how many litres went in.');
    if (!existing) {
      const warn = checkReading(f.carId, odo, { litres, date: f.date });
      if (warn) {
        const v = await rightCar(s, carOf(f.carId), warn);
        if (v === 'fix') { form(); return; }
        if (v === 'switch') { f.carId = warn.otherCar.id; }
      }
    }
    const rec = { ...(existing || {}), carId: f.carId, date: f.date, odo, litres, full: f.full, missed: f.missed, station: f.station, notes: f.notes, lat: f.lat ?? null, lng: f.lng ?? null, tag: f.tag || '' };
    delete rec.revisions; delete rec.cost;
    const id = await save('fills', rec);
    if (existing) { toast('Fill-up updated'); return s.close(); }
    afterFill(s, f.carId, id);
  };
  form();
  return s;
}

/** After a fill: the economy for this tank, then anything due on this car, each one tap to log. */
function afterFill(s, carId, fillId) {
  const car = carOf(carId);
  s.el.style.cssText = carStyle(car);
  const render = () => {
    const e = economy(carId).find(x => x.id === fillId);
    const st = fuelStats(carId), alert = economyAlert(carId, fillId);
    let cmp = '';
    if (e && st.avgYear && !e.tag && !alert) {
      const d = e.l100 - st.avgYear;
      cmp = Math.abs(d) < 0.3 ? 'Right on your 12-month average' : d < 0 ? `${Math.abs(d).toFixed(1)} L/100km better than your 12-month average` : `${d.toFixed(1)} L/100km more than your 12-month average`;
    }
    const due = carItems(carId).filter(i => i.st.level === 'red' || i.st.level === 'amber' || (i.kind === 'check' && i.st.level === 'unknown'));
    s.set(`${band(car, 'Fill-up saved', { switchable: false })}
      <div class="saved">${e ? `<div class="big">${econ(e.l100)}<small> ${econUnit()}</small></div><div class="muted">${km(e.dist)} km on ${e.litres.toFixed(1)} L</div>${cmp ? `<div class="cmp">${esc(cmp)}</div>` : ''}`
        : `<div class="big" style="font-size:40px">${ico('check')} Saved</div><div class="muted">Economy shows after the next full tank.</div>`}</div>
      <div class="form">
        ${alert ? `<div class="warnbox"><h3>${alert.pct}% thirstier than usual</h3><p style="margin:0">${econ(alert.l100)} against your normal ${econ(alert.avg)} ${econUnit()}. Worth a look: tyre pressures, a dragging brake, extra load or roof gear, or lots of short trips. If it keeps happening, it's time for a check-up.</p></div>` : ''}
        ${e?.tag ? `<p class="muted" style="margin:0">Tagged ${esc(FILL_TAGS[e.tag].toLowerCase())}, so it's kept out of your normal average.${e.tag === 'track' ? ' Ford advises an oil change after each track weekend.' : ''}</p>` : ''}
        ${due.length ? `<h3 class="section-title" style="margin:6px 0 0">While you're at the servo</h3>
          <div class="panel" style="padding:4px 10px">${due.map(i => quickRow(i)).join('')}</div>`
        : `<div class="panel" style="padding:14px 16px"><b style="color:var(--go)">${ico('check')} Nothing due on the ${esc(car.name)}.</b></div>`}
      </div>
      <div class="foot"><button class="btn paint" data-close>Done</button></div>`);
  };
  const off = onChange(() => render());
  s.onclose = () => off();
  s.el.onclick = async e => {
    if (e.target.closest('[data-close]')) return s.close();
    const q = e.target.closest('[data-quick]');
    if (q) { await quickAction(q, carId); }
    const more = e.target.closest('[data-logitem]');
    if (more) logSheet(carId, { items: [more.dataset.logitem] });
  };
  render();
}
function quickRow(i) {
  const isCheck = i.kind === 'check';
  return `<div class="item ${i.st.level}" data-row="${i.id}">
    <span class="badge">${ico(itemIcon(i))}</span><span class="nm">${esc(i.name)}</span>
    <span class="act" style="display:flex;gap:6px">${isCheck
      ? `<button class="chipbtn go" data-quick="ok" data-id="${i.id}">${ico('check')} OK</button><button class="chipbtn warn" data-logitem="${i.id}" aria-label="Needs attention: add a note">${ico('alert')}</button>`
      : `<button class="chipbtn go" data-logitem="${i.id}">${ico('check')} Done</button>`}</span>
    <span class="tx">${esc(i.st.text)}</span>${lights(i.st)}</div>`;
}
async function quickAction(btn, carId) {
  const id = btn.dataset.id;
  const cur = carOdo(carId);
  const it = state.items.find(x => x.id === id);
  const checks = it?.checklist?.length ? { [id]: Object.fromEntries(it.checklist.map(c => [c, 'ok'])) } : {};
  await save('logs', { id: newId('l'), carId, date: ymd(), odo: cur.odo, items: [id], results: { [id]: 'ok' }, checks, title: '', where: '', notes: '' });
  const row = btn.closest('[data-row]');
  row.querySelector('.act').innerHTML = `<span class="chipbtn done">${ico('check')} Logged</span>`;
  row.querySelector('.tx').textContent = 'Checked today';
}

/** Past workshop/service visits for this car (date, odometer, where) – for backdating a job */
function visits(carId) {
  const seen = new Set(), out = [];
  for (const l of live(state.logs).filter(l => l.carId === carId && l.odo).sort((a, b) => b.date.localeCompare(a.date))) {
    if (seen.has(l.date) || !l.where || /^home$/i.test(l.where)) continue;
    seen.add(l.date); out.push({ date: l.date, odo: l.odo, where: l.where });
    if (out.length >= 4) break;
  }
  return out;
}
/** Wash = the car's Wash item, plus Monthly basics if it's due ("do them when I wash it") */
function washDefaults(carId) {
  const wash = live(state.items).find(i => i.carId === carId && i.group === 'care' && /^wash$/i.test(i.name) && !i.hidden);
  const basics = carItems(carId).find(i => i.checklist?.length && /basic/i.test(i.name));
  return [wash?.id, basics && basics.st.level !== 'green' ? basics.id : null].filter(Boolean);
}
export const washSheet = carId => logSheet(carId, { care: true, items: washDefaults(carId) });

const seg = (key, v, short = key.includes('|')) => `<span class="seg"><button class="ok" data-res="${key}" data-v="ok" aria-pressed="${v !== 'attention'}">OK</button><button class="att" data-res="${key}" data-v="attention" aria-pressed="${v === 'attention'}" aria-label="Needs attention">${short ? 'Fix' : 'Needs attention'}</button></span>`;

/* =============== LOG WORK =============== */
export function logSheet(carId, { items = [], log = null, care = false } = {}) {
  let car = carOf(carId);
  const L = log ? { ...log, items: [...(log.items || [])], results: { ...(log.results || {}) }, checks: JSON.parse(JSON.stringify(log.checks || {})) }
    : { carId, date: ymd(), odo: carOdo(carId).odo || '', items: [...items], results: {}, checks: {}, title: '', where: '', notes: '' };
  for (const id of L.items) { const it = state.items.find(x => x.id === id); if (it?.kind === 'check' && !L.results[id]) L.results[id] = 'ok'; }
  if (log && (log.items || []).some(id => state.items.find(x => x.id === id)?.group === 'care')) care = true;
  const s = sheet('', { full: true, style: carStyle(car), label: care ? 'Wash' : 'Log work' });
  let showOther = !!L.title;
  let showAll = !(items.length && !care) || !!log;   // opened from one job: show just that job, so "When" is in view
  const form = () => {
    car = carOf(L.carId); s.el.style.cssText = carStyle(car);
    const list = care ? [...carItems(L.carId, { care: true }).sort((a, b) => /^wash$/i.test(b.name) - /^wash$/i.test(a.name)), ...carItems(L.carId).filter(i => i.checklist?.length)] : carItems(L.carId);
    const sel = list.filter(i => L.items.includes(i.id));
    const checks = sel.filter(i => i.kind === 'check');
    s.set(`${band(car, care ? (log ? 'Edit wash' : 'Wash') : log ? 'Edit work' : 'Log work', { switchable: !log && (!items.length || care) })}
    <div class="form">
      <div class="field"><span>What did you do?</span>
        <div class="picks">${(showAll ? list : sel).map(i => `<button class="pick" data-toggle="${i.id}" aria-pressed="${L.items.includes(i.id)}"><span class="d ${i.st.level}"></span>${esc(i.name)}</button>`).join('')}${showAll ? '' : `<button class="pick" data-showall>${ico('plus')} Add another job</button>`}
          ${showAll ? `<button class="pick" data-other aria-pressed="${showOther}">${ico('plus')} Something else</button>` : ''}</div>
        ${sel.some(i => i.kind === 'service' && i.includes?.length) ? `<span class="hint">A service also ticks the jobs it includes. Untick any that weren't done.</span>` : ''}
      </div>
      <div class="field when"><span>When was it done?</span>
        ${log ? '' : `<div class="sugg">${[{ date: ymd(), odo: carOdo(L.carId).odo, where: '', label: 'Today' }, ...visits(L.carId)].map(v => `<button data-visit="${v.date}|${v.odo}|${esc(v.where)}" style="${L.date === v.date && +L.odo === +v.odo ? 'box-shadow:inset 0 0 0 2px var(--car);' : ''}">${esc(v.label || niceDate(v.date))}<small>${km(v.odo)} km${v.where ? ' · ' + esc(v.where) : ''}</small></button>`).join('')}</div>
        <span class="hint">Done earlier? Pick a past visit, or set the date and odometer below.</span>`}
        <div class="pair">
          <label class="field"><span>Date</span><input type="date" id="date" value="${L.date}" max="${ymd()}" style="min-height:62px"></label>
          <label class="field"><span>Odometer (km)</span><input class="big" id="odo" inputmode="numeric" value="${esc(L.odo)}"></label>
        </div>
        <label class="field"><span>Where</span><input id="where" list="places" value="${esc(L.where)}" placeholder="Home, Brendale Auto…"><datalist id="places">${['Home', ...places()].map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
      </div>
      ${sel.filter(i => i.trackPart).map(i => `<label class="field"><span>${esc(i.name)}: ${i.group === 'care' ? 'product used' : 'brand / part fitted'}</span><input data-part="${i.id}" list="parts-${i.id}" value="${esc((L.parts || {})[i.id] || '')}" placeholder="${i.group === 'care' ? 'e.g. Gyeon Bathe' : 'e.g. Bendix Ultimate 4WD'}"><datalist id="parts-${i.id}">${[...new Set(itemHistory(i).map(l => l.parts?.[i.id]).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist>${i.group === 'care' ? '' : '<span class="hint">So you can see how long each brand lasts.</span>'}</label>`).join('')}
      ${showOther ? `<label class="field"><span>Something else</span><input id="title" value="${esc(L.title)}" placeholder="e.g. Replaced wiper blades"></label>` : ''}
      ${checks.length ? `<div class="field"><span>How was it?</span>${checks.map(i => i.checklist?.length
        ? `<div class="result" style="flex-direction:column;align-items:stretch"><b>${esc(i.name)}</b><div class="subchecks">${i.checklist.map((c, n) => `<div class="result"><b>${esc(c)}</b>${seg(i.id + '|' + n, (L.checks[i.id] || {})[c])}</div>`).join('')}</div></div>`
        : `<div class="result"><b>${esc(i.name)}</b>${seg(i.id, L.results[i.id])}</div>`).join('')}</div>` : ''}
      <label class="field"><span>Notes</span><textarea id="notes" rows="3" placeholder="e.g. Castrol Edge 5W-50, 8.8 L. Front pads about 60%.">${esc(L.notes)}</textarea></label>
      <p class="err" id="err" role="alert"></p>
    </div>
    <div class="foot">${log ? `<button class="btn danger" data-del style="flex:0 0 auto" aria-label="Delete">${ico('trash')}</button>` : ''}<button class="btn paint" data-save>${ico('check')} Save</button></div>`);
  };
  const read = () => {
    const g = id => $('#' + id, s.el);
    L.notes = g('notes').value.trim(); L.odo = g('odo').value; L.date = g('date').value || ymd();
    L.where = g('where').value.trim();
    L.parts = { ...(L.parts || {}) }; $$('[data-part]', s.el).forEach(x => { L.parts[x.dataset.part] = x.value.trim(); });
    if (g('title')) L.title = g('title').value.trim();
  };
  s.el.onclick = async e => {
    if (e.target.closest('[data-close]')) return s.close();
    const sw = e.target.closest('[data-switch]');
    if (sw) { read(); L.carId = sw.dataset.switch; L.items = care ? washDefaults(L.carId) : []; L.results = {}; L.odo = carOdo(L.carId).odo || ''; for (const id of L.items) if (state.items.find(x => x.id === id)?.kind === 'check') L.results[id] = 'ok'; return form(); }
    const t = e.target.closest('[data-toggle]');
    if (t) {
      read(); const id = t.dataset.toggle; const it = state.items.find(x => x.id === id);
      if (L.items.includes(id)) { const drop = new Set([id, ...(it.includes || [])]); L.items = L.items.filter(x => !drop.has(x)); }
      else { L.items.push(id); if (it.kind === 'check') L.results[id] = 'ok'; for (const inc of it.includes || []) if (!L.items.includes(inc) && state.items.some(x => x.id === inc && !x.deleted)) L.items.push(inc); }
      return form();
    }
    if (e.target.closest('[data-other]')) { read(); showOther = !showOther; if (!showOther) L.title = ''; form(); if (showOther) $('#title', s.el)?.focus(); return; }
    if (e.target.closest('[data-showall]')) { read(); showAll = true; return form(); }
    const vb = e.target.closest('[data-visit]');
    if (vb) { read(); const [d, o, w] = vb.dataset.visit.split('|'); L.date = d; L.odo = o; if (w) L.where = w; return form(); }
    const r = e.target.closest('[data-res]');
    if (r) {
      read(); const [id, n] = r.dataset.res.split('|');
      if (n != null) { const it = state.items.find(x => x.id === id); (L.checks[id] ||= {})[it.checklist[+n]] = r.dataset.v; L.results[id] = Object.values(L.checks[id]).includes('attention') ? 'attention' : 'ok'; }
      else L.results[id] = r.dataset.v;
      return form();
    }
    if (e.target.closest('[data-del]')) { await remove('logs', log.id); toast('Entry moved to the recycle bin'); return s.close(); }
    if (!e.target.closest('[data-save]')) return;
    read();
    const odo = numVal(L.odo);
    if (!L.items.length && !L.title) return ($('#err', s.el).textContent = 'Tick what you did, or describe it under "Something else".');
    if (!odo) return ($('#err', s.el).textContent = 'Enter the odometer reading.');
    if (!log && odo > (carOdo(L.carId).odo || 0) + 1) {
      const warn = checkReading(L.carId, odo, { date: L.date });
      if (warn) {
        const v = await rightCar(s, carOf(L.carId), warn);
        if (v === 'fix') return form();
        if (v === 'switch') { toast(`Pick the jobs for the ${warn.otherCar.name}`); L.carId = warn.otherCar.id; L.items = []; L.results = {}; return form(); }
      }
    }
    const results = Object.fromEntries(Object.entries(L.results).filter(([k]) => L.items.includes(k) && state.items.find(x => x.id === k)?.kind === 'check'));
    const checks = {};
    for (const id of L.items) { const it = state.items.find(x => x.id === id); if (it?.checklist?.length) checks[id] = Object.fromEntries(it.checklist.map(c => [c, (L.checks[id] || {})[c] || 'ok'])); }
    const rec = { ...(log || {}), id: log?.id || newId('l'), carId: L.carId, date: L.date, odo, items: L.items, results, title: L.title, where: L.where, notes: L.notes, checks, parts: Object.fromEntries(Object.entries(L.parts || {}).filter(([k, v]) => v && L.items.includes(k))) };
    delete rec.cost;
    delete rec.revisions;
    await save('logs', rec);
    toast(log ? 'Entry updated' : 'Logged');
    s.close();
  };
  form();
  return s;
}

/** "lasted 42,000 km (2 years)" for a replaced part, or "12,000 km so far" for the one fitted now */
function partLife(l, next) {
  const span = (a, b) => { const m = Math.round((new Date(b) - new Date(a)) / 864e5 / 30.44); return m < 24 ? `${m} months` : `${(m / 12).toFixed(1).replace(/\.0$/, '')} years`; };
  if (next) return `lasted ${km(next.odo - l.odo)} km (${span(l.date, next.date)})`;
  const now = carOdo(l.carId);
  return `${km(now.odo - l.odo)} km so far (${span(l.date, ymd())})`;
}

/* =============== ONE ITEM: status, settings, history =============== */
export function itemSheet(itemId, carIdForNew = null) {
  const it0 = itemId ? state.items.find(x => x.id === itemId) : { carId: carIdForNew, name: '', kind: 'job', everyKm: null, everyMonths: null, includes: [], notes: '' };
  const I = { ...it0, includes: [...(it0.includes || [])] };
  const car = carOf(I.carId);
  const s = sheet('', { full: true, style: carStyle(car), label: I.name || 'New item' });
  const suggestions = () => {
    const have = new Set(live(state.items).filter(x => x.carId === I.carId).map(x => x.name.toLowerCase()));
    const diesel = /diesel/i.test(car.fuel || ''), list = SUGGESTIONS.map((x, i) => ({ ...x, i })).filter(x => !have.has(x.name.toLowerCase()) && (x.fuel === 'any' || (x.fuel === 'diesel') === diesel));
    if (!list.length) return '';
    const every = x => [x.everyKm && km(x.everyKm) + ' km', x.everyMonths && (x.everyMonths % 12 ? x.everyMonths + ' months' : (x.everyMonths / 12 === 1 ? 'yearly' : x.everyMonths / 12 + ' years'))].filter(Boolean).join(' or ') || 'set your own';
    return `<div class="field"><span>Common jobs</span><div class="sugg">${list.map(x => `<button data-sugg="${x.i}">${esc(x.name)}<small>${every(x)}</small></button>`).join('')}</div><span class="hint">Tap one to fill it in, then adjust before saving.</span></div>`;
  };
  const form = () => {
    const st = itemId ? status({ ...it0 }) : null;
    const hist = itemId ? itemHistory(it0) : [];
    const others = carItems(I.carId).filter(x => x.id !== itemId && x.kind !== 'service');
    s.set(`${band(car, itemId ? car.name : 'New item for the ' + car.name, { switchable: false, plain: true }).replace(`<strong>${esc(car.name)}</strong>`, `<strong>${esc(I.name || 'New item')}</strong>`)}
    <div class="form">
      ${st ? `<div class="panel" style="padding:14px 16px;margin:0"><div class="item ${st.level}" style="padding:0">
          <span class="badge">${ico(itemIcon(I))}</span><span class="nm">${LEVEL_WORD[st.level]}</span><span></span>
          <span class="tx" style="font-size:1em">${esc(st.text)}</span>${lights(st)}</div>
          ${st.last ? `<p class="muted" style="margin:10px 0 0;font-size:.92em">Last done ${st.last.date ? niceDate(st.last.date) : ''}${st.last.odo ? ' at ' + km(st.last.odo) + ' km' : ''}${st.last.baseline ? ' (from Simply Auto)' : ''}${st.last.result === 'attention' ? ' · needed attention' : ''}</p>` : ''}
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn paint small" data-logit>${ico('check')} ${I.kind === 'check' ? 'Log a check' : 'Log it done'}</button>${I.group !== 'care' ? `<button class="btn ghost small" data-book>${ico('phone')} Book it</button>` : ''}</div></div>` : ''}
      ${!itemId ? suggestions() : ''}
      <label class="field"><span>Name</span><input id="name" value="${esc(I.name)}" placeholder="e.g. Coolant flush"></label>
      <div class="field"><span>Type</span><span class="seg" style="align-self:flex-start">
        ${[['job', 'Job'], ['check', 'Check'], ['service', 'Service']].map(([k, l]) => `<button class="plain" data-kind="${k}" aria-pressed="${I.kind === k}">${l}</button>`).join('')}</span>
        <span class="hint">${{ job: 'Something you replace or do. Logged with “Done”.', check: 'Something you inspect. Logged as OK or Needs attention.', service: 'A visit that covers several jobs. Ticking it also ticks the jobs below.' }[I.kind]}</span></div>
      <div class="field"><span>Remind me every</span><div class="pair">
        <label class="field"><input id="everyKm" inputmode="numeric" value="${I.everyKm ?? ''}" placeholder="km"><span class="hint">kilometres</span></label>
        <label class="field"><input id="everyMonths" inputmode="numeric" value="${I.everyMonths ?? ''}" placeholder="months"><span class="hint">months</span></label></div>
        <span class="hint">Whichever comes first. Leave both empty to just keep a record.</span></div>
      ${I.kind === 'service' ? `<div class="field"><span>This service includes</span><div class="picks">${others.map(o => `<button class="pick" data-inc="${o.id}" aria-pressed="${I.includes.includes(o.id)}">${esc(o.name)}</button>`).join('') || '<span class="muted">Add other items first.</span>'}</div></div>` : ''}
      ${I.kind === 'check' ? `<label class="field"><span>Checklist</span><textarea id="checklist" rows="4" placeholder="One point per line (optional)">${esc((I.checklist || []).join('\n'))}</textarea><span class="hint">Each line gets its own OK / Needs attention when you log it.</span></label>` : ''}
      <label class="toggle"><span><b>Record the brand each time</b><br><span class="muted" style="font-size:.88em">Shows how long each brand lasts</span></span><input type="checkbox" id="trackPart" ${I.trackPart ? 'checked' : ''}></label>
      <label class="field"><span>Part number / notes</span><textarea id="notes" rows="2" placeholder="e.g. Ryco Z411 oil filter, 5W-50, 9 L">${esc(I.notes || '')}</textarea></label>
      ${hist.length ? `<div class="field"><span>History</span><div class="panel rows" style="margin:0">${hist.map((l, n) => `<button class="row" data-editlog="${l.id}"><span class="grow"><span class="t">${niceDate(l.date)}${l.parts?.[I.id] ? ' · ' + esc(l.parts[I.id]) : ''}</span><span class="s">${km(l.odo)} km${l.where ? ' · ' + esc(l.where) : ''}${l.results?.[I.id] === 'attention' ? ' · needed attention' : ''}${I.trackPart ? ' · ' + partLife(l, hist[n - 1]) : ''}</span>${l.notes ? `<div class="notes">${esc(l.notes)}</div>` : ''}</span></button>`).join('')}</div></div>` : ''}
      <p class="err" id="err" role="alert"></p>
    </div>
    <div class="foot">${itemId ? `<button class="btn danger" data-hide style="flex:0 0 auto">Hide</button>` : ''}<button class="btn paint" data-save>${ico('check')} Save</button></div>`);
  };
  const read = () => { const g = id => $('#' + id, s.el); I.name = g('name').value.trim(); I.everyKm = numVal(g('everyKm').value); I.everyMonths = numVal(g('everyMonths').value); I.notes = g('notes').value.trim(); I.trackPart = g('trackPart').checked; if (g('checklist')) I.checklist = g('checklist').value.split('\n').map(x => x.trim()).filter(Boolean); };
  s.el.onclick = async e => {
    if (e.target.closest('[data-close]')) return s.close();
    const k = e.target.closest('[data-kind]'); if (k) { read(); I.kind = k.dataset.kind; return form(); }
    const sg = e.target.closest('[data-sugg]'); if (sg) { const x = SUGGESTIONS[+sg.dataset.sugg]; Object.assign(I, { name: x.name, kind: x.kind, everyKm: x.everyKm || null, everyMonths: x.everyMonths || null }); return form(); }
    const inc = e.target.closest('[data-inc]'); if (inc) { read(); const id = inc.dataset.inc; I.includes = I.includes.includes(id) ? I.includes.filter(x => x !== id) : [...I.includes, id]; return form(); }
    if (e.target.closest('[data-logit]')) return logSheet(I.carId, { items: [itemId], care: I.group === 'care' });
    if (e.target.closest('[data-book]')) return bookSheet(itemId);
    const el = e.target.closest('[data-editlog]'); if (el) return logSheet(I.carId, { log: state.logs.find(l => l.id === el.dataset.editlog) });
    if (e.target.closest('[data-hide]')) { await save('items', { id: itemId, hidden: true }); toast(`${I.name} hidden. Bring it back from the Status tab.`); return s.close(); }
    if (!e.target.closest('[data-save]')) return;
    read();
    if (!I.name) return ($('#err', s.el).textContent = 'Give it a name.');
    const { revisions, st, ...rec } = I;
    if (!itemId) rec.id = I.carId.replace('c-', 'i-') + '-' + I.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36).slice(-4);
    await save('items', { ...rec, everyKm: I.everyKm ? Math.round(I.everyKm) : null, everyMonths: I.everyMonths ? Math.round(I.everyMonths) : null });
    toast('Saved'); s.close();
  };
  form();
}

/* =============== ODOMETER =============== */
export function odoSheet(carId) {
  const car = carOf(carId), cur = carOdo(carId);
  const s = sheet(`${band(car, 'Update odometer', { switchable: false })}<div class="form">
      <label class="field"><span>Odometer now (km)</span><input class="big" id="odo" inputmode="numeric" placeholder="${km(cur.odo)}">
      <span class="hint">Last reading ${km(cur.odo)} km${cur.date ? ', ' + niceDate(cur.date) : ''}. Keeps the due distances accurate between fill-ups.</span></label>
      <p class="err" id="err" role="alert"></p></div>
    <div class="foot"><button class="btn paint" data-save>${ico('check')} Save reading</button></div>`, { style: carStyle(car), label: 'Update odometer' });
  setTimeout(() => $('#odo', s.el)?.focus(), 250);
  s.el.onclick = async e => {
    if (e.target.closest('[data-close]')) return s.close();
    if (!e.target.closest('[data-save]')) return;
    const odo = numVal($('#odo', s.el).value);
    if (!odo) return ($('#err', s.el).textContent = 'Enter the reading.');
    const warn = checkReading(carId, odo);
    if (warn) { const v = await rightCar(s, car, warn); if (v === 'fix') return s.close(), odoSheet(carId); if (v === 'switch') { await save('cars', { id: warn.otherCar.id, odoReading: { odo, date: ymd() } }); toast(`Saved to the ${warn.otherCar.name}`); return s.close(); } }
    await save('cars', { id: carId, odoReading: { odo, date: ymd() } });
    toast('Odometer updated'); s.close();
  };
}

/* =============== IMPORT FROM SIMPLY AUTO =============== */
export function importSheet() {
  const s = sheet(`<div class="band plain"><div class="who"><small>Bring your history across</small><strong>Import from Simply Auto</strong></div><button class="iconbtn x" data-close aria-label="Close">${ico('x')}</button></div>
    <div class="form">
      <p>In Simply Auto, back up to Google Drive or your phone. Then pick the backup zip here (or its three CSV files).</p>
      <label class="btn paint" style="cursor:pointer">${ico('list')} Choose the backup<input type="file" id="file" accept=".zip,.csv,application/zip,text/csv" multiple hidden></label>
      <div id="out"></div></div>`, { style: '--car:var(--blue)', label: 'Import' });
  let data = null;
  s.el.onchange = async e => {
    if (e.target.id !== 'file') return;
    const out = $('#out', s.el);
    try {
      data = await readFiles([...e.target.files]);
      const have = new Set(state.cars.map(c => c.id));
      out.innerHTML = `<div class="panel" style="padding:14px 16px;margin:0">
        <p style="margin:0 0 8px"><b>Found in the backup</b></p>
        ${data.cars.map(c => `<p style="margin:2px 0">${esc(c.year || '')} ${esc(c.make)} ${esc(c.name)} · ${data.fills.filter(f => f.carId === c.id).length} fill-ups, ${data.logs.filter(l => l.carId === c.id).length} work entries${have.has(c.id) ? ' <span class="muted">(already here, history topped up)</span>' : ''}</p>`).join('')}
        <p class="muted" style="margin:8px 0 0;font-size:.9em">Duplicate fill-ups Simply Auto created are skipped. Re-importing is safe: nothing is doubled up.</p></div>
        <button class="btn paint" data-go style="margin-top:14px">Import</button>`;
    } catch (err) { out.innerHTML = `<p class="err">${esc(err.message)}</p>`; }
  };
  s.el.onclick = async e => {
    if (e.target.closest('[data-close]')) return s.close();
    if (!e.target.closest('[data-go]') || !data) return;
    e.target.closest('[data-go]').disabled = true;
    const haveC = new Set(state.cars.map(c => c.id)), haveI = new Set(state.items.map(i => i.id));
    await saveMany('cars', data.cars.filter(c => !haveC.has(c.id)));
    await saveMany('items', data.items.filter(i => !haveI.has(i.id)));
    // only add what's missing, so anything edited here is never overwritten
    const haveF = new Set(state.fills.map(f => f.id)), haveL = new Set(state.logs.map(l => l.id));
    await saveMany('fills', data.fills.filter(f => !haveF.has(f.id)));
    // fill-ups already here from an earlier import: add their locations if missing
    const byId = Object.fromEntries(state.fills.map(f => [f.id, f]));
    await saveMany('fills', data.fills.filter(f => byId[f.id] && byId[f.id].lat == null && f.lat != null).map(f => ({ id: f.id, lat: f.lat, lng: f.lng })));
    await saveMany('logs', data.logs.filter(l => !haveL.has(l.id)));
    toast('Imported'); s.close(); location.hash = '#/';
  };
}

/* =============== ADD A CAR =============== */
export function addCarSheet() {
  const s = sheet(`<div class="band plain"><div class="who"><small>Garage</small><strong>Add a car</strong></div><button class="iconbtn x" data-close aria-label="Close">${ico('x')}</button></div>
    <div class="form">
      <label class="field"><span>Name</span><input id="name" placeholder="e.g. Ranger"></label>
      <div class="pair"><label class="field"><span>Make</span><input id="make" value="Ford"></label><label class="field"><span>Year</span><input id="year" inputmode="numeric"></label></div>
      <label class="field"><span>Odometer now (km)</span><input class="big" id="odo" inputmode="numeric"></label>
      <p class="err" id="err"></p></div>
    <div class="foot"><button class="btn" data-save>Add car</button></div>`, { label: 'Add a car' });
  s.el.onclick = async e => {
    if (e.target.closest('[data-close]')) return s.close();
    if (!e.target.closest('[data-save]')) return;
    const g = id => $('#' + id, s.el).value.trim();
    if (!g('name')) return ($('#err', s.el).textContent = 'Give the car a name.');
    const id = 'c-' + g('name').toLowerCase().replace(/[^a-z0-9]+/g, '-') + (state.cars.some(c => c.id === 'c-' + g('name').toLowerCase()) ? '-' + Date.now().toString(36).slice(-3) : '');
    const odo = numVal(g('odo'));
    await save('cars', { id, name: g('name'), make: g('make'), model: g('name'), year: numVal(g('year')), colour: '#1C5BC4', order: state.cars.length, specs: [], ...(odo ? { odoReading: { odo, date: ymd() } } : {}) });
    s.close(); location.hash = `#/car/${id}/specs`;
  };
}
