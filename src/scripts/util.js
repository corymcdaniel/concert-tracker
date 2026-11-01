import { TODAY } from './state.js';

export const $ = s => document.querySelector(s);
const PLACES = {"Phoenix": ["AZ", "US"], "Tempe": ["AZ", "US"], "San Diego": ["CA", "US"], "Atlanta": ["GA", "US"], "Brooklyn": ["NY", "US"], "New York": ["NY", "US"], "Chicago": ["IL", "US"], "Detroit": ["MI", "US"], "Grand Rapids": ["MI", "US"], "Toronto": ["ON", "Canada"], "Osaka": ["Osaka", "Japan"]};
export const withPlace = s => { const p = PLACES[s.city]; return {...s, state: s.state ?? (p?p[0]:''), country: s.country || (p?p[1]:'US')}; };
export const place = o => !o.city ? '' : o.country && o.country !== 'US' ? `${o.city}, ${o.state && o.state!==o.city ? o.state+', ' : ''}${o.country}` : o.state ? `${o.city}, ${o.state}` : o.city;
export const cityKey = o => place(o);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const store = { get(k){try{return localStorage.getItem(k)}catch{return null}}, set(k,v){try{localStorage.setItem(k,v)}catch{}} };
export const newId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
// a show counts toward stats the day after it happens; undated shows are in the past
export const happened = s => !s.date || s.date < TODAY;
