import { register } from '../core/widgets.js';
import { getForecast, describe, emoji, unitSym } from '../core/weather-data.js';
import { h } from '../core/util.js';

async function paint(el, ctx) {
  const c = ctx.config;
  const loc = c.location?.lat != null ? c.location : ctx.settings.location;
  const units = c.units || ctx.settings.units;
  const box = h('div.weather-w');
  el.replaceChildren(box);
  box.append(h('div.muted', 'Loading weather…'));
  try {
    const d = await getForecast(loc, units);
    const u = unitSym(units), cur = d.current;
    const wind = `${Math.round(cur.wind_speed_10m)} ${units === 'imperial' ? 'mph' : 'km/h'}`;
    box.replaceChildren(
      h('div.wx-now',
        h('span.wx-emoji', { 'aria-hidden': true }, emoji(cur.weather_code)),
        h('div',
          h('div.wx-temp', `${Math.round(cur.temperature_2m)}${u}`, h('span.wx-desc', ` ${describe(cur.weather_code)}`)),
          h('div.wx-meta', `${loc.name || 'Location'} · feels ${Math.round(cur.apparent_temperature)}${u} · ${cur.relative_humidity_2m}% humidity · wind ${wind}`))),
    );
    if (c.showForecast) {
      const strip = h('div.wx-strip', { role: 'list' });
      const n = Math.min(c.days || 5, d.daily.time.length);
      for (let i = 0; i < n; i++) {
        const day = new Date(d.daily.time[i] + 'T12:00');
        strip.append(h('div.wx-day', { role: 'listitem', title: describe(d.daily.weather_code[i]) },
          h('div.wx-dn', i === 0 ? 'Today' : day.toLocaleDateString(undefined, { weekday: 'short' })),
          h('div.wx-emoji', { 'aria-hidden': true }, emoji(d.daily.weather_code[i])),
          h('div.wx-hl', `${Math.round(d.daily.temperature_2m_max[i])}°`, h('span.muted', ` ${Math.round(d.daily.temperature_2m_min[i])}°`)),
          d.daily.precipitation_probability_max?.[i] != null && h('div.wx-pop', `💧${d.daily.precipitation_probability_max[i]}%`)));
      }
      box.append(strip);
    }
  } catch (e) {
    console.warn('weather', e);
    box.replaceChildren(h('div.err', 'Weather unavailable. ', h('button.link', { onclick: () => ctx.rerender() }, 'Retry')));
  }
}

register({
  type: 'weather',
  name: 'Weather',
  icon: '🌤️',
  description: 'Current conditions + forecast strip (Open-Meteo).',
  refreshEvery: 600,
  defaults: { location: null, units: '', showForecast: true, days: 5 },
  schema: [
    { key: 'location', label: 'Location (blank = use Settings → General)', type: 'location', allowEmpty: true },
    { key: 'units', label: 'Units', type: 'select', options: [['', 'Use global'], ['imperial', '°F / mph'], ['metric', '°C / km/h']] },
    { key: 'showForecast', label: 'Show forecast strip', type: 'checkbox' },
    { key: 'days', label: 'Forecast days', type: 'number', min: 1, max: 7 },
  ],
  render: (el, ctx) => paint(el, ctx),
  refresh: (el, ctx) => paint(el, ctx),
});
