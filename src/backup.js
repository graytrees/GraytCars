// Weekly backup: every record exported to Drive (GraytCars/Backups) as a JSON file plus
// spreadsheet-friendly CSVs of the fuel log and the work history. Readable without the app.
import { exportAll, saveMeta, state } from './store.js';
import { upload, driveConnected } from './drive.js';
import { ymd } from './calc.js';

const WEEK = 7 * 864e5;
function csv(rows) {
  const q = v => { const s = Array.isArray(v) ? v.join('; ') : String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return rows.map(r => r.map(q).join(',')).join('\n');
}

export async function backupNow(interactive = false) {
  const data = await exportAll();
  const day = ymd();
  const car = Object.fromEntries(data.cars.map(c => [c.id, c.name]));
  const item = Object.fromEntries(data.items.map(i => [i.id, i.name]));
  // car photos are already inside the JSON; keep the CSVs small and readable
  await upload(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), `graytcars-backup-${day}.json`, 'Backups', interactive);
  const fuel = [['Car', 'Date', 'Odometer (km)', 'Litres', 'Full tank', 'Station', 'Latitude', 'Longitude', 'Notes', 'Deleted'],
    ...data.fills.sort((a, b) => a.date.localeCompare(b.date)).map(f => [car[f.carId], f.date, f.odo, f.litres, f.full ? 'yes' : 'partial', f.station, f.lat ?? '', f.lng ?? '', f.notes, f.deleted ? 'yes' : ''])];
  await upload(new Blob([csv(fuel)], { type: 'text/csv' }), `graytcars-fuel-${day}.csv`, 'Backups', interactive);
  const work = [['Car', 'Date', 'Odometer (km)', 'Work done', 'Result', 'Where', 'Notes', 'Deleted'],
    ...data.logs.sort((a, b) => a.date.localeCompare(b.date)).map(l => [car[l.carId], l.date, l.odo, [...(l.items || []).map(i => item[i] || i), l.title].filter(Boolean),
      Object.entries(l.results || {}).map(([k, v]) => `${item[k] || k}: ${v === 'attention' ? 'needs attention' : 'OK'}`), l.where, l.notes, l.deleted ? 'yes' : ''])];
  await upload(new Blob([csv(work)], { type: 'text/csv' }), `graytcars-work-${day}.csv`, 'Backups', interactive);
  await saveMeta('backup', { lastMs: Date.now(), lastDay: day, fills: data.fills.length, logs: data.logs.length });
  return day;
}

/** Called on app start: back up if the last one was over a week ago. */
export async function maybeWeeklyBackup() {
  if (!navigator.onLine || !driveConnected()) return null;
  if (Date.now() - (state.meta.backup?.lastMs || 0) < WEEK) return null;
  try { return await backupNow(false); } catch (e) { console.warn('backup deferred', e); return null; }
}
