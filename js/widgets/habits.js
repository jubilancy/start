import { register } from '../core/widgets.js';
import { h, uid, isoDay } from '../core/util.js';

const dayKey = d => isoDay(d);
function streak(log) {
  let n = 0;
  const d = new Date();
  if (!log[dayKey(d)]) d.setDate(d.getDate() - 1); // today not done yet doesn't break the streak
  while (log[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function best(log) {
  const days = Object.keys(log).filter(k => log[k]).sort();
  let b = 0, cur = 0, prev = null;
  for (const k of days) {
    const t = new Date(k + 'T12:00').getTime();
    cur = prev && Math.round((t - prev) / 86400000) === 1 ? cur + 1 : 1;
    b = Math.max(b, cur); prev = t;
  }
  return b;
}

function paint(el, ctx) {
  let habits = (ctx.config.habits || []).map(x => ({ ...x, log: { ...x.log } }));
  const weeks = ctx.config.weeks || 18;
  const commit = () => { ctx.save({ habits }); draw(); };
  const root = h('div.habits');
  const add = h('form.todo-add', { onsubmit: e => { e.preventDefault(); const v = e.target.elements.n.value.trim(); if (v) { habits.push({ id: uid('h'), name: v, log: {} }); commit(); } } },
    h('input', { name: 'n', type: 'text', placeholder: 'New habit…', 'aria-label': 'New habit' }), h('button', { type: 'submit', 'aria-label': 'Add habit' }, '+'));

  function heat(hb) {
    const grid = h('div.heat', { role: 'img', 'aria-label': `${hb.name} last ${weeks} weeks` });
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - ((weeks - 1) * 7 + end.getDay()));
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      if (d > end) { grid.append(h('i.future')); continue; }
      const k = dayKey(d);
      grid.append(h('i', { class: hb.log[k] ? 'on' : '', title: d.toLocaleDateString(), onclick: () => { if (hb.log[k]) delete hb.log[k]; else hb.log[k] = 1; commit(); } }));
    }
    grid.style.gridTemplateColumns = `repeat(${weeks}, 1fr)`;
    return grid;
  }

  function draw() {
    const today = dayKey(new Date());
    root.replaceChildren(...habits.map(hb => h('div.habit',
      h('div.habit-head',
        h('button.check', { 'aria-pressed': String(!!hb.log[today]), 'aria-label': `${hb.name}: done today`, onclick: () => { if (hb.log[today]) delete hb.log[today]; else hb.log[today] = 1; commit(); } }, hb.log[today] ? '✓' : ''),
        h('strong', hb.name), h('span.muted', `🔥 ${streak(hb.log)} · best ${best(hb.log)}`),
        h('button.x', { 'aria-label': `Delete ${hb.name}`, onclick: () => { if (confirm(`Delete habit "${hb.name}"?`)) { habits = habits.filter(x => x !== hb); commit(); } } }, '✕')),
      heat(hb))), add);
  }
  el.replaceChildren(root);
  draw();
}

register({
  type: 'habits',
  name: 'Habit tracker',
  icon: '🔥',
  description: 'Daily check-ins with streaks and a heatmap (click any cell to edit that day).',
  card: true,
  defaults: { habits: [], weeks: 18 },
  schema: [{ key: 'weeks', label: 'Heatmap weeks', type: 'number', min: 4, max: 52 }],
  render: paint,
});
