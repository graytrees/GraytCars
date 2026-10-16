import { basicsItem } from './catalogue.js';
// Reads a Simply Auto backup (the "Simply_Fleet_Backup_….zip", or its three CSV files)
// and turns it into GraytCars records. Pure functions – nothing is saved here.
//
// What Simply Auto calls things → GraytCars:
//   Vehicles.csv               → cars
//   Services.csv (type 1)      → items with their km / day intervals and "last done" reading
//   Fuel_Log.csv  type 0       → fills  (duplicate rows Simply Auto sometimes creates are dropped)
//   Fuel_Log.csv  type 1 / 2   → logs   (services and expenses)
// Fill-up locations (latitude/longitude) come across so servos can be recognised later. Costs are not imported.

export function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(x => x !== ''));
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titleCase = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const notes = s => (s || '').split('||').map(x => x.trim()).filter(x => x && x !== 'null').join('\n');

/** Aussie spelling + sentence case for Simply Auto's built-in names */
const RENAME = { 'tire rotation': 'Tyre rotation' };
export const niceName = n => RENAME[n.toLowerCase()] || titleCase(n);

/** What kind of job an item is: service (bundle), job (Done), check (OK / Needs attention) */
export function guessKind(name) {
  const n = name.toLowerCase();
  if (/service/.test(n)) return 'service';
  if (/battery|alignment|check|inspect|pressure|coolant|wiper|lights/.test(n)) return 'check';
  return 'job';
}

const CAR_COLOURS = { mustang: '#C8102E' };   // Race Red
const EXPENSE_ONLY = /^(fine|insurance|mot|toll|tax|parking|business|medical|moving|charity|personal)$/i;

export function convert({ vehicles, fuel, services }) {
  const V = parseCsv(vehicles), F = parseCsv(fuel), S = parseCsv(services);
  const cars = [], items = [], logs = [], fills = [];
  const carIdOf = {};

  V.forEach((v, i) => {
    const model = titleCase(v.Model || v['Vehicle ID']);
    const id = 'c-' + slug(model);
    carIdOf[v['Vehicle ID']] = id;
    const specs = [];
    if (v.VIN) specs.push({ label: 'VIN', value: v.VIN });
    if (v['Insurance#']) specs.push({ label: 'Insurance policy', value: v['Insurance#'] });
    if (v.Notes) specs.push({ label: 'Notes', value: notes(v.Notes) });
    cars.push({ id, name: model, make: v.Make || '', model, year: num(v.Year) || null, fuel: v['Fuel Type'] || '',
      plate: v['Lic#'] || '', colour: CAR_COLOURS[slug(model)] || '#1C5BC4', order: i, specs, source: 'Simply Auto' });
  });

  // ---- fills (drop exact duplicates) ----
  const seen = new Set();
  const workRows = [];
  for (const r of F) {
    const carId = carIdOf[r['Vehicle ID']]; if (!carId) continue;
    const date = `${r.Year}-${pad(r.Month)}-${pad(r.Day)}`;
    if (r['Record Type'] !== '0') { workRows.push({ ...r, carId, date }); continue; }
    const key = [carId, r.Odometer, r.Qty, r['Total Cost'], date].join('|');
    if (seen.has(key)) continue; seen.add(key);
    fills.push({ id: 'f-sa' + r['Row ID'], carId, date, odo: num(r.Odometer), litres: num(r.Qty),
      full: r['Partial Tank'] !== '1', missed: r['Missed Fill Up'] === '1', station: r['Filling Station'] && r['Filling Station'] !== 'null' ? titleCaseWords(r['Filling Station']) : '',
      notes: notes(r.Notes), lat: num(r.Latitude) ? +num(r.Latitude).toFixed(5) : null, lng: num(r.Longitude) ? +num(r.Longitude).toFixed(5) : null, source: 'Simply Auto' });
  }

  // ---- items: anything with an interval, or that has history ----
  const loggedNames = new Set(workRows.map(r => r.carId + '|' + r['Record Desc'].toLowerCase()));
  const itemOf = {};
  for (const s of S) {
    const carId = carIdOf[s['Vehicle ID']]; if (!carId) continue;
    const name = s['Service Name']; if (EXPENSE_ONLY.test(name)) continue;
    const everyKm = num(s['Due Miles']) >= 50 ? Math.round(num(s['Due Miles'])) : null;
    const days = num(s['Due Days']);
    const everyMonths = days ? Math.max(1, Math.round(days / 30.44)) : null;
    if (!everyKm && !everyMonths && !loggedNames.has(carId + '|' + name.toLowerCase())) continue;
    const lastOdo = num(s['Last Odo']), lastMs = num(s['Last Date']);
    const nice = niceName(name);
    const it = { id: carId.replace('c-', 'i-') + '-' + slug(nice), carId, name: nice, kind: guessKind(nice), everyKm, everyMonths, includes: [], source: 'Simply Auto' };
    if (lastOdo || lastMs) it.baseline = { odo: lastOdo || null, date: lastMs > 1e11 ? ymd(new Date(lastMs)) : null };
    items.push(it); itemOf[carId + '|' + name.toLowerCase()] = it;
  }

  // ---- logs ----
  for (const r of workRows) {
    const desc = r['Record Desc'];
    let it = itemOf[r.carId + '|' + desc.toLowerCase()];
    if (!it && r['Record Type'] === '2' && /filter|oil|tyre|tire|battery|wiper|brake|plug/i.test(desc)) {
      const nice = niceName(desc);
      it = { id: r.carId.replace('c-', 'i-') + '-' + slug(nice), carId: r.carId, name: nice, kind: guessKind(nice), everyKm: null, everyMonths: null, includes: [], source: 'Simply Auto' };
      items.push(it); itemOf[r.carId + '|' + desc.toLowerCase()] = it;
    }
    logs.push({ id: 'l-sa' + r['Row ID'], carId: r.carId, date: r.date, odo: num(r.Odometer), items: it ? [it.id] : [],
      title: it ? '' : niceName(desc), where: r['Filling Station'] && r['Filling Station'] !== 'null' ? titleCaseWords(r['Filling Station']) : '',
      notes: notes(r.Notes), results: {}, source: 'Simply Auto' });
  }

  // Simply Auto's "last done" reading for an item often comes from a visit that was logged
  // under a different name (e.g. a full service saved as "Battery"). Link those visits so
  // each item's history shows where its last-done reading came from.
  for (const it of items) {
    const b = it.baseline; if (!b?.odo) continue;
    const match = logs.find(l => l.carId === it.carId && Math.abs(l.odo - b.odo) < 1 && (!b.date || l.date === b.date));
    if (match && !match.items.includes(it.id)) { match.items.push(it.id); match.title = ''; }
  }

  // A monthly once-over Simply Auto didn't have (shows up at the servo)
  for (const c of cars) {
    items.push(basicsItem(c.id));
  }
  // Part numbers noted in Simply Auto → the car's specs card
  for (const l of logs) {
    const m = l.notes.match(/part no\.?\s*\n?([A-Z0-9-]{5,})/i) || l.notes.match(/\n([A-Z]{2,}[0-9][A-Z0-9-]{3,})$/);
    if (m) {
      const car = cars.find(c => c.id === l.carId);
      const label = (items.find(i => l.items.includes(i.id))?.name || l.title) + ' part no.';
      if (!car.specs.some(s => s.label === label)) car.specs.push({ label, value: m[1], note: [l.where, monthYear(l.date)].filter(Boolean).join(', ') });
    }
  }
  return { cars, items, logs, fills };
}
function titleCaseWords(s) { return s.replace(/\s+/g, ' ').trim().split(' ').map(w => w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '); }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = s => `${MON[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`;

/** Accepts the Simply Auto zip and/or the three CSV files. */
export async function readFiles(files) {
  const texts = {};
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const JSZip = (await import('jszip')).default;
      const z = await JSZip.loadAsync(f);
      for (const name of Object.keys(z.files)) texts[name.split('/').pop()] = await z.files[name].async('string');
    } else texts[f.name] = await f.text();
  }
  const find = re => Object.entries(texts).find(([n]) => re.test(n))?.[1];
  const vehicles = find(/vehicle/i), fuel = find(/fuel/i), services = find(/service/i);
  if (!vehicles || !fuel || !services) throw new Error('That doesn’t look like a Simply Auto backup. Pick the backup zip, or all three CSV files (Vehicles, Fuel_Log, Services).');
  return convert({ vehicles, fuel, services });
}
