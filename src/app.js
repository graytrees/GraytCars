// Screens: Garage (both cars), a car's page (Status · Fuel · History · Specs), Settings, Recycle bin.
import { state, onChange, save, restore, saveMeta } from './store.js';
import { live, carOdo, carItems, carLevel, fuelStats, economy, km, niceDate, monthYear, ymd } from './calc.js';
import { $, $$, esc, ico, prefs, setPref, applyPrefs, carArt, carStyle, drums, lights, itemIcon, econ, econUnit, toast, carPhoto, SWATCHES, LEVEL_WORD, closeAll, plate } from './ui.js';
import { basicsItem } from './catalogue.js';
import { fillSheet, logSheet, itemSheet, odoSheet, importSheet, addCarSheet } from './sheets.js';
import { drawEconomy } from './chart.js';
import { backupNow, maybeWeeklyBackup } from './backup.js';
import { driveConnected, getToken, listBackups } from './drive.js';
import { signOut } from './firebase.js';

const main = () => document.getElementById('main');
const cars = () => live(state.cars).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const carOf = id => state.cars.find(c => c.id === id && !c.deleted);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/* ---------- routing: #/  #/car/<id>/<tab>  #/settings  #/bin ---------- */
const route = () => { const p = location.hash.replace(/^#\/?/, '').split('/'); return { view: p[0] || 'garage', id: p[1], tab: p[2] || 'status' }; };
let lastKey = '';
function render() {
  const r = route(), m = main();
  const key = r.view + '/' + r.id + '/' + r.tab;
  const keepScroll = key === lastKey ? window.scrollY : 0;
  if (r.view === 'car' && carOf(r.id)) m.innerHTML = carPage(r.id, r.tab);
  else if (r.view === 'settings') m.innerHTML = settingsPage();
  else if (r.view === 'bin') m.innerHTML = binPage();
  else m.innerHTML = garage();
  document.querySelector('.dock')?.remove();
  if (r.view === 'car' && carOf(r.id)) document.body.insertAdjacentHTML('beforeend', dock(r.id));
  if (r.view === 'car' && r.tab === 'fuel') { const el = $('#chart'); if (el) drawEconomy(el, economy(r.id), fuelStats(r.id).avgYear); }
  if (key !== lastKey) window.scrollTo(0, 0); else window.scrollTo(0, keepScroll);
  lastKey = key;
}
const topbar = (title, back) => `<header class="top">${back ? `<a class="iconbtn" href="${back}" aria-label="Back">${ico('back')}</a>` : ''}
  <h1>${back ? '' : '<span class="mark" aria-hidden="true">GC</span>'}${esc(title)}</h1>
  ${state.pending ? `<span class="sync" title="Saved on this device; will sync when online"><i></i>Syncing</span>` : ''}
  ${back ? '' : `<a class="iconbtn" href="#/settings" aria-label="Settings">${ico('gear')}</a>`}</header>`;

/* ---------- Garage ---------- */
function garage() {
  const list = cars();
  if (!list.length) return `${topbar('GraytCars')}<div class="empty">
    <h2>Bring your cars across</h2><p class="muted">Pick the Simply Auto backup and your fill-ups, services and reminders come with it.</p>
    <button class="btn" data-import>${ico('list')} Import from Simply Auto</button>
    <button class="btn ghost" data-addcar>${ico('plus')} Add a car by hand</button></div>`;
  return `${topbar('GraytCars')}<div class="garage">${list.map(carCard).join('')}</div>`;
}
function carCard(car) {
  const odo = carOdo(car.id), lv = carLevel(car.id);
  const items = carItems(car.id).filter(i => i.st.level !== 'none');
  const top = items.slice(0, 3);
  const st = fuelStats(car.id);
  const summary = lv.red ? `${lv.red} due now` : lv.amber ? `${lv.amber} coming due` : 'All good';
  return `<article class="car" style="${carStyle(car)}">
    <a class="hero" href="#/car/${car.id}/status" aria-label="Open the ${esc(car.name)}">${carArt(car)}
      ${car.photo ? '' : `<span class="addphoto">${ico('cam')} Add a photo in Specs</span>`}
      <span class="name"><h2>${esc(car.name)}</h2><p>${car.year ? esc(car.year) + ' ' : ''}${plate(car.plate)}</p></span></a>
    <div class="carbody">
      <div class="readout">
        <button class="odo" data-odo="${car.id}" aria-label="Update odometer">${drums(odo.odo)}<span class="unit">km<small>${odo.date ? niceDate(odo.date) : ''}</small></span></button>
        <span class="pill ${lv.level}"><i></i>${summary}</span>
      </div>
      ${st.last ? `<p class="muted" style="margin:-4px 0 0;font-size:.92em">${ico('fuel')} Last tank <b class="num" style="color:var(--ink);font-size:1.1em">${econ(st.last.l100)}</b> ${econUnit()} · 12-month average ${econ(st.avgYear)}</p>` : ''}
      <div class="items">${top.map(i => itemRow(i)).join('')}</div>
      ${items.length > 3 ? `<a class="more" href="#/car/${car.id}/status">All ${items.length} jobs ${ico('chev')}</a>` : ''}
      <div class="btns"><button class="btn paint" data-fill="${car.id}">${ico('fuel')} Fill up</button><button class="btn ghost" data-log="${car.id}">${ico('wrench')} Log work</button></div>
    </div></article>`;
}
function itemRow(i, withAction = false) {
  const act = withAction && i.st.level !== 'none' ? (i.kind === 'check'
    ? `<span class="act"><span class="chipbtn">${ico('check')} Check</span></span>` : `<span class="act"><span class="chipbtn">${ico('check')} Done</span></span>`) : '<span></span>';
  return `<button class="item ${i.st.level}" data-item="${i.id}" ${withAction ? `data-quicklog="${i.id}"` : ''}>
    <span class="badge">${ico(itemIcon(i))}</span><span class="nm">${esc(i.name)}</span>${act}
    <span class="tx">${esc(i.st.text)}</span>${lights(i.st)}</button>`;
}

/* ---------- Car page ---------- */
const TABS = [['status', 'Status', 'gauge'], ['fuel', 'Fuel', 'fuel'], ['history', 'History', 'history'], ['specs', 'Specs', 'list']];
function carPage(id, tab) {
  const car = carOf(id), odo = carOdo(id), lv = carLevel(id);
  const body = { status: statusTab, fuel: fuelTab, history: historyTab, specs: specsTab }[tab] || statusTab;
  return `<div class="carpage" style="${carStyle(car)}">${topbar('Garage', '#/')}
    <div class="hero">${carArt(car)}<span class="name"><h2>${esc(car.name)}</h2><p>${[car.year, car.make].filter(Boolean).map(esc).join(' ')} ${plate(car.plate)}</p></span></div>
    <div class="carhead">
      <button class="odo" data-odo="${id}" aria-label="Update odometer">${drums(odo.odo)}<span class="unit">km<small>${odo.date ? niceDate(odo.date) : ''} · tap to update</small></span></button>
      <span class="pill ${lv.level}"><i></i>${lv.red ? `${lv.red} due now` : lv.amber ? `${lv.amber} coming due` : 'All good'}</span></div>
    <nav class="tabs" role="tablist">${TABS.map(([k, l, ic]) => `<button role="tab" aria-selected="${k === tab}" data-tab="${k}">${ico(ic)}${l}</button>`).join('')}</nav>
    ${body(car)}</div>`;
}
const dock = id => `<div class="dock" style="${carStyle(carOf(id))}"><div class="btns"><button class="btn paint" data-fill="${id}">${ico('fuel')} Fill up</button><button class="btn ghost" data-log="${id}">${ico('wrench')} Log work</button></div></div>`;

function statusTab(car) {
  const all = carItems(car.id);
  const tracked = all.filter(i => i.st.level !== 'none'), records = all.filter(i => i.st.level === 'none');
  const hidden = live(state.items).filter(i => i.carId === car.id && i.hidden);
  return `<div class="split"><section class="panel"><h3>Jobs and checks</h3>
      <p class="sub muted">Green is fine, yellow is coming due, red is due now. Each bar fills by distance or time, whichever is closer.</p>
      <div class="items">${tracked.map(i => itemRow(i, true)).join('') || '<p class="muted">Nothing with a reminder yet.</p>'}</div></section>
    <div>${records.length ? `<section class="panel"><h3>Records only</h3><p class="sub muted">No reminder set. Tap one to add an interval.</p><div class="items">${records.map(i => itemRow(i)).join('')}</div></section>` : ''}
      <section class="panel" style="padding:14px 16px"><button class="btn ghost small" data-newitem="${car.id}">${ico('plus')} Add a job or check</button>
      ${hidden.length ? `<p class="muted" style="margin:12px 0 4px;font-size:.92em">Hidden: ${hidden.map(h => `<button class="chipbtn" data-unhide="${h.id}" style="margin:4px 4px 0 0">${esc(h.name)} · show</button>`).join('')}</p>` : ''}</section></div></div>`;
}

function fuelTab(car) {
  const st = fuelStats(car.id);
  const fills = live(state.fills).filter(f => f.carId === car.id).sort((a, b) => b.odo - a.odo || b.date.localeCompare(a.date));
  const eco = Object.fromEntries(economy(car.id).map(e => [e.id, e]));
  const show = fills.slice(0, 12);
  return `<div class="tiles">
      <div class="tile hero-tile"><div><span>Last tank</span><b>${econ(st.last?.l100)}<small>${econUnit()}</small></b></div><span>${st.last ? niceDate(st.last.date) : ''}</span></div>
      <div class="tile"><span>12-month average</span><b>${econ(st.avgYear)}</b></div>
      <div class="tile"><span>Best tank</span><b>${econ(st.best)}</b></div>
      <div class="tile"><span>Driving</span><b>${st.kmMonth ? km(st.kmMonth) : '–'}<small>km/month</small></b></div>
    </div>
    <section class="panel"><h3>Economy, every tank</h3><p class="sub muted">${econUnit()}. ${prefs.unit === 'kml' ? 'Higher' : 'Lower'} is better. Tap a point for details.</p><div class="chart" id="chart"></div></section>
    <section class="panel"><h3>Fill-ups</h3><div class="rows">${show.map(f => fillRow(f, eco[f.id])).join('')}</div>
      ${fills.length > show.length ? `<p class="muted" style="padding:8px 4px">Older fill-ups are in History.</p>` : ''}</section>`;
}
const fillRow = (f, e) => `<button class="row" data-editfill="${f.id}"><span class="ic fuel">${ico('fuel')}</span>
  <span class="grow"><span class="t">${f.station ? esc(f.station) : (f.litres || 0).toFixed(1) + ' L'}${f.full ? '' : ' · part fill'}</span>
  <span class="s">${niceDate(f.date)} · ${km(f.odo)} km${f.station ? ' · ' + (f.litres || 0).toFixed(1) + ' L' : ''}</span></span>
  <span class="r">${e ? econ(e.l100) + `<small class="muted"> ${econUnit()}</small>` : ''}</span></button>`;

let histFilter = 'all';
function historyTab(car) {
  const name = Object.fromEntries(state.items.map(i => [i.id, i.name]));
  const logs = live(state.logs).filter(l => l.carId === car.id).map(l => ({ t: 'log', date: l.date, odo: l.odo, l }));
  const fills = live(state.fills).filter(f => f.carId === car.id).map(f => ({ t: 'fill', date: f.date, odo: f.odo, f }));
  const eco = Object.fromEntries(economy(car.id).map(e => [e.id, e]));
  const list = (histFilter === 'work' ? logs : histFilter === 'fuel' ? fills : [...logs, ...fills]).sort((a, b) => b.date.localeCompare(a.date) || b.odo - a.odo);
  let yr = '';
  const rows = list.map(x => {
    const y = x.date.slice(0, 4), head = y !== yr ? `${yr ? '</div></section>' : ''}<section class="panel"><div class="yr">${y}</div><div class="rows">` : ''; yr = y;
    if (x.t === 'fill') return head + fillRow(x.f, eco[x.f.id]);
    const l = x.l, names = [...(l.items || []).map(i => name[i] || 'Removed item'), l.title].filter(Boolean);
    const res = Object.entries(l.results || {}).map(([k, v]) => l.checks?.[k] && v === 'attention'
      ? Object.entries(l.checks[k]).filter(([, r]) => r === 'attention').map(([c]) => `<span class="flag att">${esc(c)}: needs attention</span>`).join('')
      : `<span class="flag ${v === 'attention' ? 'att' : 'ok'}">${esc(name[k] || '')}: ${v === 'attention' ? 'needs attention' : 'OK'}</span>`).join('');
    return head + `<button class="row" data-editlog="${l.id}"><span class="ic">${ico(itemIcon({ name: names[0] || '', kind: '' }))}</span>
      <span class="grow"><span class="t">${esc(names.join(', '))}</span><span class="s">${niceDate(l.date)} · ${km(l.odo)} km${l.where ? ' · ' + esc(l.where) : ''}</span>
      ${res ? `<div>${res}</div>` : ''}${l.notes ? `<div class="notes">${esc(l.notes)}</div>` : ''}</span></button>`;
  }).join('') + (yr ? '</div></section>' : '');
  return `<div class="filters">${[['all', 'Everything'], ['work', 'Work'], ['fuel', 'Fuel']].map(([k, l]) => `<button data-hf="${k}" aria-pressed="${histFilter === k}">${l}</button>`).join('')}
    <button data-print="${car.id}" style="margin-left:auto">${ico('print')} Service history</button></div>
    ${rows || '<p class="muted">Nothing logged yet.</p>'}`;
}

const SPEC_SUGGEST = ['Engine oil (grade & litres)', 'Oil filter part no.', 'Air filter part no.', 'Tyre size', 'Tyre pressures (front / rear)', 'Wiper blades', 'Battery', 'Fuel tank (L)', 'Coolant type'];
function specsTab(car) {
  const specs = car.specs || [];
  return `<div class="split"><section class="panel"><h3>Parts &amp; numbers</h3><p class="sub muted">Handy at the parts counter. Changes save as you type.</p>
      ${specs.map((s, i) => `<div class="spec"><input class="lbl" data-spec="${i}" data-f="label" value="${esc(s.label)}" aria-label="Label">
        <input data-spec="${i}" data-f="value" value="${esc(s.value)}" aria-label="${esc(s.label)}"><button class="iconbtn" data-delspec="${i}" aria-label="Remove ${esc(s.label)}">${ico('trash')}</button>
        ${s.note ? `<span class="note">${esc(s.note)}</span>` : ''}</div>`).join('')}
      <div class="suggest">${SPEC_SUGGEST.filter(x => !specs.some(s => s.label === x)).map(x => `<button class="chipbtn" data-addspec="${esc(x)}">${ico('plus')} ${esc(x)}</button>`).join('')}
        <button class="chipbtn" data-addspec="">${ico('plus')} Other</button></div></section>
    <div><section class="panel" style="padding:14px 16px"><h3 style="padding:0 0 10px">Photo &amp; colour</h3>
      <div class="btnrow" style="display:flex;gap:10px;flex-wrap:wrap"><label class="btn paint small" style="cursor:pointer">${ico('cam')} ${car.photo ? 'Change photo' : 'Add a photo'}<input type="file" accept="image/*" data-photo="${car.id}" hidden></label>
      ${car.photo ? `<button class="btn ghost small" data-nophoto="${car.id}">Remove photo</button>` : ''}</div>
      <p class="muted" style="font-size:.9em;margin:10px 0">The colour shows on this car's fill-up and log screens. A new photo picks it from the paint.</p>
      <div class="swatches">${SWATCHES.map(([n, c]) => `<button style="--c:${c}" data-colour="${c}" aria-label="${n}" aria-pressed="${car.colour?.toLowerCase() === c.toLowerCase()}"></button>`).join('')}</div></section>
    <section class="panel" style="padding:14px 16px"><h3 style="padding:0 0 10px">Details</h3>
      <div class="form" style="padding:0;gap:12px">
        <label class="field"><span>Name</span><input data-car="name" value="${esc(car.name)}"></label>
        <div class="pair"><label class="field"><span>Year</span><input data-car="year" inputmode="numeric" value="${esc(car.year ?? '')}"></label>
        <label class="field"><span>Rego plate</span><input data-car="plate" value="${esc(car.plate || '')}"></label></div>
        <label class="field"><span>Body shape (for the outline before a photo)</span><select data-car="shape"><option value="">Automatic</option><option value="coupe" ${car.shape === 'coupe' ? 'selected' : ''}>Coupe / sedan</option><option value="suv" ${car.shape === 'suv' ? 'selected' : ''}>SUV / 4WD / ute</option></select></label>
      </div></section>
    <button class="btn ghost" data-print="${car.id}" style="width:100%">${ico('print')} Print service history</button></div></div>`;
}

/* ---------- Settings & recycle bin ---------- */
function settingsPage() {
  const b = state.meta.backup;
  return `<div class="settings">${topbar('Settings', '#/')}
    <section class="panel"><h3 style="padding:0 0 6px">Backups</h3>
      <p class="muted">${driveConnected() ? `Every week a copy goes to the GraytCars folder in your Google Drive.` : `Connect Google Drive and a copy is saved there every week (JSON plus spreadsheet-friendly CSVs).`}
      ${b?.lastDay ? `<br>Last backup: <b>${niceDate(b.lastDay)}</b>` : ''}</p>
      <div class="btnrow"><button class="btn small" data-backup>${ico('cloud')} ${driveConnected() ? 'Back up now' : 'Connect Drive and back up'}</button></div></section>
    <section class="panel"><h3 style="padding:0 0 6px">Simply Auto</h3><p class="muted">Import a Simply Auto backup. Safe to repeat: nothing is doubled up.</p>
      <div class="btnrow"><button class="btn ghost small" data-import>${ico('list')} Import from Simply Auto</button></div></section>
    <section class="panel"><h3 style="padding:0 0 6px">This device</h3>
      <div class="form" style="padding:0;gap:14px">
        <div class="field"><span>Text size</span><span class="seg" style="align-self:flex-start">${[[1, 'Normal'], [1.08, 'Large'], [1.2, 'Larger']].map(([v, l]) => `<button class="plain" data-fs="${v}" aria-pressed="${prefs.fs == v}">${l}</button>`).join('')}</span></div>
        <div class="field"><span>Appearance</span><span class="seg" style="align-self:flex-start">${[['auto', 'Match phone'], ['dark', 'Dark'], ['light', 'Light']].map(([v, l]) => `<button class="plain" data-theme="${v}" aria-pressed="${prefs.theme === v}">${l}</button>`).join('')}</span></div>
        <div class="field"><span>Fuel economy</span><span class="seg" style="align-self:flex-start">${[['l100', 'L/100km'], ['kml', 'km/L']].map(([v, l]) => `<button class="plain" data-unit="${v}" aria-pressed="${prefs.unit === v}">${l}</button>`).join('')}</span></div>
      </div></section>
    <section class="panel"><h3 style="padding:0 0 6px">Garage</h3>
      <div class="btnrow"><button class="btn ghost small" data-addcar>${ico('plus')} Add a car</button><a class="btn ghost small" href="#/bin">${ico('trash')} Recycle bin</a></div></section>
    <section class="panel"><p class="muted">Signed in as ${esc(window.__userEmail || '')}</p><button class="btn ghost small" data-signout>Sign out</button></section></div>`;
}
function binPage() {
  const name = Object.fromEntries(state.items.map(i => [i.id, i.name])), car = Object.fromEntries(state.cars.map(c => [c.id, c.name]));
  const del = [...state.logs.filter(l => l.deleted).map(l => ({ col: 'logs', x: l, t: [...(l.items || []).map(i => name[i]), l.title].filter(Boolean).join(', ') })),
    ...state.fills.filter(f => f.deleted).map(f => ({ col: 'fills', x: f, t: `Fill-up ${(f.litres || 0).toFixed(2)} L` }))].sort((a, b) => (b.x.deletedMs || 0) - (a.x.deletedMs || 0));
  return `${topbar('Recycle bin', '#/settings')}<section class="panel"><div class="rows">${del.map(d => `<div class="row"><span class="grow"><span class="t">${esc(d.t)}</span><span class="s">${esc(car[d.x.carId] || '')} · ${niceDate(d.x.date)} · ${km(d.x.odo)} km</span></span><button class="chipbtn" data-restore="${d.col}:${d.x.id}">Restore</button></div>`).join('') || '<p class="muted" style="padding:8px 4px">Nothing deleted.</p>'}</div></section>`;
}

/* ---------- printable service history ---------- */
function printHistory(carId) {
  const car = carOf(carId), name = Object.fromEntries(state.items.map(i => [i.id, i.name]));
  const logs = live(state.logs).filter(l => l.carId === carId).sort((a, b) => a.date.localeCompare(b.date));
  $('#print').innerHTML = `<h1>${esc([car.year, car.make, car.name].filter(Boolean).join(' '))}</h1>
    <p>${car.plate ? 'Rego ' + esc(car.plate) + ' · ' : ''}Odometer ${km(carOdo(carId).odo)} km · Printed ${niceDate(ymd())}</p>
    <table><thead><tr><th>Date</th><th>Odometer</th><th>Work</th><th>Where</th><th>Notes</th></tr></thead><tbody>
    ${logs.map(l => `<tr><td>${niceDate(l.date)}</td><td>${km(l.odo)} km</td><td>${esc([...(l.items || []).map(i => name[i]), l.title].filter(Boolean).join(', '))}</td><td>${esc(l.where || '')}</td><td>${esc(l.notes || '').replace(/\n/g, '<br>')}</td></tr>`).join('')}
    </tbody></table>`;
  setTimeout(() => window.print(), 50);
}

/* ---------- events ---------- */
let specTimer;
function saveSpecs(carId, specs) { clearTimeout(specTimer); specTimer = setTimeout(() => save('cars', { id: carId, specs }), 500); }
function bind() {
  document.addEventListener('click', async e => {
    const t = e.target.closest('button,[data-tab]'); if (!t) return;
    const d = t.dataset, r = route();
    if (d.fill) return fillSheet(d.fill);
    if (d.log) return logSheet(d.log);
    if (d.odo) return odoSheet(d.odo);
    if (d.tab) { location.hash = `#/car/${r.id}/${d.tab}`; return; }
    if (d.quicklog && e.target.closest('.act')) return logSheet(state.items.find(i => i.id === d.quicklog).carId, { items: [d.quicklog] });
    if (d.item) return itemSheet(d.item);
    if (d.newitem) return itemSheet(null, d.newitem);
    if (d.unhide) return save('items', { id: d.unhide, hidden: false });
    if (d.editfill) return fillSheet(state.fills.find(f => f.id === d.editfill).carId, state.fills.find(f => f.id === d.editfill));
    if (d.editlog) { const l = state.logs.find(x => x.id === d.editlog); return logSheet(l.carId, { log: l }); }
    if (d.hf) { histFilter = d.hf; return render(); }
    if (d.print) return printHistory(d.print);
    if (d.import !== undefined) return importSheet();
    if (d.addcar !== undefined) return addCarSheet();
    if (d.addspec !== undefined) { const car = carOf(r.id); const specs = [...(car.specs || []), { label: d.addspec, value: '' }]; await save('cars', { id: car.id, specs }); setTimeout(() => $$('[data-f="' + (d.addspec ? 'value' : 'label') + '"]').pop()?.focus(), 80); return; }
    if (d.delspec !== undefined) { const car = carOf(r.id); const specs = (car.specs || []).filter((_, i) => i !== +d.delspec); return save('cars', { id: car.id, specs }); }
    if (d.colour) return save('cars', { id: r.id, colour: d.colour });
    if (d.nophoto) return save('cars', { id: d.nophoto, photo: null });
    if (d.fs) return setPref('fs', +d.fs), render();
    if (d.theme) return setPref('theme', d.theme), render();
    if (d.unit) return setPref('unit', d.unit), render();
    if (d.restore) { const [col, id] = d.restore.split(':'); await restore(col, id); return toast('Restored'); }
    if (d.signout !== undefined) return signOut().then(() => location.reload());
    if (d.backup !== undefined) {
      t.disabled = true;
      try { await getToken(true); const day = await backupNow(true); toast('Backed up to Drive'); } catch (err) { toast(err.message === 'offline' ? 'No connection. Try again when online.' : 'Backup failed: ' + err.message, 5000); }
      t.disabled = false; render();
    }
  });
  document.addEventListener('input', e => {
    const t = e.target, r = route();
    if (t.dataset.spec !== undefined) { const car = carOf(r.id); const specs = (car.specs || []).map(s => ({ ...s })); specs[+t.dataset.spec][t.dataset.f] = t.value; car.specs = specs; saveSpecs(car.id, specs); }
    if (t.dataset.car) { const v = t.dataset.car === 'year' ? (parseInt(t.value) || null) : t.value; clearTimeout(specTimer); specTimer = setTimeout(() => save('cars', { id: r.id, [t.dataset.car]: v }), 600); }
  });
  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.dataset.photo && t.files?.[0]) {
      toast('Adding photo…');
      try { const p = await carPhoto(t.files[0]); await save('cars', { id: t.dataset.photo, photo: p.url, ...(p.colour ? { colour: p.colour } : {}) }); toast(p.colour ? 'Photo added. Colour matched to the paint.' : 'Photo added'); }
      catch (err) { toast('That photo could not be read. Try another.'); }
    }
    if (t.dataset.car === 'shape') save('cars', { id: route().id, shape: t.value || null });
  });
}

/* ---------- start ---------- */
let launched = false, backupTried = false, migrated = false;
/** Every car gets the Monthly basics check; the earlier stand-alone tyre-pressure check is retired if unused. */
function migrate() {
  for (const c of live(state.cars)) {
    const b = basicsItem(c.id);
    if (!state.items.some(i => i.id === b.id)) save('items', b);
    const tp = state.items.find(i => i.id === c.id.replace('c-', 'i-') + '-tyre-pressures' && !i.hidden && !i.deleted);
    if (tp && tp.source === 'GraytCars' && !state.logs.some(l => l.items?.includes(tp.id))) save('items', { id: tp.id, hidden: true });
  }
}
export function startApp({ launch } = {}) {
  applyPrefs();
  bind();
  window.addEventListener('hashchange', () => { closeAll(); render(); });
  // don't redraw the page under someone who is typing in it
  onChange(() => { const a = document.activeElement; if (a && main().contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return; render();
    if (!launched && launch && state.ready.cars && state.ready.fills) { launched = true; const c = carOf(launch.fill || launch.log); if (c) (launch.fill ? fillSheet : logSheet)(c.id); }
    if (!backupTried && state.ready.meta && live(state.cars).length) { backupTried = true; maybeWeeklyBackup(); }
    if (!migrated && state.ready.items && state.ready.logs && state.ready.cars) { migrated = true; migrate(); }
  });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (route().tab === 'fuel') render(); }, 200); });
  render();
}
