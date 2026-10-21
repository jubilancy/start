import { register } from '../core/widgets.js';
import { h } from '../core/util.js';

export function nextOccurrence(dateStr, repeat, now = new Date()) {
  const base = new Date(dateStr + 'T00:00:00');
  if (isNaN(base)) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!repeat || repeat === 'none' || base >= today) return base;
  const d = new Date(base);
  if (repeat === 'yearly') { d.setFullYear(today.getFullYear()); if (d < today) d.setFullYear(today.getFullYear() + 1); }
  else if (repeat === 'monthly') { d.setFullYear(today.getFullYear(), today.getMonth(), base.getDate()); if (d < today) d.setMonth(d.getMonth() + 1); }
  else if (repeat === 'weekly') { const diff = Math.ceil((today - base) / 86400000 / 7); d.setDate(base.getDate() + diff * 7); }
  return d;
}

function paint(el, ctx) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rows = (ctx.config.events || []).map(e => {
    const when = nextOccurrence(e.date, e.repeat, now);
    return when ? { ...e, when, days: Math.round((when - today) / 86400000) } : null;
  }).filter(Boolean).sort((a, b) => a.days - b.days);
  el.replaceChildren(h('ul.countdowns', rows.length ? rows.map(r => h('li', { class: r.days < 0 ? 'past' : '' },
    h('span.cd-n', r.days === 0 ? '🎉' : Math.abs(r.days)),
    h('span', h('strong', r.name), h('br'), h('span.muted', `${r.days === 0 ? 'today' : r.days < 0 ? `${-r.days} days ago` : r.days === 1 ? 'tomorrow' : `in ${r.days} days`} · ${r.when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}${r.repeat && r.repeat !== 'none' ? ' · ' + r.repeat : ''}`)))) : [h('li.muted', 'Add events in widget settings.')]));
}

register({
  type: 'countdown',
  name: 'Countdowns',
  icon: '⏳',
  description: 'Days until events; yearly/monthly/weekly repeats roll forward automatically.',
  refreshEvery: 3600,
  defaults: { events: [] },
  schema: [{ key: 'events', label: 'Events', type: 'lines', fields: ['name', 'date', 'repeat'], placeholder: 'Name | YYYY-MM-DD | none/yearly/monthly/weekly', rows: 6,
    help: 'Example: Birthday | 1990-05-14 | yearly' }],
  render: paint,
  refresh: paint,
});
