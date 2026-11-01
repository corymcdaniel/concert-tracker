import { loadRaw } from './api.js';
import { toast } from './motion.js';
import { closeSheet, openSheet } from './sheets.js';
import { state } from './state.js';
import { $, esc, withPlace } from './util.js';
import { render } from './view.js';

/* ---------- Netlify Identity ---------- */

export const canEdit = () => state.mode !== 'netlify' || !!state.user;
export function applyAuth(){
  document.body.classList.toggle('readonly', !canEdit());
  const b = $('#btnAuth'); if (!b) return;
  b.hidden = state.mode !== 'netlify';
  $('#btnHistory').hidden = state.mode !== 'netlify' || !state.user;
  b.textContent = state.user ? 'Sign out' : 'Sign in';
  b.title = state.user ? `Signed in as ${state.user.email||state.user.name||''}` : '';
  if (state.mode==='netlify') setState(state.user ? (state.user.name||state.user.email||'Signed in') : 'View only');
  reloadForUser();
}
// Prices and companions only come back when signed in, so the list follows who's signed in
let loadedFor = '';
async function reloadForUser(){
  if (state.mode !== 'netlify') return;
  const who = state.user?.email || state.user?.name || '';
  if (who === loadedFor) return;
  loadedFor = who;
  await loadRaw(); state.shows = state.shows.map(withPlace); render();
}
export async function initIdentity(){
  try { state.idn = await import('@netlify/identity'); } catch { return; }
  try {
    const res = await state.idn.handleAuthCallback();
    if (res?.type === 'invite') openSetPassword('invite', res.token);
    else if (res?.type === 'recovery') openSetPassword('recovery');
    else if (res?.type === 'oauth' || res?.type === 'confirmation') toast('Signed in');
  } catch(e){ toast('That sign-in link didn’t work. It may have expired.'); }
  state.user = await state.idn.getUser();
  state.idn.onAuthChange((ev, u) => { state.user = u; applyAuth(); });
}
export async function openLogin(msg){
  if (!state.idn) return;
  let providers = {}; try { providers = (await state.idn.getSettings()).providers || {}; } catch {}
  const names = {google:'Google', github:'GitHub', gitlab:'GitLab', bitbucket:'Bitbucket'};
  const oauth = Object.keys(names).filter(p => providers[p]);
  openSheet(`<h3>Sign in</h3><form id="frm">
    ${msg?`<p class="hint" style="font-size:14px">${esc(msg)}</p>`:''}
    ${oauth.map(p=>`<button type="button" data-oauth="${p}">Continue with ${names[p]}</button>`).join('')}
    ${providers.email!==false?`${oauth.length?'<p class="hint" style="text-align:center">or</p>':''}
    <label for="f-email">Email<input id="f-email" type="email" autocomplete="email" required></label>
    <label for="f-pass">Password<input id="f-pass" type="password" autocomplete="current-password" required></label>
    <div class="foot"><button class="primary" type="submit">Sign in</button><button type="button" data-close>Cancel</button><span class="spacer"></span><button type="button" id="forgot">Forgot password</button></div>`:''}
    <div id="authErr" class="hint" role="alert"></div></form>`);
  document.querySelectorAll('[data-oauth]').forEach(b => b.onclick = () => state.idn.oauthLogin(b.dataset.oauth));
  $('#frm').addEventListener('submit', async e => { e.preventDefault();
    try { state.user = await state.idn.login($('#f-email').value, $('#f-pass').value); closeSheet(); applyAuth(); toast('Signed in'); }
    catch(err){ $('#authErr').textContent = err?.status===401 ? 'Wrong email or password.' : (err?.message || 'Sign-in failed. Try again.'); } });
  $('#forgot') && ($('#forgot').onclick = async () => { const em=$('#f-email').value; if(!em){ $('#authErr').textContent='Enter your email first.'; return; }
    try { await state.idn.requestPasswordRecovery(em); $('#authErr').textContent='Check your email for a reset link.'; } catch { $('#authErr').textContent='Couldn’t send the reset email.'; } });
}
function openSetPassword(kind, token){
  openSheet(`<h3>${kind==='invite'?'Accept invite':'New password'}</h3><form id="frm">
    <label for="f-pass">Choose a password<input id="f-pass" type="password" autocomplete="new-password" minlength="8" required></label>
    <div class="foot"><button class="primary" type="submit">Save password</button></div><div id="authErr" class="hint" role="alert"></div></form>`);
  $('#frm').addEventListener('submit', async e => { e.preventDefault();
    try { state.user = kind==='invite' ? await state.idn.acceptInvite(token, $('#f-pass').value) : await state.idn.updateUser({password:$('#f-pass').value});
      closeSheet(); applyAuth(); toast('Password saved. You’re signed in.'); }
    catch(err){ $('#authErr').textContent = err?.message || 'Couldn’t save the password.'; } });
}
export function setState(s){ $('#saveState').textContent = s; }
