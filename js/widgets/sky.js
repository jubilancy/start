import { register } from '../core/widgets.js';
import { h } from '../core/util.js';
import { getForecast } from '../core/weather-data.js';

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14); // a known new moon (UTC)

/** 0 = new, 0.5 = full */
export function moonPhase(date = new Date()) {
  const days = (date.getTime() - NEW_MOON_REF) / 86400000;
  return ((days / SYNODIC) % 1 + 1) % 1;
}
export const illumination = f => (1 - Math.cos(2 * Math.PI * f)) / 2;
export function phaseName(f) {
  const names = [['New moon', '🌑'], ['Waxing crescent', '🌒'], ['First quarter', '🌓'], ['Waxing gibbous', '🌔'], ['Full moon', '🌕'], ['Waning gibbous', '🌖'], ['Last quarter', '🌗'], ['Waning crescent', '🌘']];
  return names[Math.floor(f * 8 + 0.5) % 8];
}
export function nextPhase(target, from = new Date()) { // target 0 (new) or 0.5 (full)
  const f = moonPhase(from);
  let d = ((target - f + 1) % 1) * SYNODIC;
  if (d < 0.01) d += SYNODIC;
  return new Date(from.getTime() + d * 86400000);
}

async function paint(el, ctx) {
  const now = new Date();
  const f = moonPhase(now);
  const [name, icon] = phaseName(f);
  const day = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const box = h('div.sky', h('div.sky-moon', h('span.sky-ico', { 'aria-hidden': true }, icon),
    h('div', h('strong', name), h('div.muted', `${Math.round(illumination(f) * 100)}% lit · next full ${day(nextPhase(0.5, now))} · next new ${day(nextPhase(0, now))}`))));
  el.replaceChildren(box);
  if (ctx.config.sun) {
    try {
      const d = await getForecast();
      const r = new Date(d.daily.sunrise[0]), s = new Date(d.daily.sunset[0]);
      const t = x => x.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const len = (s - r) / 60000;
      box.append(h('div.muted', `🌅 ${t(r)}  ·  🌇 ${t(s)}  ·  ${Math.floor(len / 60)}h ${Math.round(len % 60)}m daylight (${ctx.settings.location.name || 'location'}${d.daily.uv_index_max?.[0] != null ? ` · UV ${Math.round(d.daily.uv_index_max[0])}` : ''})`));
    } catch { box.append(h('div.muted', 'Sunrise/sunset unavailable')); }
  }
}

register({
  type: 'sky',
  name: 'Moon & sun',
  icon: '🌙',
  description: 'Moon phase (computed locally) and sunrise/sunset from Open-Meteo.',
  refreshEvery: 1800,
  defaults: { sun: true },
  schema: [{ key: 'sun', label: 'Show sunrise / sunset (uses global location)', type: 'checkbox' }],
  render: paint,
  refresh: paint,
});
