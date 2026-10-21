import { register } from '../core/widgets.js';
import { h, safeUrl, hostOf, timeAgo } from '../core/util.js';
import { workerJSON } from '../core/worker.js';
import { allLinks } from '../core/bookmark-index.js';
import { iconNode } from '../core/icons.js';

const ids = s => String(s || '').split(/[,\s]+/).filter(x => /^-?\d+$/.test(x));

async function fetchItems(c) {
  const cols = ids(c.collections);
  const lists = await Promise.all((cols.length ? cols : ['0']).map(id => workerJSON(`/raindrop/items?collection=${id}&perpage=50&sort=${encodeURIComponent(c.sort || '-created')}`)));
  return lists.flatMap(l => l.items || []).map(i => ({ title: i.title, url: i.link, created: i.created, excerpt: i.excerpt, domain: i.domain, cover: i.cover }));
}

const sourceItems = c => c.source === 'local' ? Promise.resolve(allLinks().map(l => ({ title: l.title, url: l.url, domain: hostOf(l.url), icon: l.icon }))) : fetchItems(c);

// deterministic pick for "link of the day"
function dayIndex(n) { const d = new Date(); return (d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % Math.max(1, n); }

async function paintQueue(el, ctx) {
  const c = ctx.config;
  const box = h('div.newsfeed.gh');
  el.replaceChildren(box);
  box.append(h('div.muted', 'Loading…'));
  try {
    const items = (await fetchItems(c)).slice(0, c.limit || 8);
    box.replaceChildren(...(items.length ? items.map(i => h('div.news-item', h('a', { href: safeUrl(i.url), target: '_blank', rel: 'noopener noreferrer' }, i.title || i.url),
      h('div.news-source', [i.domain || hostOf(i.url), i.created && timeAgo(i.created)].filter(Boolean).join(' · ')))) : [h('p.muted', 'Collection is empty.')]));
  } catch (e) { box.replaceChildren(h('div.err', 'Raindrop: ' + e.message)); }
}

async function paintRandom(el, ctx) {
  const c = ctx.config;
  const box = h('div.random');
  el.replaceChildren(box);
  try {
    const items = await sourceItems(c);
    if (!items.length) { box.append(h('p.muted', 'No bookmarks found.')); return; }
    let i = c.mode === 'daily' ? dayIndex(items.length) : Math.floor(Math.random() * items.length);
    const show = () => {
      const it = items[i];
      box.replaceChildren(...[
        h('div.muted', c.mode === 'daily' ? 'Link of the day' : 'Random bookmark'),
        h('a.random-link', { href: safeUrl(it.url), target: '_blank', rel: 'noopener noreferrer' }, iconNode(it.icon, { url: it.url, title: it.title }), h('strong', it.title || it.url)),
        it.excerpt && h('p.muted', it.excerpt.slice(0, 160)),
        c.mode !== 'daily' && h('button.link', { onclick: () => { i = Math.floor(Math.random() * items.length); show(); } }, '🎲 Another')].filter(Boolean));
    };
    show();
  } catch (e) { box.replaceChildren(h('div.err', e.message)); }
}

register({
  type: 'reading',
  name: 'Reading queue (Raindrop)',
  icon: '📚',
  description: 'Latest bookmarks from Raindrop collections via the Worker (needs RAINDROP_TOKEN).',
  needsWorker: true,
  refreshEvery: 900,
  defaults: { collections: '', sort: '-created', limit: 8 },
  schema: [
    { key: 'collections', label: 'Collection IDs (comma separated, blank = all)', type: 'text', help: 'Use "Load my collections" below to find IDs.' },
    { key: 'sort', label: 'Sort', type: 'select', options: [['-created', 'Newest first'], ['created', 'Oldest first'], ['-sort', 'Manual order'], ['title', 'Title']] },
    { key: 'limit', label: 'Items', type: 'number', min: 1, max: 50 },
  ],
  settings(box, api) {
    const out = h('div.results');
    box.append(h('div.row', h('button', { type: 'button', onclick: async () => {
      out.replaceChildren(h('span.muted', 'Loading…'));
      try {
        const d = await workerJSON('/raindrop/collections');
        out.replaceChildren(...(d.items || []).map(c => h('button', { type: 'button', onclick: () => api.set({ collections: [api.draft.collections, c._id].filter(Boolean).join(', ') }) }, `${c.title} (${c.count}) · ${c._id}`)));
      } catch (e) { out.replaceChildren(h('span.err', e.message)); }
    } }, 'Load my collections')), out);
  },
  render: paintQueue,
  refresh: paintQueue,
});

register({
  type: 'randomlink',
  name: 'Random bookmark / link of the day',
  icon: '🎲',
  description: 'Surface a bookmark from your quick links or Raindrop (Raindrop needs the Worker).',
  defaults: { source: 'local', mode: 'daily', collections: '', sort: '-created' },
  schema: [
    { key: 'source', label: 'Source', type: 'select', options: [['local', 'My quick links'], ['raindrop', 'Raindrop (Worker)']] },
    { key: 'mode', label: 'Mode', type: 'select', options: [['daily', 'Link of the day'], ['random', 'Random each load']] },
    { key: 'collections', label: 'Raindrop collection IDs (blank = all)', type: 'text' },
  ],
  render: paintRandom,
});
