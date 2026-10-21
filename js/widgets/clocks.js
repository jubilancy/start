import { register } from '../core/widgets.js';
import { h } from '../core/util.js';

const timers = new Map();

function paint(el, ctx) {
  clearInterval(timers.get(ctx.id));
  const c = ctx.config;
  const zones = (c.zones || []).filter(z => { try { new Intl.DateTimeFormat([], { timeZone: z.zone }); return true; } catch { return false; } });
  const list = h('ul.clocks');
  const draw = () => {
    const now = new Date();
    list.replaceChildren(...zones.map(z => {
      const f = new Intl.DateTimeFormat([], { timeZone: z.zone, hour: c.h24 ? '2-digit' : 'numeric', minute: '2-digit', second: c.seconds ? '2-digit' : undefined, hourCycle: c.h24 ? 'h23' : 'h12' });
      const hr = +new Intl.DateTimeFormat('en-US', { timeZone: z.zone, hour: 'numeric', hourCycle: 'h23' }).format(now);
      const day = new Intl.DateTimeFormat([], { timeZone: z.zone, weekday: 'short' }).format(now);
      const localDay = new Intl.DateTimeFormat([], { weekday: 'short' }).format(now);
      const offset = (new Date(now.toLocaleString('en-US', { timeZone: z.zone })) - new Date(now.toLocaleString('en-US'))) / 3600000;
      return h('li', h('span.clock-name', z.label || z.zone), h('span.muted', `${day !== localDay ? day + ' · ' : ''}${offset === 0 ? 'same' : (offset > 0 ? '+' : '') + offset + 'h'}`),
        h('span.clock-time', { 'aria-label': z.label }, f.format(now)), h('span', { 'aria-hidden': true }, hr >= 7 && hr < 19 ? '☀️' : '🌙'));
    }));
    if (!zones.length) list.replaceChildren(h('li.muted', 'Add time zones in widget settings.'));
  };
  draw();
  el.replaceChildren(list);
  timers.set(ctx.id, setInterval(draw, c.seconds ? 1000 : 15000));
}

register({
  type: 'clocks',
  name: 'World clocks',
  icon: '🌍',
  description: 'Several time zones with day/night marker and offset from local time.',
  defaults: { h24: false, seconds: false, zones: [{ label: 'New York', zone: 'America/New_York' }, { label: 'London', zone: 'Europe/London' }, { label: 'Tokyo', zone: 'Asia/Tokyo' }] },
  schema: [
    { key: 'zones', label: 'Time zones', type: 'lines', fields: ['label', 'zone'], placeholder: 'Label | IANA zone (e.g. Europe/Paris)', help: 'IANA names, see Intl.supportedValuesOf("timeZone"). Invalid ones are skipped.' },
    { key: 'h24', label: '24-hour clock', type: 'checkbox' },
    { key: 'seconds', label: 'Show seconds', type: 'checkbox' },
  ],
  render: paint,
  destroy: (el, ctx) => clearInterval(timers.get(ctx.id)),
});
