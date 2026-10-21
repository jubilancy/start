import { register } from '../core/widgets.js';
import { h, safeUrl, cached, pad, isoDay } from '../core/util.js';
import { fetchViaProxy } from '../core/worker.js';
import { parseICS, occurrences } from '../core/ics.js';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function loadEvents(c, from, to) {
  const sources = (c.ics || []).filter(s => s.url);
  const res = await Promise.allSettled(sources.map(async s => {
    const text = await cached('ics.' + s.url, 10 * 60e3, () => fetchViaProxy(s.url));
    return occurrences(parseICS(text), from, to).map(o => ({ ...o, source: s.name }));
  }));
  return {
    events: res.flatMap(r => r.status === 'fulfilled' ? r.value : []).sort((a, b) => a.start - b.start),
    errors: res.map((r, i) => r.status === 'rejected' ? `${sources[i].name || sources[i].url}: ${r.reason.message}` : null).filter(Boolean),
  };
}

const fmtTime = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function eventRow(ev, showDay) {
  const when = ev.allDay ? 'all day' : fmtTime(ev.start);
  return h('li.ev',
    showDay && h('span.ev-day', ev.start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })),
    h('span.ev-time', when),
    ev.url ? h('a', { href: safeUrl(ev.url), target: '_blank', rel: 'noopener noreferrer' }, ev.title) : h('span.ev-title', ev.title),
    ev.location && h('span.ev-loc', ' · ' + ev.location));
}

const views = new Map(); // widget id → shown month (survives refresh)

async function paint(el, ctx) {
  const c = ctx.config;
  const today = new Date();
  let view = views.get(ctx.id) || new Date(today.getFullYear(), today.getMonth(), 1);
  const root = h('div.cal');
  el.replaceChildren(root);

  const go = delta => { view = delta === 0 ? new Date(today.getFullYear(), today.getMonth(), 1) : new Date(view.getFullYear(), view.getMonth() + delta, 1); views.set(ctx.id, view); paint(el, ctx); };

  let events = [], errors = [];
  if ((c.ics || []).some(s => s.url)) {
    const from = new Date(Math.min(view.getFullYear(), today.getFullYear()), Math.min(view.getMonth(), today.getMonth()) - 1, 1);
    const to = new Date(view.getFullYear(), view.getMonth() + 2, 1);
    const farTo = new Date(today.getTime() + (c.agendaDays || 14) * 86400000);
    ({ events, errors } = await loadEvents(c, from, farTo > to ? farTo : to));
  }
  const byDay = new Map();
  for (const ev of events) {
    for (let d = new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate()); d < ev.end || d <= ev.start; d.setDate(d.getDate() + 1)) {
      const k = isoDay(d);
      (byDay.get(k) || byDay.set(k, []).get(k)).push(ev);
      if (ev.end <= ev.start) break;
    }
  }

  if (c.showMonth) {
    const y = view.getFullYear(), m = view.getMonth();
    const ws = c.weekStart ?? 0;
    const first = (new Date(y, m, 1).getDay() - ws + 7) % 7;
    const dim = new Date(y, m + 1, 0).getDate();
    const prevDim = new Date(y, m, 0).getDate();

    const table = h('table.cal-table', { role: 'grid' });
    const title = view.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    table.append(h('caption.sr-only', title));
    table.append(h('thead', h('tr', ...Array.from({ length: 7 }, (_, i) => h('th', { scope: 'col' }, WD[(i + ws) % 7])))));
    const body = h('tbody');
    let row = h('tr');
    const cell = (n, cls, date) => {
      const evs = date ? byDay.get(isoDay(date)) : null;
      const td = h('td', { class: cls, title: evs ? evs.map(e => e.title).join('\n') : null }, n, evs && h('span.cal-dot', { 'aria-label': `${evs.length} events` }));
      return td;
    };
    for (let i = first - 1; i >= 0; i--) row.append(cell(prevDim - i, 'other-month'));
    for (let d = 1; d <= dim; d++) {
      if (row.children.length === 7) { body.append(row); row = h('tr'); }
      const date = new Date(y, m, d);
      const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
      row.append(cell(d, isToday ? 'today' : '', date));
    }
    for (let n = 1; row.children.length < 7; n++) row.append(cell(n, 'other-month'));
    body.append(row);
    table.append(body);

    root.append(h('div.cal-nav',
      h('button.cal-btn', { 'aria-label': 'Previous month', onclick: () => go(-1) }, '<'),
      h('button.cal-title', { title: 'Jump to today', onclick: () => go(0) }, title),
      h('button.cal-btn', { 'aria-label': 'Next month', onclick: () => go(1) }, '>')), table);
  }

  if ((c.ics || []).some(s => s.url) && c.agenda) {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start.getTime() + (c.agendaDays || 14) * 86400000);
    const upcoming = events.filter(e => e.end > start && e.start < end);
    const ul = h('ul.agenda');
    if (!upcoming.length) ul.append(h('li.muted', `Nothing in the next ${c.agendaDays || 14} days.`));
    let lastDay = '';
    for (const ev of upcoming.slice(0, c.agendaMax || 12)) {
      const k = isoDay(ev.start);
      if (k !== lastDay) { ul.append(h('li.ag-head', ev.start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }))); lastDay = k; }
      ul.append(eventRow(ev, false));
    }
    root.append(h('h3.sub', 'Agenda'), ul);
  }
  for (const e of errors) root.append(h('p.err', '⚠ ' + e));

  if (c.googleEmbed) {
    const src = /^https?:/.test(c.googleEmbed) ? c.googleEmbed
      : `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(c.googleEmbed)}&ctz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}&mode=${c.embedMode || 'AGENDA'}&showTitle=0&showPrint=0&showTz=0`;
    root.append(h('iframe.cal-embed', { src, title: 'Google Calendar', loading: 'lazy', referrerpolicy: 'no-referrer' }));
  }
}

register({
  type: 'calendar',
  name: 'Calendar',
  icon: '📅',
  description: 'Month view, ICS agenda (through the Worker proxy when needed), Google Calendar embed.',
  card: true,
  refreshEvery: 900,
  defaults: { showMonth: true, weekStart: 0, ics: [], agenda: true, agendaDays: 14, agendaMax: 12, googleEmbed: '', embedMode: 'AGENDA' },
  schema: [
    { key: 'showMonth', label: 'Show month grid', type: 'checkbox' },
    { key: 'weekStart', label: 'Week starts on', type: 'select', options: [[0, 'Sunday'], [1, 'Monday'], [6, 'Saturday']] },
    { key: 'ics', label: 'ICS calendars', type: 'lines', fields: ['name', 'url'], placeholder: 'Work | https://calendar.google.com/calendar/ical/…/basic.ics',
      help: 'Secret iCal address from Google Calendar / iCloud / Fastmail. Most servers block browsers (CORS), so these go through your Worker /proxy.' },
    { key: 'agenda', label: 'Show agenda list', type: 'checkbox' },
    { key: 'agendaDays', label: 'Agenda days ahead', type: 'number', min: 1, max: 90 },
    { key: 'agendaMax', label: 'Max agenda items', type: 'number', min: 1, max: 50 },
    { key: 'googleEmbed', label: 'Google Calendar embed (calendar ID/email or full embed URL)', type: 'text',
      help: 'Calendar must be public, or you must be signed in to Google in this browser. Google Calendar → Settings → Integrate calendar.' },
    { key: 'embedMode', label: 'Embed view', type: 'select', options: [['AGENDA', 'Agenda'], ['MONTH', 'Month'], ['WEEK', 'Week']] },
  ],
  render: (el, ctx) => paint(el, ctx),
  refresh: (el, ctx) => paint(el, ctx),
});
