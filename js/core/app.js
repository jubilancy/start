// Board renderer: tabs → columns → widgets, edit mode, drag/reorder/resize, widget lifecycle.
import * as store from './store.js';
import { getDef } from './widgets.js';
import { bus } from './bus.js';
import { h, $, $$, uid, deepMerge, clone, clamp } from './util.js';
import { hasWorker, workerFetch } from './worker.js';
import { applyAppearance } from './theme.js';
import { openWidgetSettings, openAddWidget, openGlobalSettings } from './settings.js';

let board, tabbar, editing = false;
let lastSig = '';
let instances = new Map(); // widget id → {el, def, ctx, timer}

export const isEditing = () => editing;

/* ---------- tabs ---------- */
export function currentTab() {
  const tabs = store.get().tabs;
  const want = decodeURIComponent(location.hash.replace(/^#\/?/, '')) || localStorage.getItem('sp.tab');
  return tabs.find(t => t.id === want) || tabs[0];
}
export function selectTab(id) {
  try { localStorage.setItem('sp.tab', id); } catch { /* ignore */ }
  history.replaceState(null, '', '#/' + encodeURIComponent(id));
  renderAll();
}

/* ---------- widget lifecycle ---------- */
function makeCtx(w, def) {
  const ctx = {
    id: w.id,
    get config() { return deepMerge(clone(def.defaults || {}), w.config || {}); },
    get settings() { return store.settings(); },
    save(patch) { store.mutate(c => { const f = store.findWidget(w.id); if (f) f.widget.config = { ...(f.widget.config || {}), ...patch }; }, 'widget', w.id); },
    rerender() { mount(w); },
    worker: workerFetch,
    hasWorker,
    bus,
  };
  return ctx;
}

async function mount(w) {
  const old = instances.get(w.id);
  if (!old) return;
  const { def, body } = old;
  const ctx = old.ctx;
  try {
    if (def.needsWorker && !hasWorker() && !(def.worksWithoutWorker?.(ctx))) {
      body.replaceChildren(h('p.muted', 'This widget needs the Cloudflare Worker. Set its URL in ', h('button.link', { onclick: () => openGlobalSettings('integrations') }, 'Settings → Integrations'), ' (see README).'));
      return;
    }
    await def.render(body, ctx);
  } catch (e) {
    console.error(`widget ${w.type}`, e);
    body.replaceChildren(h('div.err', `${def.name} failed: ${e.message} `, h('button.link', { onclick: () => mount(w) }, 'Retry')));
  }
}

function startTimer(w, inst) {
  const secs = inst.def.refreshEvery;
  if (!secs) return;
  inst.timer = setInterval(async () => {
    if (document.hidden || editing) return;
    try { await (inst.def.refresh || inst.def.render)(inst.body, inst.ctx); }
    catch (e) { console.warn('refresh', w.type, e); }
  }, secs * 1000);
}

export async function refreshWidget(id) {
  const i = instances.get(id);
  if (!i) return;
  try { await (i.def.refresh || i.def.render)(i.body, i.ctx); } catch (e) { console.warn(e); }
}

function teardown() {
  for (const [, i] of instances) {
    clearInterval(i.timer);
    try { i.def.destroy?.(i.body, i.ctx); } catch (e) { console.warn(e); }
  }
  instances = new Map();
}

/* ---------- rendering ---------- */
export function renderAll() {
  teardown();
  const tab = currentTab();
  renderTabs(tab);
  board.className = 'content' + (editing ? ' editing' : '');
  document.body.classList.toggle('editing', editing);
  board.style.gridTemplateColumns = tab.columns.map(c => `minmax(0, ${c.w || 1}fr)`).join(' ');
  board.replaceChildren(...tab.columns.map((col, ci) => renderColumn(tab, col, ci)));
  for (const col of tab.columns) for (const w of col.widgets) mount(w);
  bus.emit('rendered');
}

function renderColumn(tab, col, ci) {
  const el = h('div.col', { dataset: { col: col.id }, class: col.align === 'center' ? 'align-center' : '' });
  if (editing) {
    el.append(h('div.col-bar',
      h('span.muted', `Column ${ci + 1}`),
      h('button', { title: 'Narrower', 'aria-label': 'Narrower column', onclick: () => editCol(col.id, c => { c.w = Math.max(0.5, (c.w || 1) - 0.25); }) }, '↔−'),
      h('button', { title: 'Wider', 'aria-label': 'Wider column', onclick: () => editCol(col.id, c => { c.w = (c.w || 1) + 0.25; }) }, '↔+'),
      h('button', { title: 'Toggle vertical centering', onclick: () => editCol(col.id, c => { c.align = c.align === 'center' ? 'start' : 'center'; }) }, '⇕'),
      tab.columns.length > 1 && h('button', { title: 'Remove column (widgets move to the previous column)', onclick: () => removeCol(col.id) }, '✕'),
      h('button.primary', { onclick: () => openAddWidget(col.id) }, '+ Widget')));
  }
  for (const w of col.widgets) el.append(renderWidget(w));
  return el;
}

function renderWidget(w) {
  const def = getDef(w.type);
  const cfg = def ? deepMerge(clone(def.defaults || {}), w.config || {}) : {};
  const wantCard = w.card ?? def?.card;
  const body = h('div.w-body');
  const el = h('section.widget', { dataset: { id: w.id, type: w.type }, class: wantCard ? 'card' : '', style: w.h ? { height: w.h + 'px' } : null, 'aria-label': w.title || def?.name || w.type }, body);
  if (w.title && !editing) el.prepend(h('h2.w-title', w.title));
  if (!def) {
    body.append(h('p.err', `Unknown widget type "${w.type}".`), editing && h('button', { onclick: () => removeWidget(w.id) }, 'Remove'));
  } else {
    const inst = { el, body, def, ctx: null, timer: null };
    inst.ctx = makeCtx(w, def);
    instances.set(w.id, inst);
    startTimer(w, inst);
  }
  if (editing) {
    el.prepend(h('div.w-bar',
      h('button.handle', { title: 'Drag to move', 'aria-label': 'Drag to move', onpointerdown: e => startDrag(e, el, w.id) }, '⠿'),
      h('span.w-name', w.title || def?.name || w.type),
      h('button', { title: 'Move up', 'aria-label': 'Move up', onclick: () => move(w.id, 'up') }, '▲'),
      h('button', { title: 'Move down', 'aria-label': 'Move down', onclick: () => move(w.id, 'down') }, '▼'),
      h('button', { title: 'Move to previous column', 'aria-label': 'Move left', onclick: () => move(w.id, 'left') }, '◀'),
      h('button', { title: 'Move to next column', 'aria-label': 'Move right', onclick: () => move(w.id, 'right') }, '▶'),
      h('button', { title: 'Refresh', 'aria-label': 'Refresh', onclick: () => refreshWidget(w.id) }, '⟳'),
      h('button', { title: 'Settings', 'aria-label': 'Widget settings', onclick: () => openWidgetSettings(w.id) }, '⚙'),
      h('button.danger', { title: 'Remove', 'aria-label': 'Remove widget', onclick: () => { if (confirm(`Remove "${w.title || def?.name || w.type}"?`)) removeWidget(w.id); } }, '✕')));
    el.append(h('div.resize', { title: 'Drag to set height · double-click for auto', onpointerdown: e => startResize(e, el, w.id), ondblclick: () => store.mutate(c => { delete store.findWidget(w.id).widget.h; }) }));
  }
  return el;
}

/* ---------- layout mutations ---------- */
const editCol = (id, fn) => store.mutate(cfg => { for (const t of cfg.tabs) for (const c of t.columns) if (c.id === id) fn(c); });

function removeCol(id) {
  store.mutate(() => {
    const t = currentTab();
    const i = t.columns.findIndex(c => c.id === id);
    const [gone] = t.columns.splice(i, 1);
    t.columns[Math.max(0, i - 1)].widgets.push(...gone.widgets);
  });
}

export function addColumn() {
  store.mutate(() => { currentTab().columns.push({ id: uid('c'), w: 1, widgets: [] }); });
}

export function addWidget(colId, type, config) {
  store.mutate(cfg => {
    const col = cfg.tabs.flatMap(t => t.columns).find(c => c.id === colId) || currentTab().columns[0];
    col.widgets.push({ id: uid('w'), type, config: config || {} });
  });
}

function removeWidget(id) {
  localStorage.removeItem('sp.read.' + id);
  store.mutate(() => { const f = store.findWidget(id); f.col.widgets.splice(f.index, 1); });
}

function move(id, dir) {
  store.mutate(() => {
    const f = store.findWidget(id);
    const cols = f.tab.columns, ci = cols.indexOf(f.col);
    const list = f.col.widgets;
    if (dir === 'up' && f.index > 0) [list[f.index - 1], list[f.index]] = [list[f.index], list[f.index - 1]];
    else if (dir === 'down' && f.index < list.length - 1) [list[f.index + 1], list[f.index]] = [list[f.index], list[f.index + 1]];
    else if ((dir === 'left' && ci > 0) || (dir === 'right' && ci < cols.length - 1)) {
      list.splice(f.index, 1);
      const target = cols[ci + (dir === 'left' ? -1 : 1)].widgets;
      target.splice(Math.min(f.index, target.length), 0, f.widget);
    }
  });
  requestAnimationFrame(() => $(`.widget[data-id="${id}"] .w-bar button[aria-label="Move ${dir}"]`)?.focus());
}

/* ---------- pointer drag + resize ---------- */
function startDrag(e, el, id) {
  e.preventDefault();
  const rect = el.getBoundingClientRect();
  const offY = e.clientY - rect.top, offX = e.clientX - rect.left;
  const ph = h('div.placeholder', { style: { height: rect.height + 'px' } });
  el.after(ph);
  Object.assign(el.style, { position: 'fixed', width: rect.width + 'px', left: rect.left + 'px', top: rect.top + 'px', zIndex: 50, pointerEvents: 'none', opacity: 0.85, boxShadow: '0 8px 24px rgba(0,0,0,.25)' });
  el.classList.add('dragging');
  const move = ev => {
    el.style.left = ev.clientX - offX + 'px';
    el.style.top = ev.clientY - offY + 'px';
    const col = $$('.col', board).find(c => { const r = c.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right; });
    if (!col) return;
    const sibs = $$(':scope > .widget:not(.dragging)', col);
    const before = sibs.find(s => { const r = s.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
    if (before) before.before(ph); else col.append(ph);
    if (ev.clientY < 60) window.scrollBy(0, -12); else if (ev.clientY > innerHeight - 60) window.scrollBy(0, 12);
  };
  const up = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    const colEl = ph.closest('.col');
    const index = $$(':scope > .widget:not(.dragging), :scope > .placeholder', colEl).indexOf(ph);
    ph.remove();
    store.mutate(() => {
      const f = store.findWidget(id);
      f.col.widgets.splice(f.index, 1);
      const target = f.tab.columns.find(c => c.id === colEl.dataset.col) || f.col;
      target.widgets.splice(clamp(index, 0, target.widgets.length), 0, f.widget);
    });
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}

function startResize(e, el, id) {
  e.preventDefault();
  const startY = e.clientY, startH = el.getBoundingClientRect().height;
  let hh = startH;
  const move = ev => { hh = Math.max(80, Math.round(startH + ev.clientY - startY)); el.style.height = hh + 'px'; };
  const up = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    store.mutate(() => { store.findWidget(id).widget.h = hh; }, 'widget');
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
}

/* ---------- chrome ---------- */
function renderTabs(tab) {
  const tabs = store.get().tabs;
  tabbar.hidden = tabs.length < 2 && !editing;
  tabbar.replaceChildren(...tabs.map(t => h('a.tab', { href: '#/' + encodeURIComponent(t.id), 'aria-current': t.id === tab.id ? 'page' : null, onclick: e => { e.preventDefault(); selectTab(t.id); } }, t.name)));
}

export function setEditing(on) {
  editing = on;
  $('#btn-edit').setAttribute('aria-pressed', String(on));
  $('#btn-edit').title = on ? 'Done editing' : 'Edit layout';
  $('#btn-edit').firstChild.textContent = on ? '✓' : '✎';
  renderAll();
}

export async function start() {
  await store.load();
  applyAppearance(store.settings());
  { const x = store.settings(); lastSig = JSON.stringify([x.location, x.units, x.workerUrl, x.workerToken]); }
  board = $('#board');
  tabbar = $('#tabs');
  $('#btn-edit').addEventListener('click', () => setEditing(!editing));
  $('#btn-settings').addEventListener('click', () => openGlobalSettings());
  addEventListener('hashchange', renderAll);
  store.on((kind, payload) => {
    if (kind === 'settings') {
      applyAppearance(store.settings());
      const s = store.settings(), sig = JSON.stringify([s.location, s.units, s.workerUrl, s.workerToken]);
      if (sig !== lastSig) { lastSig = sig; renderAll(); }
    }
    else if (kind === 'layout' || kind === 'replace') { applyAppearance(store.settings()); renderAll(); }
    else if (kind === 'error') console.warn('Could not save config (storage full?)', payload);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) bus.emit('visible'); });
  renderAll();
}
