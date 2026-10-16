// One-off upgrades to Nathan's records, each run once (tracked in meta/setup).
// Only adds or fills in — never removes history. Items he's hidden or renamed are left alone.
import { state, save, saveMeta } from './store.js';
import { live } from './calc.js';
import { basicsItem, BASICS, careItems, WORKSHOPS } from './catalogue.js';

const idFor = (carId, name) => carId.replace('c-', 'i-') + '-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const findItem = (carId, re) => live(state.items).find(i => i.carId === carId && re.test(i.name));

/** Add an item if the car has nothing like it; if it exists but has no reminder, give it the interval. */
function ensure(carId, re, item) {
  const cur = findItem(carId, re);
  if (!cur) return save('items', { id: idFor(carId, item.name), carId, includes: [], source: 'GraytCars', everyKm: null, everyMonths: null, ...item });
  const upd = { id: cur.id };
  if (!cur.everyKm && !cur.everyMonths && (item.everyKm || item.everyMonths)) { upd.everyKm = item.everyKm || null; upd.everyMonths = item.everyMonths || null; }
  if (item.trackPart && !cur.trackPart) upd.trackPart = true;
  if (item.baseline && !cur.baseline) upd.baseline = item.baseline;
  if (item.notes && !cur.notes) upd.notes = item.notes;
  if (item.kind && cur.kind !== item.kind && item.kind === 'check') upd.kind = 'check';
  if (Object.keys(upd).length > 1) return save('items', upd);
}

const STEPS = {
  // v1: Monthly basics on every car; retire the unused stand-alone tyre-pressure check
  1() {
    for (const c of live(state.cars)) {
      const b = basicsItem(c.id);
      if (!state.items.some(i => i.id === b.id)) save('items', b);
      const tp = state.items.find(i => i.id === c.id.replace('c-', 'i-') + '-tyre-pressures' && !i.hidden && !i.deleted);
      if (tp && tp.source === 'GraytCars' && !state.logs.some(l => l.items?.includes(tp.id))) save('items', { id: tp.id, hidden: true });
    }
  },
  // v2: Nathan's confirmed jobs (16 Oct 2026) and his monthly checklist
  2() {
    for (const c of live(state.cars)) {
      const basics = state.items.find(i => i.id === basicsItem(c.id).id);
      if (basics) save('items', { id: basics.id, checklist: BASICS });
    }
    const M = state.cars.find(c => c.id === 'c-mustang' && !c.deleted), E = state.cars.find(c => c.id === 'c-everest' && !c.deleted);
    if (M) {
      ensure(M.id, /catch ?can/i, { name: 'Empty catch can', kind: 'job', everyKm: 5000 });
      ensure(M.id, /wiper/i, { name: 'Wiper blades', kind: 'job', everyMonths: 12, trackPart: true });
      ensure(M.id, /cabin/i, { name: 'Cabin filter', kind: 'job', everyKm: 30000, everyMonths: 24 });
      // brake fluid flush noted on the 10 Mar 2026 service
      ensure(M.id, /brake fluid/i, { name: 'Brake fluid', kind: 'job', everyMonths: 36, baseline: { odo: 27641, date: '2026-03-10' } });
      ensure(M.id, /coolant/i, { name: 'Coolant change', kind: 'job', everyMonths: 60, notes: 'Ford: first change at 10 years / 320,000 km, then every 5 years / 160,000 km.' });
      // factory plugs assumed (no replacement on record)
      ensure(M.id, /spark|plugs/i, { name: 'Spark plugs', kind: 'job', everyKm: 150000, baseline: { odo: 0, date: null }, trackPart: true, notes: 'Factory plugs assumed – log the change if they’ve been replaced.' });
      ensure(M.id, /battery/i, { name: 'Battery', kind: 'check', everyMonths: 12, trackPart: true });
      ensure(M.id, /pads|rotors/i, { name: 'Brake pads and rotors', kind: 'job', trackPart: true });
    }
    if (E) {
      ensure(E.id, /wiper/i, { name: 'Wiper blades', kind: 'job', everyMonths: 12, trackPart: true });
      // cabin filter changed at the 24 Feb 2025 service
      ensure(E.id, /cabin/i, { name: 'Cabin filter', kind: 'job', everyKm: 30000, everyMonths: 24, baseline: { odo: 18700, date: '2025-02-24' }, notes: 'Ryco RCA460M' });
      // brake fluid flush noted on the 2 Mar 2026 service
      ensure(E.id, /brake fluid/i, { name: 'Brake fluid', kind: 'job', everyMonths: 24, baseline: { odo: 27755, date: '2026-03-02' } });
      ensure(E.id, /coolant/i, { name: 'Coolant change', kind: 'job', everyMonths: 60 });
      ensure(E.id, /battery/i, { name: 'Battery', kind: 'check', everyMonths: 12, trackPart: true });
      ensure(E.id, /pads|rotors/i, { name: 'Brake pads and rotors', kind: 'job', trackPart: true });
      ensure(E.id, /replace.*pre-?filter|pre-?filter.*replace/i, { name: 'Replace diesel pre-filter', kind: 'job', everyKm: 40000 });
      ensure(E.id, /drain/i, { name: 'Drain water from pre-filter', kind: 'job', everyKm: 5000 });
      ensure(E.id, /factory fuel filter|fuel filter \(factory\)/i, { name: 'Factory fuel filter', kind: 'job', trackPart: true, notes: 'Ford part KV6Z9155E (check against VIN). Add the interval from your logbook.' });
    }
  },
  // v3: Wash & paint care items, workshop contacts, dash style per car
  3() {
    for (const c of live(state.cars)) {
      for (const it of careItems(c)) if (!state.items.some(i => i.id === it.id)) save('items', { carId: c.id, includes: [], source: 'GraytCars', everyKm: null, everyMonths: null, ...it });
      if (!c.cluster) save('cars', { id: c.id, cluster: /everest|ranger|suv|4wd/i.test(c.name + (c.shape || '')) ? 'offroad' : 'track' });
    }
    if (!state.meta.workshops?.list?.length) saveMeta('workshops', { list: WORKSHOPS });
  },
};

export function runSetup() {
  const done = state.meta.setup?.version || 0;
  const latest = Math.max(...Object.keys(STEPS).map(Number));
  if (done >= latest || !live(state.cars).length) return;
  for (let v = done + 1; v <= latest; v++) STEPS[v]();
  saveMeta('setup', { version: latest });
}
