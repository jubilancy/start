// Settings UI: schema-driven forms for widgets, plus the global settings dialog and the "add widget" picker.
import * as store from './store.js';
import { allDefs, getDef } from './widgets.js';
import { h, clone, deepMerge, download, pickFile, imageToDataURL, uid } from './util.js';
import { searchCity, geolocate } from './weather-data.js';
import { THEME_VARS } from './theme.js';
import { workerBase } from './worker.js';
import * as app from './app.js';

/* ---------- field builders ---------- */
function linesCodec(fields) {
  return {
    encode: arr => (arr || []).map(o => (fields.length === 1 ? o : fields.map(f => o[f] ?? '').join(' | '))).join('\n'),
    decode: text => text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      if (fields.length === 1) return l;
      const parts = l.split('|').map(p => p.trim());
      // last field swallows extra "|" so URLs containing a pipe survive
      const rest = parts.slice(fields.length - 1).join('|');
      const o = {};
      fields.forEach((f, i) => { o[f] = i === fields.length - 1 ? rest : parts[i] || ''; });
      return o;
    }),
  };
}

function field(f, api) {
  const draft = api.draft;
  const id = uid('f');
  const label = h('label', { for: id }, f.label);
  const help = f.help && h('div.help', f.help);
  const get = () => draft[f.key];
  const set = v => { draft[f.key] = v; api.changed?.(f.key, v); };
  let input;
  switch (f.type) {
    case 'checkbox':
      input = h('input', { type: 'checkbox', id, checked: !!get(), onchange: e => set(e.target.checked) });
      return h('div.field.inline', input, label, help);
    case 'number':
      input = h('input', { type: 'number', id, value: get() ?? '', min: f.min, max: f.max, step: f.step || 1, onchange: e => set(e.target.value === '' ? null : +e.target.value) });
      break;
    case 'select':
      input = h('select', { id, onchange: e => { const o = f.options.find(([v]) => String(v) === e.target.value); set(o ? o[0] : e.target.value); } },
        f.options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(get() ?? '') }, l)));
      break;
    case 'color':
      input = h('input', { type: 'color', id, value: get() || '#000000', oninput: e => set(e.target.value) });
      break;
    case 'textarea':
      input = h('textarea', { id, rows: f.rows || 3, spellcheck: false, oninput: e => set(e.target.value) }, get() ?? '');
      break;
    case 'lines':
    case 'codec': {
      const codec = f.type === 'lines' ? linesCodec(f.fields) : f;
      input = h('textarea', { id, rows: f.rows || 5, spellcheck: false, placeholder: f.placeholder, wrap: 'off', class: 'mono', oninput: e => set(codec.decode(e.target.value)) }, codec.encode(get()));
      break;
    }
    case 'location': return locationField(f, api, label, help);
    case 'password':
      input = h('input', { type: 'password', id, value: get() ?? '', autocomplete: 'off', oninput: e => set(e.target.value) });
      break;
    default:
      input = h('input', { type: 'text', id, value: get() ?? '', placeholder: f.placeholder, oninput: e => set(e.target.value) });
  }
  return h('div.field', label, input, help);
}

function locationField(f, api, label, help) {
  const cur = api.draft[f.key];
  const status = h('div.muted', cur?.lat != null ? `${cur.name || 'Custom'} (${cur.lat}, ${cur.lon})` : f.allowEmpty ? 'Using global location' : 'Not set');
  const results = h('div.results');
  const q = h('input', { type: 'search', placeholder: 'Search city…', 'aria-label': 'City search' });
  const pick = loc => { api.draft[f.key] = loc; status.textContent = `${loc.name} (${loc.lat}, ${loc.lon})`; results.replaceChildren(); api.changed?.(f.key, loc); };
  const search = async () => {
    if (!q.value.trim()) return;
    results.replaceChildren(h('span.muted', 'Searching…'));
    try {
      const r = await searchCity(q.value.trim());
      results.replaceChildren(...(r.length ? r.map(x => h('button', { type: 'button', onclick: () => pick(x) }, x.name)) : [h('span.muted', 'No matches')]));
    } catch (e) { results.replaceChildren(h('span.err', 'Search failed: ' + e.message)); }
  };
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
  return h('div.field', label, status,
    h('div.row', q, h('button', { type: 'button', onclick: search }, 'Search'),
      h('button', { type: 'button', onclick: async () => { try { const p = await geolocate(); pick({ name: 'My location', ...p }); } catch (e) { status.textContent = '⚠ ' + e.message; } } }, 'Use my location'),
      f.allowEmpty && h('button', { type: 'button', onclick: () => { api.draft[f.key] = null; status.textContent = 'Using global location'; api.changed?.(f.key, null); } }, 'Clear')),
    results, help);
}

export function buildForm(schema, api) {
  return h('div.form', schema.map(f => field(f, api)));
}

/* ---------- dialog scaffold ---------- */
function dialog(title, body, { actions = [], wide = false, onClose } = {}) {
  const d = h('dialog.dlg', { class: wide ? 'wide' : '', 'aria-label': title },
    h('form', { method: 'dialog', onsubmit: e => e.preventDefault() },
      h('header', h('h2', title), h('button.x', { type: 'button', 'aria-label': 'Close', onclick: () => d.close() }, '✕')),
      h('div.dlg-body', body),
      actions.length ? h('footer', actions) : null));
  d.addEventListener('close', () => { d.remove(); onClose?.(); });
  document.body.append(d);
  d.showModal();
  return d;
}

/* ---------- widget settings ---------- */
export function openWidgetSettings(id) {
  const f = store.findWidget(id);
  const def = getDef(f.widget.type);
  if (!def) return;
  let draft = deepMerge(clone(def.defaults || {}), f.widget.config || {});
  const meta = { title: f.widget.title || '', card: f.widget.card ?? '', };
  const bodyEl = h('div');
  const api = { get draft() { return draft; }, set(patch) { Object.assign(draft, patch); build(); } };
  const build = () => {
    bodyEl.replaceChildren(
      buildForm([
        { key: 'title', label: 'Title above widget (optional)', type: 'text' },
        { key: 'card', label: 'Card style', type: 'select', options: [['', 'Widget default'], ['yes', 'Bordered card'], ['no', 'No card']] },
      ], { draft: meta }),
      h('hr'),
      buildForm(def.schema || [], { draft }));
    if (def.settings) { const x = h('div.extra'); def.settings(x, api); bodyEl.append(x); }
  };
  build();
  const d = dialog(`${def.name} settings`, bodyEl, {
    actions: [
      h('button', { type: 'button', onclick: () => { draft = clone(def.defaults || {}); build(); } }, 'Reset to defaults'),
      h('span.grow'),
      h('button', { type: 'button', onclick: () => d.close() }, 'Cancel'),
      h('button.primary', { type: 'button', onclick: () => {
        store.mutate(() => {
          const w = store.findWidget(id).widget;
          w.config = draft;
          if (meta.title) w.title = meta.title; else delete w.title;
          if (meta.card === 'yes') w.card = true; else if (meta.card === 'no') w.card = false; else delete w.card;
        });
        d.close();
      } }, 'Save')],
  });
}

/* ---------- add widget ---------- */
export function openAddWidget(colId) {
  const list = h('div.picker');
  const search = h('input', { type: 'search', placeholder: 'Filter widgets…', 'aria-label': 'Filter widgets' });
  const draw = () => {
    const q = search.value.toLowerCase();
    list.replaceChildren(...allDefs().filter(d => !q || `${d.name} ${d.description}`.toLowerCase().includes(q)).map(d =>
      h('button.pick', { type: 'button', onclick: () => { dlg.close(); app.addWidget(colId, d.type); } },
        h('span.pick-ico', d.icon || '🧩'), h('span', h('strong', d.name), h('br'), h('small.muted', d.description || '')))));
  };
  search.addEventListener('input', draw);
  const dlg = dialog('Add widget', [search, list], { wide: true });
  draw();
  search.focus();
}

/* ---------- global settings ---------- */
const FONTS = [
  ['', 'System (default)'],
  ['Georgia, "Times New Roman", serif', 'Serif'],
  ['ui-monospace, "SF Mono", Menlo, Consolas, monospace', 'Monospace'],
  ['ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, system-ui, sans-serif', 'Rounded'],
  ['"Iowan Old Style", "Palatino Linotype", Palatino, serif', 'Old style'],
];

export function openGlobalSettings(section = 'general') {
  const s = () => store.settings();
  const live = fn => store.mutate(cfg => fn(cfg.settings), 'settings');
  const panels = {};
  const body = h('div.sections');
  const nav = h('nav.sec-nav', { role: 'tablist' });

  const addSection = (key, title, build) => { panels[key] = { title, build }; };

  addSection('general', 'General', () => {
    const d = { title: s().title, location: s().location, units: s().units, favType: s().favicon.type, favValue: s().favicon.value };
    const favInput = h('input', { type: 'text', value: d.favValue, placeholder: 'Emoji (🌿) or image URL', 'aria-label': 'Favicon value' });
    const prev = h('img.fav-prev', { alt: '', width: 32, height: 32 });
    const syncPrev = () => {
      const v = s().favicon;
      prev.src = v.type === 'emoji' && v.value ? 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${v.value}</text></svg>`) : (v.value && v.type !== 'default' ? v.value : document.querySelector('link[rel~=icon]')?.href || '');
    };
    const setFav = (type, value) => live(x => { x.favicon = { type, value }; }) || syncPrev();
    const typeSel = h('select', { 'aria-label': 'Favicon type', onchange: e => { d.favType = e.target.value; favInput.hidden = !['emoji', 'url'].includes(d.favType); if (d.favType === 'default') setFav('default', ''); else if (['emoji', 'url'].includes(d.favType)) setFav(d.favType, favInput.value); } },
      [['default', 'Default'], ['emoji', 'Emoji'], ['url', 'Image URL'], ['upload', 'Upload image']].map(([v, l]) => h('option', { value: v, selected: v === d.favType }, l)));
    favInput.hidden = !['emoji', 'url'].includes(d.favType);
    favInput.addEventListener('input', () => setFav(typeSel.value, favInput.value.trim()));
    const upload = h('button', { type: 'button', onclick: async () => {
      const f = await pickFile('image/*', false);
      if (!f) return;
      try { setFav('upload', await imageToDataURL(f.data, 64)); typeSel.value = 'upload'; favInput.hidden = true; } catch (e) { alert(e.message); }
    } }, 'Choose image…');
    syncPrev();
    return h('div',
      h('div.field', h('label', 'Tab title'), h('input', { type: 'text', value: d.title, oninput: e => live(x => { x.title = e.target.value; }) })),
      h('div.field', h('label', 'Tab icon (favicon)'), h('div.row', prev, typeSel, favInput, upload),
        h('div.help', 'Stored in this browser. To make it the default everywhere, export the config and commit it as config.json.')),
      buildForm([{ key: 'location', label: 'Default location (weather, sun/moon)', type: 'location' }, { key: 'units', label: 'Units', type: 'select', options: [['imperial', 'Imperial (°F, mph)'], ['metric', 'Metric (°C, km/h)']] }],
        { draft: d, changed: (k, v) => live(x => { x[k] = v; }) }));
  });

  addSection('appearance', 'Appearance', () => {
    const t = () => s().theme;
    const vars = () => ({ ...cssDefaults(), ...(t().vars || {}) });
    const colorRows = THEME_VARS.map(([v, label]) => {
      const inp = h('input', { type: 'color', value: toHex(vars()[v]), 'aria-label': label, oninput: e => live(x => { x.theme.vars = { ...(x.theme.vars || {}), [v]: e.target.value }; }) });
      return h('label.color', inp, h('span', label));
    });
    const bg = () => s().background;
    const bgVal = h('input', { type: 'text', value: bg().type === 'upload' ? '' : bg().value, placeholder: 'Color, CSS gradient, or image URL', oninput: e => setBg(bgType.value, e.target.value.trim()) });
    const setBg = (type, value) => live(x => { x.background = { type, value }; });
    const bgType = h('select', { 'aria-label': 'Background type', onchange: e => setBg(e.target.value, e.target.value === 'none' ? '' : bgVal.value.trim()) },
      [['none', 'None'], ['color', 'Solid color'], ['gradient', 'CSS gradient'], ['image', 'Image URL'], ['upload', 'Uploaded image']].map(([v, l]) => h('option', { value: v, selected: v === bg().type }, l)));
    const fontSel = h('select', { 'aria-label': 'Font family', onchange: e => live(x => { x.font.family = e.target.value; }) },
      FONTS.map(([v, l]) => h('option', { value: v, selected: v === s().font.family }, l)));
    return h('div',
      h('div.field', h('label', 'Theme'), h('select', { onchange: e => { live(x => { x.theme.mode = e.target.value; x.theme.vars = {}; }); render('appearance'); } },
        [['light', 'Light (cream / sage)'], ['dark', 'Dark'], ['auto', 'Follow system']].map(([v, l]) => h('option', { value: v, selected: v === t().mode }, l)))),
      h('div.field', h('label', 'Color overrides (CSS variables)'), h('div.colors', colorRows),
        h('div.row', h('button', { type: 'button', onclick: () => { live(x => { x.theme.vars = {}; }); render('appearance'); } }, 'Reset colors'))),
      h('div.field', h('label', 'Font'), fontSel,
        h('input', { type: 'text', placeholder: 'Google Font name, e.g. Inter (optional)', value: s().font.googleFont, 'aria-label': 'Google Font name', onchange: e => live(x => { x.font.googleFont = e.target.value.trim(); }) }),
        h('div.row', h('button', { type: 'button', onclick: async () => {
          const f = await pickFile('.woff2,.woff,.ttf,.otf,font/*', false);
          if (!f) return;
          const r = new FileReader();
          r.onload = () => live(x => { x.font.dataUrl = r.result; x.font.dataName = f.name; });
          r.readAsDataURL(f.data);
        } }, 'Upload font file…'), s().font.dataName && h('span.muted', s().font.dataName),
        s().font.dataUrl && h('button', { type: 'button', onclick: () => { live(x => { x.font.dataUrl = ''; x.font.dataName = ''; }); render('appearance'); } }, 'Remove')),
        h('div.help', 'Google Fonts loads from fonts.googleapis.com only when a name is set. Uploaded fonts stay in this browser (localStorage, ~5 MB limit).')),
      h('div.field', h('label', 'Background'), h('div.row', bgType, bgVal, h('button', { type: 'button', onclick: async () => {
        const f = await pickFile('image/*', false);
        if (!f) return;
        try { setBg('upload', await imageToDataURL(f.data, 1920, 'image/jpeg', 0.8)); bgType.value = 'upload'; bgVal.value = ''; } catch (e) { alert(e.message); }
      } }, 'Upload image…')),
        h('div.help', 'Examples: #f4efe6 · linear-gradient(135deg,#fdfbfb,#ebedee) · https://…/photo.jpg')),
      h('div.field', h('label', 'Custom CSS'), h('textarea.mono', { rows: 6, spellcheck: false, placeholder: ':root { --accent: #7a3e9d; }\n.widget.card { border-radius: 12px; }', oninput: e => live(x => { x.theme.customCss = e.target.value; }) }, t().customCss || '')));
  });

  addSection('layout', 'Tabs & layout', () => {
    const wrap = h('div');
    const draw = () => {
      const tabs = store.get().tabs;
      wrap.replaceChildren(
        h('p.muted', 'Tabs (pages). Drag/resize widgets with the ✎ edit button.'),
        ...tabs.map((t, i) => h('div.row', { class: 'tab-row' },
          h('input', { type: 'text', value: t.name, 'aria-label': 'Tab name', onchange: e => store.mutate(() => { t.name = e.target.value || t.name; }) }),
          h('button', { type: 'button', 'aria-label': 'Move tab up', disabled: i === 0, onclick: () => { store.mutate(c => { [c.tabs[i - 1], c.tabs[i]] = [c.tabs[i], c.tabs[i - 1]]; }); draw(); } }, '▲'),
          h('button', { type: 'button', 'aria-label': 'Move tab down', disabled: i === tabs.length - 1, onclick: () => { store.mutate(c => { [c.tabs[i + 1], c.tabs[i]] = [c.tabs[i], c.tabs[i + 1]]; }); draw(); } }, '▼'),
          h('button', { type: 'button', disabled: tabs.length < 2, onclick: () => { if (confirm(`Delete tab "${t.name}" and its widgets?`)) { store.mutate(c => { c.tabs.splice(i, 1); }); draw(); } } }, 'Delete'))),
        h('div.row', h('button', { type: 'button', onclick: () => { store.mutate(c => { c.tabs.push({ id: uid('t'), name: 'New tab', columns: [{ id: uid('c'), w: 1, widgets: [] }, { id: uid('c'), w: 1, widgets: [] }] }); }); draw(); } }, '+ Add tab'),
          h('button', { type: 'button', onclick: () => { store.mutate(() => { app.addColumn(); }); } }, '+ Add column to current tab'),
          h('button.primary', { type: 'button', onclick: () => { document.querySelector('dialog')?.close(); app.setEditing(true); } }, 'Edit layout ✎')));
    };
    draw();
    return wrap;
  });

  addSection('integrations', 'Integrations', () => {
    const status = h('div.muted');
    const d = { workerUrl: s().workerUrl, workerToken: s().workerToken };
    return h('div',
      h('p.muted', 'Optional Cloudflare Worker (see README → Worker). It proxies feeds/ICS, stores the inbox, runs uptime checks and syncs this config. Everything else works without it.'),
      buildForm([
        { key: 'workerUrl', label: 'Worker URL', type: 'text', placeholder: 'https://start-worker.<you>.workers.dev' },
        { key: 'workerToken', label: 'Worker token (stored only in this browser)', type: 'password', help: 'The value of the START_TOKEN secret you set on the Worker. Needed for inbox, sync, Raindrop and uptime data.' },
      ], { draft: d, changed: (k, v) => live(x => { x[k] = v.trim(); }) }),
      h('div.row', h('button', { type: 'button', onclick: async () => {
        status.textContent = 'Testing…';
        try {
          const r = await fetch(workerBase() + '/health');
          status.textContent = r.ok ? '✓ Worker reachable: ' + (await r.text()).slice(0, 80) : '⚠ HTTP ' + r.status;
        } catch (e) { status.textContent = '⚠ ' + e.message; }
      } }, 'Test connection'), status));
  });

  addSection('data', 'Backup & data', () => h('div',
    h('p.muted', 'Everything lives in this browser (localStorage) on top of the shipped config.json. Export to back up or move to another device.'),
    h('div.row',
      h('button', { type: 'button', onclick: () => download('start-config.json', store.exportConfig()) }, 'Export config (JSON)'),
      h('button', { type: 'button', onclick: async () => {
        const f = await pickFile('.json,application/json');
        if (!f) return;
        try { store.importConfig(f.data); alert('Imported.'); } catch (e) { alert('Import failed: ' + e.message); }
      } }, 'Import config…'),
      h('button', { type: 'button', onclick: async () => { if (confirm('Discard local changes and reload config.json?')) { await store.reset(); } } }, 'Reset to config.json')),
    h('div.row', h('button', { type: 'button', onclick: () => { navigator.clipboard?.writeText(store.exportConfig()).then(() => alert('Config copied. Paste it into config.json in the repo to make it the default for every device.')); } }, 'Copy config for config.json'))));

  function render(key) {
    nav.replaceChildren(...Object.entries(panels).map(([k, p]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === key), onclick: () => render(k) }, p.title)));
    body.replaceChildren(panels[key].build());
  }
  dialog('Settings', [nav, body], { wide: true });
  render(panels[section] ? section : 'general');
}

function cssDefaults() {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(THEME_VARS.map(([v]) => [v, cs.getPropertyValue(v).trim()]));
}
function toHex(c) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + [...c.slice(1)].map(x => x + x).join('');
  const cv = document.createElement('canvas').getContext('2d');
  cv.fillStyle = '#000'; cv.fillStyle = c;
  const m = /^#[0-9a-f]{6}$/i.test(cv.fillStyle) ? cv.fillStyle : '#000000';
  return m;
}
