import { register } from '../core/widgets.js';
import { h, safeUrl, timeAgo } from '../core/util.js';
import { workerJSON, workerFetch } from '../core/worker.js';

async function pushSites(path, sites) {
  await workerFetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sites) });
}

const syncUI = (path, label) => (box, api) => {
  const out = h('span.muted');
  box.append(h('div.row', h('button', { type: 'button', onclick: async () => {
    out.textContent = 'Saving…';
    try { await pushSites(path, api.draft.sites || []); out.textContent = '✓ Sent to Worker — checks run every 5 minutes'; } catch (e) { out.textContent = '⚠ ' + e.message; }
  } }, label), out));
};

async function paintUptime(el, ctx) {
  const box = h('ul.uptime');
  el.replaceChildren(box);
  try {
    const data = await workerJSON('/uptime');
    const sites = (ctx.config.sites || []);
    box.replaceChildren(...sites.map(s => {
      const d = data[s.url];
      if (!d) return h('li', h('span.dotc.unk'), h('span', s.name), h('span.muted', 'waiting for first check'));
      const hist = d.hist || [];
      const up = hist.length ? Math.round(100 * hist.filter(x => x[1]).length / hist.length) : null;
      return h('li', h('span.dotc', { class: d.last.ok ? 'ok' : 'bad', 'aria-label': d.last.ok ? 'up' : 'down' }),
        h('a', { href: safeUrl(s.url), target: '_blank', rel: 'noopener noreferrer' }, s.name),
        h('span.muted', `${d.last.ok ? d.last.ms + ' ms' : 'DOWN ' + (d.last.status || '')} · ${up ?? '–'}% · ${timeAgo(d.last.t)}`),
        h('span.spark', hist.slice(-48).map(x => h('i', { class: x[1] ? 'ok' : 'bad' }))));
    }));
    if (!sites.length) box.append(h('li.muted', 'Add sites in widget settings, then press "Save sites to Worker".'));
  } catch (e) { box.replaceChildren(h('li.err', e.message)); }
}

register({
  type: 'uptime',
  name: 'Uptime checker',
  icon: '🟢',
  description: 'Pings your sites every 5 minutes from a Worker cron; shows status, latency and 24h uptime.',
  card: true,
  needsWorker: true,
  refreshEvery: 120,
  defaults: { sites: [{ name: 'glosse.me start page', url: 'https://start.glosse.me' }] },
  schema: [{ key: 'sites', label: 'Sites', type: 'lines', fields: ['name', 'url'], placeholder: 'Name | https://example.com' }],
  settings: syncUI('/uptime/sites', 'Save sites to Worker'),
  render: paintUptime,
  refresh: paintUptime,
});

async function paintWatch(el, ctx) {
  const box = h('ul.uptime');
  el.replaceChildren(box);
  try {
    const data = await workerJSON('/watch');
    const sites = ctx.config.sites || [];
    box.replaceChildren(...sites.map(s => {
      const d = data[s.url];
      if (!d) return h('li', h('span.dotc.unk'), h('span', s.name), h('span.muted', 'waiting for first check'));
      return h('li', h('span.dotc', { class: d.error ? 'bad' : d.changedAt && Date.now() - d.changedAt < 86400e3 ? 'warn' : 'ok' }),
        h('a', { href: safeUrl(s.url), target: '_blank', rel: 'noopener noreferrer' }, s.name),
        h('span.muted', d.error ? `error: ${d.error}` : d.changedAt ? `changed ${timeAgo(d.changedAt)}` : `no change since ${timeAgo(d.since)}`));
    }));
    if (!sites.length) box.append(h('li.muted', 'Add pages in widget settings, then press "Save pages to Worker".'));
  } catch (e) { box.replaceChildren(h('li.err', e.message)); }
}

register({
  type: 'watcher',
  name: 'Page-change watcher',
  icon: '👀',
  description: 'Worker cron hashes a page (or a CSS-selected part) every 5 minutes and flags changes.',
  card: true,
  needsWorker: true,
  refreshEvery: 300,
  defaults: { sites: [] },
  schema: [{ key: 'sites', label: 'Pages', type: 'lines', fields: ['name', 'url', 'selector'], placeholder: 'Name | https://example.com/page | optional CSS selector', help: 'The selector (e.g. .price or #stock) limits the check to that part of the page.' }],
  settings: syncUI('/watch/sites', 'Save pages to Worker'),
  render: paintWatch,
  refresh: paintWatch,
});
