// Pre-builds CORS-free copies of feeds into data/feeds/<slug>.json (JSON Feed-like, newest first).
// Run by .github/workflows/build-feeds.yml. Usage: node scripts/build-feeds.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const list = JSON.parse(await readFile(new URL('../feeds.build.json', import.meta.url), 'utf8'));
await mkdir(new URL('../data/feeds/', import.meta.url), { recursive: true });

const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim();
const tag = (b, n) => { const m = new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`, 'i').exec(b); return m ? decode(m[1]) : ''; };

export function parse(text) {
  const t = text.trim();
  if (t.startsWith('{')) {
    const j = JSON.parse(t);
    return (j.items || []).map(e => ({ title: e.title || '(untitled)', url: e.url || e.external_url || '', date_published: e.date_published || e.date_modified || '' }));
  }
  const items = [];
  for (const m of t.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    items.push({ title: tag(m[0], 'title') || '(untitled)', url: tag(m[0], 'link') || tag(m[0], 'guid'), date_published: tag(m[0], 'pubDate') || tag(m[0], 'dc:date') });
  }
  for (const m of t.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)) {
    const href = /<link[^>]*?href="([^"]+)"[^>]*?(?:rel="alternate")?[^>]*>/i.exec(m[0]);
    items.push({ title: tag(m[0], 'title') || '(untitled)', url: href ? href[1] : '', date_published: tag(m[0], 'published') || tag(m[0], 'updated') });
  }
  return items;
}

let failed = 0;
for (const f of list) {
  try {
    const r = await fetch(f.url, { headers: { 'User-Agent': 'start-page-feed-builder', Accept: '*/*' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const items = parse(await r.text()).filter(i => i.url).slice(0, 30);
    const out = { version: 'https://jsonfeed.org/version/1.1', title: f.name || f.slug, items };
    await writeFile(new URL(`../data/feeds/${f.slug}.json`, import.meta.url), JSON.stringify(out, null, 1) + '\n');
    console.log(`ok   ${f.slug}: ${items.length} items`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${f.slug}: ${e.message}`); // keep the previous file so the widget still has something to show
  }
}
process.exit(failed === list.length && list.length ? 1 : 0);
