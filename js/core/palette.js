// Command palette (Ctrl/Cmd+K): jump to any link, tab or widget; run actions; fall back to a web search.
import * as store from './store.js';
import { h, safeUrl, $, $$ } from './util.js';
import { allLinks } from './bookmark-index.js';
import { iconNode } from './icons.js';
import { openGlobalSettings } from './settings.js';
import { selectTab, setEditing, isEditing } from './app.js';
import { resolveQuery } from '../widgets/search.js';
import { getDef } from './widgets.js';

function entries() {
  const out = [];
  for (const l of allLinks()) out.push({ kind: 'Link', label: l.title, sub: l.group || l.url, node: () => iconNode(l.icon, { url: l.url, title: l.title }), run: () => { location.href = safeUrl(l.url); } });
  for (const t of store.get().tabs) out.push({ kind: 'Tab', label: t.name, sub: 'Switch page', node: () => h('span.ico.emoji', '🗂'), run: () => selectTab(t.id) });
  for (const t of store.get().tabs) for (const c of t.columns) for (const w of c.widgets) {
    const def = getDef(w.type);
    out.push({ kind: 'Widget', label: w.title || def?.name || w.type, sub: `${t.name}`, node: () => h('span.ico.emoji', def?.icon || '🧩'),
      run: () => { selectTab(t.id); setTimeout(() => { const el = $(`.widget[data-id="${w.id}"]`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.querySelector('input,button,a')?.focus(); }, 60); } });
  }
  const act = (label, run) => out.push({ kind: 'Action', label, sub: '', node: () => h('span.ico.emoji', '⚡'), run });
  act('Open settings', () => openGlobalSettings());
  act(isEditing() ? 'Stop editing layout' : 'Edit layout', () => setEditing(!isEditing()));
  act('Toggle dark / light theme', () => store.mutate(c => { const t = c.settings.theme; t.mode = (document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark'; t.vars = {}; }, 'settings'));
  act('Settings: Appearance', () => openGlobalSettings('appearance'));
  act('Settings: Integrations (Worker)', () => openGlobalSettings('integrations'));
  return out;
}

export function openPalette() {
  if ($('dialog.palette')) return;
  const all = entries();
  let shown = [], sel = 0;
  const input = h('input', { type: 'text', placeholder: 'Jump to a link, tab, widget or action — or search the web…', 'aria-label': 'Command palette', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', autocomplete: 'off', spellcheck: false });
  const list = h('ul#pal-list', { role: 'listbox' });
  const d = h('dialog.dlg.palette', { 'aria-label': 'Command palette' }, h('div.pal', input, list));
  const run = e => { d.close(); e.run(); };
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    shown = all.filter(e => words.every(w => `${e.label} ${e.sub} ${e.kind}`.toLowerCase().includes(w)))
      .sort((a, b) => (b.label.toLowerCase().startsWith(q) - a.label.toLowerCase().startsWith(q))).slice(0, 12);
    if (q) {
      const search = $('.widget[data-type="search"]') && store.allWidgets().find(w => w.type === 'search');
      const cfg = { engines: [], ...(getDef('search')?.defaults || {}), ...(search?.config || {}) };
      const dest = resolveQuery(input.value, cfg, cfg.defaultEngine);
      if (dest) shown.push({ kind: 'Go', label: `Go / search: ${input.value.trim()}`, sub: '', node: () => h('span.ico.emoji', '↗'), run: () => { location.href = dest; } });
    }
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.replaceChildren(...shown.map((e, i) => h('li', { id: `pal-${i}`, role: 'option', 'aria-selected': String(i === sel), onclick: () => run(e), onmousemove: () => { sel = i; mark(); } },
      e.node(), h('span.pal-label', e.label), h('span.muted', e.sub), h('span.pal-kind', e.kind))));
    input.setAttribute('aria-activedescendant', shown.length ? `pal-${sel}` : '');
  };
  const mark = () => { [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === sel))); input.setAttribute('aria-activedescendant', `pal-${sel}`); list.children[sel]?.scrollIntoView({ block: 'nearest' }); };
  input.addEventListener('input', () => { sel = 0; draw(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, shown.length); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(1, shown.length); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[sel]) run(shown[sel]); }
  });
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
  document.body.append(d);
  d.showModal();
  draw();
  input.focus();
}

export function initPalette() {
  addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.key === '/' && !['input', 'textarea', 'select'].includes(tag) && !e.target.isContentEditable && !$('dialog[open]')) {
      const s = $('.searchbar');
      if (s) { e.preventDefault(); s.focus(); }
    }
  });
  $('#btn-palette')?.addEventListener('click', openPalette);
}
