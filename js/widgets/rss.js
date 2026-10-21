import { register } from '../core/widgets.js';
import { h, safeUrl, timeAgo, fetchJSON, cached, download, pickFile, esc } from '../core/util.js';
import { fetchViaProxy } from '../core/worker.js';

/* ---------- parsing ---------- */
const txt = (el, ...names) => {
  for (const n of names) {
    const f = el.getElementsByTagName(n)[0];
    if (f && f.textContent.trim()) return f.textContent.trim();
  }
  return '';
};

export function parseFeed(text) {
  const t = text.trim();
  if (t.startsWith('{')) {
    const j = JSON.parse(t);
    return (j.items || j.entries || []).map(e => ({
      title: e.title || e.name || '(untitled)',
      link: e.url || e.link || e.external_url || '#',
      date: e.date_published || e.pubDate || e.published || e.date_modified || '',
    }));
  }
  const doc = new DOMParser().parseFromString(t, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Feed is not valid XML/JSON');
  const out = [];
  for (const it of doc.getElementsByTagName('item')) {
    out.push({ title: txt(it, 'title') || '(untitled)', link: txt(it, 'link') || txt(it, 'guid'), date: txt(it, 'pubDate', 'dc:date', 'date') });
  }
  for (const en of doc.getElementsByTagName('entry')) {
    const links = [...en.getElementsByTagName('link')];
    const l = links.find(x => (x.getAttribute('rel') || 'alternate') === 'alternate') || links[0];
    out.push({ title: txt(en, 'title') || '(untitled)', link: l?.getAttribute('href') || '', date: txt(en, 'published', 'updated') });
  }
  return out;
}

async function loadHN(kind) {
  const ids = await fetchJSON(`https://hacker-news.firebaseio.com/v0/${kind}stories.json`);
  const items = await Promise.all(ids.slice(0, 20).map(id => fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)));
  return items.filter(Boolean).map(i => ({
    title: i.title, link: i.url || `https://news.ycombinator.com/item?id=${i.id}`,
    date: new Date(i.time * 1000).toISOString(), meta: `${i.score} pts · ${i.descendants ?? 0} comments`,
    meta2: `https://news.ycombinator.com/item?id=${i.id}`,
  }));
}

/** Special sources: hn:top | hn:new | hn:best  — public Firebase API, CORS-enabled. */
export async function loadFeed(url) {
  const hn = /^hn:(top|new|best)$/.exec(url);
  const items = hn ? await cached('hn.' + hn[1], 5 * 60e3, () => loadHN(hn[1]))
    : parseFeed(await cached('feed.' + url, 5 * 60e3, () => fetchViaProxy(url)));
  return items;
}

/* ---------- OPML ---------- */
export function parseOPML(text) {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  return [...doc.getElementsByTagName('outline')]
    .filter(o => o.getAttribute('xmlUrl'))
    .map(o => ({ name: o.getAttribute('title') || o.getAttribute('text') || o.getAttribute('xmlUrl'), url: o.getAttribute('xmlUrl') }));
}
export function toOPML(feeds, title = 'Start page feeds') {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0"><head><title>${esc(title)}</title></head><body>\n` +
    feeds.map(f => `  <outline type="rss" text="${esc(f.name)}" title="${esc(f.name)}" xmlUrl="${esc(f.url)}"/>`).join('\n') + '\n</body></opml>\n';
}

/* ---------- unread tracking ---------- */
const readKey = id => 'sp.read.' + id;
const loadRead = id => { try { return new Set(JSON.parse(localStorage.getItem(readKey(id)) || '[]')); } catch { return new Set(); } };
const saveRead = (id, set) => { try { localStorage.setItem(readKey(id), JSON.stringify([...set].slice(-2000))); } catch { /* quota */ } };

/* ---------- widget ---------- */
const state = new Map(); // widget id → current feed index

async function paint(el, ctx) {
  const c = ctx.config;
  const feeds = c.feeds || [];
  const merge = c.mode === 'merge';
  let idx = Math.min(state.get(ctx.id) ?? 0, Math.max(0, feeds.length - 1));
  const read = loadRead(ctx.id);

  const head = h('div.headline');
  const list = h('div.newsfeed', { tabindex: 0, 'aria-label': 'Feed items' }, h('div.muted', 'Loading…'));
  el.replaceChildren(head, list);

  const providerBtn = () => feeds.length > 1 && !merge
    ? h('button.provider', { title: 'Switch feed', onclick: () => { state.set(ctx.id, (idx + 1) % feeds.length); paint(el, ctx); } }, feeds[idx].name)
    : h('span.provider.static', merge ? 'all feeds' : feeds[idx]?.name || '—');
  if (c.heading) head.append(h('h1', c.heading + ' ', providerBtn(), ':'));

  if (!feeds.length) { list.replaceChildren(h('p.muted', 'No feeds yet. Open widget settings to add some or import an OPML file.')); return; }

  const active = merge ? feeds : [feeds[idx]];
  const results = await Promise.allSettled(active.map(f => loadFeed(f.url).then(items => items.map(i => ({ ...i, source: f.name })))));
  const errors = results.map((r, i) => r.status === 'rejected' ? `${active[i].name}: ${r.reason.message}` : null).filter(Boolean);
  let items = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  if (merge) items.sort((a, b) => new Date(b.date) - new Date(a.date));
  items = items.slice(0, c.limit || 6);

  list.replaceChildren();
  const unread = items.filter(i => !read.has(i.link || i.title)).length;
  if (c.unread && items.length) {
    list.append(h('div.news-tools', h('span.muted', `${unread} unread`),
      h('button.link', { onclick: () => { items.forEach(i => read.add(i.link || i.title)); saveRead(ctx.id, read); paint(el, ctx); } }, 'Mark all read')));
  }
  for (const it of items) {
    const key = it.link || it.title;
    const isRead = read.has(key);
    const a = h('a', {
      href: safeUrl(it.link), target: '_blank', rel: 'noopener noreferrer',
      onclick: () => { read.add(key); saveRead(ctx.id, read); a.parentElement.classList.add('read'); },
    }, it.title.length > 100 ? it.title.slice(0, 100) + '…' : it.title);
    list.append(h('div.news-item', { class: c.unread && isRead ? 'read' : '' },
      c.unread && !isRead && h('span.dot', { 'aria-label': 'unread' }),
      a,
      h('div.news-source', [merge && it.source, it.date && timeAgo(it.date), it.meta].filter(Boolean).join(' · '))));
  }
  if (!items.length) list.append(h('p.muted', 'No articles available.'));
  for (const e of errors) list.append(h('p.err', '⚠ ' + e));
}

register({
  type: 'rss',
  name: 'RSS / News',
  icon: '📰',
  description: 'Multiple feeds (RSS, Atom, JSON Feed, Hacker News), unread tracking, OPML.',
  refreshEvery: 1800,
  defaults: {
    heading: "Here's the latest news from",
    feeds: [{ name: 'Hacker News', url: 'hn:top' }],
    mode: 'switch', limit: 6, unread: false,
  },
  schema: [
    { key: 'heading', label: 'Heading (blank to hide)', type: 'text' },
    { key: 'feeds', label: 'Feeds', type: 'lines', fields: ['name', 'url'], placeholder: 'Name | https://example.com/feed.xml',
      help: 'One per line: Name | URL. Use hn:top, hn:new or hn:best for Hacker News (no proxy needed). Other feeds are fetched directly and fall back to the Worker proxy when blocked by CORS.' },
    { key: 'mode', label: 'Multiple feeds', type: 'select', options: [['switch', 'Click heading to switch'], ['merge', 'Merge into one list']] },
    { key: 'limit', label: 'Items to show', type: 'number', min: 1, max: 50 },
    { key: 'unread', label: 'Track unread items', type: 'checkbox' },
  ],
  settings(box, api) {
    box.append(h('div.row',
      h('button', { type: 'button', onclick: async () => {
        const f = await pickFile('.opml,.xml,text/xml');
        if (!f) return;
        const feeds = parseOPML(f.data);
        if (!feeds.length) return alert('No feeds found in that file.');
        api.set({ feeds: [...(api.draft.feeds || []), ...feeds] });
      } }, 'Import OPML…'),
      h('button', { type: 'button', onclick: () => download('feeds.opml', toOPML(api.draft.feeds || []), 'text/x-opml') }, 'Export OPML')));
  },
  render: (el, ctx) => paint(el, ctx),
  refresh: (el, ctx) => paint(el, ctx),
});
