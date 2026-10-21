import { register } from '../core/widgets.js';
import { h, timeAgo, safeUrl } from '../core/util.js';
import { workerJSON, workerFetch } from '../core/worker.js';

async function paint(el, ctx) {
  const list = h('ul.inbox');
  const status = h('span.muted');
  const text = h('textarea', { rows: 2, placeholder: 'Capture a thought or paste a link… (Ctrl/Cmd+Enter to send)', 'aria-label': 'Inbox capture' });
  const send = async () => {
    const t = text.value.trim();
    if (!t) return;
    status.textContent = 'Sending…';
    try {
      const url = /^https?:\/\/\S+$/.test(t) ? t : undefined;
      await workerFetch('/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t, url }) });
      text.value = ''; status.textContent = '✓ Saved'; load();
    } catch (e) { status.textContent = '⚠ ' + e.message; }
  };
  text.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
  async function load() {
    try {
      const d = await workerJSON(`/inbox?limit=${ctx.config.limit || 10}`);
      list.replaceChildren(...d.items.map(i => h('li',
        h('span.todo-text', i.url ? h('a', { href: safeUrl(i.url), target: '_blank', rel: 'noopener noreferrer' }, i.text) : i.text),
        h('span.muted', timeAgo(i.t)),
        h('button.x', { 'aria-label': 'Delete', onclick: async () => { await workerFetch('/inbox/' + encodeURIComponent(i.id), { method: 'DELETE' }); load(); } }, '✕'))));
      if (!d.items.length) list.append(h('li.muted', 'Inbox zero ✨'));
    } catch (e) { list.replaceChildren(h('li.err', e.message)); }
  }
  el.replaceChildren(h('div.inbox-w', text, h('div.row', h('button', { onclick: send }, 'Send to inbox'), status), list));
  load();
}

register({
  type: 'inbox',
  name: 'Quick-capture inbox',
  icon: '📥',
  description: 'POSTs notes/links to your Worker (KV). Items appear here and on any device.',
  card: true,
  needsWorker: true,
  defaults: { limit: 10 },
  schema: [{ key: 'limit', label: 'Items to show', type: 'number', min: 1, max: 100 }],
  render: paint,
  refresh: paint,
});
