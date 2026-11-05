import { state } from './state.js';
import { $, store } from './util.js';

/* ---------- Google Analytics (GA4), only with the visitor's consent ----------
   The Measurement ID comes from the PUBLIC_GA_ID environment variable at build time (Netlify site settings).
   Nothing loads, and nothing is sent, until the visitor picks Allow in the banner. Their choice is remembered,
   and the footer's Analytics button reopens the banner to change it.
   Never runs on localhost or Netlify deploy previews, and stops sending once you're signed in as an editor. */
const GA_ID = import.meta.env.PUBLIC_GA_ID;
const KEY = 'show-log-analytics';

const host = location.hostname;
// Deploy previews and branch deploys are "something--site.netlify.app"
const isLive = !['localhost', '127.0.0.1', '[::1]'].includes(host) && !host.includes('--');
export const analyticsAvailable = () => Boolean(GA_ID) && isLive;

let loaded = false, lastPath = '', ready = false;
const allowed = () => store.get(KEY) === 'granted';
// Editors are you: signed in on the live site
const counting = () => ready && analyticsAvailable() && allowed() && !state.user;

function load(){
  if (loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  // Page views are sent by hand, since the views and Stats sections are one page. No ads features.
  window.gtag('config', GA_ID, {send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false});
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.append(s);
}

// The view you're on, as a path GA can group: / for the log, /stats, /stats/artists, ...
function currentPage(){
  if (state.view !== 'stats') return {path: '/', title: 'Log'};
  if (!state.statsSection) return {path: '/stats', title: 'Stats'};
  const name = state.statsSection[0].toUpperCase() + state.statsSection.slice(1);
  return {path: `/stats/${state.statsSection}`, title: `Stats · ${name}`};
}

export function trackView(){
  if (!counting()) return;
  const {path, title} = currentPage();
  // Redrawing the same view isn't a new page view
  if (path === lastPath) return;
  lastPath = path;
  load();
  window.gtag('event', 'page_view', {page_path: path, page_location: location.origin + path, page_title: title});
}

export function track(name, params = {}){
  if (!counting()) return;
  load();
  window.gtag('event', name, params);
}

// Called once sign-in is known (main.js), so your own first page view isn't counted before we know it's you
export function analyticsReady(){ ready = true; trackView(); }

/* ---------- the consent banner ---------- */
function choose(granted){
  let value = 'denied';
  if (granted) value = 'granted';
  store.set(KEY, value);
  // Once gtag has loaded it can't be unloaded, but this stops it sending anything more
  if (GA_ID) window[`ga-disable-${GA_ID}`] = !granted;
  $('#consent').hidden = true;
  if (granted) { lastPath = ''; trackView(); }
}

export function openConsent(){
  if (!analyticsAvailable()) return;
  $('#consent').hidden = false;
  $('#consentAllow').focus({preventScroll: true});
}

export function initAnalytics(){
  const btn = $('#btnAnalytics');
  if (!analyticsAvailable()) { btn.hidden = true; return; }
  btn.hidden = false;
  btn.onclick = openConsent;
  $('#consentAllow').onclick = () => choose(true);
  $('#consentDeny').onclick = () => choose(false);
  // Ask once; after that the footer button is the way to change your mind
  if (store.get(KEY) === null) $('#consent').hidden = false;
  if (store.get(KEY) === 'denied') window[`ga-disable-${GA_ID}`] = true;
}
