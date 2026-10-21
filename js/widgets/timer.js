import { register } from '../core/widgets.js';
import { h, pad } from '../core/util.js';

const fmt = s => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
const timers = new Map(); // widget id → interval

function beep() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    const o = a.createOscillator(), g = a.createGain();
    o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = 0.1;
    o.start(); setTimeout(() => { o.stop(); a.close(); }, 450);
  } catch { /* no audio */ }
}

function paint(el, ctx) {
  clearInterval(timers.get(ctx.id));
  const c = ctx.config;
  // persisted state: { mode: 'work'|'break'|'long'|'timer', endAt (ms) | null, left (s) when paused, cycle }
  let st = { mode: 'work', endAt: null, left: c.work * 60, cycle: 0, ...(c.state || {}) };
  const len = m => (m === 'work' ? c.work : m === 'break' ? c.rest : m === 'long' ? c.long : c.custom) * 60;
  const persist = () => ctx.save({ state: st });
  const remaining = () => (st.endAt ? Math.max(0, Math.round((st.endAt - Date.now()) / 1000)) : st.left);

  const clock = h('div.timer-clock', { role: 'timer', 'aria-live': 'off' });
  const label = h('div.timer-label.muted');
  const toggle = h('button.primary', { onclick: () => {
    if (st.endAt) { st.left = remaining(); st.endAt = null; } else { st.endAt = Date.now() + st.left * 1000; }
    persist(); draw();
  } });
  const reset = h('button', { onclick: () => { st.endAt = null; st.left = len(st.mode); persist(); draw(); } }, 'Reset');
  const modes = h('div.engines', { role: 'group', 'aria-label': 'Timer mode' }, ...[['work', 'Focus'], ['break', 'Break'], ['long', 'Long break'], ['timer', 'Timer']]
    .filter(([m]) => m !== 'long' || c.pomodoro).map(([m, l]) => h('button.pill', { 'aria-pressed': String(st.mode === m), onclick: () => { st = { ...st, mode: m, endAt: null, left: len(m) }; persist(); draw(); } }, l)));

  function finish() {
    beep();
    document.title = '⏰ ' + (ctx.settings.title || 'startpage');
    setTimeout(() => { document.title = ctx.settings.title || 'startpage'; }, 8000);
    if (c.pomodoro && st.mode === 'work') {
      st.cycle++;
      st.mode = st.cycle % 4 === 0 ? 'long' : 'break';
    } else if (c.pomodoro && st.mode !== 'timer') st.mode = 'work';
    st.endAt = null; st.left = len(st.mode); persist(); draw();
  }

  function tick() {
    const r = remaining();
    clock.textContent = fmt(r);
    if (st.endAt && r <= 0) finish();
  }
  function draw() {
    toggle.textContent = st.endAt ? 'Pause' : 'Start';
    label.textContent = c.pomodoro ? `Session ${st.cycle % 4 + (st.mode === 'work' ? 1 : 0)} of 4 · ${st.cycle} done` : '';
    modes.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === ({ work: 'Focus', break: 'Break', long: 'Long break', timer: 'Timer' })[st.mode])));
    tick();
  }
  el.replaceChildren(h('div.timer', modes, clock, label, h('div.row', toggle, reset)));
  draw();
  timers.set(ctx.id, setInterval(tick, 500));
}

register({
  type: 'timer',
  name: 'Timer / Pomodoro',
  icon: '⏱️',
  description: 'Pomodoro cycles or a custom countdown; survives reloads; beeps when done.',
  card: true,
  defaults: { pomodoro: true, work: 25, rest: 5, long: 15, custom: 10, state: null },
  schema: [
    { key: 'pomodoro', label: 'Pomodoro cycle (focus → break, long break every 4th)', type: 'checkbox' },
    { key: 'work', label: 'Focus minutes', type: 'number', min: 1, max: 180 },
    { key: 'rest', label: 'Break minutes', type: 'number', min: 1, max: 60 },
    { key: 'long', label: 'Long break minutes', type: 'number', min: 1, max: 90 },
    { key: 'custom', label: 'Custom timer minutes', type: 'number', min: 1, max: 600 },
  ],
  render: paint,
  destroy: (el, ctx) => clearInterval(timers.get(ctx.id)),
});
