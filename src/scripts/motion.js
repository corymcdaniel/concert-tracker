import { $ } from './util.js';

/* ---------- motion ---------- */
export const motionOK = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
// The FX toggle (main.js): off is the simple view, without the mouse effects, foil shimmer or light switch
export const effectsOn = () => document.documentElement.dataset.effects !== 'off';
// open = shown and not on its way out
export const isOpen = el => !el.hidden && !el.classList.contains('closing');
export function show(el){ el.classList.remove('closing'); el.hidden = false; }
// Plays the element's .closing animation, then hides it. Showing it again meanwhile cancels the hide.
export function hide(el){
  if (!isOpen(el)) return;
  if (!motionOK()) { el.hidden = true; return; }
  el.classList.add('closing');
  el.addEventListener('animationend', function done(e){
    if (e.target !== el) return;
    el.removeEventListener('animationend', done);
    if (!el.classList.contains('closing')) return;
    el.classList.remove('closing'); el.hidden = true;
  });
}
// Restart a CSS animation class on an element that's already showing
function replay(el, cls){ el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

export function toast(msg){ const t=$('#toast'); t.textContent=msg; show(t); replay(t,'pop'); clearTimeout(toast.h); toast.h=setTimeout(()=>hide(t),2200); }
// Runs fn, which redraws the list, then animates each stub still on screen from where it was
export function flip(fn){
  if (!motionOK()) { fn(); return; }
  const onScreen = r => r.bottom > 0 && r.top < innerHeight;
  const was = new Map();
  document.querySelectorAll('.stub').forEach(el => {
    const r = el.getBoundingClientRect();
    if (onScreen(r)) was.set(el.dataset.k, r.top);
  });
  fn();
  const opts = {duration:300, easing:'cubic-bezier(.2,.7,.3,1)'};
  document.querySelectorAll('.stub').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!onScreen(r)) return;
    if (!was.has(el.dataset.k)) { el.animate([{opacity:0}, {opacity:1}], opts); return; }
    const dy = was.get(el.dataset.k) - r.top;
    if (Math.abs(dy) > 1) el.animate([{transform:`translateY(${dy}px)`}, {transform:'none'}], opts);
  });
}
