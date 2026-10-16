// The numbers behind the screens: odometer, how far each car goes per day,
// what's due (traffic lights), fuel economy, and the "is this the right car?" check.
import { state } from './store.js';

export const live = list => list.filter(x => !x.deleted);
export const DAY = 864e5;
const pad = n => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => parseDay(ymd());
export function addMonths(s, n) { const d = parseDay(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return ymd(d); }
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / DAY);

/* ---------- formatting ---------- */
export const km = n => n == null ? '–' : Math.round(n).toLocaleString('en-AU');
export const money = n => n == null || n === '' ? '' : '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const niceDate = s => { if (!s) return ''; const d = parseDay(s); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
export const monthYear = s => { const d = parseDay(s); return `${MON[d.getMonth()]} ${d.getFullYear()}`; };
export function roughWhen(s) {
  const d = parseDay(s), t = today(), n = Math.round((d - t) / DAY);
  if (n < 0) return niceDate(s);
  if (n === 0) return 'today';
  if (n < 14) return `in ${n} day${n === 1 ? '' : 's'}`;
  const part = d.getDate() <= 10 ? 'early' : d.getDate() <= 20 ? 'mid' : 'late';
  return `${part} ${MON[d.getMonth()]}${d.getFullYear() !== t.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
function span(days) {
  days = Math.abs(days);
  if (days < 45) return `${days} day${days === 1 ? '' : 's'}`;
  const m = Math.round(days / 30.44);
  return m < 24 ? `${m} months` : `${(days / 365.25).toFixed(1).replace(/\.0$/, '')} years`;
}

/* ---------- odometer + driving rate ---------- */
export function readings(carId) {
  const r = [];
  for (const f of live(state.fills)) if (f.carId === carId && f.odo) r.push({ odo: f.odo, date: f.date, src: 'fill' });
  for (const l of live(state.logs)) if (l.carId === carId && l.odo) r.push({ odo: l.odo, date: l.date, src: 'log' });
  const car = state.cars.find(c => c.id === carId);
  if (car?.odoReading?.odo) r.push({ ...car.odoReading, src: 'manual' });
  return r.sort((a, b) => a.date.localeCompare(b.date) || a.odo - b.odo);
}
export function carOdo(carId) {
  let best = null;
  for (const r of readings(carId)) if (!best || r.odo > best.odo) best = r;
  return best || { odo: 0, date: null };
}
/** km per day over the last year of readings */
export function kmPerDay(carId) {
  const r = readings(carId); if (r.length < 2) return null;
  const last = r[r.length - 1];
  const from = ymd(new Date(parseDay(last.date) - 365 * DAY));
  let win = r.filter(x => x.date >= from);
  if (win.length < 2 || daysBetween(win[0].date, last.date) < 30) win = r;
  const days = daysBetween(win[0].date, win[win.length - 1].date);
  const dist = Math.max(...win.map(x => x.odo)) - Math.min(...win.map(x => x.odo));
  return days > 0 && dist > 0 ? dist / days : null;
}

/* ---------- maintenance status ---------- */
export function itemHistory(item) {
  return live(state.logs).filter(l => l.items?.includes(item.id)).sort((a, b) => b.date.localeCompare(a.date) || b.odo - a.odo);
}
export function lastDone(item) {
  const h = itemHistory(item)[0];
  const b = item.baseline;
  const fromLog = h ? { odo: h.odo, date: h.date, log: h, result: h.results?.[item.id] } : null;
  if (!b || (b.odo == null && !b.date)) return fromLog;
  const fromBase = { odo: b.odo ?? null, date: b.date || null, baseline: true };
  if (!fromLog) return fromBase;
  // whichever is later (by odometer when both have one)
  if (fromBase.odo != null && fromLog.odo) return fromBase.odo > fromLog.odo + 1 ? fromBase : fromLog;
  return (fromBase.date || '') > fromLog.date ? fromBase : fromLog;
}

/** level: red | amber | green | none (no reminder set) | unknown (never recorded) */
export function status(item) {
  const odo = carOdo(item.carId).odo;
  const rate = kmPerDay(item.carId);
  const t = ymd();
  const last = lastDone(item);
  if (!item.everyKm && !item.everyMonths) {
    if (!last) return { level: 'none', frac: 0, text: 'Nothing logged yet', short: 'No reminder' };
    const part = last.log?.parts?.[item.id];
    const ago = last.odo != null ? ` · ${km(carOdo(item.carId).odo - last.odo)} km ago` : '';
    if (item.group === 'care' && last.date) { const d = daysBetween(last.date, ymd()); return { level: 'none', frac: 0, last, text: `${d === 0 ? 'Today' : d === 1 ? 'Yesterday' : span(d) + ' ago'}${part ? ' · ' + part : ''}`, short: 'No reminder' }; }
    return { level: 'none', frac: 0, last, text: `Last done ${last.date ? niceDate(last.date) : ''}${last.odo ? ' at ' + km(last.odo) + ' km' : ''}${part ? ' · ' + part : ''}${ago}`.replace('Last done  at', 'Last done at'), short: 'No reminder' };
  }
  if (!last) return { level: 'unknown', frac: 0, text: 'Not recorded yet', short: 'Not recorded' };
  let fracKm = null, fracT = null, kmLeft = null, daysLeft = null, timeDue = null;
  if (item.everyKm && last.odo != null) { kmLeft = last.odo + item.everyKm - odo; fracKm = (odo - last.odo) / item.everyKm; }
  if (item.everyMonths && last.date) { timeDue = addMonths(last.date, item.everyMonths); daysLeft = daysBetween(t, timeDue); fracT = daysBetween(last.date, t) / daysBetween(last.date, timeDue); }
  const fracs = [fracKm, fracT].filter(x => x != null);
  if (!fracs.length) return { level: 'unknown', frac: 0, last, text: 'Not recorded yet', short: 'Not recorded' };
  const frac = Math.max(...fracs);
  const level = frac >= 1 ? 'red' : frac >= 0.85 ? 'amber' : 'green';
  // when it'll fall due: the earlier of the date limit and the km limit at your usual driving
  let dueDate = timeDue;
  if (kmLeft != null && rate) { const byKm = ymd(new Date(today().getTime() + Math.max(0, kmLeft) / rate * DAY)); if (!dueDate || byKm < dueDate) dueDate = byKm; }
  const kmOver = kmLeft != null && kmLeft <= 0, timeOver = daysLeft != null && daysLeft <= 0;
  let text, short;
  if (kmOver || timeOver) {
    const bits = [];
    if (kmOver) bits.push(`${km(-kmLeft)} km`);
    if (timeOver) bits.push(span(daysLeft));
    text = `Overdue by ${bits.join(' / ')}`; short = 'Overdue';
  } else {
    const bits = [];
    if (kmLeft != null) bits.push(`${km(kmLeft)} km`);
    if (daysLeft != null) bits.push(span(daysLeft));
    text = `Due in ${bits.join(' or ')}`;
    short = bits[0];
    if (dueDate && parseDay(dueDate) - today() < 5 * 365 * DAY) text += ` · ${roughWhen(dueDate)}`;
  }
  // days until it's likely needed (negative = overdue), by whichever limit comes first
  const etas = [];
  if (daysLeft != null) etas.push(daysLeft);
  if (kmLeft != null) etas.push(kmLeft / (rate || 40));
  const eta = etas.length ? Math.min(...etas) : null;
  return { level, frac, kmLeft, daysLeft, dueDate, last, text, short, eta };
}
// soonest-needed first (most overdue at the top); then never-recorded; then records only
const RANK = { red: 0, amber: 0, green: 0, unknown: 1, none: 2 };
export function carItems(carId, { withStatus = true, care = false } = {}) {
  const list = live(state.items).filter(i => i.carId === carId && !i.hidden && (care ? i.group === 'care' : i.group !== 'care')).map(i => ({ ...i, st: withStatus ? status(i) : null }));
  return list.sort((a, b) => RANK[a.st.level] - RANK[b.st.level] || (a.st.eta ?? 1e9) - (b.st.eta ?? 1e9) || a.name.localeCompare(b.name));
}
export function carLevel(carId) {
  const it = carItems(carId);
  const n = l => it.filter(i => i.st.level === l).length;
  return { red: n('red'), amber: n('amber'), green: n('green'), level: n('red') ? 'red' : n('amber') ? 'amber' : 'green' };
}

/* ---------- fuel ---------- */
/** L/100km for each full fill, counting any partial fills in between */
export function economy(carId) {
  const f = live(state.fills).filter(x => x.carId === carId).sort((a, b) => a.odo - b.odo || a.date.localeCompare(b.date));
  const out = []; let prevFull = null, acc = 0, broken = false;
  for (const x of f) {
    if (prevFull == null) { if (x.full) prevFull = x; continue; }
    acc += x.litres || 0;
    if (x.missed) broken = true;
    if (x.full) {
      const dist = x.odo - prevFull.odo;
      if (!broken && dist > 20 && acc > 0) {
        const l100 = acc / dist * 100;
        if (l100 > 2 && l100 < 40) out.push({ id: x.id, date: x.date, odo: x.odo, l100, dist, litres: acc, station: x.station, tag: x.tag || '' });
      }
      prevFull = x; acc = 0; broken = false;
    }
  }
  return out;
}
export function fuelStats(carId) {
  const e = economy(carId);
  const from = ymd(new Date(today() - 365 * DAY));
  const normal = e.filter(x => !x.tag);   // towing / 4WD / track tanks are kept out of the averages
  const yr = normal.filter(x => x.date >= from);
  const avg = list => { const L = list.reduce((s, x) => s + x.litres, 0), D = list.reduce((s, x) => s + x.dist, 0); return D ? L / D * 100 : null; };
  const fills = live(state.fills).filter(x => x.carId === carId);
  const lastFill = fills.sort((a, b) => b.odo - a.odo)[0];
  const rate = kmPerDay(carId);
  return { series: e, last: e[e.length - 1] || null, avgYear: avg(yr.length >= 3 ? yr : normal), avgAll: avg(normal), best: normal.length ? Math.min(...normal.map(x => x.l100)) : null,
    lastFill, kmMonth: rate ? rate * 30.44 : null };
}
export function maxLitres(carId) {
  const l = live(state.fills).filter(x => x.carId === carId).map(x => x.litres || 0);
  return l.length ? Math.max(...l) : null;
}
export function longestTank(carId) {
  const e = economy(carId);
  return e.length ? Math.max(...e.map(x => x.dist)) : null;
}

/* ---------- "is this the right car?" ---------- */
/** Returns null when the reading looks fine, otherwise { msg, otherCar } */
export function checkReading(carId, odo, { litres, date } = {}) {
  const car = state.cars.find(c => c.id === carId);
  const cur = carOdo(carId);
  const others = live(state.cars).filter(c => c.id !== carId).map(c => ({ car: c, odo: carOdo(c.id).odo }));
  const plausibleFor = (cid, last) => {
    const rate = kmPerDay(cid) || 60;
    const lastR = carOdo(cid);
    const days = lastR.date ? Math.max(1, daysBetween(lastR.date, date || ymd())) : 30;
    return odo >= last - 1 && odo - last <= Math.max(1500, rate * days * 3);
  };
  const better = others.find(o => o.odo && plausibleFor(o.car.id, o.odo) && Math.abs(odo - o.odo) < Math.abs(odo - cur.odo));
  const why = [];
  if (cur.odo && odo < cur.odo - 1) why.push(`It's lower than the ${car.name}'s last reading of ${km(cur.odo)} km.`);
  else if (cur.odo && !plausibleFor(carId, cur.odo)) why.push(`That's ${km(odo - cur.odo)} km since the ${car.name}'s last reading of ${km(cur.odo)} km, more than it usually travels.`);
  const tank = maxLitres(carId);
  if (litres && tank && litres > tank * 1.12) why.push(`${litres} L is more than the ${car.name} has ever taken (${tank.toFixed(1)} L).`);
  if (!why.length) return null;
  return { msg: why.join(' '), otherCar: better?.car || null };
}

/** Was this tank noticeably worse than the car's usual? null if fine. */
export function economyAlert(carId, fillId) {
  const e = economy(carId), me = e.find(x => x.id === fillId);
  if (!me || me.tag) return null;
  const from = ymd(new Date(parseDay(me.date) - 365 * DAY));
  const base = e.filter(x => !x.tag && x.id !== fillId && x.date >= from && x.date <= me.date);
  if (base.length < 4) return null;
  const avg = base.reduce((s, x) => s + x.litres, 0) / base.reduce((s, x) => s + x.dist, 0) * 100;
  const pct = (me.l100 - avg) / avg * 100;
  return pct >= 12 ? { pct: Math.round(pct), avg, l100: me.l100 } : null;
}

/* ---------- tyres ---------- */
const TYRE_MIN = 3;   // mm – a sensible replace point (legal minimum is 1.5 mm)
export function dotDate(dot) { const m = String(dot || '').match(/^(\d{2})(\d{2})$/); if (!m) return null; const d = new Date(2000 + +m[2], 0, 1 + (+m[1] - 1) * 7); return d; }
export function tyreStatus(t) {
  const out = {};
  const made = dotDate(t.dot);
  if (made) {
    const yrs = (today() - made) / (365.25 * DAY);
    out.age = { years: yrs, frac: yrs / 6, level: yrs >= 6 ? 'red' : yrs >= 5 ? 'amber' : 'green', text: `${yrs.toFixed(1)} years old (made ${made.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })})` };
  }
  const rs = [...(t.readings || [])].sort((a, b) => a.odo - b.odo);
  const start = t.newTread ? { odo: t.fittedOdo || 0, mm: +t.newTread } : rs[0];
  const last = rs[rs.length - 1];
  if (start && last && start.mm > TYRE_MIN) {
    const used = (start.mm - last.mm) / (start.mm - TYRE_MIN);
    const dist = last.odo - start.odo, wear = dist > 500 ? (start.mm - last.mm) / dist : null;
    const kmLeft = wear > 0 ? (last.mm - TYRE_MIN) / wear - (carOdo(t.carId).odo - last.odo) : null;
    out.tread = { mm: last.mm, frac: Math.max(0, used), level: last.mm <= TYRE_MIN ? 'red' : used >= 0.85 ? 'amber' : 'green',
      text: `${last.mm} mm left${kmLeft != null ? ` · about ${km(Math.max(0, kmLeft))} km to ${TYRE_MIN} mm` : ''}` };
  }
  out.km = t.fittedOdo != null ? carOdo(t.carId).odo - t.fittedOdo : null;
  return out;
}
export const currentTyres = carId => live(state.tyres).filter(t => t.carId === carId && !t.removedDate).sort((a, b) => (b.fittedDate || '').localeCompare(a.fittedDate || ''));

/* ---------- trips ---------- */
export const activeTrip = (carId, date = ymd()) => live(state.trips).find(t => t.carId === carId && t.start <= date && date <= (t.end || t.start));
export const upcomingTrips = () => live(state.trips).filter(t => (t.end || t.start) >= ymd(new Date(today() - 14 * DAY))).sort((a, b) => a.start.localeCompare(b.start));
