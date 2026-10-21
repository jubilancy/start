import { register } from '../core/widgets.js';
import { getForecast, describe } from '../core/weather-data.js';
import { h } from '../core/util.js';

// Tokens: {timeofday} {name} {weather} {temp} {date} {time}
function fill(tpl, vals) {
  const frag = document.createDocumentFragment();
  tpl.split('\n').forEach((line, li, lines) => {
    const re = /\{(\w+)\}/g;
    let last = 0, m;
    while ((m = re.exec(line))) {
      frag.append(line.slice(last, m.index));
      const v = vals[m[1]];
      frag.append(v instanceof Node ? v : v == null ? m[0] : h('span', { dataset: { token: m[1] } }, v));
      last = re.lastIndex;
    }
    frag.append(line.slice(last));
    if (li < lines.length - 1) frag.append(h('br'));
  });
  return frag;
}

function timeOfDay(date = new Date()) {
  const hr = date.getHours();
  return hr < 12 ? 'Morning' : hr < 18 ? 'Afternoon' : 'Evening';
}

async function paint(el, ctx) {
  const c = ctx.config;
  const now = new Date();
  const vals = {
    timeofday: timeOfDay(now), name: c.name || '',
    date: now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    time: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    weather: 'loading…', temp: '',
  };
  const h1 = el.querySelector('h1');
  h1.replaceChildren(fill(c.template, vals));
  if (!/\{(weather|temp)\}/.test(c.template)) return;
  try {
    const d = await getForecast();
    vals.weather = `${describe(d.current.weather_code)} (${Math.round(d.current.temperature_2m)}${ctx.settings.units === 'imperial' ? '°F' : '°C'})`;
    vals.temp = `${Math.round(d.current.temperature_2m)}°`;
  } catch (e) {
    console.warn('greeting weather', e);
    vals.weather = 'unavailable'; vals.temp = '';
  }
  h1.replaceChildren(fill(c.template, vals));
}

register({
  type: 'greeting',
  name: 'Greeting',
  icon: '👋',
  description: 'Time-of-day headline with live weather tokens.',
  refreshEvery: 60,
  defaults: { name: '', template: 'Good {timeofday},\nThe weather is currently {weather}.' },
  schema: [
    { key: 'name', label: 'Your name (for {name})', type: 'text' },
    { key: 'template', label: 'Template', type: 'textarea', rows: 4,
      help: 'Tokens: {timeofday} {name} {weather} {temp} {date} {time}. New line = line break. Weather uses the location in Settings → General.' },
  ],
  render(el, ctx) {
    el.replaceChildren(h('div.headline', h('h1')));
    return paint(el, ctx);
  },
  refresh: (el, ctx) => paint(el, ctx),
});
