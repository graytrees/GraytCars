// All records live in Firestore under users/{uid}/…  (one owner)
//   cars    – one per vehicle (name, colour, photo, specs)
//   items   – maintenance items per car (interval in km and/or months)
//   logs    – work done (one entry can tick several items, e.g. a service)
//   fills   – fuel fill-ups
//   meta    – settings, backup status
// History is never silently lost: edits keep the previous version in `revisions`,
// deletes only set `deleted: true` (restorable from the Recycle bin).
import {
  collection, doc, onSnapshot, writeBatch, setDoc, updateDoc, arrayUnion, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db } from './firebase.js';

export const COLS = ['cars', 'items', 'logs', 'fills', 'mods', 'tyres', 'trips', 'meta'];
export const state = { cars: [], items: [], logs: [], fills: [], mods: [], tyres: [], trips: [], meta: {}, ready: {}, pending: false };

let uid = null;
const unsubs = [];
const listeners = new Set();
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
let emitT; const emit = () => { clearTimeout(emitT); emitT = setTimeout(() => listeners.forEach(fn => fn(state)), 16); };

export const newId = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const col = name => collection(db, 'users', uid, name);
const ref = (name, id) => doc(db, 'users', uid, name, id);

export function start(userId) {
  stop();
  uid = userId;
  for (const name of COLS) {
    unsubs.push(onSnapshot(col(name), { includeMetadataChanges: true }, snap => {
      const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      if (name === 'meta') state.meta = Object.fromEntries(docs.map(d => [d.id, d]));
      else state[name] = docs;
      state.ready[name] = true;
      state.pending = snap.metadata.hasPendingWrites;
      emit();
    }, err => { console.error(name, err); state.error = err.message; emit(); }));
  }
}
export function stop() { unsubs.splice(0).forEach(u => u()); }
export const allReady = () => COLS.every(c => state.ready[c]);

const stamp = () => ({ updatedAt: serverTimestamp() });

/** Create or update a record. Updates keep the previous version in `revisions`. */
export async function save(name, rec) {
  const id = rec.id || newId(name[0]);
  const cur = (state[name] || []).find(x => x.id === id);
  const { revisions, updatedAt, ...plain } = cur || {};
  const data = { ...rec, id, ...stamp() };
  if (!cur) data.createdMs = Date.now();
  if (cur && name !== 'cars') data.revisions = arrayUnion({ ...plain, at: Date.now() });
  await setDoc(ref(name, id), data, { merge: true });
  return id;
}
export async function saveMany(name, recs) {
  for (let i = 0; i < recs.length; i += 400) {
    const b = writeBatch(db);
    for (const r of recs.slice(i, i + 400)) b.set(ref(name, r.id), { ...r, ...stamp() }, { merge: true });
    await b.commit();
  }
}
export const remove = (name, id) => updateDoc(ref(name, id), { deleted: true, deletedMs: Date.now(), ...stamp() });
export const restore = (name, id) => updateDoc(ref(name, id), { deleted: false, ...stamp() });
export const saveMeta = (id, data) => setDoc(ref('meta', id), { ...data, ...stamp() }, { merge: true });

/* ---------- full export (backups) ---------- */
export async function exportAll() {
  const out = { exported: new Date().toISOString(), app: 'GraytCars', version: 1 };
  for (const name of COLS) {
    const snap = await getDocs(col(name));
    out[name] = snap.docs.map(d => {
      const x = { ...d.data(), id: d.id };
      for (const k of Object.keys(x)) if (x[k] && typeof x[k].toDate === 'function') x[k] = x[k].toDate().toISOString();
      return x;
    });
  }
  return out;
}
