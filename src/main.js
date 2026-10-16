import './styles.css';
import { onUser, signIn, signOut } from './firebase.js';
import { start } from './store.js';
import { startApp } from './app.js';
import { applyPrefs } from './ui.js';
import { ownerEmail } from './config.js';
import { registerSW } from 'virtual:pwa-register';

applyPrefs();
const main = document.getElementById('main');
const gate = html => { main.innerHTML = `<div class="gate"><span class="mark" aria-hidden="true">GC</span><h1>GraytCars</h1>${html}</div>`; };

// Home-screen shortcuts open straight into a fill-up: ?fill=c-mustang
const q = new URLSearchParams(location.search);
const launch = q.get('fill') ? { fill: q.get('fill') } : q.get('log') ? { log: q.get('log') } : null;
if (launch) history.replaceState(null, '', location.pathname + location.hash);

let started = false;
onUser(user => {
  if (!user) {
    gate(`<p class="muted">Your cars, their jobs and every tank.</p><button class="btn" id="signin">Sign in with Google</button><p class="err" id="gateErr"></p>`);
    document.getElementById('signin').onclick = () => signIn().catch(e => { document.getElementById('gateErr').textContent = e.code === 'auth/popup-closed-by-user' ? '' : 'Sign-in failed: ' + e.message; });
    return;
  }
  if (user.email !== ownerEmail) {
    gate(`<p>This app is private. ${user.email} doesn't have access.</p><button class="btn ghost" id="out">Use a different account</button>`);
    document.getElementById('out').onclick = () => signOut();
    return;
  }
  if (started) return; started = true;
  window.__userEmail = user.email;
  start(user.uid);
  startApp({ launch });
});

// Installable + offline. A new version shows a small banner instead of interrupting.
const updateSW = registerSW({
  onNeedRefresh() {
    const b = document.createElement('button');
    b.className = 'toast update'; b.textContent = 'Update available – tap to refresh';
    b.onclick = () => updateSW(true);
    document.body.appendChild(b);
  },
});
