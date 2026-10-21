import { register } from '../core/widgets.js';
import { h, safeUrl } from '../core/util.js';
import { matchLinks } from '../core/bookmark-index.js';
import { iconNode } from '../core/icons.js';

const DOMAIN = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/.*)?$/;

/** Turn the input into a destination URL (or null). Order matches the original page: URL → domain → go/ → search. */
export function resolveQuery(input, cfg, engineKey) {
  const q = input.trim();
  if (!q) return null;
  const engines = cfg.engines || [];
  const bang = /^!(\S+)\s*(.*)$/.exec(q);
  if (bang) {
    const e = engines.find(x => x.key === bang[1].toLowerCase());
    if (e) return bang[2] ? e.url.replace('%s', encodeURIComponent(bang[2])) : new URL(e.url.replace('%s', ''), location.href).origin;
  }
  if (/^https?:\/\//i.test(q)) return q;
  if (DOMAIN.test(q)) return 'https://' + q;
  if (q.startsWith('go/')) return 'https://' + q.slice(3);
  const e = engines.find(x => x.key === engineKey) || engines[0];
  return e ? e.url.replace('%s', encodeURIComponent(q)) : `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
}

function paint(el, ctx) {
  const c = ctx.config;
  const engines = c.engines || [];
  let engineKey = sessionStorage.getItem('sp.engine.' + ctx.id) || c.defaultEngine || engines[0]?.key;
  let items = [], active = -1;

  const input = h('input.searchbar', {
    type: 'search', name: 'q', placeholder: c.placeholder || 'Search..', autocomplete: 'off', spellcheck: false,
    'aria-label': 'Search', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': `sug-${ctx.id}`, 'aria-autocomplete': 'list',
  });
  const list = h('ul.suggest', { id: `sug-${ctx.id}`, role: 'listbox', hidden: true });
  const pills = h('div.engines', { role: 'group', 'aria-label': 'Search engine' });

  const drawPills = () => pills.replaceChildren(...engines.map(e =>
    h('button.pill', { type: 'button', 'aria-pressed': String(e.key === engineKey), title: `!${e.key}`, onclick: () => { engineKey = e.key; sessionStorage.setItem('sp.engine.' + ctx.id, engineKey); drawPills(); input.focus(); } }, e.name)));
  if (c.showEngines && engines.length > 1) drawPills();

  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
  const setActive = n => {
    active = n;
    [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === n)));
    input.setAttribute('aria-activedescendant', n >= 0 ? list.children[n].id : '');
  };
  const refreshSuggest = () => {
    const raw = input.value.trim();
    const bm = /^!bm\s+(.*)$/i.exec(raw);
    items = c.searchBookmarks || bm ? matchLinks(bm ? bm[1] : raw) : [];
    if (!items.length || raw.length < 2) return close();
    list.replaceChildren(...items.map((l, i) => h('li', { id: `sug-${ctx.id}-${i}`, role: 'option', onmousedown: e => { e.preventDefault(); location.href = safeUrl(l.url); } },
      iconNode(l.icon, { url: l.url, title: l.title }), h('span', l.title), h('span.muted', l.group ? ` · ${l.group}` : ''))));
    list.hidden = false; input.setAttribute('aria-expanded', 'true'); setActive(-1);
  };

  input.addEventListener('input', refreshSuggest);
  input.addEventListener('blur', close);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && !list.hidden) { e.preventDefault(); setActive((active + 1) % items.length); }
    else if (e.key === 'ArrowUp' && !list.hidden) { e.preventDefault(); setActive((active - 1 + items.length) % items.length); }
    else if (e.key === 'Escape') { close(); }
    else if (e.key === 'Tab' && !e.shiftKey && c.showEngines && engines.length > 1 && input.value === '') { /* keep native tab */ }
  });

  const form = h('form', {
    onsubmit: e => {
      e.preventDefault();
      if (active >= 0 && items[active]) { location.href = safeUrl(items[active].url); return; }
      const bm = /^!bm\s+(.*)$/i.exec(input.value.trim());
      if (bm) { const m = matchLinks(bm[1], 1)[0]; if (m) location.href = safeUrl(m.url); return; }
      const dest = resolveQuery(input.value, c, engineKey);
      if (dest) location.href = dest;
    },
  }, input, list);

  el.replaceChildren(h('div.search', form, pills));
  if (c.autofocus && !document.querySelector('dialog[open]') && !document.body.classList.contains('editing')) input.focus();
}

register({
  type: 'search',
  name: 'Search',
  icon: '🔍',
  description: 'Search bar: engine switcher, custom engines, !bang shortcuts, bookmark search.',
  defaults: {
    placeholder: 'Search..', autofocus: true, showEngines: false, searchBookmarks: false, defaultEngine: 'kagi',
    engines: [
      { key: 'kagi', name: 'Kagi', url: 'https://kagi.com/search?q=%s' },
      { key: 'ddg', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
      { key: 'g', name: 'Google', url: 'https://www.google.com/search?q=%s' },
      { key: 'w', name: 'Wikipedia', url: 'https://en.wikipedia.org/w/index.php?search=%s' },
      { key: 'gh', name: 'GitHub', url: 'https://github.com/search?q=%s' },
      { key: 'yt', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s' },
    ],
  },
  schema: [
    { key: 'placeholder', label: 'Placeholder', type: 'text' },
    { key: 'defaultEngine', label: 'Default engine key', type: 'text', help: 'One of the keys below, e.g. kagi' },
    { key: 'engines', label: 'Engines', type: 'lines', fields: ['key', 'name', 'url'], placeholder: 'key | Name | https://example.com/?q=%s',
      help: 'One per line: key | Name | URL with %s for the query. Type "!key your query" in the box to use an engine once (e.g. "!g cats"). "!bm word" searches your own quick links.' },
    { key: 'showEngines', label: 'Show engine switcher', type: 'checkbox' },
    { key: 'searchBookmarks', label: 'Suggest matches from my quick links while typing', type: 'checkbox' },
    { key: 'autofocus', label: 'Focus on page load', type: 'checkbox' },
  ],
  render: paint,
  refresh: undefined,
});
