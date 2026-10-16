// Reads upcoming events from The Grayt Schedule (read-only) so planned trips show up in GraytCars.
// Uses the same Google sign-in as Drive backups, with the narrow "view events" permission.
import { googleClientId, ownerEmail, tripCalendarId } from './config.js';
import { TRIP_WORDS } from './catalogue.js';

const SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
let token = null, tokenExp = 0;
const KEY = 'gc-cal-ok';
export const calendarConnected = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = res; s.onerror = () => rej(new Error('Could not reach Google')); document.head.appendChild(s); });
}
async function getToken(interactive) {
  if (token && Date.now() < tokenExp - 60000) return token;
  if (!navigator.onLine) throw new Error('offline');
  await loadGis();
  return new Promise((resolve, reject) => {
    google.accounts.oauth2.initTokenClient({
      client_id: googleClientId, scope: SCOPE, hint: ownerEmail, prompt: interactive ? '' : 'none',
      callback: r => { if (r.error) return reject(new Error(r.error)); token = r.access_token; tokenExp = Date.now() + r.expires_in * 1000; try { localStorage.setItem(KEY, '1'); } catch (e) {} resolve(token); },
      error_callback: e => reject(new Error(e.type || 'Calendar permission was not granted')),
    }).requestAccessToken();
  });
}

let cache = null, cacheAt = 0;
/** Trip-like events in the next 120 days: [{ id, title, start, end, location }] */
export async function tripEvents(interactive = false) {
  if (!interactive && cache && Date.now() - cacheAt < 30 * 60000) return cache;
  const t = await getToken(interactive);
  const now = new Date(), max = new Date(Date.now() + 120 * 864e5);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tripCalendarId)}/events?singleEvents=true&orderBy=startTime&maxResults=100&timeMin=${now.toISOString()}&timeMax=${max.toISOString()}`;
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
  if (!r.ok) throw new Error('Calendar ' + r.status);
  const items = (await r.json()).items || [];
  const day = v => (v?.date || v?.dateTime || '').slice(0, 10);
  cache = items.filter(e => TRIP_WORDS.test(`${e.summary || ''} ${e.description || ''} ${e.location || ''}`))
    .map(e => {
      let end = day(e.end); if (e.end?.date) { const d = new Date(end); d.setDate(d.getDate() - 1); end = d.toISOString().slice(0, 10); }   // all-day ends are exclusive
      return { id: e.id, title: e.summary || 'Trip', start: day(e.start), end, location: e.location || '' };
    });
  cacheAt = Date.now();
  return cache;
}

export { calendarLink } from './calendar-link.js';
