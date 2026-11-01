export const KEY = 'show-log-v2';
export const API = '/api/shows';
export const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)(new Date());
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export let filt = {q:'', type:'', city:''};

// Variables reassigned from more than one module
export const state = {
  showAllMost: false,
  view: 'log',
  statsSection: null,
  shows: [],
  mode: 'local',
  idn: null,
  user: null,
  stampId: null,
  LISTEN: null,
  historyFor: null,
  INFO: {artists:{}, venues:{}},
};
