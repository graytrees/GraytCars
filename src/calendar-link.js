import { tripCalendarId } from './config.js';
/** Link that opens Google Calendar with the event filled in, on The Grayt Schedule */
export function calendarLink({ title, start, end, details = '', location = '' }) {
  const d = s => s.replace(/-/g, '');
  const e = new Date(end || start); e.setDate(e.getDate() + 1);
  const p = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${d(start)}/${e.toISOString().slice(0, 10).replace(/-/g, '')}`, details, location, src: tripCalendarId });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}
