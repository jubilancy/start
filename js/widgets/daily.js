import { register } from '../core/widgets.js';
import { h, safeUrl, fetchJSON, cached, pad } from '../core/util.js';

const dayNum = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); };

async function quote() {
  // dummyjson has a fixed, numbered set; pick one by calendar day so it is stable all day.
  const total = (await cached('dj.total', 7 * 86400e3, () => fetchJSON('https://dummyjson.com/quotes?limit=1&select=id'))).total;
  const q = await cached('dj.q.' + dayNum(), 86400e3, () => fetchJSON(`https://dummyjson.com/quotes/${dayNum() % total + 1}`));
  return h('figure.quote', h('blockquote', `“${q.quote}”`), h('figcaption.muted', `— ${q.author}`));
}

async function wiki() {
  const d = new Date();
  const feed = await cached('wp.feed.' + dayNum(), 6 * 3600e3, () => fetchJSON(`https://en.wikipedia.org/api/rest_v1/feed/featured/${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`));
  return feed;
}

async function onThisDay() {
  const feed = await wiki();
  const evs = feed.onthisday || [];
  if (!evs.length) throw new Error('No events');
  const e = evs[dayNum() % evs.length];
  const page = e.pages?.[0];
  return h('div.otd', h('div.muted', `On this day · ${e.year}`), h('p', e.text), page && h('a', { href: safeUrl(page.content_urls?.desktop?.page), target: '_blank', rel: 'noopener noreferrer' }, page.normalizedtitle || page.title));
}

async function featured() {
  const t = (await wiki()).tfa;
  if (!t) throw new Error('No featured article today');
  return h('div.otd', h('div.muted', 'Wikipedia featured article'), h('strong', t.normalizedtitle || t.title), h('p', t.extract?.slice(0, 280) + (t.extract?.length > 280 ? '…' : '')),
    h('a', { href: safeUrl(t.content_urls?.desktop?.page), target: '_blank', rel: 'noopener noreferrer' }, 'Read'));
}

const MODES = { quote, onthisday: onThisDay, featured };

async function paint(el, ctx) {
  const box = h('div.daily', h('span.muted', 'Loading…'));
  el.replaceChildren(box);
  try { box.replaceChildren(await MODES[ctx.config.mode || 'quote']()); }
  catch (e) { box.replaceChildren(h('div.err', e.message)); }
}

register({
  type: 'daily',
  name: 'Quote / on this day',
  icon: '💡',
  description: 'Quote of the day (dummyjson), Wikipedia "on this day" or featured article.',
  refreshEvery: 3600,
  defaults: { mode: 'quote' },
  schema: [{ key: 'mode', label: 'Show', type: 'select', options: [['quote', 'Quote of the day'], ['onthisday', 'On this day (Wikipedia)'], ['featured', "Today's featured article (Wikipedia)"]] }],
  render: paint,
  refresh: paint,
});
