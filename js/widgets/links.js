import { register } from '../core/widgets.js';
import { h, safeUrl, pickFile } from '../core/util.js';
import { iconNode } from '../core/icons.js';
import { groupsToText, textToGroups, parseBookmarkFile } from '../core/bookmarks.js';

function renderItem(it, layout) {
  const label = it.title || it.url;
  return h('a.link-item', { href: safeUrl(it.url), title: label, 'aria-label': label, rel: 'noopener' },
    iconNode(it.icon, { url: it.url, title: label }),
    layout !== 'icons' && h('span.link-label', label));
}

function paint(el, ctx) {
  const c = ctx.config;
  const root = h('div.links', { class: 'layout-' + c.layout });
  for (const g of c.groups || []) {
    const group = h('div.link-group');
    if (g.name && (c.layout !== 'icons' || c.showGroupNames)) group.append(h('div.link-group-name', g.name));
    group.append(h('div.icon-row', { class: c.layout !== 'icons' ? 'icon-grid' : '' }, g.items.map(i => renderItem(i, c.layout))));
    root.append(group);
  }
  if (!(c.groups || []).length) root.append(h('p.muted', 'No links yet — open widget settings.'));
  el.replaceChildren(root);
}

register({
  type: 'links',
  name: 'Quick links',
  icon: '🔗',
  description: 'Grouped shortcuts with auto favicons, emoji/image icons, bookmark import.',
  defaults: { layout: 'icons', showGroupNames: false, groups: [] },
  schema: [
    { key: 'layout', label: 'Layout', type: 'select', options: [['icons', 'Icon rows'], ['grid', 'Icon + label grid'], ['list', 'List']] },
    { key: 'showGroupNames', label: 'Show group names in icon rows', type: 'checkbox' },
    { key: 'groups', label: 'Links', type: 'codec', rows: 14, encode: groupsToText, decode: textToGroups,
      placeholder: '# Group name\nTitle | https://example.com | optional icon',
      help: 'Format: "# Group", then "Title | URL | icon" per line. Icon is optional: leave blank for an auto favicon (DuckDuckGo → Google → /favicon.ico → letter), or use si:github (Simple Icons), lucide:search, an emoji, or an image URL.' },
  ],
  settings(box, api) {
    box.append(h('div.row',
      h('button', { type: 'button', onclick: async () => {
        const f = await pickFile('.html,.htm,.csv,text/html,text/csv');
        if (!f) return;
        try {
          const imported = parseBookmarkFile(f);
          if (!imported.length) return alert('No bookmarks found in that file.');
          api.set({ groups: [...(api.draft.groups || []), ...imported] });
        } catch (e) { alert('Import failed: ' + e.message); }
      } }, 'Import bookmarks (browser HTML / Raindrop HTML or CSV)…')));
  },
  render: paint,
  refresh: paint,
});
