import { register } from '../core/widgets.js';
import { h, safeUrl, timeAgo, fetchJSON, cached } from '../core/util.js';

async function hn(kind, n) {
  const ids = await cached('hnids.' + kind, 300e3, () => fetchJSON(`https://hacker-news.firebaseio.com/v0/${kind}stories.json`));
  const items = await cached(`hnitems.${kind}.${n}`, 300e3, () => Promise.all(ids.slice(0, n).map(id => fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`))));
  return items.filter(Boolean).map(i => ({
    title: i.title, url: i.url || `https://news.ycombinator.com/item?id=${i.id}`, date: i.time * 1000,
    meta: `${i.score} pts`, meta2: { label: `${i.descendants ?? 0} comments`, url: `https://news.ycombinator.com/item?id=${i.id}` },
  }));
}

const BSKY = 'https://public.api.bsky.app/xrpc/';
async function bsky(source, n) {
  const q = source.startsWith('at://') || source.startsWith('feed:')
    ? `app.bsky.feed.getFeed?feed=${encodeURIComponent(source.replace(/^feed:/, ''))}&limit=${n}`
    : `app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(source.replace(/^@/, ''))}&filter=posts_no_replies&limit=${n}`;
  const d = await cached('bsky.' + q, 120e3, () => fetchJSON(BSKY + q));
  return d.feed.map(({ post: p }) => ({
    title: (p.record?.text || '').replace(/\s+/g, ' ').slice(0, 280) || '(media post)',
    url: `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split('/').pop()}`, date: Date.parse(p.record?.createdAt || p.indexedAt),
    meta: `@${p.author.handle}`, meta2: { label: `♥ ${p.likeCount ?? 0} · ↻ ${p.repostCount ?? 0}`, url: '' },
  }));
}

async function paint(el, ctx) {
  const c = ctx.config;
  const list = h('div.newsfeed.social');
  el.replaceChildren(list);
  list.append(h('div.muted', 'Loading…'));
  try {
    const n = c.limit || 8;
    const items = c.source === 'bluesky' ? await bsky(c.bsky || 'bsky.app', n) : await hn(c.hn || 'top', n);
    list.replaceChildren(...items.map(i => h('div.news-item',
      h('a', { href: safeUrl(i.url), target: '_blank', rel: 'noopener noreferrer' }, i.title),
      h('div.news-source', [i.meta, timeAgo(i.date)].filter(Boolean).join(' · '), i.meta2?.url ? [' · ', h('a', { href: safeUrl(i.meta2.url), target: '_blank', rel: 'noopener noreferrer' }, i.meta2.label)] : i.meta2 ? ` · ${i.meta2.label}` : ''))));
    if (!items.length) list.append(h('p.muted', 'Nothing to show.'));
  } catch (e) { list.replaceChildren(h('div.err', 'Failed: ' + e.message + ' ', h('button.link', { onclick: () => ctx.rerender() }, 'Retry'))); }
}

register({
  type: 'social',
  name: 'Hacker News / Bluesky',
  icon: '💬',
  description: 'Hacker News story lists or a Bluesky profile/feed (public endpoints, no login).',
  refreshEvery: 600,
  defaults: { source: 'hn', hn: 'top', bsky: 'bsky.app', limit: 8 },
  schema: [
    { key: 'source', label: 'Source', type: 'select', options: [['hn', 'Hacker News'], ['bluesky', 'Bluesky']] },
    { key: 'hn', label: 'HN list', type: 'select', options: [['top', 'Top'], ['new', 'New'], ['best', 'Best'], ['ask', 'Ask HN'], ['show', 'Show HN']] },
    { key: 'bsky', label: 'Bluesky handle (bsky.app) or feed (at://…/app.bsky.feed.generator/…)', type: 'text' },
    { key: 'limit', label: 'Items', type: 'number', min: 1, max: 30 },
  ],
  render: paint,
  refresh: paint,
});
