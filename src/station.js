// Works out which servo you're at: first from your own past fill-ups nearby (works offline),
// otherwise from OpenStreetMap's list of fuel stations (free, no account needed).
import { state } from './store.js';
import { live } from './calc.js';

const R = 6371000;
export function metres(a, b) {
  const t = x => x * Math.PI / 180;
  const dLat = t(b.lat - a.lat), dLng = t(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function here(timeout = 10000) {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('no location'));
    navigator.geolocation.getCurrentPosition(p => res({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }),
      e => rej(e), { enableHighAccuracy: true, timeout, maximumAge: 60000 });
  });
}

function fromHistory(pos) {
  let best = null;
  for (const f of live(state.fills)) {
    if (!f.station || f.lat == null) continue;
    const d = metres(pos, f);
    if (d < 180 && (!best || d < best.d)) best = { d, name: f.station };
  }
  return best?.name || null;
}

async function fromMap(pos) {
  if (!navigator.onLine) return null;
  const q = `[out:json][timeout:8];nwr(around:250,${pos.lat},${pos.lng})[amenity=fuel];out center 5;`;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q), { signal: ctl.signal });
    if (!r.ok) return null;
    const els = (await r.json()).elements || [];
    let best = null;
    for (const e of els) {
      const at = { lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon };
      if (at.lat == null) continue;
      const d = metres(pos, at);
      if (!best || d < best.d) best = { d, tags: e.tags || {} };
    }
    if (!best) return null;
    const { brand, name, 'addr:suburb': suburb } = best.tags;
    let label = name || brand || '';
    if (brand && name && !name.toLowerCase().includes(brand.toLowerCase())) label = `${brand} ${name}`;
    if (brand && !name && suburb) label = `${brand} ${suburb}`;
    return label || null;
  } catch (e) { return null; } finally { clearTimeout(t); }
}

/** { pos, name } — name may be null when nothing is found */
export async function detectStation() {
  const pos = await here();
  return { pos, name: fromHistory(pos) || await fromMap(pos) };
}
