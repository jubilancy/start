// Config store: config.json is the shipped default; localStorage holds the user's edits.
import { clone, deepMerge, debounce } from './util.js';

const KEY = 'startpage.config.v1';
const VERSION = 1;

export const DEFAULT_SETTINGS = {
  title: 'startpage',
  favicon: { type: 'default', value: '' },       // default | emoji | url | upload
  theme: { mode: 'light', vars: {}, customCss: '' }, // light | dark | auto (vars override any mode)
  font: { family: '', googleFont: '', dataUrl: '', dataName: '' },
  background: { type: 'none', value: '' },       // none | color | gradient | image | upload
  location: { name: 'Alexandria, Virginia', lat: 38.8048, lon: -77.0469 },
  units: 'imperial',                              // imperial | metric
  workerUrl: '',
  workerToken: '',
};

let cfg = null;
const subs = new Set();
let lastError = null;

const persist = debounce(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
    lastError = null;
  } catch (e) {
    lastError = e;
    emit('error', e);
  }
}, 250);

function emit(kind, payload) { subs.forEach(fn => fn(kind, payload)); }

export const on = fn => { subs.add(fn); return () => subs.delete(fn); };
export const get = () => cfg;
export const settings = () => cfg.settings;
export const saveError = () => lastError;

function normalize(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  c.version = VERSION;
  c.settings = deepMerge(clone(DEFAULT_SETTINGS), c.settings || {});
  if (!Array.isArray(c.tabs) || !c.tabs.length) c.tabs = [{ id: 'home', name: 'Home', columns: [{ id: 'c1', w: 1, widgets: [] }] }];
  for (const t of c.tabs) {
    if (!Array.isArray(t.columns) || !t.columns.length) t.columns = [{ id: 'c1', w: 1, widgets: [] }];
    for (const col of t.columns) {
      col.widgets = (col.widgets || []).filter(w => w && w.type);
      col.w = col.w || 1;
    }
  }
  return c;
}

export async function load() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* corrupt → fall through */ }
  if (stored) {
    cfg = normalize(stored);
  } else {
    cfg = normalize(await fetchDefaults());
  }
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue) return;
    try { cfg = normalize(JSON.parse(e.newValue)); emit('replace'); } catch { /* ignore */ }
  });
  return cfg;
}

export async function fetchDefaults() {
  try {
    const r = await fetch('config.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch (e) {
    console.warn('config.json unavailable, using empty config', e);
    return {};
  }
}

/** Mutate the config. kind: 'layout' (re-render board) | 'settings' (re-apply theme etc.) | 'widget' (no re-render) */
export function mutate(fn, kind = 'layout', payload) {
  fn(cfg);
  persist();
  emit(kind, payload);
}

export function exportConfig({ secrets = false } = {}) {
  const c = clone(cfg);
  if (!secrets) delete c.settings.workerToken;
  return JSON.stringify(c, null, 2);
}

export function importConfig(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.tabs)) throw new Error('Not a start page config (missing "tabs").');
  const keepToken = cfg?.settings?.workerToken;
  cfg = normalize(parsed);
  if (!cfg.settings.workerToken && keepToken) cfg.settings.workerToken = keepToken;
  persist.flush();
  emit('replace');
}

export async function reset() {
  cfg = normalize(await fetchDefaults());
  persist.flush();
  emit('replace');
}

// Lookup helpers
export function findWidget(id) {
  for (const t of cfg.tabs) for (const c of t.columns) {
    const i = c.widgets.findIndex(w => w.id === id);
    if (i >= 0) return { tab: t, col: c, index: i, widget: c.widgets[i] };
  }
  return null;
}

export function allWidgets() {
  return cfg.tabs.flatMap(t => t.columns.flatMap(c => c.widgets.map(w => ({ ...w, tabId: t.id, tabName: t.name }))));
}
